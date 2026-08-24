import { z, ZodType } from "zod";
import { resolveModel, estimateCostUsd } from "./model-routing";
import { ModelSpec, StructuredResult } from "./types";
import { completeAnthropic } from "./providers/anthropic.provider";
import { completeOpenAI } from "./providers/openai.provider";
import { completeGemini } from "./providers/gemini.provider";

/**
 * FR-18 — every LLM call logs model, agent, tokens, cost. Default sink is
 * console; scan.service wires this to UsageLog persistence at boot so
 * agents themselves stay framework-agnostic (Master Plan §8.1 pattern).
 */
export type UsageSink = (entry: {
  agentName: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  scanId?: string;
}) => void;

let usageSink: UsageSink = (entry) => {
  // eslint-disable-next-line no-console
  console.log(`[usage] ${entry.agentName} ${entry.provider}:${entry.model} in=${entry.tokensIn} out=${entry.tokensOut} $${entry.costUsd.toFixed(5)} ${entry.latencyMs}ms`);
};

export function setUsageSink(sink: UsageSink): void {
  usageSink = sink;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

async function callProvider(spec: ModelSpec, prompt: string) {
  switch (spec.provider) {
    case "anthropic":
      return completeAnthropic(prompt, spec.model);
    case "openai":
      return completeOpenAI(prompt, spec.model);
    case "gemini":
      return completeGemini(prompt, spec.model);
    default:
      throw new Error(`Unknown provider "${spec.provider}"`);
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && RETRYABLE_STATUS.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Providers occasionally return transient 429/5xx (e.g. Gemini's "high
 * demand" 503) — without a retry these kill the whole scan on a blip.
 * Schema-mismatch retries in completeStructured are separate and unaffected.
 */
async function callProviderWithRetry(spec: ModelSpec, prompt: string, maxAttempts = 3) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await callProvider(spec, prompt);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts - 1 || !isRetryableError(err)) throw err;
      const backoffMs = 500 * 2 ** attempt + Math.random() * 250;
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}

/**
 * The one function every agent calls. Master Plan §8.1, step 3.
 *
 * Resolves the model for `agentName` (§8.2 routing table, env-overridable),
 * calls the provider, validates the response against `schema`, retries once
 * with a correction prompt on schema mismatch, and logs cost/usage.
 */
export async function completeStructured<S extends ZodType>(
  prompt: string,
  schema: S,
  agentName: string,
  opts: { scanId?: string; modelOverride?: ModelSpec } = {},
): Promise<StructuredResult<z.infer<S>>> {
  const spec = resolveModel(agentName, opts.modelOverride);
  const start = Date.now();

  let raw = await callProviderWithRetry(spec, prompt);
  let parsed = safeParseJson(raw.text);
  let validated = parsed.ok ? schema.safeParse(parsed.value) : { success: false as const };

  let tokensIn = raw.tokensIn;
  let tokensOut = raw.tokensOut;

  if (!validated.success) {
    // One corrective retry — tell the model exactly what was wrong.
    const issue = parsed.ok ? JSON.stringify((validated as z.SafeParseError<unknown>).error?.format?.() ?? "schema mismatch") : parsed.error;
    const correctionPrompt = `${prompt}\n\nYour previous response failed validation: ${issue}\nReturn ONLY valid JSON matching the required shape. No prose, no markdown fences.`;
    raw = await callProviderWithRetry(spec, correctionPrompt);
    tokensIn += raw.tokensIn;
    tokensOut += raw.tokensOut;
    parsed = safeParseJson(raw.text);
    validated = parsed.ok ? schema.safeParse(parsed.value) : { success: false as const };
  }

  if (!validated.success) {
    throw new Error(`${agentName}: LLM response failed schema validation twice. Last raw text: ${raw.text.slice(0, 500)}`);
  }

  const latencyMs = Date.now() - start;
  const costUsd = estimateCostUsd(spec.provider, spec.model, tokensIn, tokensOut);

  usageSink({
    agentName,
    provider: spec.provider,
    model: spec.model,
    tokensIn,
    tokensOut,
    costUsd,
    latencyMs,
    scanId: opts.scanId,
  });

  return {
    data: (validated as z.SafeParseSuccess<z.infer<S>>).data,
    tokensUsed: { in: tokensIn, out: tokensOut },
    costUsd,
    latencyMs,
    provider: spec.provider,
    model: spec.model,
  };
}

function safeParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(stripCodeFence(text)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "JSON parse error" };
  }
}
