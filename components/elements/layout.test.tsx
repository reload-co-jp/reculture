import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Breadcrumb, Footer, Header, JsonLd } from "./layout"

describe("Header", () => {
  it("renders logo, navigation and search", () => {
    render(<Header />)
    expect(screen.getAllByText("Reculture")[0]).toBeInTheDocument()
    for (const label of ["動画を探す", "ジャンル", "特集", "サイトについて"])
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument()
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q")
  })
})

describe("Footer", () => {
  it("renders the tagline", () => {
    render(<Footer />)
    expect(
      screen.getByText("知ることから、世界を再発見する。")
    ).toBeInTheDocument()
  })
})

describe("Breadcrumb", () => {
  it("links all but the last item", () => {
    render(
      <Breadcrumb
        siteUrl="https://example.com"
        items={[
          { name: "トップ", href: "/" },
          { name: "現在地", href: "/here/" },
        ]}
      />
    )
    expect(screen.getByRole("link", { name: "トップ" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "現在地" })).toBeNull()
  })
})

describe("JsonLd", () => {
  it("escapes < so data cannot close the script tag", () => {
    const { container } = render(<JsonLd data={{ x: "</script>" }} />)
    expect(container.innerHTML).not.toContain("</script><")
    expect(container.querySelector("script")!.innerHTML).toContain("\\u003c")
  })
})
