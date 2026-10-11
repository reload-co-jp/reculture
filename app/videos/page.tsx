import { Suspense } from "react"
import { PageHead } from "@/components/elements/layout"
import { VideoBrowser } from "@/components/elements/video-browser"
import { genres, pageMeta, videos } from "@/lib/data"

const description =
  "キーワード、ジャンル、難易度、対象者、視聴時間、内容の深さから教養動画を探せます。"

export const metadata = pageMeta("動画を探す", description, "/videos/")

const Page = () => (
  <>
    <PageHead eyebrow="Library" title="動画を探す" description={description} />
    <Suspense>
      <VideoBrowser videos={videos} genres={genres} />
    </Suspense>
  </>
)

export default Page
