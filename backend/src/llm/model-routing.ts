import { ModelSpec } from "./types";

/**
 * Master Plan §8.2 — model routing table.
 *
 * Temporarily Gemini-only: only GEMINI_API_KEY is provisioned right now,
 * Anthropic and OpenAI land later. This is exactly the "LLM provider
 * abstraction" §8.1/§8.2 exist to make cheap — every agent still declares a
 * provider+model pair, so restoring the original per-agent split (OpenAI
 * mid-tier, Haiku 4.5 for Rewrite/Verify) is a table edit, not a rewrite.
 * The provider/rate-card infrastructure for Anthropic and OpenAI is
 * untouched in providers/ and below; it's just unrouted-to for now.
 *
 * The cheap/mid/frontier *tiering itself* is preserved using Gemini's own
 * model classes, since that distinction (§8.2: "how visible is a failure,
 * how many tokens does the agent burn") doesn't go away just because the
 * provider did:
 *   - CHEAP    gemini-3.5-flash-lite  — high-volume, forgiving tasks
 *   - MID      gemini-3.6-flash       — judgment calls, not safety-critical
 *   - FRONTIER gemini-3.5-flash       — RewriteAgent/VerifyAgent/RoadmapAgent
 *
 * FRONTIER was originally gemini-2.5-pro (a dedicated reasoning-tier model,
 * not just a faster one) but this API key has zero free-tier quota for any
 * "-pro" model — confirmed directly against the live API, a 429 with
 * limit: 0, not a rate limit. gemini-2.5-flash is also out: it 404s as
 * "no longer available to new users." gemini-3.5-flash is the strongest
 * model this key can actually reach on the free tier (verified live) — the
 * safety-critical agents (VerifyAgent especially, FR-8) are running on a
 * flash-class model for now, not a dedicated reasoning tier. Revisit once
 * billing is enabled or Anthropic/OpenAI are wired back in.
 *
 * §11 open decision: confirm current per-token rates before trusting §5's
 * margins. Override per agent via MODEL_OVERRIDE_<AGENT_NAME> (e.g.
 * MODEL_OVERRIDE_REWRITE_AGENT="anthropic:claude-haiku-4-5-20251001") once
 * the other providers are back, without touching this file.
 */
const CHEAP: ModelSpec = { provider: "gemini", model: "gemini-3.5-flash-lite" };
const MID: ModelSpec = { provider: "gemini", model: "gemini-3.6-flash" };
const FRONTIER: ModelSpec = { provider: "gemini", model: "gemini-3.5-flash" };

export const MODEL_ROUTING: Record<string, ModelSpec> = {
  ParseResumeAgent: CHEAP,
  ParseJDAgent: CHEAP,
  SemanticMatchAgent: MID,
  QualityAgent: MID,
  RoadmapAgent: FRONTIER,
  RewriteAgent: FRONTIER,
  VerifyAgent: FRONTIER,
  RecruiterCommentAgent: MID,
  InterviewPrepAgent: CHEAP,
  NaukriScoreAgent: CHEAP,
  TierCalibrationAgent: CHEAP,
  ReferralMessageAgent: CHEAP,
};

export function resolveModel(agentName: string, override?: ModelSpec): ModelSpec {
  const envOverride = process.env[`MODEL_OVERRIDE_${toEnvKey(agentName)}`];
  if (envOverride) {
    const [provider, model] = envOverride.split(":");
    return { provider: provider as ModelSpec["provider"], model };
  }
  if (override) return override;
  const spec = MODEL_ROUTING[agentName];
  if (!spec) {
    throw new Error(`No model route configured for agent "${agentName}". Add it to MODEL_ROUTING.`);
  }
  return spec;
}

function toEnvKey(agentName: string): string {
  // "RewriteAgent" -> "REWRITE_AGENT"
  return agentName.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * Indicative per-1K-token USD rates. Placeholder pending §11.1/§13.9
 * confirmation — do not treat §5's margin table as real until these are
 * verified against current provider pricing.
 */
export const RATE_CARD: Record<string, { in: number; out: number }> = {
  "gemini:gemini-3.5-flash-lite": { in: 0.0, out: 0.0 }, // fill in once confirmed
  "gemini:gemini-3.6-flash": { in: 0.0, out: 0.0 },
  "gemini:gemini-3.5-flash": { in: 0.0, out: 0.0 },
  "openai:gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "openai:gpt-4o": { in: 0.0025, out: 0.01 },
  "anthropic:claude-haiku-4-5-20251001": { in: 0.001, out: 0.005 },
};

export function estimateCostUsd(provider: string, model: string, tokensIn: number, tokensOut: number): number {
  const rate = RATE_CARD[`${provider}:${model}`];
  if (!rate) return 0;
  return (tokensIn / 1000) * rate.in + (tokensOut / 1000) * rate.out;
}
