// Dev-only: list pending videos with approve/reject buttons.
import { PageHead } from "@/components/elements/layout"
import { ReviewButtons } from "@/components/elements/review-buttons"
import { VideoCard } from "@/components/elements/video-card"
import { genreName, videos } from "@/lib/data"

const Page = () => {
  const pending = videos.filter((v) => v.status === "pending")
  return (
    <>
      <PageHead
        eyebrow="Review"
        title="承認待ち"
        description={`${pending.length}本の動画が承認待ちです。`}
      />
      <section className="section">
        {pending.length ? (
          <div className="video-grid">
            {pending.map((v) => (
              <div key={v.id}>
                <VideoCard video={v} genreName={genreName[v.genreId ?? ""]} />
                <div className="tags">
                  <ReviewButtons id={v.id} stay />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">承認待ちの動画はありません。</p>
        )}
      </section>
    </>
  )
}

export default Page
