import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";

const OutputSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
  }),
  headline: z.string(),
  summary: z.string(),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    start: z.string(),
    end: z.string(),
    bullets: z.array(z.string()),
  })),
  projects: z.array(z.object({ name: z.string(), bullets: z.array(z.string()) })),
  skills: z.array(z.string()),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
});
export type ParseResumeOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example input:
"John Doe | john@mail.com | 9876543210 | linkedin.com/in/johndoe
Backend Engineer
Experience: Software Engineer at Acme (Jan 2023 - Present). Built a payments service handling 5k rps. Reduced latency 30%.
Skills: Node.js, PostgreSQL"

Example output:
{"contact":{"name":"John Doe","email":"john@mail.com","phone":"9876543210","linkedin":"linkedin.com/in/johndoe"},"headline":"Backend Engineer","summary":"","experience":[{"title":"Software Engineer","company":"Acme","start":"2023-01","end":"Present","bullets":["Built a payments service handling 5k rps","Reduced latency 30%"]}],"projects":[],"skills":["Node.js","PostgreSQL"],"education":[],"certifications":[]}
`.trim();

function buildPrompt(resumeText: string): string {
  return `
You parse raw resume text into structured JSON. Extract only what is actually present — never invent dates, employers, or skills that aren't in the text. If a field is unknown, use an empty string or empty array.

Return ONLY JSON matching this shape: {contact:{name,email,phone,linkedin?,github?}, headline, summary, experience:[{title,company,start,end,bullets[]}], projects:[{name,bullets[]}], skills[], education:[{degree,institution,year}], certifications[]}

${FEW_SHOT}

Now parse this resume:
"""
${resumeText}
"""
`.trim();
}

export async function runParseResumeAgent(resumeText: string, scanId?: string) {
  const prompt = buildPrompt(resumeText);
  return completeStructured(prompt, OutputSchema, "ParseResumeAgent", { scanId });
}

export const goldenTests = [
  {
    input: "Jane Smith | jane@x.com | 9123456789\nFrontend Developer\nSkills: React, TypeScript",
    expectPartial: { headline: "Frontend Developer", skills: ["React", "TypeScript"] },
  },
];
