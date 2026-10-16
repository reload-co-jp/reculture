// Data types and validation shared by the site and the Node scripts.
// Keep this file free of imports so `node scripts/*.ts` can load it directly.

export const STATUSES = ["pending", "approved", "rejected", "archived"] as const
export const AI_STATUSES = ["pending", "done", "failed"] as const
export const REVIEW_STATUSES = ["unreviewed", "reviewed"] as const
export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const
export const DEPTHS = ["overview", "standard", "deep"] as const
export const AUDIENCES = [
  "はじめて学ぶ人",
  "学生",
  "社会人",
  "専門的に学びたい人",
] as const

export type Status = (typeof STATUSES)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type Depth = (typeof DEPTHS)[number]
export type Audience = (typeof AUDIENCES)[number]

export type Video = {
  id: string
  youtubeId: string
  title: string
  channelId: string
  channelTitle: string
  url: string
  thumbnailUrl: string
  publishedAt: string
  durationSec: number
  embeddable: boolean
  summary: string
  learningPoints: string[]
  /** Summary of the spoken content (captions). "" = no captions; absent = not yet tried. */
  transcriptSummary?: string
  audience: Audience[]
  prerequisites: string
  genreId: string | null
  subGenreId: string | null
  tags: string[]
  difficulty: Difficulty | null
  depth: Depth | null
  editorNote: string
  featured: boolean
  collectedAt: string
  lastCheckedAt: string
  source: string
  aiStatus: (typeof AI_STATUSES)[number]
  reviewStatus: (typeof REVIEW_STATUSES)[number]
  status: Status
}

export type Genre = {
  id: string
  name: string
  description: string
  subGenres: { id: string; name: string }[]
}

export type Collection = {
  id: string
  title: string
  description: string
  steps: { videoId: string; note: string }[]
}

export type Sources = {
  language: string
  regionCode: string
  keywords: { q: string; genreId: string }[]
  channels: { channelId: string; genreId: string }[]
  targetGenreIds: string[]
  minDurationSec: number
  maxDurationSec: number
  publishedWithinDays: number
  excludeKeywords: string[]
  excludeChannelIds: string[]
  maxPerRun: number
}

type Rule = [key: string, check: (v: unknown) => boolean, expected: string]

const str = (v: unknown) => typeof v === "string"
const nonEmpty = (v: unknown) => typeof v === "string" && v.trim() !== ""
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v)
const bool = (v: unknown) => typeof v === "boolean"
const date = (v: unknown) => str(v) && !Number.isNaN(Date.parse(v as string))
const strArr = (v: unknown) => Array.isArray(v) && v.every(str)
const oneOf =
  (list: readonly unknown[], nullable = false) =>
  (v: unknown) =>
    (nullable && v === null) || list.includes(v)
const nullableStr = (v: unknown) => v === null || str(v)
const slug = (v: unknown) => str(v) && /^[a-z0-9-]+$/.test(v as string)

const VIDEO_RULES: Rule[] = [
  ["id", slugOrYoutubeId, "URL-safe id"],
  ["youtubeId", (v) => str(v) && /^[\w-]{11}$/.test(v as string), "YouTube ID"],
  ["title", nonEmpty, "non-empty string"],
  ["channelId", str, "string"],
  ["channelTitle", nonEmpty, "non-empty string"],
  ["url", (v) => str(v) && (v as string).startsWith("https://"), "https URL"],
  ["thumbnailUrl", str, "string"],
  ["publishedAt", date, "ISO date"],
  ["durationSec", (v) => num(v) && (v as number) >= 0, "number >= 0"],
  ["embeddable", bool, "boolean"],
  ["summary", str, "string"],
  ["learningPoints", strArr, "string[]"],
  ["transcriptSummary", (v) => v === undefined || str(v), "string"],
  [
    "audience",
    (v) => Array.isArray(v) && v.every(oneOf(AUDIENCES)),
    AUDIENCES.join("|"),
  ],
  ["prerequisites", str, "string"],
  ["genreId", nullableStr, "string|null"],
  ["subGenreId", nullableStr, "string|null"],
  ["tags", strArr, "string[]"],
  ["difficulty", oneOf(DIFFICULTIES, true), DIFFICULTIES.join("|") + "|null"],
  ["depth", oneOf(DEPTHS, true), DEPTHS.join("|") + "|null"],
  ["editorNote", str, "string"],
  ["featured", bool, "boolean"],
  ["collectedAt", date, "ISO date"],
  ["lastCheckedAt", date, "ISO date"],
  ["source", str, "string"],
  ["aiStatus", oneOf(AI_STATUSES), AI_STATUSES.join("|")],
  ["reviewStatus", oneOf(REVIEW_STATUSES), REVIEW_STATUSES.join("|")],
  ["status", oneOf(STATUSES), STATUSES.join("|")],
]

