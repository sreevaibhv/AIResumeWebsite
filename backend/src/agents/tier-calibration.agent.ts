import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume, Tier } from "./types";

const OutputSchema = z.object({
  adjustments: z.array(z.object({ area: z.string(), advice: z.string() })),
  tierNote: z.string(),
});
export type TierCalibrationOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example (tier=PSU): resume written in startup voice ("shipped", "owned end-to-end").
-> {"adjustments":[{"area":"Tone","advice":"PSU screening favors formal, role-and-responsibility phrasing over startup-style ownership language."}],"tierNote":"Structurally close to a private-sector resume; PSU screeners still expect a resume, not a government bio-data form."}
`.trim();

/**
 * §14 of the Master Plan: Government tier is explicitly unresolved — a
 * bio-data form (photograph, father's name, category, domicile) is a
 * different document type this agent cannot produce from a resume input.
 * Scoped down here to structural guidance only, per the third option listed
 * in §14, pending the product decision the doc says must happen before
 * Phase 2.
 */
function buildPrompt(resume: ParsedResume, tier: Tier): string {
  const govNote = tier === "Government"
    ? "\nNote: Government roles often require a bio-data format (photograph, father's name, category, domicile) that this resume cannot become. Give structural guidance toward that expectation; do not attempt to fabricate bio-data fields that aren't resume content."
    : "";
  return `
You give structural calibration advice for a resume targeting a specific hiring tier: Startup, MNC, PSU, or Government. Each tier reads differently — startups want ownership language and impact; MNC wants process and scale; PSU wants formal tone and clear designations; Government (see note) is closest to a different document type entirely.${govNote}

Return ONLY JSON matching this shape: {adjustments:[{area,advice}], tierNote}

${FEW_SHOT}

Resume: ${JSON.stringify(resume)}
Target tier: ${tier}
`.trim();
}

export async function runTierCalibrationAgent(resume: ParsedResume, tier: Tier, scanId?: string) {
  const prompt = buildPrompt(resume, tier);
  return completeStructured(prompt, OutputSchema, "TierCalibrationAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set to be populated once §14's Government-tier product decision is made — until then, Government output should be spot-checked manually, not golden-tested against an assumed shape." },
];
