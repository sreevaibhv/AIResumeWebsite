import { z } from "zod";
import { completeStructured } from "../llm/llm-provider";
import { ScoreResult, SemanticMatchResult, QualityResult, DeterministicResult } from "./types";

const OutputSchema = z.object({
  roadmap: z.array(z.object({
    rank: z.number(),
    fix: z.string(),
    gain: z.number(),
    conf: z.enum(["high", "medium", "low"]),
    evidence: z.string(),
  })),
});
export type RoadmapOutput = z.infer<typeof OutputSchema>;

const FEW_SHOT = `
Example: JD title appears 4× in the JD text, resume headline reads "Software Engineer" not "Backend Developer", Naukri weights title heavily.
-> {"rank":1,"fix":"Change your headline to \\"Backend Developer\\"","gain":8,"conf":"high","evidence":"JD title appears 4×; Naukri weights title match heavily."}
`.trim();

function buildPrompt(score: ScoreResult, det: DeterministicResult, semantic: SemanticMatchResult, quality: QualityResult): string {
  return `
You turn a scan's findings into a prioritized fix roadmap. Rank by point-gain descending. Each item needs a specific, concrete fix (not "improve keywords" — name the keyword and where it goes), an honest confidence level, and one sentence of evidence pulled from the actual findings below. Point gains across all items should roughly sum to what's realistically recoverable, not wildly exceed the points actually lost.

Return ONLY JSON matching this shape: {roadmap:[{rank,fix,gain,conf,evidence}]}

${FEW_SHOT}

Score breakdown: ${JSON.stringify(score)}
Deterministic findings: ${JSON.stringify(det)}
Semantic findings: ${JSON.stringify(semantic)}
Quality findings: ${JSON.stringify(quality)}
`.trim();
}

export async function runRoadmapAgent(
  score: ScoreResult,
  det: DeterministicResult,
  semantic: SemanticMatchResult,
  quality: QualityResult,
  scanId?: string,
) {
  const prompt = buildPrompt(score, det, semantic, quality);
  return completeStructured(prompt, OutputSchema, "RoadmapAgent", { scanId });
}

export const goldenTests: Array<{ note: string }> = [
  { note: "Golden set to be populated from real scans during Phase 1 — roadmap quality depends on realistic score/finding combinations." },
];
