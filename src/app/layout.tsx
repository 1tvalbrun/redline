import type { Metadata } from "next"
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { ConvexClientProvider } from "./providers"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

// Display face: Archivo variable, width axis pinned to 125 ("Expanded")
// via --font-display--font-variation-settings in globals.css.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
})

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-plex-sans",
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
})

export const metadata: Metadata = {
  title: "Redline · AI Panel Stress Test",
  description: "Stress-test your ideas against live AI expert panels",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ConvexClientProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}

export default RootLayout
