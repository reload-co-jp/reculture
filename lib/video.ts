import type { Depth, Difficulty, Video } from "./schema"

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "入門",
  intermediate: "中級",
  advanced: "上級",
}

export const DEPTH_LABEL: Record<Depth, string> = {
  overview: "概要をつかむ",
  standard: "標準的な解説",
  deep: "専門的に掘り下げる",
}

export const LENGTHS = {
  short: { label: "10分未満", min: 0, max: 600 },
  medium: { label: "10〜30分", min: 600, max: 1800 },
  long: { label: "30分以上", min: 1800, max: Infinity },
} as const
export type Length = keyof typeof LENGTHS

export const SORTS = {
  recommended: "おすすめ順",
  newest: "新着順",
  shortest: "視聴時間が短い順",
  longest: "視聴時間が長い順",
} as const
export type Sort = keyof typeof SORTS

export const formatDuration = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** ISO 8601 duration for structured data (PT1H2M3S). */
export const isoDuration = (sec: number) =>
  `PT${Math.floor(sec / 3600)}H${Math.floor((sec % 3600) / 60)}M${sec % 60}S`

export type Filters = {
  q?: string
  genre?: string
  difficulty?: string
  audience?: string
  length?: string
  depth?: string
  sort?: string
}

const searchText = (v: Video) =>
  [v.title, v.summary, ...v.learningPoints, v.channelTitle, ...v.tags]
    .join("\n")
    .toLowerCase()

const byNewest = (a: Video, b: Video) =>
  b.publishedAt.localeCompare(a.publishedAt)

export function filterVideos(videos: Video[], f: Filters): Video[] {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean)
  const len = LENGTHS[f.length as Length]
  const result = videos.filter(
    (v) =>
      words.every((w) => searchText(v).includes(w)) &&
      (!f.genre || v.genreId === f.genre) &&
      (!f.difficulty || v.difficulty === f.difficulty) &&
      (!f.depth || v.depth === f.depth) &&
      (!f.audience ||
        v.audience.includes(f.audience as Video["audience"][0])) &&
      (!len || (v.durationSec >= len.min && v.durationSec < len.max))
  )
  const sorters: Record<Sort, (a: Video, b: Video) => number> = {
    recommended: (a, b) =>
      Number(b.featured) - Number(a.featured) || byNewest(a, b),
    newest: byNewest,
    shortest: (a, b) => a.durationSec - b.durationSec,
    longest: (a, b) => b.durationSec - a.durationSec,
  }
  return result.sort(sorters[f.sort as Sort] ?? sorters.recommended)
}

/** Same genre first, then shared tags. */
export function relatedVideos(video: Video, all: Video[], limit = 3) {
  const score = (v: Video) =>
    (v.genreId === video.genreId ? 10 : 0) +
    v.tags.filter((t) => video.tags.includes(t)).length
  return all
    .filter((v) => v.id !== video.id && score(v) > 0)
    .sort((a, b) => score(b) - score(a) || byNewest(a, b))
    .slice(0, limit)
}
