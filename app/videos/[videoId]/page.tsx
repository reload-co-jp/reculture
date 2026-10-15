import Link from "next/link"
import { notFound } from "next/navigation"
import { ReviewButtons } from "@/components/elements/review-buttons"
import { Breadcrumb, JsonLd, SectionHead } from "@/components/elements/layout"
import { VideoRow } from "@/components/elements/video-card"
import {
  genreName,
  getGenre,
  getVideo,
  pageMeta,
  SITE_URL,
  staticParams,
  videos,
} from "@/lib/data"
import {
  DEPTH_LABEL,
  DIFFICULTY_LABEL,
  formatDuration,
  isoDuration,
  relatedVideos,
} from "@/lib/video"

type Props = { params: Promise<{ videoId: string }> }

export const dynamicParams = false
export const generateStaticParams = () =>
  staticParams(
    "videoId",
    videos.map((v) => v.id)
  )

export const generateMetadata = async ({ params }: Props) => {
  const video = getVideo((await params).videoId)
  if (!video) return {}
  return pageMeta(video.title, video.summary, `/videos/${video.id}/`)
}

const Page = async ({ params }: Props) => {
  const video = getVideo((await params).videoId)
  if (!video) notFound()
  const genre = getGenre(video.genreId)
  const subGenre = genre?.subGenres.find((s) => s.id === video.subGenreId)
  const embedUrl = `https://www.youtube-nocookie.com/embed/${video.youtubeId}`

  return (
    <>
      <Breadcrumb
        siteUrl={SITE_URL}
        items={[
          { name: "トップ", href: "/" },
          ...(genre
            ? [{ name: genre.name, href: `/genres/${genre.id}/` }]
            : [{ name: "動画を探す", href: "/videos/" }]),
          { name: video.title, href: `/videos/${video.id}/` },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: video.title,
          description: video.summary,
          ...(video.thumbnailUrl && { thumbnailUrl: video.thumbnailUrl }),
          uploadDate: video.publishedAt,
          duration: isoDuration(video.durationSec),
          contentUrl: video.url,
          ...(video.embeddable && { embedUrl }),
          author: { "@type": "Organization", name: video.channelTitle },
        }}
      />

      <div className="detail-head">
        {genre && (
          <Link href={`/genres/${genre.id}/`} className="eyebrow">
            {genre.name}
            {subGenre && ` / ${subGenre.name}`}
          </Link>
        )}
        <h1>{video.title}</h1>
        <div className="meta">
          <span>{video.channelTitle}</span>
          <span>{formatDuration(video.durationSec)}</span>
          {video.status === "pending" && (
            <>
              <span className="tag tag-pending">承認待ち</span>
              <ReviewButtons id={video.id} />
            </>
          )}
          {video.difficulty && (
            <span className="tag tag-level">
              難易度：{DIFFICULTY_LABEL[video.difficulty]}
            </span>
          )}
          <span>公開日 {video.publishedAt.slice(0, 10)}</span>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          <div className="player">
            {video.embeddable ? (
              <iframe
                src={embedUrl}
                title={video.title}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <a
                className="player-link"
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTubeで視聴する ↗
              </a>
            )}
          </div>
          <a
            className="watch-link"
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTubeで開く ↗
          </a>

          <div className="prose">
            <h2>要約</h2>
            <p>{video.summary}</p>
            {video.learningPoints.length > 0 && (
              <>
                <h2>学べること</h2>
                <ul className="points">
                  {video.learningPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            )}
            {video.editorNote && (
              <>
                <h2>編集者の補足</h2>
                <p className="note">{video.editorNote}</p>
              </>
            )}
          </div>
        </div>

        <aside className="side-box">
          <dl>
            <dt>対象者</dt>
            <dd>{video.audience.join("、") || "—"}</dd>
            <dt>前提知識</dt>
            <dd>{video.prerequisites || "—"}</dd>
            <dt>難易度</dt>
            <dd>
              {video.difficulty ? DIFFICULTY_LABEL[video.difficulty] : "—"}
            </dd>
            <dt>内容の深さ</dt>
            <dd>{video.depth ? DEPTH_LABEL[video.depth] : "—"}</dd>
            <dt>視聴時間</dt>
            <dd>{formatDuration(video.durationSec)}</dd>
            <dt>キーワード</dt>
            <dd className="tags">
              {video.tags.length
                ? video.tags.map((t) => (
                    <Link
                      key={t}
                      className="tag"
                      href={`/videos/?q=${encodeURIComponent(t)}`}
                    >
                      {t}
                    </Link>
                  ))
                : "—"}
            </dd>
          </dl>
        </aside>
      </div>

      <section className="section">
        <SectionHead title="関連動画" />
        <VideoRow
          list={relatedVideos(video, videos)}
          genreName={genreName}
          empty="関連動画はまだありません。"
        />
      </section>
    </>
  )
}

export default Page
