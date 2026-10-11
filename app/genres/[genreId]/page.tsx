import { notFound } from "next/navigation"
import { Breadcrumb, PageHead, SectionHead } from "@/components/elements/layout"
import { VideoRow } from "@/components/elements/video-card"
import {
  genreName,
  genres,
  getGenre,
  pageMeta,
  SITE_URL,
  staticParams,
  videos,
} from "@/lib/data"
import { filterVideos } from "@/lib/video"

type Props = { params: Promise<{ genreId: string }> }

export const dynamicParams = false
export const generateStaticParams = () =>
  staticParams(
    "genreId",
    genres.map((g) => g.id)
  )

export const generateMetadata = async ({ params }: Props) => {
  const genre = getGenre((await params).genreId)
  if (!genre) return {}
  return pageMeta(
    `${genre.name}の教養動画`,
    genre.description,
    `/genres/${genre.id}/`
  )
}

const Page = async ({ params }: Props) => {
  const genre = getGenre((await params).genreId)
  if (!genre) notFound()
  const list = filterVideos(videos, { genre: genre.id })

  return (
    <>
      <Breadcrumb
        siteUrl={SITE_URL}
        items={[
          { name: "トップ", href: "/" },
          { name: "ジャンル", href: "/genres/" },
          { name: genre.name, href: `/genres/${genre.id}/` },
        ]}
      />
      <PageHead
        eyebrow="Genre"
        title={genre.name}
        description={genre.description}
      />
      {genre.subGenres.map((sub) => {
        const subList = list.filter((v) => v.subGenreId === sub.id)
        return subList.length ? (
          <section className="section" key={sub.id}>
            <SectionHead title={sub.name} />
            <VideoRow list={subList} genreName={genreName} />
          </section>
        ) : null
      })}
      <section className="section">
        <SectionHead
          title={`${genre.name}のすべての動画（${list.length}）`}
          href={list.length ? `/videos/?genre=${genre.id}` : undefined}
        />
        <VideoRow
          list={list}
          genreName={genreName}
          empty="このジャンルの公開動画はまだありません。"
        />
      </section>
    </>
  )
}

export default Page
