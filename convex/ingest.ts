"use node"

import { v } from "convex/values"
import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import {
  clampExtractedText,
  ooxmlText,
  type MaterialFileType,
} from "../src/lib/materials"

const extractPdf = async (buffer: ArrayBuffer): Promise<string> => {
  const { extractText, getDocumentProxy } = await import("unpdf")
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf)
  return text.map((page, i) => `[page ${i + 1}] ${page}`).join("\n")
}

const extractZipXml = async (
  buffer: ArrayBuffer,
  fileType: "docx" | "pptx"
): Promise<string> => {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(buffer)
  if (fileType === "docx") {
    const document = await zip.file("word/document.xml")?.async("string")
    return document ? ooxmlText(document, "w:t") : ""
  }
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  const slides = await Promise.all(
    slidePaths.map(async (path, i) => {
      const xml = await zip.file(path)!.async("string")
      return `[slide ${i + 1}] ${ooxmlText(xml, "a:t")}`
    })
  )
  return slides.join("\n")
}

const extractXlsx = async (buffer: ArrayBuffer): Promise<string> => {
  // CJS interop: the bundled module surfaces its API on .default at runtime
  // even though the types say otherwise.
  const imported = await import("xlsx")
  const XLSX =
    typeof imported.read === "function"
      ? imported
      : (imported as unknown as { default: typeof imported }).default
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" })
  return workbook.SheetNames.map(
    (name) => `[sheet ${name}]\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`
  ).join("\n")
}

const EXTRACTORS: Record<MaterialFileType, (buffer: ArrayBuffer) => Promise<string>> = {
  pdf: extractPdf,
  docx: (buffer) => extractZipXml(buffer, "docx"),
  pptx: (buffer) => extractZipXml(buffer, "pptx"),
  xlsx: extractXlsx,
}

const failureReason = (error: unknown): string => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  if (/password|encrypted/i.test(message)) {
    return "This file is password-protected. Remove the password and re-upload."
  }
  return "Couldn't read this file. Re-export it and try again."
}

export const extract = internalAction({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    const material = await ctx.runQuery(internal.materials.getForExtraction, {
      materialId: args.materialId,
    })
    if (!material) return

    const setResult = (result: { status: "ready"; text: string } | { status: "failed"; failureReason: string }) =>
      ctx.runMutation(internal.materials.setExtractionResult, {
        materialId: args.materialId,
        result,
      })

    const blob = await ctx.storage.get(material.storageId)
    if (!blob) {
      await setResult({ status: "failed", failureReason: "The upload didn't reach storage. Try again." })
      return
    }

    try {
      const text = await EXTRACTORS[material.fileType](await blob.arrayBuffer())
      // Strip location markers before deciding emptiness — a PDF of images
      // yields "[page 1] [page 2]" with no actual words.
      const hasContent = text.replace(/\[(page|slide|sheet)[^\]]*\]/g, "").trim().length > 0
      if (!hasContent) {
        await setResult({
          status: "failed",
          failureReason: "No readable text found. Scanned or image-only files can't be read yet.",
        })
        return
      }
      await setResult({ status: "ready", text: clampExtractedText(text) })
    } catch (error) {
      await setResult({ status: "failed", failureReason: failureReason(error) })
    }
  },
})
