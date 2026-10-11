import { PageHead } from "@/components/elements/layout"
import { pageMeta } from "@/lib/data"

const description =
  "Recultureは、YouTube上の教養動画をジャンル別に整理し、自分に合った動画を探せるキュレーションメディアです。"

export const metadata = pageMeta("サイトについて", description, "/about/")

const Page = () => (
  <>
    <PageHead eyebrow="About" title="サイトについて" />
    <div className="prose about">
      <p>{description}</p>
      <h2>動画の選び方</h2>
      <p>
        設定したキーワード・ジャンル・チャンネルをもとに候補となる動画を毎日収集し、
        AIで要約・分類の下書きを作成します。そのうえで編集者が内容、要約、分類を確認し、
        承認した動画だけを掲載しています。
      </p>
      <h2>掲載情報について</h2>
      <ul className="points">
        <li>
          要約や学習ポイントは、動画のタイトルと説明文をもとに作成し、編集者が確認しています。
        </li>
        <li>
          動画の削除・非公開・埋め込み不可の状態は定期的に確認し、反映しています。
        </li>
        <li>
          動画の著作権は各動画の権利者に帰属します。動画はYouTubeの埋め込み機能またはリンクで紹介しています。
        </li>
      </ul>
    </div>
  </>
)

export default Page
