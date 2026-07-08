export const MATERIAL_FILE_TYPES = ["pdf", "pptx", "xlsx", "docx"] as const

export type MaterialFileType = (typeof MATERIAL_FILE_TYPES)[number]

export const MAX_MATERIAL_BYTES = 10 * 1024 * 1024

// Cap stored text so downstream prompts stay bounded.
export const MAX_EXTRACTED_CHARS = 80_000

export const materialFileType = (fileName: string): MaterialFileType | null => {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
  return (MATERIAL_FILE_TYPES as readonly string[]).includes(ext)
    ? (ext as MaterialFileType)
    : null
}

export type MaterialRejection = "unsupported" | "empty" | "oversized"

export const REJECTION_MESSAGES: Record<MaterialRejection, string> = {
  unsupported: "Only PDF, PPTX, XLSX, and DOCX files are supported.",
  empty: "This file is empty.",
  oversized: "Files must be 10MB or smaller.",
}

export const validateMaterialFile = (
  name: string,
  size: number
): MaterialRejection | null => {
  if (materialFileType(name) === null) return "unsupported"
  if (size === 0) return "empty"
  if (size > MAX_MATERIAL_BYTES) return "oversized"
  return null
}

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
}

const decodeXmlEntities = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity])

// OOXML stores visible text in run elements: <w:t> in DOCX, <a:t> in PPTX.
// Whitespace is normalized — this text feeds prompts, not layout.
export const ooxmlText = (xml: string, tag: "w:t" | "a:t"): string =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "g"))]
    .map((match) => decodeXmlEntities(match[1]))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

export const clampExtractedText = (text: string): string =>
  text.length > MAX_EXTRACTED_CHARS
    ? `${text.slice(0, MAX_EXTRACTED_CHARS)}\n[truncated]`
    : text
