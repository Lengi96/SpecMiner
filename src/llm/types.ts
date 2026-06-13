export interface LlmRequest {
  system: string;
  prompt: string;
  evidence: unknown;
}

export interface LlmResponse {
  text: string;
  raw?: unknown;
}

export interface LlmProvider {
  name: string;
  complete(input: LlmRequest): Promise<LlmResponse>;
}
