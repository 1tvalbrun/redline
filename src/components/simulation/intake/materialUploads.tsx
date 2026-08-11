"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { REJECTION_MESSAGES, validateMaterialFile } from "@/lib/materials"

export type UploadEntry = { key: string; name: string; size: number } & (
  | { state: "uploading" }
  | { state: "ready"; storageId: Id<"_storage"> }
  | { state: "rejected"; reason: string }
)

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`

// Upload state + transport for intake materials, shared by every lane's
// intake form. Client-side validation mirrors the server's; anything that
// slips past is rejected loudly by simulations.create.
export const useMaterialUploads = () => {
  const generateUploadUrl = useMutation(api.materials.generateUploadUrl)
  const [uploads, setUploads] = useState<UploadEntry[]>([])

  const uploadFile = async (key: string, file: File) => {
    const fail = (reason: string) =>
      setUploads((prev) =>
        prev.map((entry) =>
          entry.key === key
            ? { key, name: file.name, size: file.size, state: "rejected", reason }
            : entry
        )
      )
    try {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!response.ok) return fail("Upload failed. Try again.")
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> }
      setUploads((prev) =>
        prev.map((entry) =>
          entry.key === key
            ? { key, name: file.name, size: file.size, state: "ready", storageId }
            : entry
        )
      )
    } catch {
      fail("Upload failed. Check your connection and try again.")
    }
  }

  const addFiles = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const key = crypto.randomUUID()
      const rejection = validateMaterialFile(file.name, file.size)
      if (rejection) {
        setUploads((prev) => [
          ...prev,
          { key, name: file.name, size: file.size, state: "rejected", reason: REJECTION_MESSAGES[rejection] },
        ])
        continue
      }
      setUploads((prev) => [...prev, { key, name: file.name, size: file.size, state: "uploading" }])
      uploadFile(key, file)
    }
  }

  const removeUpload = (key: string) =>
    setUploads((prev) => prev.filter((entry) => entry.key !== key))

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
          className="flex items-center gap-2.5 border border-line bg-surface px-[11px] py-[9px] text-[13px]"
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
            <span role="alert" className="text-[11.5px] text-red-fg">
              {entry.reason}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(entry.key)}
            aria-label={`Remove ${entry.name}`}
            className="focus-ring flex-none text-on-surface-3 hover:text-red-fg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}
