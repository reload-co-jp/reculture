import { notFound } from "next/navigation"
import { Breadcrumb, PageHead } from "@/components/elements/layout"
import { VideoRow } from "@/components/elements/video-card"
import {
  genreName,
  pageMeta,
  SITE_URL,
  staticParams,
  tagPages,
  tagVideos,
} from "@/lib/data"

type Props = { params: Promise<{ tag: string }> }

export const dynamicParams = false
export const generateStaticParams = () => staticParams("tag", tagPages)

// Params may arrive percent-encoded for non-ASCII segments.
const getTag = async ({ params }: Props) => {
  const tag = decodeURIComponent((await params).tag)
  return tagPages.includes(tag) ? tag : undefined
}

const description = (tag: string) =>
  `「${tag}」を学べるYouTubeの教養動画${tagVideos.get(tag)!.length}本を、要約・難易度・視聴時間つきで紹介。`

export const generateMetadata = async (props: Props) => {
  const tag = await getTag(props)
  if (!tag) return {}
  return pageMeta(
    `${tag}が学べる動画まとめ`,
    description(tag),
    `/tags/${encodeURIComponent(tag)}/`
  )
}

const Page = async (props: Props) => {
  const tag = await getTag(props)
  if (!tag) notFound()

  return (
    <>
      <Breadcrumb
        siteUrl={SITE_URL}
        items={[
          { name: "トップ", href: "/" },
          { name: "動画を探す", href: "/videos/" },
          { name: tag, href: `/tags/${encodeURIComponent(tag)}/` },
        ]}
      />
      <PageHead
        eyebrow="Keyword"
        title={`${tag}が学べる動画`}
        description={description(tag)}
      />
      <section className="section">
        <VideoRow list={tagVideos.get(tag)!} genreName={genreName} />
      </section>
    </>
  )
}

export default Page
