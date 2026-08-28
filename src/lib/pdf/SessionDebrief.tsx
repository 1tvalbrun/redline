import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { formatExportDate } from "../export"
import { Chip, Meta, PAGE, ROW, SectionLabel, SheetChrome, TITLE } from "./components"
import type { ExportActionItem } from "./PracticeReport"
import { INK_2, INK_3, INK_4, LINE_2, MONO, OK, RED, SERIF } from "./theme"

type SessionDebriefProps = {
  practiceName: string
  personaName: string
  sessionDate: number
  exportedAt: number
  title: string
  verdictLabel: string
  verdictSummary: string
  spokenVerdict: string
  whatHappened: string
  heldUp: { quote: string; why: string }[]
  didntHold: { text: string; ref?: string }[]
  verifyItems: { text: string }[]
  actionItems: ExportActionItem[]
}

const styles = StyleSheet.create({
  verdictRow: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 10 },
  verdictSummary: { marginLeft: 8, fontSize: 9, color: INK_2 },
  pullQuote: { fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.45, maxWidth: 400 },
  quoteMark: { color: INK_4 },
  attrib: { marginTop: 5, fontSize: 8.5, color: INK_3 },
  attribName: { fontWeight: 500, color: INK_2 },
  prose: { color: INK_2, maxWidth: 470 },
  heldQuote: { fontFamily: SERIF, fontStyle: "italic", fontSize: 10 },
  heldQuoteMark: { color: OK },
  heldWhy: { fontSize: 8.5, color: INK_3, marginTop: 1.5 },
  ref: { fontFamily: MONO, fontSize: 7, color: RED, marginTop: 1.5 },
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
})

export const sessionDebrief = ({
  practiceName,
  personaName,
  sessionDate,
  exportedAt,
  title,
  verdictLabel,
  verdictSummary,
  spokenVerdict,
  whatHappened,
  heldUp,
  didntHold,
  verifyItems,
  actionItems,
}: SessionDebriefProps) => (
  <Document title={`${title} — session debrief`} creator="Prestage">
    <Page size="A4" style={PAGE.page}>
      <SheetChrome docKind="Session debrief" generated={formatExportDate(exportedAt)} />

      <Text style={TITLE.docTitle}>{title}</Text>
      <Meta
        parts={[
          practiceName,
          { prefix: "Session with", strong: personaName },
          formatExportDate(sessionDate),
        ]}
      />

      <View style={styles.verdictRow}>
        <Chip tone="warn">{verdictLabel}</Chip>
        <Text style={styles.verdictSummary}>{verdictSummary}</Text>
      </View>
      <Text style={styles.pullQuote}>
        <Text style={styles.quoteMark}>&ldquo;</Text>
        {spokenVerdict}
        <Text style={styles.quoteMark}>&rdquo;</Text>
      </Text>
      <Text style={styles.attrib}>
        <Text style={styles.attribName}>{personaName}</Text> · spoken at the end of the session
      </Text>

      {whatHappened ? (
        <>
          <SectionLabel title="What happened in there" />
          <Text style={styles.prose}>{whatHappened}</Text>
        </>
      ) : null}

      {heldUp.length > 0 && (
        <>
          <SectionLabel title="What held up" hint="verbatim only" />
          {heldUp.map((finding, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <View style={ROW.body}>
                <Text style={styles.heldQuote}>
                  <Text style={styles.heldQuoteMark}>&ldquo;</Text>
                  {finding.quote}
                  <Text style={styles.heldQuoteMark}>&rdquo;</Text>
                </Text>
                <Text style={styles.heldWhy}>{finding.why}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {didntHold.length > 0 && (
        <>
          <SectionLabel title="What didn't" />
          {didntHold.map((gap, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <View style={ROW.body}>
                <Text>{gap.text}</Text>
                {gap.ref ? <Text style={styles.ref}>{gap.ref}</Text> : null}
              </View>
            </View>
          ))}
        </>
      )}

      {verifyItems.length > 0 && (
        <>
          <SectionLabel
            title="Verify before the real thing"
            hint="facts the panelist couldn't vouch for"
          />
          {verifyItems.map((item, i) => (
            <View key={i} style={[ROW.divided, ...(i === 0 ? [ROW.first] : [])]} wrap={false}>
              <Text style={ROW.body}>{item.text}</Text>
            </View>
          ))}
        </>
      )}

      {actionItems.length > 0 && (
        <>
          <SectionLabel title="Added to your list" />
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
    </Page>
  </Document>
)
