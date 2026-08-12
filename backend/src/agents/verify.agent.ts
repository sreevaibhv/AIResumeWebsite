import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ParsedResume } from "./types";

const OutputSchema = z.object({
  passed: z.boolean(),
  flaggedClaims: z.array(z.object({ claim: z.string(), reason: z.string() })),
});
export type VerifyOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example: original resume never mentions Kubernetes anywhere. Rewrite adds "Kubernetes" to Skills.
-> flagged: {"claim":"Kubernetes","reason":"No mention of Kubernetes, container orchestration, or related tooling anywhere in the original resume."}

Example: original says "reduced latency", rewrite says "reduced latency 30%" with no number anywhere in the original.
-> flagged: {"claim":"reduced latency 30%","reason":"Original has no metric for this bullet; 30% is not traceable."}

Example: original describes "container orchestration with Docker Swarm", rewrite adds "Kubernetes" to Skills.
-> flagged: {"claim":"Kubernetes","reason":"Related but not the same technology as what the original describes — Docker Swarm ≠ Kubernetes."}
`.trim();

function buildPrompt(original: ParsedResume, rewritten: ParsedResume): string {
  return `
FR-8, a hard requirement: flag any claim in the rewritten resume that is not traceable to the original — new employers, new metrics with no basis, skills with zero evidence anywhere in the original, extended date ranges, or technologies that are merely adjacent to (not the same as) what the original describes. Be strict: "related" is not "traceable." passed=true only if there are zero flagged claims.

Return ONLY JSON matching this shape: {passed, flaggedClaims:[{claim,reason}]}

${FEW_SHOT}

Original resume: ${JSON.stringify(original)}
Rewritten resume: ${JSON.stringify(rewritten)}
`.trim();
}

export async function runVerifyAgent(original: ParsedResume, rewritten: ParsedResume, scanId?: string) {
  const prompt = buildPrompt(original, rewritten);
  return completeStructured(prompt, OutputSchema, "VerifyAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "This is the FR-8a safety-critical agent — golden set must include both true positives (real hallucinations, must flag) and true negatives (legitimate rephrasing, must pass) before any model downgrade is considered. Cheap models miss subtle unverifiable claims — invisible in testing, fatal in production (§8.2)." },
];
