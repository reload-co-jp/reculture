// Daily pipeline: check existing videos, collect new candidates from YouTube,
// enrich them with the LLM, validate, and save as unapproved (`pending`).
//
// Env: YOUTUBE_API_KEY (required), ANTHROPIC_API_KEY (optional; enrichment is
// skipped without it), LLM_MODEL (optional).
// Usage: node scripts/collect.ts [--dry-run]
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import Anthropic from "@anthropic-ai/sdk"
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
  toVideo,
  type YouTubeItem,
} from "./pipeline.ts"

const DATA = new URL("../data/", import.meta.url)
const dryRun = process.argv.includes("--dry-run")
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
YouTube動画のメタデータ（タイトル・チャンネル・説明文・長さ）だけを根拠に、掲載用の下書きを日本語で作成します。

- 与えられた情報から確認できないことは推測で補わないでください。判断できない項目は null、空文字、または空配列にしてください。
- relevant: ジャンル一覧のいずれかに該当する、知識や考え方を学べる教養・解説動画なら true。娯楽・雑談・ニュース速報・商品紹介・受験テクニックのみ等は false。
- summary: 2〜3文、120字程度。動画で扱う内容を事実ベースで。誇張や宣伝的表現は避ける。
- learningPoints: 学べることを3〜5個、各40字以内。説明文から読み取れない場合は少なくてよい。
- audience: 想定される対象者を選択肢から1〜2個。
- prerequisites: 必要な前提知識を短く。不要なら「特になし」、判断できなければ空文字。
- genreId / subGenreId: ジャンル一覧から最も適切なもの。subGenreId は選んだ genreId に属するものだけ。該当なしは null。
- tags: 重要なキーワードを3〜6個。
- difficulty: beginner=前提知識なしで理解できる / intermediate=基礎知識が必要 / advanced=専門的。
- depth: overview=概要紹介 / standard=標準的な解説 / deep=専門的な掘り下げ。`

async function enrich(
  client: Anthropic,
  video: Video,
  genres: Genre[],
  description: string
) {
  const genreList = genres
    .map(
      (g) =>
        `- ${g.id}（${g.name}）: ${g.subGenres.map((s) => `${s.id}（${s.name}）`).join(", ")}`
    )
    .join("\n")
  const response = await client.beta.messages.create({
    model: process.env.LLM_MODEL || "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: enrichmentSchema(genres) },
    },
    messages: [
      {
        role: "user",
        content: `ジャンル一覧:\n${genreList}\n\n<video>\nタイトル: ${video.title}\nチャンネル: ${video.channelTitle}\n長さ: ${Math.round(video.durationSec / 60)}分\n説明文:\n${description}\n</video>`,
      },
    ],
  })
  if (response.stop_reason !== "end_turn")
    throw new Error(`stop_reason=${response.stop_reason}`)
  const text = response.content.find((b) => b.type === "text")
  if (!text || text.type !== "text") throw new Error("no text output")
  const { relevant, ...out } = JSON.parse(text.text)
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

  // 2. Collect candidate IDs from keywords and channels.
  const candidates = new Map<string, string>() // youtubeId -> source
  const queries = [
    ...sources.keywords.map((k) => ({
      source: `keyword:${k.q}`,
      query: { q: k.q },
    })),
    ...sources.channels.map((c) => ({
      source: `channel:${c.channelId}`,
      query: { channelId: c.channelId, order: "date" },
    })),
  ]
  for (const { source, query } of queries) {
    try {
      for (const id of await search(sources, query))
        if (!candidates.has(id)) candidates.set(id, source)
    } catch (e) {
      await log("error", "search", `${source}: ${(e as Error).message}`)
      if (e instanceof QuotaError) break
    }
  }

  // 3. Fetch details, dedupe and filter, cap per run.
  const known = new Set(videos.map((v) => v.youtubeId))
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
  if (!process.env.ANTHROPIC_API_KEY) {
    await log("info", "enrich", "ANTHROPIC_API_KEY not set; skipped")
  } else {
    const client = new Anthropic()
    const targetGenres = genres.filter((g) =>
      sources.targetGenreIds.includes(g.id)
    )
    const todo = videos
      .filter((v) => v.status === "pending" && v.aiStatus !== "done")
      .slice(0, sources.maxPerRun)
    const missing = todo
      .filter((v) => !descriptions.has(v.youtubeId))
      .map((v) => v.youtubeId)
    try {
      for (const item of await videoDetails(missing))
        descriptions.set(item.id, item.snippet.description)
    } catch (e) {
      await log("error", "enrich", `description fetch: ${(e as Error).message}`)
    }
    for (const v of todo) {
      const i = videos.indexOf(v)
      try {
        const fields = await enrich(
          client,
          v,
          targetGenres,
          descriptions.get(v.youtubeId) ?? ""
        )
        videos[i] = { ...v, ...fields, aiStatus: "done" }
        enriched++
      } catch (e) {
        videos[i] = { ...v, aiStatus: "failed" }
        await log("error", "enrich", `${v.id}: ${(e as Error).message}`)
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
