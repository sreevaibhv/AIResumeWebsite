import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume, RoadmapItem } from "./types";

const ResumeShape = z.object({
  contact: z.object({
    name: z.string(), email: z.string(), phone: z.string(),
    linkedin: z.string().optional(), github: z.string().optional(),
  }),
  headline: z.string(),
  summary: z.string(),
  experience: z.array(z.object({
    title: z.string(), company: z.string(), start: z.string(), end: z.string(), bullets: z.array(z.string()),
  })),
  projects: z.array(z.object({ name: z.string(), bullets: z.array(z.string()) })),
  skills: z.array(z.string()),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
});

const OutputSchema = z.object({ resume: ResumeShape, changeSummary: z.array(z.string()) });
export type RewriteOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example roadmap item: {"fix":"Add Kubernetes and gRPC to Skills","gain":9}
Only apply this if the candidate's actual resume content supports it — e.g. an experience bullet already describes container orchestration, so "Kubernetes" is a fair addition to Skills. Never add a skill with zero supporting evidence anywhere in the original resume.
`.trim();

function buildPrompt(resume: ParsedResume, roadmap: RoadmapItem[], flaggedClaims?: Array<{ claim: string; reason: string }>): string {
  const correction = flaggedClaims?.length
    ? `\n\nYour previous rewrite was rejected — these claims could not be traced to the original resume, fix them:\n${JSON.stringify(flaggedClaims)}\nEither remove the claim or ground it in something the original resume actually says.`
    : "";
  return `
You rewrite a resume to close gaps identified in a fix roadmap, addressing the highest point-gain items first. Hard rule, non-negotiable: every claim in the rewrite must be traceable to the original resume — same employer, same dates, same scope. You may sharpen phrasing, add a metric that's a reasonable estimate the candidate could defend, restructure for clarity, or surface a skill that's clearly evidenced in a bullet but missing from the Skills list. You may NOT invent a new employer, a new metric with no basis, a skill with zero evidence anywhere, or extend a date range.

Return ONLY JSON matching this shape: {resume:{...same shape as input...}, changeSummary:[...one line per meaningful change...]}

${FEW_SHOT}${correction}

Original resume: ${JSON.stringify(resume)}
Roadmap (address highest gain first): ${JSON.stringify(roadmap)}
`.trim();
}

export async function runRewriteAgent(
  resume: ParsedResume,
  roadmap: RoadmapItem[],
  flaggedClaims?: Array<{ claim: string; reason: string }>,
  scanId?: string,
) {
  const prompt = buildPrompt(resume, roadmap, flaggedClaims);
  return completeStructured(prompt, OutputSchema, "RewriteAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set must include at least one deliberate hallucination-bait case (roadmap item requesting a skill with zero evidence in the source resume) — the agent should decline it, not fabricate support. Populate during Phase 2 build (§9)." },
];
