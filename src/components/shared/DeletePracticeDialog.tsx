"use client"

import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Drops the practice from practices.list immediately; Convex rolls the
// local store back if the server rejects the mutation.
export const useDeletePractice = () =>
  useMutation(api.practices.remove).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.practices.list, {})
    if (!current) return
    localStore.setQuery(
      api.practices.list,
      {},
      current.filter((practice) => practice.practiceId !== args.id)
    )
  })

export const DeletePracticeError = ({ className }: { className?: string }) => (
  <p role="alert" className={cn("text-[12.5px] text-red-fg", className)}>
    Deletion didn&apos;t go through, so nothing was removed. Check your connection and try
    again.
  </p>
)

export const DeletePracticeDialog = ({
  name,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent size="sm">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently removes the practice with its sessions, transcripts, debriefs,
          and uploads. There&apos;s no undo.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep it</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onConfirm}>
          Delete practice
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
