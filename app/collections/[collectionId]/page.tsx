import { notFound } from "next/navigation"
import { Breadcrumb, PageHead } from "@/components/elements/layout"
import { VideoCard } from "@/components/elements/video-card"
import {
  collections,
  genreName,
  getCollection,
  pageMeta,
  SITE_URL,
  staticParams,
} from "@/lib/data"

type Props = { params: Promise<{ collectionId: string }> }

export const dynamicParams = false
export const generateStaticParams = () =>
  staticParams(
    "collectionId",
    collections.map((c) => c.id)
  )

export const generateMetadata = async ({ params }: Props) => {
  const c = getCollection((await params).collectionId)
  if (!c) return {}
  return pageMeta(c.title, c.description, `/collections/${c.id}/`)
}

const Page = async ({ params }: Props) => {
  const c = getCollection((await params).collectionId)
  if (!c) notFound()

  return (
    <>
      <Breadcrumb
        siteUrl={SITE_URL}
        items={[
          { name: "トップ", href: "/" },
          { name: "特集", href: "/#collections" },
          { name: c.title, href: `/collections/${c.id}/` },
        ]}
      />
      <PageHead
        eyebrow={`Learning route — ${c.steps.length} steps`}
        title={c.title}
        description={c.description}
      />
      <ol className="steps">
        {c.steps.map((s) => (
          <li className="step" key={s.videoId}>
            <div>
              {s.note && <p className="step-note">{s.note}</p>}
              <VideoCard
                video={s.video}
                genreName={genreName[s.video.genreId ?? ""]}
              />
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

export default Page
