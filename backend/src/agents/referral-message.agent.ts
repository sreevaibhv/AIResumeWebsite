import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume } from "./types";

const OutputSchema = z.object({ message: z.string() });
export type ReferralMessageOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example: contactName="Priya", company="Zeta", role="Backend Developer II"
-> {"message":"Hi Priya, hope you're doing well! I'm applying for the Backend Developer II role at Zeta and really admire the team's work on [specific, if known]. I've spent the last 1.5 years building backend services with Node.js and PostgreSQL — happy to share my resume if you'd be open to a referral. No pressure either way, thanks for considering it!"}
`.trim();

function buildPrompt(resume: ParsedResume, targetCompany: string, targetRole: string, contactName?: string): string {
  return `
You draft a short referral-request message an Indian job seeker can send to a contact at a target company via LinkedIn or WhatsApp. Tone: warm, brief, low-pressure, specific about what the sender actually brings (pulled from their resume) — never generic "I saw you work at X" filler. 80-120 words.

Return ONLY JSON matching this shape: {message}

${FEW_SHOT}

Resume: ${JSON.stringify(resume)}
Target company: ${targetCompany}
Target role: ${targetRole}
Contact name: ${contactName ?? "(not given — use a generic greeting)"}
`.trim();
}

export async function runReferralMessageAgent(
  resume: ParsedResume,
  targetCompany: string,
  targetRole: string,
  contactName?: string,
  scanId?: string,
) {
  const prompt = buildPrompt(resume, targetCompany, targetRole, contactName);
  return completeStructured(prompt, OutputSchema, "ReferralMessageAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set to be populated in Phase 3 (§9) alongside the referral flow build." },
];
