import path from "node:path"
import { Font } from "@react-pdf/renderer"

// Print palette: the app's light theme, committed — a PDF has no dark mode.
export const INK = "#151a21"
export const INK_2 = "#4e5866"
export const INK_3 = "#66707e"
export const INK_4 = "#b4bcc7"
export const LINE = "#e5e9ee"
export const LINE_2 = "#d6dce4"
export const RED = "#c93a26"
export const RED_BG = "#faeae7"
export const BLUE = "#0e5fd8"
export const OK = "#3d7a32"
export const OK_BG = "#eaf2e4"
export const WARN = "#8a5a12"
export const WARN_BG = "#f6eedb"
export const WARN_LINE = "#e9d9b6"

export const SANS = "Instrument Sans"
export const SERIF = "Source Serif 4"
export const MONO = "Spline Sans Mono"

const font = (file: string) => path.join(process.cwd(), "src/lib/pdf/fonts", file)

Font.register({
  family: SANS,
  fonts: [
    { src: font("instrument-sans-400.ttf"), fontWeight: 400 },
    { src: font("instrument-sans-500.ttf"), fontWeight: 500 },
    { src: font("instrument-sans-600.ttf"), fontWeight: 600 },
  ],
})
Font.register({
  family: SERIF,
  fonts: [
    { src: font("source-serif-400.ttf"), fontWeight: 400 },
    { src: font("source-serif-400-italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: font("source-serif-600.ttf"), fontWeight: 600 },
  ],
})
Font.register({
  family: MONO,
  fonts: [
    { src: font("spline-sans-mono-400.ttf"), fontWeight: 400 },
    { src: font("spline-sans-mono-500.ttf"), fontWeight: 500 },
  ],
})

// No mid-word breaks — hyphenation reads as damage in a report.
Font.registerHyphenationCallback((word) => [word])
