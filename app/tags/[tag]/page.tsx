import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Breadcrumb,
  JsonLd,
  PageHead,
  SectionHead,
} from "@/components/elements/layout"
import { VideoRow } from "@/components/elements/video-card"
import {
  genreName,
  itemListLd,
  pageMeta,
  SITE_URL,
  staticParams,
  tagHref,
  tagPages,
  tagVideos,
  topTags,
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
  const list = tagVideos.get(tag)!
  const related = topTags(list, tag)

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
      <JsonLd data={itemListLd(list)} />
      <section className="section">
        <VideoRow list={list} genreName={genreName} />
      </section>
      {related.length > 0 && (
        <section className="section">
          <SectionHead title="関連キーワード" />
          <div className="tags">
            {related.map((t) => (
              <Link key={t} className="tag" href={tagHref(t)}>
                {t}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export default Page
