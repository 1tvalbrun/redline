import { Path, Svg, View } from "@react-pdf/renderer"
import { OK, OK_BG, RED, RED_BG } from "./theme"

// Drawn as vectors: the embedded text faces don't carry ✓/✕ glyphs, and a
// missing glyph prints as blank — severity must never be color-only.

const box = (background: string) => ({
  width: 10,
  height: 10,
  borderRadius: 3,
  backgroundColor: background,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginTop: 1.5,
  marginRight: 7,
})

export const CheckMark = () => (
  <View style={box(OK_BG)}>
    <Svg width={6} height={6} viewBox="0 0 12 12">
      <Path d="M2 6.5 L4.8 9.2 L10 3" stroke={OK} strokeWidth={2.2} />
    </Svg>
  </View>
)

export const CrossMark = () => (
  <View style={box(RED_BG)}>
    <Svg width={5.5} height={5.5} viewBox="0 0 12 12">
      <Path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke={RED} strokeWidth={2.2} />
    </Svg>
  </View>
)
