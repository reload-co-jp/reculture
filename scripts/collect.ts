// Daily pipeline: check existing videos, collect new candidates from YouTube,
// enrich them with the LLM, validate, and save as unapproved (`pending`).
//
// Env: YOUTUBE_API_KEY (required), LLM_MODEL (optional).
// Enrichment runs the `claude` CLI (Claude Code), so it uses its login
// (or CLAUDE_CODE_OAUTH_TOKEN in CI). Skipped when the CLI is missing.
// Usage: node scripts/collect.ts [--dry-run] [--regenerate]
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { promisify } from "node:util"
import {
  AUDIENCES,
  DEPTHS,
  DIFFICULTIES,
  validateData,
  type Genre,
  type Sources,
  type Video,
} from "../lib/schema.ts"
import {
  applyCheck,
  excludeReason,
  parseTranscript,
  toVideo,
  type YouTubeItem,
} from "./pipeline.ts"

const DATA = new URL("../data/", import.meta.url)
const dryRun = process.argv.includes("--dry-run")
// Skip searching and process every pending video still to do, uncapped.
const regenerate = process.argv.includes("--regenerate")
const now = new Date().toISOString()
const logFile = new URL(`logs/${now.slice(0, 7)}.jsonl`, DATA)

const readJson = async <T>(name: string) =>
  JSON.parse(await readFile(new URL(name, DATA), "utf8")) as T

let errorCount = 0
async function log(level: "info" | "error", step: string, message: string) {
  if (level === "error") errorCount++
  // `::error::` surfaces as an annotation in GitHub Actions.
  const prefix =
    level === "error" && process.env.GITHUB_ACTIONS ? "::error::" : ""
  console[level](`${prefix}[${step}] ${message}`)
  if (dryRun) return
  await mkdir(new URL("logs/", DATA), { recursive: true })
  await appendFile(
    logFile,
    JSON.stringify({ at: now, level, step, message }) + "\n"
  )
}

// ---------- YouTube ----------

class QuotaError extends Error {}

async function youtube<T>(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  url.search = new URLSearchParams({
    ...params,
    key: process.env.YOUTUBE_API_KEY!,
  }).toString()
  const res = await fetch(url)
  if (res.ok) return (await res.json()) as T
  // Never log the URL: it contains the API key.
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; errors?: { reason?: string }[] }
  }
  const reason = body.error?.errors?.[0]?.reason ?? ""
  const msg =
    `${path} ${res.status} ${reason} ${body.error?.message ?? ""}`.trim()
  throw /quota|rateLimit/i.test(reason) ? new QuotaError(msg) : new Error(msg)
}

async function videoDetails(ids: string[]) {
  const items: YouTubeItem[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const res = await youtube<{ items: YouTubeItem[] }>("videos", {
      part: "snippet,contentDetails,status",
      id: ids.slice(i, i + 50).join(","),
      maxResults: "50",
    })
    items.push(...res.items)
  }
  return items
}

async function search(sources: Sources, query: Record<string, string>) {
  const publishedAfter = new Date(
    Date.now() - sources.publishedWithinDays * 86400_000
  ).toISOString()
  const res = await youtube<{ items: { id: { videoId: string } }[] }>(
    "search",
    {
      part: "id",
      type: "video",
      maxResults: "25",
      relevanceLanguage: sources.language,
      regionCode: sources.regionCode,
      safeSearch: "strict",
      publishedAfter,
      ...query,
    }
  )
  return res.items.map((i) => i.id.videoId)
}

/** Recent uploads via the uploads playlist (1 unit vs 100 for search). */
async function channelUploads(sources: Sources, channelId: string) {
  const publishedAfter = Date.now() - sources.publishedWithinDays * 86400_000
  const res = await youtube<{
    items: { contentDetails: { videoId: string; videoPublishedAt?: string } }[]
  }>("playlistItems", {
    part: "contentDetails",
    playlistId: `UU${channelId.slice(2)}`,
    maxResults: "10",
  })
  return res.items
    .filter(
      (i) => +new Date(i.contentDetails.videoPublishedAt ?? 0) >= publishedAfter
    )
    .map((i) => i.contentDetails.videoId)
}

