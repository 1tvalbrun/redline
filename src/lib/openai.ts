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

// Reasoning models spend most of their latency and output tokens thinking
// (measured: default effort made extraction 5-6x slower for identical JSON).
// Fast-tier calls are extraction/classification — minimal loses nothing.
// Quality-tier calls are judgment — low matched default's audit quality in
// testing where minimal hallucinated a citation. Non-reasoning models
// reject the parameter, so it's only sent where the model family takes it.
const isReasoningModel = (model: string): boolean =>
  model.startsWith("gpt-5") || /^o\d/.test(model)

export type ModelSettings = { model: string; reasoning_effort?: "minimal" | "low" }

export const modelSettings = (tier: ModelTier, env: OpenAIEnv = process.env): ModelSettings => {
  const model = resolveModel(tier, env)
  if (!isReasoningModel(model)) return { model }
  return { model, reasoning_effort: tier === "quality" ? "low" : "minimal" }
}

// Dynamic import keeps the SDK out of client bundles that share src/lib.
export const createOpenAI = async () => {
  const { OpenAI } = await import("openai")
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}
