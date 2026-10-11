import { describe, expect, it } from "vitest"
import { validateData, type Video } from "./schema"
import genres from "@/data/genres.json"
import sources from "@/data/sources.json"
import sample from "@/data/sample/videos.json"

const video = (over: Partial<Video> = {}): Video => ({
  ...(sample[0] as Video),
  ...over,
})
const validate = (videos: unknown[], collections: unknown[] = []) =>
  validateData({ videos, genres, collections, sources })

describe("validateData", () => {
  it("accepts the bundled data", () => {
    expect(validate([video()])).toEqual([])
  })

  it("rejects duplicate YouTube IDs", () => {
    const errors = validate([video(), video({ id: "other" })])
    expect(errors.some((e) => e.includes("youtubeId: duplicate"))).toBe(true)
  })

  it("rejects wrong types and enum values", () => {
    const errors = validate([
      video({ durationSec: "10" as never, status: "public" as never }),
    ])
    expect(errors).toContain("videos[0].durationSec: number >= 0 expected")
    expect(errors.some((e) => e.startsWith("videos[0].status"))).toBe(true)
  })

  it("requires review before approval", () => {
    const errors = validate([video({ reviewStatus: "unreviewed" })])
    expect(
      errors.some((e) => e.includes("approved requires reviewStatus"))
    ).toBe(true)
  })

  it("allows an unreviewed pending video with empty AI fields", () => {
    expect(
      validate([
        video({
          status: "pending",
          reviewStatus: "unreviewed",
          summary: "",
          genreId: null,
        }),
      ])
    ).toEqual([])
  })

  it("rejects unknown genres and collection videos", () => {
    const errors = validate(
      [video({ genreId: "nope" })],
      [
        {
          id: "c",
          title: "t",
          description: "",
          steps: [{ videoId: "missing", note: "" }],
        },
      ]
    )
    expect(errors.some((e) => e.includes('unknown genre "nope"'))).toBe(true)
    expect(errors.some((e) => e.includes('unknown video "missing"'))).toBe(true)
  })
})
