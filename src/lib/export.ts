// Pure data shaping shared by the PDF export route, the export documents,
// and the practice hub (open-question parsing must agree between screen
// and print).

// Only real questions survive — the analyze model writes prose like
// "Not provided in pitch scope." for missing info, which is honest data
// but not an open question.
export const parseOpenQuestions = (context: string | undefined): string[] =>
  (context ?? "")
    .split(/\n|(?<=\?)\s+/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("?"))

export const blockersFirst = <T extends { severity: "blocker" | "gap" }>(
  gaps: readonly T[]
): T[] => [...gaps].sort((a, b) => Number(b.severity === "blocker") - Number(a.severity === "blocker"))

export const exportFilename = (name: string, kind: "report" | "debrief"): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `prestage-${slug ? `${slug}-` : ""}${kind}.pdf`
}

export const formatExportDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
