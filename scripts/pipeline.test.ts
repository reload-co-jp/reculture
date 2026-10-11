import { describe, expect, it } from "vitest"
import type { Sources } from "../lib/schema"
import { validateData } from "../lib/schema"
import genres from "../data/genres.json"
import {
  applyCheck,
  excludeReason,
  parseIsoDuration,
  toVideo,
  type YouTubeItem,
} from "./pipeline"

const sources: Sources = {
  language: "ja",
  regionCode: "JP",
  keywords: [],
  channels: [],
  targetGenreIds: [],
  minDurationSec: 180,
  maxDurationSec: 3600,
  publishedWithinDays: 365,
  excludeKeywords: ["#shorts"],
  excludeChannelIds: ["UCbad"],
  maxPerRun: 10,
}

const item = (
  over: Partial<YouTubeItem["snippet"]> = {},
  duration = "PT12M3S"
): YouTubeItem => ({
  id: "abcdefghijk",
  snippet: {
    title: "テスト動画",
    description: "説明",
    channelId: "UCgood",
    channelTitle: "テストチャンネル",
    publishedAt: "2026-01-01T00:00:00Z",
    liveBroadcastContent: "none",
    thumbnails: {
      high: { url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" },
    },
    ...over,
  },
  contentDetails: { duration },
  status: { embeddable: true, privacyStatus: "public" },
})

describe("parseIsoDuration", () => {
  it("parses", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723)
    expect(parseIsoDuration("PT45S")).toBe(45)
    expect(parseIsoDuration("P1D")).toBeNaN()
  })
})

describe("excludeReason", () => {
  it("passes a valid candidate", () => {
    expect(excludeReason(item(), sources, new Set())).toBeNull()
  })
  it("rejects duplicates, excluded channels/keywords, live, and out-of-range durations", () => {
    expect(excludeReason(item(), sources, new Set(["abcdefghijk"]))).toBe(
      "duplicate"
    )
    expect(
      excludeReason(item({ channelId: "UCbad" }), sources, new Set())
    ).toBe("excluded channel")
    expect(
      excludeReason(item({ title: "見て #Shorts" }), sources, new Set())
    ).toMatch("keyword")
    expect(
      excludeReason(item({ liveBroadcastContent: "live" }), sources, new Set())
    ).toBe("live")
    expect(excludeReason(item({}, "PT59S"), sources, new Set())).toMatch(
      "duration"
    )
    expect(excludeReason(item({}, "P1D"), sources, new Set())).toMatch(
      "duration"
    )
  })
})

describe("toVideo / applyCheck", () => {
  const now = "2026-10-12T00:00:00.000Z"
  const v = toVideo(item(), "keyword:test", now)

  it("creates a valid, unpublished, unreviewed record", () => {
    expect(v).toMatchObject({
      status: "pending",
      reviewStatus: "unreviewed",
      aiStatus: "pending",
      durationSec: 723,
    })
    expect(validateData({ videos: [v], genres, collections: [] })).toEqual([])
  })

  it("archives deleted or private videos and tracks embeddability", () => {
    const approved = { ...v, status: "approved" as const }
    expect(applyCheck(approved, undefined, now).status).toBe("archived")
    const priv = item()
    priv.status.privacyStatus = "private"
    expect(applyCheck(approved, priv, now).status).toBe("archived")
    const noEmbed = item()
    noEmbed.status.embeddable = false
    expect(applyCheck(approved, noEmbed, now)).toMatchObject({
      status: "approved",
      embeddable: false,
    })
  })
})
