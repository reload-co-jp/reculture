"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FC, useState } from "react"
import { AUDIENCES, type Genre, type Video } from "@/lib/schema"
import {
  DEPTH_LABEL,
  DIFFICULTY_LABEL,
  filterVideos,
  LENGTHS,
  SORTS,
  type Filters,
} from "@/lib/video"
import { VideoCard } from "./video-card"

const KEYS = [
  "q",
  "genre",
  "difficulty",
  "audience",
  "length",
  "depth",
  "sort",
] as const

const Select: FC<{
  id: string
  label: string
  value: string
  options: Record<string, string>
  onChange: (v: string) => void
}> = ({ id, label, value, options, onChange }) => (
  <div className="filter-group">
    <label htmlFor={id}>{label}</label>
    <select
      id={id}
      className="field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">すべて</option>
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  </div>
)

/** Search / filter / sort UI. State lives in the URL query so results are shareable. */
export const VideoBrowser: FC<{ videos: Video[]; genres: Genre[] }> = ({
  videos,
  genres,
}) => {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const filters: Filters = Object.fromEntries(
    KEYS.map((k) => [k, params.get(k) ?? ""])
  )
  const set = (key: keyof Filters, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const results = filterVideos(videos, filters)
  const genreName = Object.fromEntries(genres.map((g) => [g.id, g.name]))
  const active = KEYS.some((k) => k !== "sort" && filters[k])

  return (
    <div className="list-layout">
      <aside className={`filters${open ? " open" : ""}`}>
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          絞り込み{active ? "（適用中）" : ""}
        </button>
        <div className="filter-body">
          <div className="filter-group">
            <label htmlFor="f-q">キーワード</label>
            <input
              id="f-q"
              type="search"
              className="field"
              value={filters.q}
              placeholder="タイトル・要約・タグなど"
              onChange={(e) => set("q", e.target.value)}
            />
          </div>
          <Select
            id="f-genre"
            label="ジャンル"
            value={filters.genre!}
            options={genreName}
            onChange={(v) => set("genre", v)}
          />
          <Select
            id="f-difficulty"
            label="難易度"
            value={filters.difficulty!}
            options={DIFFICULTY_LABEL}
            onChange={(v) => set("difficulty", v)}
          />
          <Select
            id="f-audience"
            label="対象者"
            value={filters.audience!}
            options={Object.fromEntries(AUDIENCES.map((a) => [a, a]))}
            onChange={(v) => set("audience", v)}
          />
          <Select
            id="f-length"
            label="視聴時間"
            value={filters.length!}
            options={Object.fromEntries(
              Object.entries(LENGTHS).map(([k, v]) => [k, v.label])
            )}
            onChange={(v) => set("length", v)}
          />
          <Select
            id="f-depth"
            label="内容の深さ"
            value={filters.depth!}
            options={DEPTH_LABEL}
            onChange={(v) => set("depth", v)}
          />
          {active && (
            <button
              type="button"
              className="reset"
              onClick={() =>
                router.replace(
                  filters.sort ? `${pathname}?sort=${filters.sort}` : pathname,
                  { scroll: false }
                )
              }
            >
              条件をリセット
            </button>
          )}
        </div>
      </aside>

      <div>
        <div className="list-toolbar">
          <p aria-live="polite">
            <strong>{results.length}</strong> 件の動画
          </p>
          <label htmlFor="f-sort" className="visually-hidden">
            並び替え
          </label>
          <select
            id="f-sort"
            className="field"
            value={filters.sort || "recommended"}
            onChange={(e) => set("sort", e.target.value)}
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {results.length ? (
          <div className="video-grid results" key={JSON.stringify(filters)}>
            {results.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                genreName={genreName[v.genreId ?? ""]}
              />
            ))}
          </div>
        ) : (
          <p className="empty">条件に合う動画が見つかりませんでした。</p>
        )}
      </div>
    </div>
  )
}
