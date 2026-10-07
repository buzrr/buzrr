export type LlmProvider = "gemini" | "openai";

/** The model took too long; worth retrying. */
export class LlmTimeoutError extends Error {}
/** The provider failed or answered with nothing usable. */
export class LlmUpstreamError extends Error {}

/**
 * The one capability the Nest API needs from a language model: prompt in,
 * text out. Bound at boot from `LLM_PROVIDER` (see `llm.provider.ts`), so AI
 * quiz generation can run on Gemini, OpenAI, or anything that speaks the
 * OpenAI chat-completions API — Ollama, vLLM, LM Studio, llama.cpp's server —
 * including a model on the same machine with no internet at all.
 *
 * Abstract class rather than an interface so it can be the Nest injection
 * token.
 */
export abstract class TextGenerator {
  abstract readonly provider: LlmProvider;
  abstract readonly model: string;
  /** False when the provider has no credentials/endpoint configured. */
  abstract readonly configured: boolean;

  /**
   * Throws `LlmTimeoutError` or `LlmUpstreamError`; never returns an empty
   * string.
   */
  abstract generate(prompt: string): Promise<string>;
}

/** Shared by implementations that only see an SDK's generic errors. */
export function classifyLlmError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    (err instanceof Error && err.name === "TimeoutError")
  ) {
    return new LlmTimeoutError(msg);
  }
  return new LlmUpstreamError(msg);
}
