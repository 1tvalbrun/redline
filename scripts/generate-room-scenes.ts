// Provisions the three verdict-film boardroom stills.
//
// The verdict film composites the panel with act_two: a pre-rendered group
// still (this script's output) driven by the speaker's talking-head clip.
// act_two re-renders every frame from the still, so anything the still
// invents that the driver doesn't control — a held folder, an open mouth —
// flickers in the film. So the stills must be prop-free and closed-mouthed;
// the speaker's mouth is supplied by the driving clip at film time.
//
// One template for all three, with explicit gender + seat cues so the
// center seat is always the intended speaker (the earlier prompt let the
// model recenter, which needed a per-speaker rewrite). gen4_image tags each
// reference image and the prompt addresses them with @Tag.
//
// Run (node 23.6+ runs .ts natively; needs the Runway key):
//   RUNWAY_KEY=$(npx convex env get RUNWAYML_API_SECRET) \
//     node scripts/generate-room-scenes.ts
//
// Prints, per scene, the Convex storage URL to set as VERDICT_ROOM_SCENE_*.
// Reference images are the committed avatar PNGs, downscaled with sips to
// stay under gen4_image's data-URI size limit.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"

const RUNWAY_KEY = process.env.RUNWAY_KEY
const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://compassionate-wolf-381.convex.cloud"
const RUNWAY_API = "https://api.dev.runwayml.com"

if (!RUNWAY_KEY) {
  console.error("Set RUNWAY_KEY (e.g. RUNWAY_KEY=$(npx convex env get RUNWAYML_API_SECRET))")
  process.exit(1)
}

type Panelist = { file: string; tag: string; article: "The man" | "The woman" }

const PANEL: Record<"victoria" | "marcus" | "sarah", Panelist> = {
  victoria: { file: "public/avatars/victoria-chen.png", tag: "Victoria", article: "The woman" },
  marcus: { file: "public/avatars/marcus-rivera.png", tag: "Marcus", article: "The man" },
  sarah: { file: "public/avatars/sarah-okafor.png", tag: "Sarah", article: "The woman" },
}

// VERDICT_ROOM_SCENE_<envKey>: which panelist is centered, and the seating.
const SCENES: { envKey: "VC" | "TC" | "TA"; center: keyof typeof PANEL; left: keyof typeof PANEL; right: keyof typeof PANEL }[] = [
  { envKey: "VC", center: "victoria", left: "marcus", right: "sarah" },
  { envKey: "TC", center: "marcus", left: "victoria", right: "sarah" },
  { envKey: "TA", center: "sarah", left: "victoria", right: "marcus" },
]

const prompt = (c: Panelist, l: Panelist, r: Panelist) =>
  `Three people seated side by side at a dark boardroom table facing the camera, ` +
  `cinematic warm key light, deep shadows, shallow depth of field, muted film grade. ` +
  `${c.article} @${c.tag} sits in the CENTER seat, lit brightest, looking directly ` +
  `at the camera with a neutral attentive expression, lips closed. ` +
  `${l.article} @${l.tag} sits on the LEFT seat, silent, lips closed, in shadow. ` +
  `${r.article} @${r.tag} sits on the RIGHT seat, silent, lips closed, in shadow. ` +
  `All three have their hands resting flat and empty on the table — no folders, ` +
  `no papers, no pens, no cups, nothing held. Arms still, relaxed posture, ` +
  `shoulders squared to camera. Nothing on the table surface. ` +
  `Static locked-off camera. Photorealistic, editorial, serious tone.`

// Downscale a committed avatar PNG to a data URI small enough for gen4_image.
const refDataUri = (file: string): string => {
  const out = join(tmpdir(), `${file.replace(/\W/g, "_")}-1600.jpg`)
  execFileSync("sips", ["-Z", "1600", "-s", "format", "jpeg", file, "--out", out], {
    stdio: "ignore",
  })
  return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`
}

const H = {
  Authorization: `Bearer ${RUNWAY_KEY}`,
  "Content-Type": "application/json",
  "X-Runway-Version": "2024-11-06",
}

const generate = async (promptText: string, referenceImages: { uri: string; tag: string }[]): Promise<Buffer> => {
  const create = await fetch(`${RUNWAY_API}/v1/text_to_image`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ model: "gen4_image", promptText, ratio: "1920:1080", referenceImages }),
  })
  const created = await create.json()
  if (!create.ok) throw new Error(`gen4_image rejected: ${JSON.stringify(created)}`)
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000))
    const task = await (await fetch(`${RUNWAY_API}/v1/tasks/${created.id}`, { headers: H })).json()
    if (task.status === "SUCCEEDED") {
      const bytes = await (await fetch(task.output[0])).arrayBuffer()
      return Buffer.from(new Uint8Array(bytes))
    }
    if (task.status === "FAILED") throw new Error(`gen4_image failed: ${JSON.stringify(task.failure ?? task)}`)
  }
}

const uploadToConvex = async (convex: ConvexHttpClient, png: Buffer): Promise<string> => {
  const uploadUrl = await convex.mutation(api.materials.generateUploadUrl, {})
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: new Uint8Array(png),
  })
  const { storageId } = await res.json()
  const url = await convex.query(api.materials.storageUrl, { storageId })
  if (!url) throw new Error("storage.getUrl returned null")
  return url
}

const main = async () => {
  // Optional args filter which scenes to (re)generate, e.g. "VC TC". No args
  // → all three. Lets a failed eye-check regenerate only the misses.
  const only = new Set(process.argv.slice(2).map((a) => a.toUpperCase()))
  const outDir = process.env.SCENES_OUT ?? tmpdir()
  const convex = new ConvexHttpClient(CONVEX_URL)
  const refs = Object.values(PANEL).map((p) => ({ uri: refDataUri(p.file), tag: p.tag }))

  const results: Record<string, string> = {}
  for (const scene of SCENES) {
    if (only.size > 0 && !only.has(scene.envKey)) continue
    const c = PANEL[scene.center]
    const l = PANEL[scene.left]
    const r = PANEL[scene.right]
    console.log(`[${scene.envKey}] generating — ${c.tag} centered…`)
    const png = await generate(prompt(c, l, r), refs)
    const localPath = join(outDir, `scene-${scene.envKey}-${scene.center}.png`)
    writeFileSync(localPath, png)
    const url = await uploadToConvex(convex, png)
    results[scene.envKey] = url
    console.log(`[${scene.envKey}] done → local ${localPath}`)
    console.log(`[${scene.envKey}]        → ${url}`)
  }

  console.log("\nSet these env vars, then redeploy:")
  for (const [key, url] of Object.entries(results)) {
    console.log(`  npx convex env set VERDICT_ROOM_SCENE_${key} "${url}"`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
