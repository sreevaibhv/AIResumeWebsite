import { ModelSpec } from "./types";

/**
 * Master Plan §8.2 — model routing table.
 *
 * Gemini is the dev default for every tier — GEMINI_API_KEY is the only key
 * reliably provisioned in this environment. The cheap/mid/frontier tiering
 * itself (§8.2: "how visible is a failure, how many tokens does the agent
 * burn") is preserved using Gemini's own model classes:
 *   - CHEAP    gemini-3.5-flash-lite  — high-volume, forgiving tasks
 *   - MID      gemini-3.6-flash       — judgment calls, not safety-critical
 *   - FRONTIER gemini-3.5-flash       — RoadmapAgent (advisory, not safety-critical)
 *
 * FRONTIER was originally gemini-2.5-pro (a dedicated reasoning-tier model,
 * not just a faster one) but this API key has zero free-tier quota for any
 * "-pro" model — confirmed directly against the live API, a 429 with
 * limit: 0, not a rate limit. gemini-2.5-flash is also out: it 404s as
 * "no longer available to new users." gemini-3.5-flash is the strongest
 * model this key can actually reach on the free tier (verified live).
 *
 * RewriteAgent/VerifyAgent are the two safety/fidelity-critical agents
 * (invariants #1/#2 — zero invention, fail-closed verification) and do NOT
 * use the static FRONTIER Gemini spec above. They resolve dynamically via
 * `resolveReasoningTier()`: the moment OPENAI_API_KEY or ANTHROPIC_API_KEY is
 * added to the environment, both agents automatically upgrade to that
 * reasoning-tier provider — no other code or env var required. Until then
 * they fall back to Gemini flash, same as today. This is the build's
 * explicit launch gate: no verified-rewrite feature should ship to real
 * users on unmeasured free-tier flash Gemini at 5 RPM.
 *
 * Per-agent override still wins over all of the above:
 * MODEL_OVERRIDE_<AGENT_NAME> (e.g.
 * MODEL_OVERRIDE_REWRITE_AGENT="anthropic:claude-haiku-4-5-20251001") is
 * checked first in resolveModel() and is unaffected by this file.
 *
 * §11 open decision: confirm current per-token rates before trusting §5's
 * margins.
 */
const CHEAP: ModelSpec = { provider: "gemini", model: "gemini-3.5-flash-lite" };
const MID: ModelSpec = { provider: "gemini", model: "gemini-3.6-flash" };
const FRONTIER: ModelSpec = { provider: "gemini", model: "gemini-3.5-flash" };

/** OpenAI is the locked default reasoning tier once a key exists; Claude is a documented, available alternative. */
const REASONING_OPENAI: ModelSpec = { provider: "openai", model: "gpt-4o" };
const REASONING_ANTHROPIC: ModelSpec = { provider: "anthropic", model: "claude-sonnet-5" };

/**
 * Evaluated per call, not as a module-level const — model-routing.ts is
 * imported very early (agent modules load before ConfigModule.forRoot() has
 * necessarily populated process.env from .env), so a module-level constant
 * would capture "keys existed at import time" instead of the intended "keys
 * exist now."
 */
function resolveReasoningTier(): ModelSpec {
  if (process.env.OPENAI_API_KEY) return REASONING_OPENAI;
  if (process.env.ANTHROPIC_API_KEY) return REASONING_ANTHROPIC;
  return FRONTIER;
}

const REASONING_TIER_AGENTS = new Set(["RewriteAgent", "VerifyAgent"]);

export const MODEL_ROUTING: Record<string, ModelSpec> = {
  // Gemini-only — native PDF inlineData has no wired equivalent for the
  // other providers. See completeMultimodalText in llm-provider.ts, which
  // throws rather than silently routing elsewhere if an override picks a
  // non-Gemini provider for this agent.
  DocumentExtractionAgent: FRONTIER,
  ParseResumeAgent: CHEAP,
  ParseJDAgent: CHEAP,
  TierDetectionAgent: CHEAP,
  SemanticMatchAgent: MID,
  QualityAgent: MID,
  RoadmapAgent: FRONTIER,
  RewriteAgent: FRONTIER, // superseded by resolveReasoningTier() in resolveModel() below when a reasoning-tier key exists
  VerifyAgent: FRONTIER, // superseded by resolveReasoningTier() in resolveModel() below when a reasoning-tier key exists
  RecruiterCommentAgent: MID,
  InterviewPrepAgent: CHEAP,
  NaukriScoreAgent: CHEAP,
  // Generates specific, literal, copy-pasteable text a user may paste
  // directly into their real resume — closer to RewriteAgent's invention
  // risk than to NaukriScoreAgent's bounded score+sentence. RoadmapAgent
  // (advisory, still FRONTIER for the same reason) is the closest
  // precedent. Downgrade to MID only with an eval showing it's safe.
  NaukriOptimizationAgent: FRONTIER,
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
  if (REASONING_TIER_AGENTS.has(agentName)) return resolveReasoningTier();
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
  "anthropic:claude-sonnet-5": { in: 0.003, out: 0.015 }, // indicative — same caveat as the rest of this table
};

export function estimateCostUsd(provider: string, model: string, tokensIn: number, tokensOut: number): number {
  const rate = RATE_CARD[`${provider}:${model}`];
  if (!rate) return 0;
  return (tokensIn / 1000) * rate.in + (tokensOut / 1000) * rate.out;
}
