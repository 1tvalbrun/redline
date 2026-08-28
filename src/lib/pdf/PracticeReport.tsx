import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { Claim, Gap } from "../audit"
import { formatExportDate } from "../export"
import { Chip, Meta, PAGE, ROW, SectionLabel, SheetChrome, TITLE } from "./components"
import { CheckMark, CrossMark } from "./marks"
import { INK_3, INK_4, LINE_2, MONO, OK } from "./theme"

export type ExportActionItem = {
  text: string
  priority: "high" | "medium" | "low"
  status: "open" | "done"
}

export type SessionRow = {
  startedAt: number
  verdictLabel: string | null
  title: string | null
}

type PracticeReportProps = {
  practiceName: string
  laneLabel: string
  personaName: string | null
  exportedAt: number
  claims: Claim[]
  gaps: Gap[]
  openQuestions: string[]
  actionItems: ExportActionItem[]
  sessions: SessionRow[]
}

const styles = StyleSheet.create({
  cite: { fontFamily: MONO, fontSize: 7, color: INK_3, marginTop: 1.5 },
  gapTitle: { fontWeight: 500 },
  gapDetail: { fontSize: 9, color: INK_3, marginTop: 0.5 },
  questionIndex: { fontFamily: MONO, fontSize: 7.5, color: INK_4, width: 18, marginTop: 1 },
  todoBox: {
    width: 9,
    height: 9,
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: LINE_2,
    marginTop: 2,
    marginRight: 8,
  },
  todoBoxDone: { borderColor: OK, backgroundColor: OK },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 0.7,
    borderBottomColor: LINE_2,
    paddingBottom: 4,
    fontFamily: MONO,
    fontSize: 6.5,
    color: INK_4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  colDate: { width: 78 },
  colVerdict: { width: 92, alignItems: "flex-start" },
})

const gapChip = (gap: Gap) =>
  gap.severity === "blocker" ? (
    <Chip tone="red">Blocker</Chip>
  ) : (
    <Chip tone="neutral">{gap.kind === "unsupported" ? "Unsupported" : "Gap"}</Chip>
  )

export const practiceReport = ({
  practiceName,
  laneLabel,
  personaName,
  exportedAt,
  claims,
  gaps,
  openQuestions,
  actionItems,
  sessions,
}: PracticeReportProps) => (
  <Document title={`${practiceName} — practice report`} creator="Prestage">
    <Page size="A4" style={PAGE.page}>
      <SheetChrome docKind="Practice report" generated={formatExportDate(exportedAt)} />

      <Text style={TITLE.docTitle}>{practiceName}</Text>
      <Meta
        parts={[
          laneLabel,
          ...(personaName ? [{ prefix: "Panelist", strong: personaName }] : []),
          `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`,
        ]}
      />

      {claims.length > 0 && (
        <>
          <SectionLabel title="What the record supports" hint="every claim cites its source" />
          {claims.map((claim, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <CheckMark />
              <View style={ROW.body}>
                <Text>{claim.text}</Text>
                <Text style={styles.cite}>
                  {claim.citation.source} · {claim.citation.location}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {gaps.length > 0 && (
        <>
          <SectionLabel title="What's missing" hint="blockers first · full text, never truncated" />
          {gaps.map((gap, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <CrossMark />
              <View style={ROW.body}>
                <Text style={styles.gapTitle}>{gap.title}</Text>
                {gap.detail ? <Text style={styles.gapDetail}>{gap.detail}</Text> : null}
              </View>
              {gapChip(gap)}
            </View>
          ))}
        </>
      )}

      {openQuestions.length > 0 && (
        <>
          <SectionLabel title="Open questions" />
          {openQuestions.map((question, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <Text style={styles.questionIndex}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={ROW.body}>{question}</Text>
            </View>
          ))}
        </>
      )}

      {actionItems.length > 0 && (
        <>
          <SectionLabel title="To work on" hint="carried across sessions" />
          {actionItems.map((item, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <View
                style={[styles.todoBox, ...(item.status === "done" ? [styles.todoBoxDone] : [])]}
              />
              <Text style={ROW.body}>{item.text}</Text>
              <Chip tone={item.priority === "high" ? "warn" : "neutral"}>
                {item.priority === "medium" ? "Med" : item.priority}
              </Chip>
            </View>
          ))}
        </>
      )}

      {sessions.length > 0 && (
        <>
          <SectionLabel title="Sessions" />
          <View style={styles.tableHead}>
            <Text style={styles.colDate}>Date</Text>
            <Text style={styles.colVerdict}>Verdict</Text>
            <Text>Headline</Text>
          </View>
          {sessions.map((session, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <Text style={styles.colDate}>{formatExportDate(session.startedAt)}</Text>
              <View style={styles.colVerdict}>
                {session.verdictLabel ? <Chip tone="warn">{session.verdictLabel}</Chip> : null}
              </View>
              <Text style={ROW.body}>{session.title ?? ""}</Text>
            </View>
          ))}
        </>
      )}
    </Page>
  </Document>
)
