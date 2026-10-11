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
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "")

export const genres = genresJson as Genre[]
export const genreName: Record<string, string> = Object.fromEntries(
  genres.map((g) => [g.id, g.name])
)

const allVideos = (useSample ? sampleVideosJson : videosJson) as Video[]

/** Only approved videos are ever published. */
export const videos = allVideos.filter((v) => v.status === "approved")

const videoById = new Map(videos.map((v) => [v.id, v]))
export const getVideo = (id: string) => videoById.get(id)
export const getGenre = (id: string | null) => genres.find((g) => g.id === id)

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
  openGraph: { title, description, url: path, siteName: SITE_NAME },
})

/**
 * `output: "export"` fails on an empty generateStaticParams result, so emit a
 * placeholder that renders notFound() until real data exists.
 */
export const staticParams = <K extends string>(key: K, ids: string[]) =>
  (ids.length ? ids : ["_"]).map((id) => ({ [key]: id }) as Record<K, string>)
