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

function buildPrompt(resume: ParsedResume, tier: Tier): string {
  return `
You give structural calibration advice for a resume targeting a specific hiring tier: Startup, MNC, or PSU. Each tier reads differently — startups want ownership language and impact; MNC wants process and scale; PSU wants formal tone and clear designations.

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
  { note: "Golden set to be populated from real scans — one fixture per tier (Startup/MNC/PSU)." },
];
