import Link from "next/link"
import { FC } from "react"
import type { Video } from "@/lib/schema"
import { DIFFICULTY_LABEL, formatDuration } from "@/lib/video"

export const VideoCard: FC<{ video: Video; genreName?: string }> = ({
  video,
  genreName,
}) => (
  <article className="card">
    <Link href={`/videos/${video.id}/`} tabIndex={-1} aria-hidden="true">
      <div className="thumb">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <div className="thumb-placeholder">Reculture</div>
        )}
        <span className="duration">
          <span className="visually-hidden">再生時間 </span>
          {formatDuration(video.durationSec)}
        </span>
      </div>
    </Link>
    <div className="card-body">
      {genreName && <p className="card-genre">{genreName}</p>}
      <h3 className="card-title">
        <Link href={`/videos/${video.id}/`}>{video.title}</Link>
      </h3>
      <p className="card-channel">{video.channelTitle}</p>
      {video.summary && <p className="card-summary">{video.summary}</p>}
      <div className="tags">
        {video.status === "pending" && (
          <span className="tag tag-pending">承認待ち</span>
        )}
        {video.difficulty && (
          <span className="tag tag-level">
            難易度：{DIFFICULTY_LABEL[video.difficulty]}
          </span>
        )}
        <span className="tag">{formatDuration(video.durationSec)}</span>
      </div>
    </div>
  </article>
)

export const VideoRow: FC<{
  list: Video[]
  genreName: Record<string, string>
  empty?: string
}> = ({ list, genreName, empty = "公開中の動画はまだありません。" }) =>
  list.length ? (
    <div className="video-grid">
      {list.map((v) => (
        <VideoCard
          key={v.id}
          video={v}
          genreName={genreName[v.genreId ?? ""]}
        />
      ))}
    </div>
  ) : (
    <p className="empty">{empty}</p>
  )
