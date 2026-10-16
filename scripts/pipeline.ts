// Pure helpers for the collection pipeline (no I/O, unit-tested).
import type { Sources, Video } from "../lib/schema.ts"

/** Subset of a YouTube Data API v3 `videos.list` item we rely on. */
export type YouTubeItem = {
  id: string
  snippet: {
    title: string
    description: string
    channelId: string
    channelTitle: string
    publishedAt: string
    liveBroadcastContent?: string
    thumbnails?: Record<string, { url: string }>
  }
  contentDetails: { duration: string }
  status: { embeddable: boolean; privacyStatus: string; uploadStatus?: string }
}

/** "PT1H2M3S" -> 3723. Returns NaN for unsupported formats (e.g. "P1D"). */
export function parseIsoDuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return NaN
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

/** Reason the candidate is rejected, or null when it passes. */
export function excludeReason(
  item: YouTubeItem,
  sources: Sources,
  knownYoutubeIds: Set<string>
): string | null {
  const { snippet, status } = item
  const sec = parseIsoDuration(item.contentDetails.duration)
  const text = `${snippet.title}\n${snippet.description}`.toLowerCase()
  if (knownYoutubeIds.has(item.id)) return "duplicate"
  if (sources.excludeChannelIds.includes(snippet.channelId))
    return "excluded channel"
  const kw = sources.excludeKeywords.find((k) => text.includes(k.toLowerCase()))
  if (kw) return `excluded keyword: ${kw}`
  if (snippet.liveBroadcastContent && snippet.liveBroadcastContent !== "none")
    return "live"
  if (status.privacyStatus !== "public") return "not public"
  if (!(sec >= sources.minDurationSec && sec <= sources.maxDurationSec))
    return `duration ${sec}s out of range`
  return null
}

const bestThumbnail = (t: YouTubeItem["snippet"]["thumbnails"] = {}) =>
  (t.maxres ?? t.standard ?? t.high ?? t.medium ?? t.default)?.url ?? ""

/** New unreviewed, unpublished record. AI fields stay empty until enrichment. */
export function toVideo(item: YouTubeItem, source: string, now: string): Video {
  return {
    id: item.id,
    youtubeId: item.id,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
    publishedAt: item.snippet.publishedAt,
    durationSec: parseIsoDuration(item.contentDetails.duration),
    embeddable: item.status.embeddable,
    summary: "",
    learningPoints: [],
    audience: [],
    prerequisites: "",
    genreId: null,
    subGenreId: null,
    tags: [],
    difficulty: null,
    depth: null,
    editorNote: "",
    featured: false,
    collectedAt: now,
    lastCheckedAt: now,
    source,
    aiStatus: "pending",
    reviewStatus: "unreviewed",
    status: "pending",
  }
}

/**
 * Apply an availability check to an existing record.
 * `item` undefined = the video no longer exists (deleted or private).
 */
export function applyCheck(
  video: Video,
  item: YouTubeItem | undefined,
  now: string
): Video {
  const gone = !item || item.status.privacyStatus === "private"
  return {
    ...video,
    lastCheckedAt: now,
    embeddable: item ? item.status.embeddable : video.embeddable,
    status: gone && video.status !== "rejected" ? "archived" : video.status,
  }
}

/** YouTube timedtext XML -> plain text (cue texts joined, entities decoded). */
export function parseTranscript(xml: string): string {
  const decode = (s: string) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  return [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => decode(m[1]).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
}
