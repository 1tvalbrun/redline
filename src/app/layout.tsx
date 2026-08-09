import type { Metadata } from "next"
import { Instrument_Sans, Source_Serif_4, Spline_Sans_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "next-themes"
import { ConvexClientProvider } from "./providers"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
})

// Persona voice: verdicts, quotes, and anything spoken renders in serif.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-source-serif",
})

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-spline-mono",
})

export const metadata: Metadata = {
  title: "Redline · Practice with a live AI panel",
  description:
    "Practice your pitch, sale, or audit interview live with an AI avatar — leave with feedback and action items.",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${sourceSerif.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProvider>
            <ConvexClientProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
