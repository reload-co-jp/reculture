import Link from "next/link"
import { FC } from "react"
import { SectionHead } from "@/components/elements/layout"
import { VideoRow } from "@/components/elements/video-card"
import { collections, genreName, genres, videos } from "@/lib/data"
import { filterVideos } from "@/lib/video"

const Page: FC = () => {
  const recommended = filterVideos(videos, { sort: "recommended" }).slice(0, 6)
  const short = filterVideos(videos, { length: "short", sort: "newest" }).slice(
    0,
    3
  )
  const newest = filterVideos(videos, { sort: "newest" }).slice(0, 6)

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Reculture — a library of curiosity</p>
        <h1>
          知ることから、
          <br />
          世界を再発見する。
        </h1>
        <p>
          YouTubeにある良質な教養動画を、ジャンル・対象者・難易度・視聴時間で整理しました。
          まだ知らない分野への入り口を、ここから探してください。
        </p>
        <form className="hero-search" action="/videos/" role="search">
          <label htmlFor="hero-q" className="visually-hidden">
            キーワード検索
          </label>
          <input
            id="hero-q"
            type="search"
            name="q"
            placeholder="気になるテーマを入力（例：哲学、宇宙、経済）"
          />
          <button className="button" type="submit">
            探す
          </button>
        </form>
        <p className="hero-links">
          または <Link href="/genres/">ジャンルから探索する</Link>
        </p>
      </section>

      <section className="section" aria-labelledby="genres">
        <SectionHead title="ジャンル" href="/genres/" />
        <div className="genre-grid" id="genres">
          {genres.map((g, i) => (
            <Link key={g.id} href={`/genres/${g.id}/`} className="genre-item">
              <span className="num">No.{String(i + 1).padStart(2, "0")}</span>
              <h3>{g.name}</h3>
              <p>{g.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead title="おすすめ動画" href="/videos/" />
        <VideoRow genreName={genreName} list={recommended} />
      </section>

      <section className="section">
        <SectionHead title="10分未満で学べる" href="/videos/?length=short" />
        <VideoRow genreName={genreName} list={short} />
      </section>

      <section className="section">
        <SectionHead title="新着動画" href="/videos/?sort=newest" />
        <VideoRow genreName={genreName} list={newest} />
      </section>

      <section className="section" id="collections">
        <SectionHead title="テーマ別特集" />
        {collections.length ? (
          <div className="collection-list">
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}/`}
                className="collection-item"
              >
                <p className="eyebrow">{c.steps.length} steps</p>
                <h3>{c.title}</h3>
                <p>{c.description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty">特集は準備中です。</p>
        )}
      </section>
    </>
  )
}

export default Page
