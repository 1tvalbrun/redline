export const MODELS = {
  fast: process.env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini',
  quality: process.env.OPENAI_MODEL_QUALITY ?? 'gpt-4o-mini',
} as const
