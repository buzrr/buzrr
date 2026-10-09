import {
  GoogleGenerativeAI,
  type GenerationConfig,
  type ResponseSchema,
} from "@google/generative-ai";
import {
  LlmUpstreamError,
  TextGenerator,
  classifyLlmError,
  parseJsonReply,
  type JsonOutputSchema,
} from "./text-generator";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

/** JSON Schema keywords Gemini's `responseSchema` rejects. */
const UNSUPPORTED_KEYS = new Set(["$schema", "additionalProperties"]);

/**
 * Gemini's `responseSchema` is an OpenAPI subset of JSON Schema with the same
 * lowercase type names, so translating is just dropping what it rejects.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => !UNSUPPORTED_KEYS.has(key))
      .map(([key, value]) => [key, toGeminiSchema(value)]),
  );
}

/** Google Gemini through its own SDK (the hosted default). */
export class GeminiGenerator extends TextGenerator {
  readonly provider = "gemini" as const;
  readonly configured: boolean;

  constructor(
    private readonly apiKey: string | undefined,
    readonly model: string = DEFAULT_GEMINI_MODEL,
  ) {
    super();
    this.configured = Boolean(apiKey);
  }

  generate(prompt: string): Promise<string> {
    return this.run(prompt);
  }

  async generateJson(
    prompt: string,
    { schema }: JsonOutputSchema,
  ): Promise<unknown> {
    const text = await this.run(prompt, {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(schema) as ResponseSchema,
    });
    return parseJsonReply(text);
  }

  private async run(
    prompt: string,
    generationConfig?: GenerationConfig,
  ): Promise<string> {
    if (!this.apiKey) throw new LlmUpstreamError("GEMINI_API_KEY is not set");
    const model = new GoogleGenerativeAI(this.apiKey).getGenerativeModel({
      model: this.model,
      generationConfig,
    });
    let text: string;
    try {
      text = (await model.generateContent(prompt)).response.text();
    } catch (err) {
      throw classifyLlmError(err);
    }
    if (!text.trim()) throw new LlmUpstreamError("Empty response");
    return text;
  }
}
