import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume, ParsedJD } from "./types";

const OutputSchema = z.object({
  technical: z.array(z.object({ question: z.string(), why: z.string() })),
  hr: z.array(z.object({ question: z.string(), why: z.string() })),
});
export type InterviewPrepOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example technical: {"question":"Walk me through how you'd scale the payments service you mention to 10x traffic.","why":"Directly probes the one concrete system you claim ownership of — expect this to come up."}
Example HR: {"question":"Tell me about a time a project didn't go as planned.","why":"Standard behavioral opener; your resume doesn't mention any setbacks, so have one ready."}
`.trim();

function buildPrompt(resume: ParsedResume, jd: ParsedJD): string {
  return `
You generate interview prep questions grounded in the actual resume and JD — not generic question banks. Technical questions should probe specific claims in the resume against what the JD needs. HR/behavioral questions should anticipate what a recruiter would ask given gaps or transitions visible in the resume. 4-6 technical, 3-4 HR, each with a one-line "why this" note.

Return ONLY JSON matching this shape: {technical:[{question,why}], hr:[{question,why}]}

${FEW_SHOT}

Resume: ${JSON.stringify(resume)}
JD: ${JSON.stringify(jd)}
`.trim();
}

export async function runInterviewPrepAgent(resume: ParsedResume, jd: ParsedJD, scanId?: string) {
  const prompt = buildPrompt(resume, jd);
  return completeStructured(prompt, OutputSchema, "InterviewPrepAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set to be populated during Phase 2 build (§9) alongside RewritePipeline wiring." },
];
