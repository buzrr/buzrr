import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  LlmUpstreamError,
  TextGenerator,
  classifyLlmError,
} from "./text-generator";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

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

  async generate(prompt: string): Promise<string> {
    if (!this.apiKey) throw new LlmUpstreamError("GEMINI_API_KEY is not set");
    const model = new GoogleGenerativeAI(this.apiKey).getGenerativeModel({
      model: this.model,
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
