import { v, type Infer } from "convex/values"

// Single source for the audit contract: the schema table, the Convex
// mutations, and the TS types all derive from these validators.
export const citationValidator = v.object({
  source: v.string(),
  location: v.string(),
})

// Axis is optional only because audits generated before axis-tagging
// existed remain valid; new generations always tag it.
const axisValidator = v.optional(
  v.union(v.literal("market"), v.literal("customer"), v.literal("technical"), v.literal("gtm"))
)

// A claim without a citation cannot be constructed — grounding is the type.
export const claimValidator = v.object({
  text: v.string(),
  citation: citationValidator,
  axis: axisValidator,
})

export const gapValidator = v.object({
  severity: v.union(v.literal("blocker"), v.literal("gap")),
  kind: v.union(v.literal("absent"), v.literal("unsupported")),
  title: v.string(),
  detail: v.string(),
  axis: axisValidator,
})

export type Citation = Infer<typeof citationValidator>
export type Claim = Infer<typeof claimValidator>
export type Gap = Infer<typeof gapValidator>

export type AuditResult = {
  claims: Claim[]
  gaps: Gap[]
}

export const MAX_CLAIMS = 15
export const MAX_GAPS = 10

const normalize = (value: string) => value.trim().toLowerCase()

// 4a's extraction markers are the citable surface of each material.
// A material with no markers (DOCX) is citable as one "document".
export const locationsIn = (materialText: string): Set<string> => {
  const markers = [...materialText.matchAll(/\[(page \d+|slide \d+|sheet [^\]]+)\]/gi)].map(
    (match) => normalize(match[1])
  )
  return new Set(markers.length > 0 ? markers : ["document"])
}

type GroundingMaterial = { name: string; text: string }

export const field = (entry: unknown, key: string): unknown =>
  typeof entry === "object" && entry !== null
    ? (entry as Record<string, unknown>)[key]
    : undefined

export const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const parseSeverity = (value: string | undefined): Gap["severity"] =>
  value === "blocker" ? "blocker" : "gap"

const parseKind = (value: string | undefined): Gap["kind"] =>
  value === "unsupported" ? "unsupported" : "absent"

const AXES_SET: ReadonlySet<string> = new Set(["market", "customer", "technical", "gtm"])

const parseAxis = (value: string | undefined): Claim["axis"] =>
  value !== undefined && AXES_SET.has(value) ? (value as Claim["axis"]) : undefined

// Validates model output against the actual materials. Claims that cite a
// real source and location survive; everything else is demoted to an
// "unsupported" gap. The model cannot assert what it cannot cite.
export const groundAudit = (
  raw: { claims?: unknown; gaps?: unknown },
  materials: GroundingMaterial[]
): AuditResult => {
  const sources = new Map(
    materials.map((material) => [normalize(material.name), locationsIn(material.text)])
  )

  const claims: Claim[] = []
  const gaps: Gap[] = []

  const rawClaims: unknown[] = Array.isArray(raw.claims) ? raw.claims.slice(0, MAX_CLAIMS) : []
  for (const entry of rawClaims) {
    const text = asString(field(entry, "text"))
    if (!text) continue
    const source = asString(field(entry, "source"))
    const location = asString(field(entry, "location"))
    const axis = parseAxis(asString(field(entry, "axis"))?.toLowerCase())
    if (
      source !== null &&
      location !== null &&
      sources.get(normalize(source))?.has(normalize(location))
    ) {
      claims.push({ text, citation: { source, location }, ...(axis && { axis }) })
    } else {
      gaps.push({
        severity: "gap",
        kind: "unsupported",
        title: text.length > 60 ? `${text.slice(0, 57)}…` : text,
        detail: "Stated, but nothing in the materials backs it.",
        ...(axis && { axis }),
      })
    }
  }

  const rawGaps: unknown[] = Array.isArray(raw.gaps) ? raw.gaps : []
  for (const entry of rawGaps) {
    if (gaps.length >= MAX_GAPS) break
    const title = asString(field(entry, "title"))
    if (!title) continue
    const axis = parseAxis(asString(field(entry, "axis"))?.toLowerCase())
    gaps.push({
      severity: parseSeverity(asString(field(entry, "severity"))?.toLowerCase()),
      kind: parseKind(asString(field(entry, "kind"))?.toLowerCase()),
      title,
      detail: asString(field(entry, "detail")) ?? "",
      ...(axis && { axis }),
    })
  }

  return { claims, gaps: gaps.slice(0, MAX_GAPS) }
}
