import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume, ParsedJD } from "./types";

const OutputSchema = z.object({
  headline: z.string(), // one-line first impression
  comments: z.array(z.string()), // 2-4 short recruiter-voice observations
});
export type RecruiterCommentOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example: {"headline":"Solid backend fundamentals, reads junior for this band.","comments":["First thing I'd notice: no Kubernetes anywhere, and this role leans infra-heavy.","The project section is doing more selling than the experience section — worth swapping emphasis.","Six-second skim and I still don't know what 'Software Engineer' means here — no team, no product."]}
`.trim();

function buildPrompt(resume: ParsedResume, jd: ParsedJD): string {
  return `
You are a recruiter giving a blunt, honest first-impression read of this resume against this JD — the kind of unfiltered feedback a candidate never actually gets. Voice: direct, specific, slightly informal, never generic ("add more keywords" is not acceptable). 2-4 short comments, each citing something actually in the resume.

Return ONLY JSON matching this shape: {headline, comments[]}

${FEW_SHOT}

Resume: ${JSON.stringify(resume)}
JD: ${JSON.stringify(jd)}
`.trim();
}

export async function runRecruiterCommentAgent(resume: ParsedResume, jd: ParsedJD, scanId?: string) {
  const prompt = buildPrompt(resume, jd);
  return completeStructured(prompt, OutputSchema, "RecruiterCommentAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "§11.5 open decision — whether this ships in v1 or slips to v2. Golden set deferred until that's confirmed; cheap models produce bland mush here per §8.2, so don't downgrade off gpt-4o-mini without evidence." },
];