/** Spoken text from captions (manual preferred over auto). "" when none. */
async function fetchTranscript(youtubeId: string, language: string) {
  // ponytail: unofficial innertube endpoint (Data API captions need owner OAuth); may break or be blocked from CI IPs.
  const res = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: { clientName: "ANDROID", clientVersion: "20.10.38" },
        },
        videoId: youtubeId,
      }),
    }
  )
  if (!res.ok) throw new Error(`player ${res.status}`)
  const tracks: { baseUrl: string; languageCode: string; kind?: string }[] =
    (await res.json()).captions?.playerCaptionsTracklistRenderer
      ?.captionTracks ?? []
  const track =
    tracks.find((t) => t.languageCode === language && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode === language)
  if (!track) return ""
  const xml = await fetch(track.baseUrl.replace(/&fmt=\w+/, ""))
  if (!xml.ok) throw new Error(`timedtext ${xml.status}`)
  return parseTranscript(await xml.text())
}

// ---------- LLM ----------

function enrichmentSchema(genres: Genre[]) {
  const nullableEnum = (values: readonly string[]) => ({
    anyOf: [{ type: "string", enum: values }, { type: "null" }],
  })
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "relevant",
      "summary",
      "learningPoints",
      "transcriptSummary",
      "audience",
      "prerequisites",
      "genreId",
      "subGenreId",
      "tags",
      "difficulty",
      "depth",
    ],
    properties: {
      relevant: { type: "boolean" },
      summary: { type: "string" },
      learningPoints: { type: "array", items: { type: "string" } },
      transcriptSummary: { type: "string" },
      audience: { type: "array", items: { type: "string", enum: AUDIENCES } },
      prerequisites: { type: "string" },
      genreId: nullableEnum(genres.map((g) => g.id)),
      subGenreId: nullableEnum(
        genres.flatMap((g) => g.subGenres.map((s) => s.id))
      ),
      tags: { type: "array", items: { type: "string" } },
      difficulty: nullableEnum(DIFFICULTIES),
      depth: nullableEnum(DEPTHS),
    },
  }
}

const SYSTEM = `あなたは教養動画キュレーションサイトの編集アシスタントです。
YouTube動画のメタデータ（タイトル・チャンネル・説明文・長さ）と読み上げテキスト（字幕。ある場合のみ）だけを根拠に、掲載用の下書きを日本語で作成します。

- 与えられた情報から確認できないことは推測で補わないでください。判断できない項目は null、空文字、または空配列にしてください。
- relevant: ジャンル一覧のいずれかに該当する、知識や考え方を学べる教養・解説動画なら true。娯楽・雑談・ニュース速報・商品紹介・受験テクニックのみ等は false。
- summary: 2〜3文、120字程度。動画で扱う内容を事実ベースで。誇張や宣伝的表現は避ける。
- learningPoints: 学べることを3〜5個、各40字以内。説明文・読み上げテキストから読み取れない場合は少なくてよい。
- transcriptSummary: 読み上げテキストの内容を話の流れに沿って詳しく要約。導入・各論点（主張、根拠、具体例やエピソード、登場する人物・用語の説明）・結論を省かずに書く。1000〜2000字（短い動画は内容に応じて短くてよい）、4〜8段落、段落ごとに改行。自動字幕の誤認識は文脈から補正し、固有名詞が不確かなら書かない。読み上げテキストがなければ空文字。
- audience: 想定される対象者を選択肢から1〜2個。
- prerequisites: 必要な前提知識を短く。不要なら「特になし」、判断できなければ空文字。
- genreId / subGenreId: ジャンル一覧から最も適切なもの。subGenreId は選んだ genreId に属するものだけ。該当なしは null。
- tags: 重要なキーワードを3〜6個。
- difficulty: beginner=前提知識なしで理解できる / intermediate=基礎知識が必要 / advanced=専門的。
- depth: overview=概要紹介 / standard=標準的な解説 / deep=専門的な掘り下げ。`

/** Thrown when further enrichment in this run is pointless. */
class StopEnrich extends Error {}

