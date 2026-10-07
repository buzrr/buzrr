import {
  LlmUpstreamError,
  TextGenerator,
  classifyLlmError,
} from "./text-generator";

const REQUEST_TIMEOUT_MS = 120_000;

interface ChatCompletion {
  choices?: { message?: { content?: string | null } }[];
}

/**
 * Any server that speaks the OpenAI chat-completions API: OpenAI itself,
 * Ollama (`http://localhost:11434/v1`), vLLM, LM Studio, llama.cpp, LiteLLM,
 * OpenRouter, Groq, or Gemini's own OpenAI-compatible endpoint. Plain `fetch`
 * — no vendor SDK.
 */
export class OpenAICompatibleGenerator extends TextGenerator {
  readonly provider = "openai" as const;
  readonly configured: boolean;
  private readonly endpoint: string;

  constructor(
    private readonly config: {
      baseUrl: string;
      model: string;
      /** Optional: local servers like Ollama don't check it. */
      apiKey?: string;
      timeoutMs?: number;
    },
  ) {
    super();
    this.configured = Boolean(config.baseUrl && config.model);
    this.endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  }

  get model(): string {
    return this.config.model;
  }

  async generate(prompt: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey
            ? { authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(
          this.config.timeoutMs ?? REQUEST_TIMEOUT_MS,
        ),
      });
    } catch (err) {
      throw classifyLlmError(err);
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new LlmUpstreamError(
        `${res.status} from ${this.endpoint}: ${detail}`,
      );
    }
    const body = (await res.json().catch(() => null)) as ChatCompletion | null;
    const text = body?.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new LlmUpstreamError("Empty response");
    return text;
  }
}
