# Reculture

知ることから、世界を再発見する。

YouTube 上の教養動画をジャンル別に整理し、内容・対象者・難易度・視聴時間から探せるキュレーションメディア。Next.js の静的エクスポートで GitHub Pages に配信する。データベースは使わず、`data/*.json` がデータの正本。

## 構成

```
app/                     ページ（すべて静的生成）
  page.tsx               /
  videos/                /videos, /videos/[videoId]
  genres/                /genres, /genres/[genreId]
  collections/           /collections/[collectionId]
  about/                 /about
  sitemap.ts, robots.ts  sitemap.xml, robots.txt
components/elements/     レイアウト・動画カード・検索UI
lib/schema.ts            データ型とバリデーション（サイトとスクリプトで共有）
lib/video.ts             検索・絞り込み・並び替え・表示用ヘルパー
lib/data.ts              JSON 読み込み（approved のみ公開）
scripts/collect.ts       日次の収集・確認・AI 要約パイプライン
scripts/validate.ts      data/*.json の検証
data/
  videos.json            動画（公開状態を含む）
  genres.json            ジャンル・サブジャンル
  collections.json       特集・学習ルート
  sources.json           収集設定
  logs/YYYY-MM.jsonl     収集ログ・エラー記録
  sample/                デザイン確認用サンプル（本番では使われない）
```

## 開発

```bash
pnpm install
pnpm dev                       # 本番データ（data/videos.json）で起動
RECULTURE_SAMPLE=1 pnpm dev    # サンプルデータで起動（デザイン確認用）
pnpm test                      # ユニットテスト
pnpm typecheck && pnpm lint
pnpm build                     # データ検証 → out/ に静的出力
```

サンプルデータ（`data/sample/`）は実在しないダミー動画。`RECULTURE_SAMPLE=1` を明示した時だけ読み込まれる。

## 環境変数・Secrets

| 名前                | 種別             | 用途                                                            |
| ------------------- | ---------------- | --------------------------------------------------------------- |
| `YOUTUBE_API_KEY`   | Secret           | YouTube Data API v3（収集に必須）                               |
| `ANTHROPIC_API_KEY` | Secret           | AI 要約・分類（未設定なら AI 処理をスキップ）                   |
| `LLM_MODEL`         | Variable（任意） | 使用モデル。既定 `claude-opus-5-5`                              |

ローカルでは `YOUTUBE_API_KEY=... ANTHROPIC_API_KEY=... pnpm collect -- --dry-run` で書き込みなしの試行ができる。

## 自動収集（.github/workflows/collect.yml）

毎日 03:00 JST に実行（手動実行も可）。

1. 公開中・承認待ちの動画を再確認し、削除・非公開は `archived`、埋め込み不可は `embeddable: false` にする
2. `sources.json` のキーワード・チャンネルから候補を検索
3. 登録済み YouTube ID の重複、除外キーワード・除外チャンネル、ライブ、動画時間範囲外を除外し、`maxPerRun` 件まで追加
4. LLM で教養動画として該当するか判定（非該当は `rejected`）し、要約・学べること・対象者・前提知識・ジャンル（`targetGenreIds` から選択）・タグ・難易度・内容の深さを推定（失敗分は翌日再試行）
5. スキーマ検証に通った場合のみ `videos.json` に保存（新規は必ず `status: "pending"`）
6. `data/` をコミットし、デプロイワークフローを起動

エラーは `data/logs/YYYY-MM.jsonl` に記録し、Actions の annotation にも表示する。API キーはログに出さない。

## 承認・公開フロー

管理画面はなし。`data/videos.json` を直接編集する。

1. `status: "pending"` の動画の要約・分類を確認し、必要なら修正する。AI が判断できなかった項目は空のまま残っている。推測で埋めない
2. 公開する場合は `reviewStatus: "reviewed"`、`status: "approved"` にする（任意で `editorNote`、おすすめ表示用の `featured: true`）
3. 公開しない場合は `status: "rejected"`
4. main に push すると検証・テスト・ビルド・デプロイが走る

`approved` には `reviewed`・要約・ジャンルが必須で、満たさない場合はビルドが失敗する。サイトに出るのは `approved` のみ。

特集は `data/collections.json` に `{ id, title, description, steps: [{ videoId, note }] }` で学習順に記述する。

## GitHub Pages 設定

Settings → Pages → Source を「GitHub Actions」に設定する。リポジトリ名のサブパスで公開する場合は `next.config.js` に `basePath` を追加する。
