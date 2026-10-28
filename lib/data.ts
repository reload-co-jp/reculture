import type { Collection, Genre, Video } from "./schema"
import genresJson from "@/data/genres.json"
import videosJson from "@/data/videos.json"
import collectionsJson from "@/data/collections.json"
import sampleVideosJson from "@/data/sample/videos.json"
import sampleCollectionsJson from "@/data/sample/collections.json"

// Sample data is for local design checks only (`RECULTURE_SAMPLE=1 pnpm dev`).
// It is never used unless explicitly enabled.
const useSample = process.env.RECULTURE_SAMPLE === "1"

export const SITE_NAME = "Reculture"
export const SITE_URL = "https://reculture.reload.co.jp"

export const genres = genresJson as Genre[]
export const genreName: Record<string, string> = Object.fromEntries(
  genres.map((g) => [g.id, g.name])
)

const allVideos = (useSample ? sampleVideosJson : videosJson) as Video[]

// `next dev` also shows pending videos for review; builds publish approved only.
const visible = new Set(
  process.env.NODE_ENV === "development"
    ? ["approved", "pending"]
    : ["approved"]
)
export const videos = allVideos.filter((v) => visible.has(v.status))

const videoById = new Map(videos.map((v) => [v.id, v]))
export const getVideo = (id: string) => videoById.get(id)
export const getGenre = (id: string | null) => genres.find((g) => g.id === id)

/** Tags with enough videos to earn their own page (thinner ones stay search links). */
export const TAG_PAGE_MIN = 3
export const tagVideos = new Map<string, Video[]>()
for (const v of videos)
  for (const t of v.tags) tagVideos.set(t, [...(tagVideos.get(t) ?? []), v])
export const tagPages = [...tagVideos]
  .filter(([, l]) => l.length >= TAG_PAGE_MIN)
  .map(([t]) => t)
/** Tags that have their own page, most frequent in `list` first. */
export const topTags = (list: Video[], exclude?: string, limit = 12) => {
  const count = new Map<string, number>()
  for (const v of list)
    for (const t of v.tags)
      if (t !== exclude && tagPages.includes(t))
        count.set(t, (count.get(t) ?? 0) + 1)
  return [...count]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t)
}
export const tagHref = (t: string) =>
  tagPages.includes(t)
    ? `/tags/${encodeURIComponent(t)}/`
    : `/videos/?q=${encodeURIComponent(t)}`

/** Collections with steps resolved to published videos only. */
export const collections = (
  (useSample ? sampleCollectionsJson : collectionsJson) as Collection[]
)
  .map((c) => ({
    ...c,
    steps: c.steps.flatMap((s) => {
      const video = videoById.get(s.videoId)
      return video ? [{ ...s, video }] : []
    }),
  }))
  .filter((c) => c.steps.length > 0)

export const getCollection = (id: string) =>
  collections.find((c) => c.id === id)

/** Per-page metadata with canonical URL (path must end with "/"). */
export const pageMeta = (title: string, description: string, path: string) => ({
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    title,
    description,
    url: path,
    siteName: SITE_NAME,
    locale: "ja_JP",
  },
  twitter: { card: "summary" as const, title, description },
})

/** ItemList structured data linking a list page to its video pages. */
export const itemListLd = (list: Video[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: list.map((v, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${SITE_URL}/videos/${v.id}/`,
    name: v.title,
  })),
})

/**
 * `output: "export"` fails on an empty generateStaticParams result, so emit a
 * placeholder that renders notFound() until real data exists.
 */
export const staticParams = <K extends string>(key: K, ids: string[]) =>
  (ids.length ? ids : ["_"]).map((id) => ({ [key]: id }) as Record<K, string>)
