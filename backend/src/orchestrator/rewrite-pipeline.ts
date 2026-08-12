import { PrismaClient } from "@prisma/client";
import { ParsedResume, ParsedJD, RoadmapItem, ScanOptions } from "../agents/types";
import { runRewriteAgent } from "../agents/rewrite.agent";
import { runVerifyAgent } from "../agents/verify.agent";
import { runRecruiterCommentAgent } from "../agents/recruiter-comment.agent";
import { runInterviewPrepAgent } from "../agents/interview-prep.agent";
import { ScanPipeline, ScanPipelineResult } from "./scan-pipeline";

export type RewritePipelineResult =
  | {
      status: "verified";
      resume: ParsedResume;
      changeSummary: string[];
      rescored: ScanPipelineResult;
      recruiterComments: Awaited<ReturnType<typeof runRecruiterCommentAgent>>["data"];
      interviewPrep: Awaited<ReturnType<typeof runInterviewPrepAgent>>["data"];
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
 */
export class RewritePipeline {
  constructor(private readonly prisma: PrismaClient) {}

  async run(
    original: ParsedResume,
    roadmap: RoadmapItem[],
    jd: ParsedJD,
    options: ScanOptions,
    scanId?: string,
    maxRetries = 2,
  ): Promise<RewritePipelineResult> {
    let rewritten = await runRewriteAgent(original, roadmap, undefined, scanId);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const verification = await runVerifyAgent(original, rewritten.data.resume, scanId);

      if (verification.data.passed) {
        const scanPipeline = new ScanPipeline(this.prisma);
        const [rescored, recruiterComments, interviewPrep] = await Promise.all([
          scanPipeline.runFromStructured(rewritten.data.resume, jd, options, scanId),
          runRecruiterCommentAgent(rewritten.data.resume, jd, scanId),
          runInterviewPrepAgent(rewritten.data.resume, jd, scanId),
        ]);
        return {
          status: "verified",
          resume: rewritten.data.resume,
          changeSummary: rewritten.data.changeSummary,
          rescored,
          recruiterComments: recruiterComments.data,
          interviewPrep: interviewPrep.data,
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
