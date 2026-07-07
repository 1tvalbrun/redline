import { NextRequest, NextResponse } from "next/server"
import { AssemblyAI } from "assemblyai"

export const POST = async (req: NextRequest) => {
  const formData = await req.formData()
  const audio = formData.get("audio")
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 })
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY not configured" },
      { status: 500 }
    )
  }

  const client = new AssemblyAI({ apiKey })

  try {
    const buffer = Buffer.from(await audio.arrayBuffer())
    const transcript = await client.transcripts.transcribe({ audio: buffer })

    if (transcript.status === "error") {
      console.error("[/api/transcribe] AssemblyAI error:", transcript.error)
      return NextResponse.json({ error: "transcription failed" }, { status: 500 })
    }

    return NextResponse.json({ text: transcript.text ?? "" })
  } catch (err) {
    console.error("[/api/transcribe] failed:", err)
    return NextResponse.json({ error: "transcription failed" }, { status: 500 })
  }
}
