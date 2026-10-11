import type { MetadataRoute } from "next"
import { collections, genres, SITE_URL, videos } from "@/lib/data"

export const dynamic = "force-static"

const sitemap = (): MetadataRoute.Sitemap =>
  [
    "/",
    "/videos/",
    "/genres/",
    "/about/",
    ...genres.map((g) => `/genres/${g.id}/`),
    ...videos.map((v) => `/videos/${v.id}/`),
    ...collections.map((c) => `/collections/${c.id}/`),
  ].map((path) => ({ url: SITE_URL + path }))

export default sitemap
