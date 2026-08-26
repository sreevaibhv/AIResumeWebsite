import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedJD, Tier } from "./types";

const OutputSchema = z.object({
  tier: z.enum(["Startup", "MNC", "PSU"]),
  reason: z.string(),
});
export type TierDetectionOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example: company="Zeta" (unknown, no other signal) -> {"tier":"MNC","reason":"No recognizable company signal — defaulting to MNC."}
Example: company="Ministry of Electronics and IT" -> {"tier":"PSU","reason":"Government department — folded into PSU."}
Example: company="Indian Oil Corporation Limited" -> {"tier":"PSU","reason":"Public sector undertaking."}
Example: company="Razorpay" -> {"tier":"Startup","reason":"Recognizable venture-backed startup."}
Example: company="Accenture" -> {"tier":"MNC","reason":"Large multinational services company."}
`.trim();

/**
 * Government tier is folded into PSU — see the Tier type comment in
 * types.ts. Any public-sector or government employer classifies as PSU.
 */
function buildPrompt(jd: ParsedJD): string {
  return `
You classify a job posting's hiring tier from its company name: Startup, MNC, or PSU. PSU includes government departments and public-sector undertakings. If the company name gives no usable signal (generic, fictional, or missing), default to MNC — that is the safest assumption for scoring calibration.

Return ONLY JSON matching this shape: {tier, reason}

${FEW_SHOT}

Company: ${JSON.stringify(jd.company || "(not given)")}
Job title: ${JSON.stringify(jd.title)}
`.trim();
}

export async function runTierDetectionAgent(jd: ParsedJD, scanId?: string) {
  const prompt = buildPrompt(jd);
  return completeStructured(prompt, OutputSchema, "TierDetectionAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set should cover: no company name (-> MNC default), an unambiguous startup, an unambiguous MNC, and a government department (-> PSU)." },
];