async function enrich(
  video: Video,
  genres: Genre[],
  description: string,
  transcript: string
) {
  const genreList = genres
    .map(
      (g) =>
        `- ${g.id}（${g.name}）: ${g.subGenres.map((s) => `${s.id}（${s.name}）`).join(", ")}`
    )
    .join("\n")
  const prompt = `ジャンル一覧:\n${genreList}\n\n<video>\nタイトル: ${video.title}\nチャンネル: ${video.channelTitle}\n長さ: ${Math.round(video.durationSec / 60)}分\n説明文:\n${description}\n読み上げテキスト:\n${transcript.slice(0, 40_000) || "（なし）"}\n</video>`
  const args = [
    "-p",
    prompt,
    "--model",
    process.env.LLM_MODEL || "sonnet",
    "--effort",
    "low",
    "--system-prompt",
    SYSTEM,
    "--tools",
    "",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(enrichmentSchema(genres)),
  ]
  let stdout: string
  try {
    ;({ stdout } = await promisify(execFile)("claude", args, {
      timeout: 300_000,
      maxBuffer: 10_000_000,
    }))
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stdout?: string }
    if (err.code === "ENOENT") throw new StopEnrich("claude CLI not found")
    if (!err.stdout) throw e
    stdout = err.stdout // CLI exits non-zero on API errors; details are in JSON
  }
  const result = JSON.parse(stdout)
  if (result.is_error) {
    const msg = `${result.subtype} ${result.api_error_status ?? ""} ${result.result ?? ""}`
    if (result.api_error_status === 429) throw new StopEnrich(msg)
    throw new Error(msg)
  }
  if (!result.structured_output) throw new Error("no structured output")
  const { relevant, ...out } = result.structured_output
  const genre = genres.find((g) => g.id === out.genreId)
  return {
    ...out,
    // Off-topic videos stay recorded (for dedupe) but are never reviewed.
    ...(relevant ? {} : { status: "rejected" }),
    // Drop a sub-genre that does not belong to the chosen genre.
    subGenreId: genre?.subGenres.some((s) => s.id === out.subGenreId)
      ? out.subGenreId
      : null,
  } as Partial<Video>
}

// ---------- Main ----------

