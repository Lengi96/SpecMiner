import type { LlmProvider, LlmRequest, LlmResponse } from "./types.js";

export class DisabledLlmProvider implements LlmProvider {
  readonly name = "disabled";

  async complete(_input: LlmRequest): Promise<LlmResponse> {
    return {
      text: "",
      raw: {
        disabled: true,
        reason: "SpecMiner MVP uses deterministic generation unless a provider is configured."
      }
    };
  }
}

export class OllamaLlmProvider implements LlmProvider {
  readonly name = "local-ollama";

  constructor(
    private readonly endpoint = process.env.SPECMINER_OLLAMA_URL ?? "http://127.0.0.1:11434/api/generate",
    private readonly model = process.env.SPECMINER_OLLAMA_MODEL ?? "llama3.1"
  ) {}

  async complete(input: LlmRequest): Promise<LlmResponse> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: `${input.system}\n\n${input.prompt}\n\nEvidence:\n${JSON.stringify(input.evidence)}`,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as { response?: string };
    return {
      text: raw.response ?? "",
      raw
    };
  }
}

export function createProvider(name = "disabled"): LlmProvider {
  if (name === "disabled") {
    return new DisabledLlmProvider();
  }
  if (name === "local-ollama") {
    return new OllamaLlmProvider();
  }
  throw new Error(`Provider ${name} is listed but not implemented in this MVP.`);
}

export function listProviders(): string[] {
  return ["disabled", "local-ollama", "local-llama-cpp", "openai-compatible", "anthropic-compatible"];
}
