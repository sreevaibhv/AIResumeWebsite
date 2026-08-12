export type Provider = "anthropic" | "openai" | "gemini";

export interface ModelSpec {
  provider: Provider;
  model: string;
}

export interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface StructuredResult<T> {
  data: T;
  tokensUsed: { in: number; out: number };
  costUsd: number;
  latencyMs: number;
  provider: Provider;
  model: string;
}