function slugOrYoutubeId(v: unknown) {
  return str(v) && /^[\w-]+$/.test(v as string)
}

function checkRules(
  item: unknown,
  rules: Rule[],
  where: string,
  errors: string[]
) {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    errors.push(`${where}: object expected`)
    return
  }
  const obj = item as Record<string, unknown>
  for (const [key, check, expected] of rules) {
    if (!check(obj[key])) errors.push(`${where}.${key}: ${expected} expected`)
  }
}

function checkArray(value: unknown, name: string, errors: string[]) {
  if (Array.isArray(value)) return value
  errors.push(`${name}: array expected`)
  return []
}

/** Returns a list of human-readable errors. Empty list = valid. */
export function validateData(data: {
  videos: unknown
  genres: unknown
  collections: unknown
  sources?: unknown
}): string[] {
  const errors: string[] = []

  const genres = checkArray(data.genres, "genres", errors) as Genre[]
  genres.forEach((g, i) =>
    checkRules(
      g,
      [
        ["id", slug, "slug"],
        ["name", nonEmpty, "non-empty string"],
        ["description", str, "string"],
        [
          "subGenres",
          (v) =>
            Array.isArray(v) &&
            v.every((s) => s && slug(s.id) && nonEmpty(s.name)),
          "{id,name}[]",
        ],
      ],
      `genres[${i}]`,
      errors
    )
  )
  const genreIds = new Set(genres.map((g) => g.id))
  if (genreIds.size !== genres.length) errors.push("genres: duplicate id")

  const videos = checkArray(data.videos, "videos", errors) as Video[]
  const ids = new Set<string>()
  const youtubeIds = new Set<string>()
  videos.forEach((v, i) => {
    const where = `videos[${i}]`
    checkRules(v, VIDEO_RULES, where, errors)
    if (ids.has(v.id)) errors.push(`${where}.id: duplicate "${v.id}"`)
    if (youtubeIds.has(v.youtubeId))
      errors.push(`${where}.youtubeId: duplicate "${v.youtubeId}"`)
    ids.add(v.id)
    youtubeIds.add(v.youtubeId)
    if (v.genreId !== null && !genreIds.has(v.genreId))
      errors.push(`${where}.genreId: unknown genre "${v.genreId}"`)
    if (v.status === "approved") {
      if (v.reviewStatus !== "reviewed")
        errors.push(`${where}: approved requires reviewStatus "reviewed"`)
      if (!nonEmpty(v.summary) || v.genreId === null)
        errors.push(`${where}: approved requires summary and genreId`)
    }
  })

  const collections = checkArray(
    data.collections,
    "collections",
    errors
  ) as Collection[]
  collections.forEach((c, i) => {
    const where = `collections[${i}]`
    checkRules(
      c,
      [
        ["id", slug, "slug"],
        ["title", nonEmpty, "non-empty string"],
        ["description", str, "string"],
        [
          "steps",
          (v) =>
            Array.isArray(v) &&
            v.every((s) => s && str(s.videoId) && str(s.note)),
          "{videoId,note}[]",
        ],
      ],
      where,
      errors
    )
    c.steps?.forEach((s, j) => {
      if (!ids.has(s?.videoId))
        errors.push(`${where}.steps[${j}]: unknown video "${s?.videoId}"`)
    })
  })

  if (data.sources !== undefined) {
    const strOrIdList = (key: string) => (v: unknown) =>
      Array.isArray(v) &&
      v.every((x) => x && nonEmpty(x[key]) && slug(x.genreId))
    checkRules(
      data.sources,
      [
        ["language", nonEmpty, "non-empty string"],
        ["regionCode", nonEmpty, "non-empty string"],
        ["keywords", strOrIdList("q"), "{q,genreId}[]"],
        ["channels", strOrIdList("channelId"), "{channelId,genreId}[]"],
        ["targetGenreIds", strArr, "string[]"],
        ["minDurationSec", num, "number"],
        ["maxDurationSec", num, "number"],
        ["publishedWithinDays", num, "number"],
        ["excludeKeywords", strArr, "string[]"],
        ["excludeChannelIds", strArr, "string[]"],
        ["maxPerRun", num, "number"],
      ],
      "sources",
      errors
    )
  }

  return errors
}
