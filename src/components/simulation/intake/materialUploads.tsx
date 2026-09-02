"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { REJECTION_MESSAGES, validateMaterialFile } from "@/lib/materials"

export type UploadEntry = { key: string; laneId: string; name: string; size: number } & (
  | { state: "uploading" }
  | { state: "ready"; storageId: Id<"_storage"> }
  | { state: "rejected"; reason: string }
)

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`

// Upload state + transport for intake materials, shared by every lane's
// intake form. Entries are tagged with the lane they were added in and the
// hook exposes only the active lane's — a resume uploaded on Interview is
// never shown, extracted, or attached anywhere else, but it's waiting when
// the user switches back. An upload finishing after a lane switch still
// lands in its own lane's list (laneId is captured at add time).
// Client-side validation mirrors the server's; anything that slips past is
// rejected loudly by practices.create.
export const useMaterialUploads = (laneId: string) => {
  const generateUploadUrl = useMutation(api.materials.generateUploadUrl)
  const [allUploads, setAllUploads] = useState<UploadEntry[]>([])

  const uploadFile = async (key: string, ownerLane: string, file: File) => {
    const settle = (settled: UploadEntry) =>
      setAllUploads((prev) => prev.map((entry) => (entry.key === key ? settled : entry)))
    const base = { key, laneId: ownerLane, name: file.name, size: file.size }
    try {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!response.ok) return settle({ ...base, state: "rejected", reason: "Upload failed. Try again." })
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> }
      settle({ ...base, state: "ready", storageId })
    } catch {
      settle({ ...base, state: "rejected", reason: "Upload failed. Check your connection and try again." })
    }
  }

  const addFiles = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const key = crypto.randomUUID()
      const base = { key, laneId, name: file.name, size: file.size }
      const rejection = validateMaterialFile(file.name, file.size)
      if (rejection) {
        setAllUploads((prev) => [
          ...prev,
          { ...base, state: "rejected", reason: REJECTION_MESSAGES[rejection] },
        ])
        continue
      }
      setAllUploads((prev) => [...prev, { ...base, state: "uploading" }])
      uploadFile(key, laneId, file)
    }
  }

  const removeUpload = (key: string) =>
    setAllUploads((prev) => prev.filter((entry) => entry.key !== key))

  const uploads = allUploads.filter((entry) => entry.laneId === laneId)

  const readyMaterials = uploads.flatMap((entry) =>
    entry.state === "ready"
      ? [{ storageId: entry.storageId, name: entry.name, size: entry.size }]
      : []
  )

  return {
    uploads,
    addFiles,
    removeUpload,
    readyMaterials,
    isUploading: uploads.some((entry) => entry.state === "uploading"),
  }
}

export const UploadList = ({
  uploads,
  onRemove,
}: {
  uploads: UploadEntry[]
  onRemove: (key: string) => void
}) => {
  if (uploads.length === 0) return null
  return (
    <ul className="mt-2.5 flex flex-col gap-2">
      {uploads.map((entry) => (
        <li
          key={entry.key}
          className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-raised px-[11px] py-[9px] text-[13px] shadow-card"
        >
          <span className="flex-none bg-on-surface px-1.5 py-[2px] font-mono text-[9px] tracking-[.06em] text-surface">
            {entry.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "?"}
          </span>
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          {entry.state === "uploading" && (
            <span className="font-mono text-[10px] uppercase text-on-surface-3">Uploading…</span>
          )}
          {entry.state === "ready" && (
            <span className="font-mono text-[10px] uppercase text-on-surface-3">
              <span aria-hidden="true" className="text-ok">✓</span> {formatSize(entry.size)}
            </span>
          )}
          {entry.state === "rejected" && (
            <span role="alert" className="min-w-0 text-[11.5px] text-red-fg max-md:break-words">
              {entry.reason}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(entry.key)}
            aria-label={`Remove ${entry.name}`}
            className="focus-ring flex-none text-on-surface-3 hover:text-red-fg max-md:-m-3 max-md:p-3"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}
