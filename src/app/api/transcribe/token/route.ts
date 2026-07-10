import { NextResponse } from "next/server"
import { z } from "zod"

const tokenResponseSchema = z.object({ token: z.string() })

// Mints a short-lived AssemblyAI streaming token so the browser can open the
// transcription WebSocket directly. Audio never passes through this server,
// and the API key never reaches the client.
export const GET = async () => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=60",
      { headers: { Authorization: apiKey }, cache: "no-store" }
    )
    if (!response.ok) {
      console.error("[/api/transcribe/token] mint failed:", response.status)
      return NextResponse.json({ error: "token mint failed" }, { status: 502 })
    }

    const parsed = tokenResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      console.error("[/api/transcribe/token] unexpected response shape")
      return NextResponse.json({ error: "token mint failed" }, { status: 502 })
    }

    return NextResponse.json({ token: parsed.data.token })
  } catch (err) {
    console.error("[/api/transcribe/token] mint failed:", err)
    return NextResponse.json({ error: "token mint failed" }, { status: 502 })
  }
}
