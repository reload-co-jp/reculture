import Link from "next/link"
import { FC } from "react"

/** Symbol: an orbit (the world) with a point of discovery on it. */
export const Mark: FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle
      cx="16"
      cy="16"
      r="11"
      fill="none"
      stroke="#202B3C"
      strokeWidth="2"
    />
    <path
      d="M7 21 Q16 9 25 11"
      fill="none"
      stroke="#202B3C"
      strokeWidth="1.2"
    />
    <circle cx="25" cy="11" r="4" fill="#C66B4E" />
  </svg>
)

export const Logo: FC = () => (
  <Link href="/" className="logo" aria-label="Reculture トップへ">
    <Mark />
    <span>Reculture</span>
  </Link>
)

const NAV = [
  { href: "/videos/", label: "動画を探す" },
  { href: "/genres/", label: "ジャンル" },
  { href: "/#collections", label: "特集" },
  { href: "/about/", label: "サイトについて" },
]

export const Header: FC = () => (
  <header className="site-header">
    <div className="container">
      <Logo />
      <nav className="nav" aria-label="メインナビゲーション">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
      </nav>
      <form className="header-search" action="/videos/" role="search">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle
            cx="7"
            cy="7"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <label htmlFor="header-q" className="visually-hidden">
          キーワード検索
        </label>
        <input
          id="header-q"
          type="search"
          name="q"
          placeholder="キーワードで探す"
        />
      </form>
    </div>
  </header>
)

export const Footer: FC = () => (
  <footer className="site-footer">
    <div className="container">
      <div>
        <Logo />
        <p style={{ marginTop: 12 }}>知ることから、世界を再発見する。</p>
      </div>
      <nav aria-label="フッターナビゲーション">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  </footer>
)

export const PageHead: FC<{
  eyebrow: string
  title: string
  description?: string
}> = ({ eyebrow, title, description }) => (
  <div className="page-head">
    <p className="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    {description && <p>{description}</p>}
  </div>
)

export const SectionHead: FC<{ title: string; href?: string }> = ({
  title,
  href,
}) => (
  <div className="section-head">
    <h2>{title}</h2>
    {href && (
      <Link href={href} className="more">
        すべて見る
      </Link>
    )}
  </div>
)

export type Crumb = { name: string; href: string }

/** Visible breadcrumb + matching BreadcrumbList structured data. */
export const Breadcrumb: FC<{ items: Crumb[]; siteUrl: string }> = ({
  items,
  siteUrl,
}) => (
  <>
    <ol className="breadcrumb" aria-label="パンくずリスト">
      {items.map((c, i) => (
        <li key={c.href}>
          {i < items.length - 1 ? <Link href={c.href}>{c.name}</Link> : c.name}
        </li>
      ))}
    </ol>
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: siteUrl + c.href,
        })),
      }}
    />
  </>
)

export const JsonLd: FC<{ data: object }> = ({ data }) => (
  <script
    type="application/ld+json"
    // Escape "<" so data can never close the script tag.
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    }}
  />
)
