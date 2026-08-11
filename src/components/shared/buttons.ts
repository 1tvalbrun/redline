// The two button scales flow and workspace share. Compact placements
// override size via cn (padding/text only), never color or shape.
export const BTN_PRIMARY =
  "focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent-blue px-[18px] py-2.5 text-[13.5px] font-medium text-primary-foreground shadow-btn transition hover:bg-accent-blue-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"

export const BTN_SECONDARY =
  "focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line-2 bg-surface-raised px-[17px] py-2.5 text-[13.5px] font-medium text-on-surface-2 shadow-btn transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
