import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { toGeminiSchema } from "../gemini.generator";
import { createTextGenerator, resolveLlmProvider } from "../llm.provider";
import { OpenAICompatibleGenerator } from "../openai-compatible.generator";
import {
  LlmTimeoutError,
  LlmUpstreamError,
  parseJsonReply,
} from "../text-generator";

const env = (vars: Record<string, string>) => (key: string) => vars[key];

describe("provider selection", () => {
  it("stays on Gemini unless an OpenAI-compatible endpoint is configured", () => {
    expect(resolveLlmProvider(env({ GEMINI_API_KEY: "k" }))).toBe("gemini");
    expect(
      resolveLlmProvider(env({ LLM_BASE_URL: "http://localhost:11434/v1" })),
    ).toBe("openai");
    expect(
      resolveLlmProvider(
        env({ LLM_PROVIDER: "gemini", LLM_BASE_URL: "http://x/v1" }),
      ),
    ).toBe("gemini");
    expect(() => resolveLlmProvider(env({ LLM_PROVIDER: "bard" }))).toThrow();
  });

  it("is unconfigured, not broken, with nothing set", () => {
    expect(createTextGenerator(env({})).configured).toBe(false);
    expect(
      createTextGenerator(env({ LLM_BASE_URL: "http://x/v1" })).configured,
    ).toBe(false); // no model
  });
});

describe("OpenAICompatibleGenerator", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  async function fakeServer(
    handler: (
      body: Record<string, unknown>,
      auth?: string,
    ) => {
      status: number;
      json?: unknown;
      delayMs?: number;
    },
  ): Promise<string> {
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        expect(req.url).toBe("/v1/chat/completions");
        const out = handler(JSON.parse(raw), req.headers.authorization);
        setTimeout(() => {
          res.writeHead(out.status, { "content-type": "application/json" });
          res.end(JSON.stringify(out.json ?? {}));
        }, out.delayMs ?? 0);
      });
    });
    await new Promise<void>((r) => server!.listen(0, r));
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/v1/`;
  }

  it("sends a chat completion and returns the message", async () => {
    let seen: Record<string, unknown> = {};
    let auth: string | undefined;
    const baseUrl = await fakeServer((body, a) => {
      seen = body;
      auth = a;
      return {
        status: 200,
        json: { choices: [{ message: { content: "Question: 2+2?" } }] },
      };
    });
    const llm = new OpenAICompatibleGenerator({
      baseUrl,
      model: "llama3.1",
      apiKey: "sk-test",
    });
    await expect(llm.generate("make a quiz")).resolves.toBe("Question: 2+2?");
    expect(seen).toMatchObject({
      model: "llama3.1",
      messages: [{ role: "user", content: "make a quiz" }],
    });
    expect(auth).toBe("Bearer sk-test");
  });

  it("sends no Authorization header without a key (Ollama)", async () => {
    let auth: string | undefined = "unset";
    const baseUrl = await fakeServer((_body, a) => {
      auth = a;
      return {
        status: 200,
        json: { choices: [{ message: { content: "ok" } }] },
      };
    });
    await new OpenAICompatibleGenerator({ baseUrl, model: "m" }).generate("p");
    expect(auth).toBeUndefined();
  });

  it("treats errors and empty answers as upstream failures", async () => {
    const failing = await fakeServer(() => ({ status: 500, json: {} }));
    await expect(
      new OpenAICompatibleGenerator({ baseUrl: failing, model: "m" }).generate(
        "p",
      ),
    ).rejects.toBeInstanceOf(LlmUpstreamError);
    server?.close();
    const empty = await fakeServer(() => ({
      status: 200,
      json: { choices: [{ message: { content: "  " } }] },
    }));
    await expect(
      new OpenAICompatibleGenerator({ baseUrl: empty, model: "m" }).generate(
        "p",
      ),
    ).rejects.toBeInstanceOf(LlmUpstreamError);
  });

  it("requests structured output and parses the JSON reply", async () => {
    let seen: Record<string, unknown> = {};
    const baseUrl = await fakeServer((body) => {
      seen = body;
      return {
        status: 200,
        json: { choices: [{ message: { content: '{"ok":true}' } }] },
      };
    });
    const schema = {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        tags: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" },
        },
      },
    };
    await expect(
      new OpenAICompatibleGenerator({ baseUrl, model: "m" }).generateJson("p", {
        name: "out",
        schema,
      }),
    ).resolves.toEqual({ ok: true });
    expect(seen.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "out",
        schema: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
        strict: true,
      },
    });
  });

  it("times out slow models", async () => {
    const slow = await fakeServer(() => ({ status: 200, delayMs: 500 }));
    await expect(
      new OpenAICompatibleGenerator({
        baseUrl: slow,
        model: "m",
        timeoutMs: 50,
      }).generate("p"),
    ).rejects.toBeInstanceOf(LlmTimeoutError);
  });
});

describe("structured output helpers", () => {
  it("parses JSON, tolerating a markdown fence", () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseJsonReply("Question: 2+2?")).toThrow(LlmUpstreamError);
  });

  it("strips JSON Schema keys Gemini rejects, at every level", () => {
    expect(
      toGeminiSchema({
        $schema: "x",
        type: "object",
        additionalProperties: false,
        properties: {
          q: {
            type: "array",
            minItems: 3,
            items: { type: "object", additionalProperties: false },
          },
        },
      }),
    ).toEqual({
      type: "object",
      properties: {
        q: { type: "array", minItems: 3, items: { type: "object" } },
      },
    });
  });
});
