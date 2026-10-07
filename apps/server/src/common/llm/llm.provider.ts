import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_GEMINI_MODEL, GeminiGenerator } from "./gemini.generator";
import { OpenAICompatibleGenerator } from "./openai-compatible.generator";
import { TextGenerator, type LlmProvider } from "./text-generator";

/**
 * `LLM_PROVIDER` picks the model API. Unset keeps existing deployments as
 * they were (Gemini via `GEMINI_API_KEY`), unless `LLM_BASE_URL` points at an
 * OpenAI-compatible server — then that is what you meant.
 */
export function resolveLlmProvider(
  env: (key: string) => string | undefined,
): LlmProvider {
  const explicit = env("LLM_PROVIDER")?.trim().toLowerCase();
  if (explicit) {
    if (explicit !== "gemini" && explicit !== "openai") {
      throw new Error(
        `LLM_PROVIDER must be gemini or openai (got "${explicit}")`,
      );
    }
    return explicit;
  }
  return env("LLM_BASE_URL") ? "openai" : "gemini";
}

export function createTextGenerator(
  env: (key: string) => string | undefined,
): TextGenerator {
  if (resolveLlmProvider(env) === "openai") {
    return new OpenAICompatibleGenerator({
      baseUrl: env("LLM_BASE_URL") || "https://api.openai.com/v1",
      model: env("LLM_MODEL") ?? "",
      apiKey: env("LLM_API_KEY"),
    });
  }
  return new GeminiGenerator(
    env("GEMINI_API_KEY"),
    env("LLM_MODEL") || DEFAULT_GEMINI_MODEL,
  );
}

export const textGeneratorProvider: Provider = {
  provide: TextGenerator,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const llm = createTextGenerator((key) => config.get<string>(key));
    new Logger("TextGenerator").log(
      llm.configured
        ? `AI quiz generation via ${llm.provider} (${llm.model})`
        : "AI quiz generation disabled (no LLM configured)",
    );
    return llm;
  },
};
