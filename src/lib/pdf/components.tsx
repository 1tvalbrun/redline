import { StyleSheet, Text, View } from "@react-pdf/renderer"
import {
  INK,
  INK_2,
  INK_3,
  INK_4,
  LINE,
  LINE_2,
  MONO,
  OK,
  OK_BG,
  RED,
  RED_BG,
  SANS,
  WARN,
  WARN_BG,
  WARN_LINE,
} from "./theme"

// Shared print grammar for both export documents. Sizes are in pt on A4.

// No lineHeight here, on purpose: a page-level line-height never reaches
// nested Texts but does inflate the bottom-anchored fixed footer past the
// page edge, where react-pdf silently clips it. Default font leading is
// the intended look.
export const PAGE = StyleSheet.create({
  page: {
    fontFamily: SANS,
    fontSize: 9.5,
    color: INK,
    paddingTop: 92,
    paddingHorizontal: 56,
    paddingBottom: 64,
  },
})

const chrome = StyleSheet.create({
  header: {
    position: "absolute",
    top: 44,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.2,
    borderBottomColor: INK,
    paddingBottom: 9,
  },
  wordmark: { fontSize: 11.5, fontWeight: 600, letterSpacing: -0.15 },
  wordmarkDot: { color: RED },
  docKind: {
    fontFamily: MONO,
    fontSize: 7,
    color: INK_3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  footer: {
    position: "absolute",
    bottom: 34,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.7,
    borderTopColor: LINE,
    paddingTop: 8,
    fontFamily: MONO,
    fontSize: 6.5,
    color: INK_4,
  },
})

export const SheetChrome = ({ docKind, generated }: { docKind: string; generated: string }) => (
  <>
    <View style={chrome.header} fixed>
      <Text style={chrome.wordmark}>
        Prestage<Text style={chrome.wordmarkDot}>.</Text>
      </Text>
      <Text style={chrome.docKind}>{docKind}</Text>
    </View>
    <View style={chrome.footer} fixed>
      <Text>Generated {generated} · prestage.app</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  </>
)

const section = StyleSheet.create({
  label: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 20,
    marginBottom: 7,
  },
  labelText: {
    fontSize: 7.5,
    fontWeight: 600,
    color: INK_3,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  hint: { fontFamily: MONO, fontSize: 6.5, color: INK_4 },
})

export const SectionLabel = ({ title, hint }: { title: string; hint?: string }) => (
  <View style={section.label} minPresenceAhead={40}>
    <Text style={section.labelText}>{title}</Text>
    {hint ? <Text style={section.hint}>{hint}</Text> : null}
  </View>
)

const CHIP_STYLES = StyleSheet.create({
  base: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    // Half the chip height at most — react-pdf notches corners past that.
    borderRadius: 4,
    borderWidth: 0.7,
  },
  warn: { backgroundColor: WARN_BG, color: WARN, borderColor: WARN_LINE },
  red: { backgroundColor: RED_BG, color: RED, borderColor: "#ecccc5" },
  ok: { backgroundColor: OK_BG, color: OK, borderColor: "#d3e5c9" },
  neutral: { backgroundColor: "#f1f4f8", color: INK_3, borderColor: LINE_2 },
})

export type ChipTone = "warn" | "red" | "ok" | "neutral"

export const Chip = ({ tone, children }: { tone: ChipTone; children: string }) => (
  <Text style={[CHIP_STYLES.base, CHIP_STYLES[tone]]}>{children}</Text>
)

export const ROW = StyleSheet.create({
  divided: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 0.7,
    borderTopColor: LINE,
    paddingVertical: 6,
  },
  first: { borderTopWidth: 0 },
  body: { flex: 1, color: INK_2 },
})

export const TITLE = StyleSheet.create({
  docTitle: { fontSize: 19, fontWeight: 600, letterSpacing: -0.3 },
  meta: { marginTop: 6, fontSize: 8.5, color: INK_3 },
  metaStrong: { fontWeight: 500, color: INK_2 },
  metaSep: { color: INK_4 },
})

// A part with a prefix keeps it inside one segment ("Panelist Marcus Webb"),
// so the dot separator only lands between parts.
type MetaPart = string | { prefix?: string; strong: string }

export const Meta = ({ parts }: { parts: MetaPart[] }) => (
  <Text style={TITLE.meta}>
    {parts.map((part, i) => (
      <Text key={i}>
        {i > 0 && <Text style={TITLE.metaSep}> · </Text>}
        {typeof part === "string" ? (
          part
        ) : (
          <>
            {part.prefix ? `${part.prefix} ` : ""}
            <Text style={TITLE.metaStrong}>{part.strong}</Text>
          </>
        )}
      </Text>
    ))}
  </Text>
)
