import { PrismaClient } from "@prisma/client";
import { ParsedResume, ParsedJD, RoadmapItem, ScanOptions, Tier } from "../agents/types";
import { runRewriteAgent } from "../agents/rewrite.agent";
import { runVerifyAgent } from "../agents/verify.agent";
import { ScanPipeline, ScanPipelineResult } from "./scan-pipeline";

export type RewritePipelineResult =
  | {
      status: "verified";
      resume: ParsedResume;
      changeSummary: string[];
      rescored: ScanPipelineResult;
    }
  | {
      status: "verification_failed";
      resume: ParsedResume; // the ORIGINAL — never ship an unverified rewrite (FR-8a)
      flaggedClaims: Array<{ claim: string; reason: string }>;
    };

/**
 * RewritePipeline — Master Plan §8.3, corrected.
 *
 * §13.2: the source plan's retry loop broke out and returned the unverified
 * rewrite anyway once retries were exhausted — it failed *open*, directly
 * contradicting FR-8 and the reliability NFR ("rewrite output never
 * introduces unverifiable claims, hard requirement, not best-effort").
 * FR-8a fixes this: on exhausted retries, return the ORIGINAL resume plus
 * the flagged claims. The pipeline fails closed — it never ships an
 * unverified rewrite, full stop.
 *
 * §13.6: also fixes the source plan's `new ScanPipeline().run(rewritten.data, jd)`
 * call, which passed structured objects into a signature expecting raw text
 * and silently dropped `options`. This uses ScanPipeline.runFromStructured
 * with options threaded through explicitly.
 *
 * Spec §4/§7: RecruiterCommentAgent and InterviewPrepAgent used to run
 * inside the success branch here, on every rewrite, whether or not either
 * result was ever displayed. Both are now on-demand-only (ScanService),
 * so this pipeline does exactly one thing: rewrite, verify, rescore.
 */
export class RewritePipeline {
  constructor(private readonly prisma: PrismaClient) {}

  async run(
    original: ParsedResume,
    roadmap: RoadmapItem[],
    jd: ParsedJD,
    tier: Tier,
    options: ScanOptions,
    scanId?: string,
    maxRetries = 2,
  ): Promise<RewritePipelineResult> {
    let rewritten = await runRewriteAgent(original, roadmap, undefined, scanId);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const verification = await runVerifyAgent(original, rewritten.data.resume, scanId);

      if (verification.data.passed) {
        const scanPipeline = new ScanPipeline(this.prisma);
        const rescored = await scanPipeline.runFromStructured(rewritten.data.resume, jd, tier, options, scanId);
        return {
          status: "verified",
          resume: rewritten.data.resume,
          changeSummary: rewritten.data.changeSummary,
          rescored,
        };
      }

      if (attempt === maxRetries) {
        // Fail closed — never ship it (FR-8a).
        return {
          status: "verification_failed",
          resume: original,
          flaggedClaims: verification.data.flaggedClaims,
        };
      }

      rewritten = await runRewriteAgent(original, roadmap, verification.data.flaggedClaims, scanId);
    }

    // Unreachable — the loop always returns on the final iteration above.
    throw new Error("RewritePipeline: retry loop exited without a terminal result.");
  }
}
