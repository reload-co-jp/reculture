// Validates data/*.json. Usage: node scripts/validate.ts
import { readFile } from "node:fs/promises"
import { validateData } from "../lib/schema.ts"

const read = async (name: string) =>
  JSON.parse(
    await readFile(new URL(`../data/${name}`, import.meta.url), "utf8")
  )

const errors = validateData({
  videos: await read("videos.json"),
  genres: await read("genres.json"),
  collections: await read("collections.json"),
  sources: await read("sources.json"),
})
const sample = validateData({
  videos: await read("sample/videos.json"),
  genres: await read("genres.json"),
  collections: await read("sample/collections.json"),
}).map((e) => `sample: ${e}`)

const all = [...errors, ...sample]
if (all.length) {
  console.error(all.join("\n"))
  process.exit(1)
}
console.log("data OK")
