import type { Metadata } from "next"
import { Footer, Header } from "@/components/elements/layout"
import { SITE_NAME, SITE_URL } from "@/lib/data"
import "./globals.css"

const description =
  "YouTube上の教養動画をジャンル別に整理。内容・対象者・難易度・視聴時間から、自分に合った動画を探せるキュレーションメディア。"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 知ることから、世界を再発見する。`,
    template: `%s | ${SITE_NAME}`,
  },
  description,
  alternates: { canonical: "/" },
  openGraph: { siteName: SITE_NAME, locale: "ja_JP", type: "website" },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="ja">
    <body>
      <Header />
      <main className="container">{children}</main>
      <Footer />
    </body>
  </html>
)
export default RootLayout
