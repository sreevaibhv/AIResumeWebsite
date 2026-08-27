import { z, ZodType } from "zod";
import { resolveModel, estimateCostUsd } from "./model-routing";
import { ModelSpec, StructuredResult } from "./types";
import { completeAnthropic } from "./providers/anthropic.provider";
import { completeOpenAI } from "./providers/openai.provider";
import { completeGemini, completeGeminiMultimodal } from "./providers/gemini.provider";

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

/**
 * `temperature` is Gemini-only today — the two agents that need it
 * (SemanticMatchAgent, QualityAgent, NaukriScoreAgent's scoring path) only
 * ever route to Gemini (model-routing.ts's CHEAP/MID tiers), and
 * completeAnthropic/completeOpenAI don't accept a config override. Silently
 * ignored on the other providers rather than threaded everywhere, since
 * nothing in this codebase currently needs it there.
 */
async function callProvider(spec: ModelSpec, prompt: string, temperature?: number) {
  switch (spec.provider) {
    case "anthropic":
      return completeAnthropic(prompt, spec.model);
    case "openai":
      return completeOpenAI(prompt, spec.model);
    case "gemini":
      return completeGemini(prompt, spec.model, temperature);
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
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts - 1 || !isRetryableError(err)) throw err;
      const backoffMs = 500 * 2 ** attempt + Math.random() * 250;
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}

function callProviderWithRetry(spec: ModelSpec, prompt: string, temperature?: number, maxAttempts = 3) {
  return withRetry(() => callProvider(spec, prompt, temperature), maxAttempts);
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
  opts: { scanId?: string; modelOverride?: ModelSpec; temperature?: number } = {},
): Promise<StructuredResult<z.infer<S>>> {
  const spec = resolveModel(agentName, opts.modelOverride);
  const start = Date.now();

  let raw = await callProviderWithRetry(spec, prompt, opts.temperature);
  let parsed = safeParseJson(raw.text);
  let validated = parsed.ok ? schema.safeParse(parsed.value) : { success: false as const };

  let tokensIn = raw.tokensIn;
  let tokensOut = raw.tokensOut;

  if (!validated.success) {
    // One corrective retry — tell the model exactly what was wrong. This is
    // the existing safety net that a fractional 0-1 value in place of a
    // 0-100 integer score now falls into: .int() on the affected agents'
    // schemas turns that mistake into a validation failure, which lands
    // here and gets a chance to self-correct, instead of silently passing.
    const issue = parsed.ok ? JSON.stringify((validated as z.SafeParseError<unknown>).error?.format?.() ?? "schema mismatch") : parsed.error;
    const correctionPrompt = `${prompt}\n\nYour previous response failed validation: ${issue}\nReturn ONLY valid JSON matching the required shape. No prose, no markdown fences.`;
    raw = await callProviderWithRetry(spec, correctionPrompt, opts.temperature);
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

/**
 * Sibling to completeStructured for the one non-JSON call in the system:
 * document transcription. There's no schema to validate against, so no
 * correction retry — only the transient-error retry, and the same
 * cost/usage logging every other agent gets.
 *
 * Gemini-only: native PDF inlineData has no equivalent wired for the other
 * providers, and DocumentExtractionAgent isn't in the reasoning-tier
 * auto-upgrade set (model-routing.ts) — a MODEL_OVERRIDE pointed at a
 * non-Gemini provider is a misconfiguration, not something to silently
 * degrade around.
 */
export async function completeMultimodalText(
  fileBuffer: Buffer,
  mimeType: string,
  promptText: string,
  agentName: string,
  opts: { scanId?: string; modelOverride?: ModelSpec } = {},
): Promise<StructuredResult<string>> {
  const spec = resolveModel(agentName, opts.modelOverride);
  if (spec.provider !== "gemini") {
    throw new Error(`${agentName}: multimodal extraction only supports Gemini (native PDF inlineData) — resolved to "${spec.provider}".`);
  }

  const start = Date.now();
  const raw = await withRetry(() => completeGeminiMultimodal(fileBuffer, mimeType, promptText, spec.model));
  const latencyMs = Date.now() - start;
  const costUsd = estimateCostUsd(spec.provider, spec.model, raw.tokensIn, raw.tokensOut);

  usageSink({
    agentName,
    provider: spec.provider,
    model: spec.model,
    tokensIn: raw.tokensIn,
    tokensOut: raw.tokensOut,
    costUsd,
    latencyMs,
    scanId: opts.scanId,
  });

  return {
    data: raw.text,
    tokensUsed: { in: raw.tokensIn, out: raw.tokensOut },
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
