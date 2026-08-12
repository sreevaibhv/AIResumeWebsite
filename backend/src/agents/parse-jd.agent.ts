import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";

const OutputSchema = z.object({
  title: z.string(),
  company: z.string(),
  seniority: z.string(),
  minYearsExperience: z.number(),
  mustHaveSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
});
export type ParseJDOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example input:
"Backend Developer II - Zeta. 2-4 years experience. Required: Node.js, Kubernetes, gRPC. Nice to have: Terraform. Own service reliability and mentor juniors."

Example output:
{"title":"Backend Developer II","company":"Zeta","seniority":"Mid","minYearsExperience":2,"mustHaveSkills":["Node.js","Kubernetes","gRPC"],"niceToHaveSkills":["Terraform"],"responsibilities":["Own service reliability","Mentor juniors"]}
`.trim();

function buildPrompt(jdText: string): string {
  return `
You parse a raw job description into structured JSON. Distinguish must-have from nice-to-have skills based on language like "required" vs "preferred"/"bonus". Infer seniority (Junior/Mid/Senior/Staff) from years-of-experience language and title.

Return ONLY JSON matching this shape: {title, company, seniority, minYearsExperience, mustHaveSkills[], niceToHaveSkills[], responsibilities[]}

${FEW_SHOT}

Now parse this job description:
"""
${jdText}
"""
`.trim();
}

export async function runParseJDAgent(jdText: string, scanId?: string) {
  const prompt = buildPrompt(jdText);
  return completeStructured(prompt, OutputSchema, "ParseJDAgent", { scanId });
}

export const goldenTests = [
  {
    input: "Frontend Engineer at Acme. 0-1 years. Required: React, TypeScript.",
    expectPartial: { seniority: "Junior", mustHaveSkills: ["React", "TypeScript"] },
  },
];