async function main() {
  if (!process.env.YOUTUBE_API_KEY)
    throw new Error("YOUTUBE_API_KEY is not set")
  const [sources, genres, collections, original] = await Promise.all([
    readJson<Sources>("sources.json"),
    readJson<Genre[]>("genres.json"),
    readJson<unknown>("collections.json"),
    readJson<Video[]>("videos.json"),
  ])
  const before = validateData({
    videos: original,
    genres,
    collections,
    sources,
  })
  if (before.length)
    throw new Error(`Invalid data before run:\n${before.join("\n")}`)
  let videos = original

  // 1. Re-check approved/pending videos for deletion, privacy, embeddability.
  try {
    const targets = videos.filter(
      (v) => v.status === "approved" || v.status === "pending"
    )
    const found = new Map(
      (await videoDetails(targets.map((v) => v.youtubeId))).map((i) => [
        i.id,
        i,
      ])
    )
    const changes: string[] = []
    videos = videos.map((v) => {
      if (!targets.includes(v)) return v
      const next = applyCheck(v, found.get(v.youtubeId), now)
      if (next.status !== v.status || next.embeddable !== v.embeddable)
        changes.push(
          `${v.id}: status=${next.status} embeddable=${next.embeddable}`
        )
      return next
    })
    for (const c of changes) await log("info", "check", c)
  } catch (e) {
    await log("error", "check", (e as Error).message)
  }

  // 2. Collect candidate IDs from keywords and channels
  // (sources.channels plus channels of approved videos).
  const known = new Set(videos.map((v) => v.youtubeId))
  const channelIds = [
    ...new Set([
      ...sources.channels.map((c) => c.channelId),
      ...videos.filter((v) => v.status === "approved").map((v) => v.channelId),
    ]),
  ].filter((id) => !sources.excludeChannelIds.includes(id))
  const queries = regenerate
    ? []
    : [
        ...sources.keywords.map((k) => ({
          source: `keyword:${k.q}`,
          ids: () => search(sources, { q: k.q }),
        })),
        ...channelIds.map((id) => ({
          source: `channel:${id}`,
          ids: () => channelUploads(sources, id),
        })),
      ]
  const hits = { keyword: [] as string[][], channel: [] as string[][] }
  for (const { source, ids } of queries) {
    try {
      for (const id of await ids())
        if (!known.has(id))
          hits[source.startsWith("keyword:") ? "keyword" : "channel"].push([
            id,
            source,
          ])
    } catch (e) {
      await log("error", "search", `${source}: ${(e as Error).message}`)
      if (e instanceof QuotaError) break
    }
  }
  // Alternate keyword/channel hits so neither starves the maxPerRun cap.
  const candidates = new Map<string, string>() // youtubeId -> source
  for (let i = 0; i < Math.max(hits.keyword.length, hits.channel.length); i++)
    for (const [id, source] of [hits.keyword[i], hits.channel[i]].filter(
      Boolean
    ))
      if (!candidates.has(id)) candidates.set(id, source)

  // 3. Fetch details, dedupe and filter, cap per run.
  const descriptions = new Map<string, string>()
  let added = 0
  try {
    const fresh = [...candidates.keys()].filter((id) => !known.has(id))
    for (const item of await videoDetails(fresh)) {
      if (added >= sources.maxPerRun) break
      const reason = excludeReason(item, sources, known)
      if (reason) continue
      videos.push(toVideo(item, candidates.get(item.id)!, now))
      descriptions.set(item.id, item.snippet.description)
      known.add(item.id)
      added++
    }
  } catch (e) {
    await log("error", "details", (e as Error).message)
  }

  // 4. LLM enrichment for pending videos (new ones, plus earlier failures).
  let enriched = 0
  {
    const targetGenres = genres.filter((g) =>
      sources.targetGenreIds.includes(g.id)
    )
    const todo = videos
      .filter(
        (v) =>
          v.status === "pending" &&
          (v.aiStatus !== "done" || v.transcriptSummary === undefined)
      )
      // New/failed first; then backfill transcript summaries for older ones.
      .sort((a, b) => +(a.aiStatus === "done") - +(b.aiStatus === "done"))
      .slice(0, regenerate ? Infinity : sources.maxPerRun)
    const missing = todo
      .filter((v) => !descriptions.has(v.youtubeId))
      .map((v) => v.youtubeId)
    try {
      for (const item of await videoDetails(missing))
        descriptions.set(item.id, item.snippet.description)
    } catch (e) {
      await log("error", "enrich", `description fetch: ${(e as Error).message}`)
    }
    let transcriptBlocked = false
    for (const v of todo) {
      const i = videos.indexOf(v)
      let transcript: string | undefined
      if (!transcriptBlocked) {
        try {
          transcript = await fetchTranscript(v.youtubeId, sources.language)
          await sleep(3000) // YouTube rate-limits caption fetches by IP.
        } catch (e) {
          const msg = (e as Error).message
          await log("error", "transcript", `${v.id}: ${msg}`)
          // Blocked for hours; the rest would fail too. Retried next run.
          if (msg.includes("429")) transcriptBlocked = true
        }
      }
      // No transcript and already enriched: nothing new to add, retry later.
      if (transcript === undefined && v.aiStatus === "done") continue
      try {
        const { transcriptSummary, ...fields } = await enrich(
          v,
          targetGenres,
          descriptions.get(v.youtubeId) ?? "",
          transcript ?? ""
        )
        videos[i] = {
          ...v,
          ...fields,
          // Leave unset when the fetch failed so the next run retries it.
          ...(transcript !== undefined && { transcriptSummary }),
          aiStatus: "done",
        }
        enriched++
      } catch (e) {
        videos[i] = { ...v, aiStatus: "failed" }
        await log("error", "enrich", `${v.id}: ${(e as Error).message}`)
        // Rate limited or no CLI: the rest would fail too. Retried next run.
        if (e instanceof StopEnrich) break
      }
    }
  }

  // 5. Validate before saving; never write invalid data.
  const errors = validateData({ videos, genres, collections, sources })
  if (errors.length) throw new Error(`Validation failed:\n${errors.join("\n")}`)

  await log(
    "info",
    "summary",
    `candidates=${candidates.size} added=${added} enriched=${enriched} errors=${errorCount}`
  )
  if (!dryRun)
    await writeFile(
      new URL("videos.json", DATA),
      JSON.stringify(videos, null, 2) + "\n"
    )
}

main().catch(async (e) => {
  await log("error", "fatal", (e as Error).message)
  process.exit(1)
})
