import { describe, expect, it } from "vitest"
import type { Video } from "./schema"
import {
  filterVideos,
  formatDuration,
  isoDuration,
  relatedVideos,
} from "./video"
import sample from "@/data/sample/videos.json"

const videos = sample as Video[]

describe("formatDuration / isoDuration", () => {
  it("formats", () => {
    expect(formatDuration(65)).toBe("1:05")
    expect(formatDuration(3723)).toBe("1:02:03")
    expect(isoDuration(3723)).toBe("PT1H2M3S")
  })
})

describe("filterVideos", () => {
  it("searches across title, summary, points, channel and tags (AND, case-insensitive)", () => {
    expect(filterVideos(videos, { q: "哲学・思想 サンプル" }).length).toBe(3)
    expect(filterVideos(videos, { q: "存在しない語" })).toEqual([])
  })

  it("filters by genre, difficulty, audience, depth and length", () => {
    const r = filterVideos(videos, { genre: "history", difficulty: "beginner" })
    expect(
      r.every((v) => v.genreId === "history" && v.difficulty === "beginner")
    ).toBe(true)
    expect(
      filterVideos(videos, { length: "short" }).every(
        (v) => v.durationSec < 600
      )
    ).toBe(true)
    expect(
      filterVideos(videos, { depth: "deep" }).every((v) => v.depth === "deep")
    ).toBe(true)
    expect(
      filterVideos(videos, { audience: "学生" }).every((v) =>
        v.audience.includes("学生")
      )
    ).toBe(true)
  })

  it("sorts", () => {
    const newest = filterVideos(videos, { sort: "newest" })
    expect(newest[0].publishedAt >= newest[1].publishedAt).toBe(true)
    const shortest = filterVideos(videos, { sort: "shortest" })
    expect(shortest[0].durationSec).toBe(
      Math.min(...videos.map((v) => v.durationSec))
    )
    expect(filterVideos(videos, {})[0].featured).toBe(true)
  })

  it("does not mutate input order", () => {
    const ids = videos.map((v) => v.id)
    filterVideos(videos, { sort: "longest" })
    expect(videos.map((v) => v.id)).toEqual(ids)
  })
})

describe("relatedVideos", () => {
  it("prefers the same genre and excludes itself", () => {
    const r = relatedVideos(videos[0], videos)
    expect(r.map((v) => v.id)).not.toContain(videos[0].id)
    expect(r[0].genreId).toBe(videos[0].genreId)
  })
})
