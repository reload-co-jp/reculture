import Link from "next/link"
import { PageHead } from "@/components/elements/layout"
import { genres, pageMeta, videos } from "@/lib/data"

const description =
  "哲学、歴史、科学、芸術など、分野ごとに教養動画を整理しています。"

export const metadata = pageMeta("ジャンル一覧", description, "/genres/")

const Page = () => (
  <>
    <PageHead eyebrow="Genres" title="ジャンル一覧" description={description} />
    <div className="genre-grid">
      {genres.map((g, i) => (
        <Link key={g.id} href={`/genres/${g.id}/`} className="genre-item">
          <span className="num">No.{String(i + 1).padStart(2, "0")}</span>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 19 }}>{g.name}</h2>
          <p>{g.description}</p>
          <span className="count">
            {videos.filter((v) => v.genreId === g.id).length} 本の動画
          </span>
        </Link>
      ))}
    </div>
  </>
)

export default Page
