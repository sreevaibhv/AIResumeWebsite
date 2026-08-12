import { ScanOptions, ParsedResume, ParsedJD } from "../agents/types";
import { runParseResumeAgent } from "../agents/parse-resume.agent";
import { runParseJDAgent } from "../agents/parse-jd.agent";
import { runDeterministicCheck } from "../agents/deterministic-check.agent";
import { runSemanticMatchAgent } from "../agents/semantic-match.agent";
import { runQualityAgent } from "../agents/quality.agent";
import { runNaukriScoreAgent } from "../agents/naukri-score.agent";
import { runTierCalibrationAgent } from "../agents/tier-calibration.agent";
import { runScoreAggregator } from "../agents/score-aggregator";
import { runRoadmapAgent } from "../agents/roadmap.agent";
import { PgVectorStore } from "../vector/pgvector.store";
import { PrismaClient } from "@prisma/client";

/**
 * ScanPipeline — Master Plan §8.3.
 *
 *   Wave 1  ParseResumeAgent ∥ ParseJDAgent                         2 calls
 *   Wave 2  DeterministicCheck(0) ∥ SemanticMatch ∥ Quality
 *           ∥ NaukriScore ∥ TierCalibration                         4 calls
 *           ScoreAggregator                                         0 calls
 *   Wave 3  RoadmapAgent                                            1 call
 *                                                          Total ≈ 7 calls
 *
 * FR-2 originally specified 3 batched calls; that was never achievable —
 * this is the corrected, real count (§13.1). Re-baseline cost/latency
 * ceilings against this, not the original spec.
 *
 * Fixes contradiction 13.6: this pipeline's signature takes raw text and an
 * explicit ScanOptions object (the source plan's RewritePipeline called
 * `new ScanPipeline().run(rewritten.data, jd)` with structured objects
 * against a raw-text signature and silently dropped options — both wrong).
 */
export interface ScanPipelineResult {
  resume: ParsedResume;
  jd: ParsedJD;
  score: ReturnType<typeof runScoreAggregator>;
  roadmap: Awaited<ReturnType<typeof runRoadmapAgent>>["data"]["roadmap"];
  naukri: Awaited<ReturnType<typeof runNaukriScoreAgent>>["data"];
  tierCalibration: Awaited<ReturnType<typeof runTierCalibrationAgent>>["data"];
  quality: Awaited<ReturnType<typeof runQualityAgent>>["data"];
  deterministic: ReturnType<typeof runDeterministicCheck>;
  semantic: Awaited<ReturnType<typeof runSemanticMatchAgent>>["data"];
}

export class ScanPipeline {
  constructor(private readonly prisma: PrismaClient) {}

  async run(resumeText: string, jdText: string, options: ScanOptions, scanId?: string): Promise<ScanPipelineResult> {
    return this.runParsed(resumeText, jdText, options, scanId);
  }

  /** Entry point for the rewrite pipeline, which already has structured objects — no re-parsing needed. */
  async runFromStructured(resume: ParsedResume, jd: ParsedJD, options: ScanOptions, scanId?: string): Promise<ScanPipelineResult> {
    return this.runCore(resume, jd, options, scanId);
  }

  private async runParsed(resumeText: string, jdText: string, options: ScanOptions, scanId?: string): Promise<ScanPipelineResult> {
    // Wave 1 — 2 calls
    const [resumeResult, jdResult] = await Promise.all([
      runParseResumeAgent(resumeText, scanId),
      runParseJDAgent(jdText, scanId),
    ]);
    return this.runCore(resumeResult.data, jdResult.data, options, scanId);
  }

  private async runCore(resume: ParsedResume, jd: ParsedJD, options: ScanOptions, scanId?: string): Promise<ScanPipelineResult> {
    const vectorStore = new PgVectorStore(this.prisma);
    const resumeTerms = [...resume.skills, ...resume.experience.flatMap((e) => e.bullets), ...resume.projects.flatMap((p) => p.bullets)];
    const jdTerms = [...jd.mustHaveSkills, ...jd.niceToHaveSkills, ...jd.responsibilities];
    const candidates = await vectorStore.matchCandidates(resumeTerms, jdTerms);

    // Wave 2 — deterministic (0 calls) ∥ 4 LLM calls
    const deterministic = runDeterministicCheck(resume, jd);
    const [semanticResult, qualityResult, naukriResult, tierResult] = await Promise.all([
      runSemanticMatchAgent(resume, jd, candidates, options, scanId),
      runQualityAgent(resume, scanId),
      runNaukriScoreAgent(resume, jd, deterministic, scanId),
      runTierCalibrationAgent(resume, options.tier, scanId),
    ]);

    const score = runScoreAggregator(
      deterministic,
      semanticResult.data,
      qualityResult.data,
      naukriResult.data,
      resume,
      options,
    );

    // Wave 3 — 1 call
    const roadmapResult = await runRoadmapAgent(score, deterministic, semanticResult.data, qualityResult.data, scanId);

    return {
      resume,
      jd,
      score,
      roadmap: roadmapResult.data.roadmap,
      naukri: naukriResult.data,
      tierCalibration: tierResult.data,
      quality: qualityResult.data,
      deterministic,
      semantic: semanticResult.data,
    };
  }
}
