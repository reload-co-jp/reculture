"use client"
import { useRouter } from "next/navigation"
import { FC, useState } from "react"

/** Dev-only (pending videos never reach builds). Calls app/api/review. */
export const ReviewButtons: FC<{ id: string }> = ({ id }) => {
  const router = useRouter()
  const [error, setError] = useState("")
  const review = async (status: "approved" | "rejected") => {
    const res = await fetch("/api/review/", {
      method: "POST",
      body: JSON.stringify({ id, status }),
    })
    // A rejected video disappears from the site, so leave its page.
    if (res.ok)
      return status === "rejected" ? router.push("/videos/") : router.refresh()
    const body = await res.json().catch(() => ({}))
    setError(body.errors?.join("\n") ?? body.error ?? `HTTP ${res.status}`)
  }
  return (
    <>
      <button
        type="button"
        className="tag tag-pending"
        onClick={() => review("approved")}
      >
        承認する
      </button>
      <button type="button" className="tag" onClick={() => review("rejected")}>
        却下する
      </button>
      {error && <span className="tag tag-pending">{error}</span>}
    </>
  )
}
