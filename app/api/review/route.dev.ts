// Dev-only: approve or reject a pending video by rewriting data/videos.json.
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import genres from "@/data/genres.json"
import collections from "@/data/collections.json"
import { validateData, type Video } from "@/lib/schema"

const FILE = join(process.cwd(), "data/videos.json")

export async function POST(req: Request) {
  const { id, status } = (await req.json()) as { id: string; status: string }
  if (status !== "approved" && status !== "rejected")
    return Response.json({ error: "bad status" }, { status: 400 })
  const videos = JSON.parse(await readFile(FILE, "utf8")) as Video[]
  const i = videos.findIndex((v) => v.id === id && v.status === "pending")
  if (i < 0) return Response.json({ error: "not pending" }, { status: 404 })
  videos[i] = { ...videos[i], reviewStatus: "reviewed", status }
  const errors = validateData({ videos, genres, collections }).filter((e) =>
    e.startsWith(`videos[${i}]`)
  )
  if (errors.length) return Response.json({ errors }, { status: 400 })
  await writeFile(FILE, JSON.stringify(videos, null, 2) + "\n")
  return Response.json({ ok: true })
}
