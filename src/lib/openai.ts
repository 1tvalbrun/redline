// One model ladder for every OpenAI call site (Convex actions only): "fast"
// covers orchestration and intake, "quality" covers audit and report and
// falls back to fast. Env vars live in the Convex deployment env.
type OpenAIEnv = Record<string, string | undefined>

export type ModelTier = "fast" | "quality"

const DEFAULT_MODEL = "gpt-4o-mini"

export const resolveModel = (tier: ModelTier, env: OpenAIEnv = process.env): string =>
  tier === "quality"
    ? env.OPENAI_MODEL_QUALITY ?? env.OPENAI_MODEL_FAST ?? DEFAULT_MODEL
    : env.OPENAI_MODEL_FAST ?? DEFAULT_MODEL

// Dynamic import keeps the SDK out of client bundles that share src/lib.
export const createOpenAI = async () => {
  const { OpenAI } = await import("openai")
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}
