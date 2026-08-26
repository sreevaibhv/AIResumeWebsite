import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import { ScanPipeline, ScanPipelineResult } from "../orchestrator/scan-pipeline";
import { RewritePipeline } from "../orchestrator/rewrite-pipeline";
import { applyDeterministicFixes } from "../orchestrator/deterministic-fixes";
import { computeCeiling, ConfirmedSkills } from "../scoring/achievable-ceiling";
import { computeVerdict } from "../scoring/verdict";
import { CreateScanDto } from "./dto/create-scan.dto";
import { ConfirmScanDto } from "./dto/confirm-scan.dto";
import { EditResumeVersionDto } from "./dto/edit-resume.dto";
import { runInterviewPrepAgent } from "../agents/interview-prep.agent";
import { runReferralMessageAgent } from "../agents/referral-message.agent";
import { runRecruiterCommentAgent } from "../agents/recruiter-comment.agent";
import { runNaukriOptimizationAgent } from "../agents/naukri-score.agent";
import { runVerifyAgent } from "../agents/verify.agent";
import { render, ExportFormat, contentType } from "../export/render";
import { ScanOptions, Tier, ParsedResume, ParsedJD, DeterministicResult, ScoreResult, ScoreCategory } from "../agents/types";
import { Tier as PrismaTier, Scan, Prisma } from "@prisma/client";

@Injectable()
export class ScanService {
  private readonly scanPipeline: ScanPipeline;
  private readonly rewritePipeline: RewritePipeline;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.scanPipeline = new ScanPipeline(this.prisma);
    this.rewritePipeline = new RewritePipeline(this.prisma);
  }

  async createScan(dto: CreateScanDto, userId?: string) {
    const options: ScanOptions = {
      fresherMode: dto.fresherMode ?? false,
    };

    // FR-6 — identical resume+JD+options pairs return cached results and
    // consume no credit. Cache hit path never touches the pipeline.
    const cacheKey = RedisService.cacheKey(dto.resumeText, dto.jdText, options);
    const cached = await this.redis.getScanResult<{ scanId: string }>(cacheKey);
    if (cached) {
      const existing = await this.prisma.scan.findUnique({ where: { id: cached.scanId } });
      if (existing && existing.status === "COMPLETE") {
        return this.attributeCachedScan(existing, userId);
      }
    }

    const scan = await this.prisma.scan.create({
      data: {
        userId,
        status: "RUNNING",
        cacheKey,
        resumeText: dto.resumeText,
        jdText: dto.jdText,
        fresherMode: options.fresherMode,
      },
    });

    try {
      // Tier is detected from the JD inside the pipeline, not supplied here.
      const result = await this.scanPipeline.run(dto.resumeText, dto.jdText, options, scan.id);

      // §2/§3 — achievable ceiling + verdict, both pure arithmetic. No
      // confirmations exist yet on a fresh scan, so this is the
      // conservative baseline the confirm endpoint later recomputes.
      const ceiling = computeCeiling(result.score, result.deterministic, result.quality, result.resume, null);
      const verdict = computeVerdict(result.score, result.deterministic, result.jd, ceiling, null);

      const updated = await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETE",
          tier: result.tier.toUpperCase() as PrismaTier,
          resumeParsed: result.resume as any,
          jdParsed: result.jd as any,
          score: result.score as any,
          roadmap: result.roadmap as any,
          naukri: result.naukri as any,
          details: {
            deterministic: result.deterministic,
            quality: result.quality,
            semantic: result.semantic,
            tierCalibration: result.tierCalibration,
            tierReason: result.tierReason,
          } as any,
          verdict: verdict as any,
        },
      });
      await this.prisma.resumeVersion.create({
        data: { scanId: scan.id, kind: "original", content: result.resume as any, verified: true },
      });
      await this.redis.setScanResult(cacheKey, { scanId: scan.id });
      return updated;
    } catch (err) {
      await this.prisma.scan.update({
        where: { id: scan.id },
        data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown pipeline error" },
      });
      // FR-20 — credit refund on pipeline failure happens here once credit
      // gating (Phase 3) is wired; no-op today since credits aren't live yet.
      throw err;
    }
  }

  /**
   * Reconcile a cache hit with who is asking for it.
   *
   * FR-6 says identical inputs must not re-run the pipeline. It does not
   * say the result belongs to whoever ran it first — and once scans have
   * owners (BE-1) that distinction matters: without this, a signed-in
   * user whose resume+JD was already scanned by anyone gets a row owned
   * by someone else, and their analysis never appears in their dashboard.
   *
   *   unowned + signed-in  → claim it (this is the signup-after-scan path)
   *   already theirs       → return as-is
   *   owned by another     → copy the results onto a new row for them
   *
   * Every branch still skips the pipeline, so the cost saving stands.
   */
  private async attributeCachedScan(existing: Scan, userId?: string): Promise<Scan> {
    if (!userId || existing.userId === userId) return existing;

    if (existing.userId === null) {
      return this.prisma.scan.update({ where: { id: existing.id }, data: { userId } });
    }

    const copy = await this.prisma.scan.create({
      data: {
        userId,
        status: existing.status,
        cacheKey: existing.cacheKey,
        resumeText: existing.resumeText,
        jdText: existing.jdText,
        tier: existing.tier,
        fresherMode: existing.fresherMode,
        resumeParsed: existing.resumeParsed ?? undefined,
        jdParsed: existing.jdParsed ?? undefined,
        score: existing.score ?? undefined,
        roadmap: existing.roadmap ?? undefined,
        naukri: existing.naukri ?? undefined,
        details: existing.details ?? undefined,
        verdict: existing.verdict ?? undefined,
      },
    });

    // The improve and diff endpoints both start from the "original"
    // version, so the copy needs one of its own.
    const original = await this.prisma.resumeVersion.findFirst({
      where: { scanId: existing.id, kind: "original" },
    });
    if (original?.content != null) {
      await this.prisma.resumeVersion.create({
        data: {
          scanId: copy.id,
          kind: "original",
          content: original.content as Prisma.InputJsonValue,
          verified: true,
        },
      });
    }

    return copy;
  }

  /**
   * BE-1 — the signed-in user's scans, newest first.
   *
   * Deliberately projects a summary rather than returning whole scans:
   * a list of 25 full rows would ship 25 resumes, 25 job descriptions
   * and 25 complete pipeline outputs to render a few cards.
   */
  async listScans(userId: string, take = 25) {
    const scans = await this.prisma.scan.findMany({
      where: { userId, status: "COMPLETE" },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 100),
      select: {
        id: true,
        status: true,
        tier: true,
        fresherMode: true,
        score: true,
        roadmap: true,
        jdParsed: true,
        verdict: true,
        createdAt: true,
        resumeVersions: { select: { kind: true, verified: true } },
        interviewPreps: { select: { id: true } },
      },
    });

    return scans.map((scan) => ({
      id: scan.id,
      status: scan.status,
      tier: scan.tier,
      fresherMode: scan.fresherMode,
      createdAt: scan.createdAt,
      score: scan.score,
      verdict: (scan.verdict as { verdict?: string } | null)?.verdict ?? null,
      // The list only needs how many fixes remain and what they are worth.
      roadmapCount: Array.isArray(scan.roadmap) ? scan.roadmap.length : 0,
      roadmapGain: Array.isArray(scan.roadmap)
        ? (scan.roadmap as Array<{ gain?: number }>).reduce((n, r) => n + (r?.gain ?? 0), 0)
        : 0,
      role: (scan.jdParsed as { title?: string } | null)?.title ?? null,
      company: (scan.jdParsed as { company?: string } | null)?.company ?? null,
      optimized: scan.resumeVersions.some((v) => (v.kind === "rewritten" && v.verified) || v.kind === "edited"),
      hasPrep: scan.interviewPreps.length > 0,
    }));
  }

  async getScan(id: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id },
      include: { resumeVersions: true, interviewPreps: true, naukriOptimizations: true },
    });
    if (!scan) throw new NotFoundException(`Scan ${id} not found`);
    return scan;
  }

  /**
   * Every LLM-burning or data-mutating endpoint below needs this. An
   * unowned scan (started before signup) is claimed by the first
   * signed-in caller — mirroring attributeCachedScan's "unowned +
   * signed-in → claim it" rule — rather than left permanently orphaned.
   */
  private async assertOwnsScan<T extends Scan>(scan: T, userId: string): Promise<T> {
    if (scan.userId === userId) return scan;
    if (scan.userId === null) {
      await this.prisma.scan.update({ where: { id: scan.id }, data: { userId } });
      return { ...scan, userId };
    }
    throw new ForbiddenException("You do not have access to this scan.");
  }

  /** spec §2.2 — persist confirmed must-haves/profile links, recompute the ceiling and verdict. */
  async confirmScan(id: string, userId: string, dto: ConfirmScanDto) {
    const scan = await this.assertOwnsScan(await this.getScan(id), userId);
    if (scan.status !== "COMPLETE" || !scan.score || !scan.jdParsed || !scan.resumeParsed || !scan.details) {
      throw new BadRequestException("Scan must complete successfully before confirming keywords.");
    }

    const confirmed: ConfirmedSkills = {
      skills: dto.skills ?? [],
      contact: dto.contact ?? {},
    };

    const details = scan.details as any;
    const ceiling = computeCeiling(
      scan.score as unknown as ScoreResult,
      details.deterministic as DeterministicResult,
      details.quality,
      scan.resumeParsed as unknown as ParsedResume,
      confirmed,
    );
    const verdict = computeVerdict(
      scan.score as unknown as ScoreResult,
      details.deterministic as DeterministicResult,
      scan.jdParsed as unknown as ParsedJD,
      ceiling,
      confirmed,
    );

    await this.prisma.scan.update({
      where: { id: scan.id },
      data: { confirmedSkills: confirmed as any, verdict: verdict as any },
    });

    return verdict;
  }

  /**
   * spec §4 — POST /scan/:id/improve. Replaces the old /rewrite. Reuses
   * stored data only: no re-scan, no re-parse, no re-detect.
   *
   *   1. deterministic fixes (code) — confirmed keywords + profile links,
   *      normalised email/phone (invariant #1: only what the user supplied)
   *   2. RewriteAgent → VerifyAgent, fail-closed (invariant #2)
   *   3. re-score via ScanPipeline.runFromStructured against the stored tier
   */
  async improveScan(id: string, userId: string) {
    const scan = await this.assertOwnsScan(await this.getScan(id), userId);
    if (scan.status !== "COMPLETE" || !scan.resumeParsed || !scan.jdParsed || !scan.roadmap || !scan.details) {
      throw new BadRequestException("Scan must complete successfully before it can be improved.");
    }
    const options: ScanOptions = { fresherMode: scan.fresherMode };
    const jd = scan.jdParsed as unknown as ParsedJD;
    const det = (scan.details as any).deterministic as DeterministicResult;
    const confirmed = (scan.confirmedSkills as unknown as ConfirmedSkills | null) ?? null;
    const jdSkills = [...jd.mustHaveSkills, ...jd.niceToHaveSkills];

    const baseResume = applyDeterministicFixes(scan.resumeParsed as unknown as ParsedResume, det, confirmed, jdSkills);
    const beforeScore = (scan.score as unknown as ScoreResult).generic;

    const result = await this.rewritePipeline.run(
      baseResume,
      scan.roadmap as any,
      jd,
      toTierLabel(scan.tier),
      options,
      scan.id,
    );

    if (result.status === "verification_failed") {
      const version = await this.prisma.resumeVersion.create({
        data: {
          scanId: scan.id,
          kind: "rewritten",
          content: result.resume as any,
          verified: false,
          flagged: result.flaggedClaims as any,
          beforeScore,
        },
      });
      return {
        status: "verification_failed" as const,
        structuredResume: result.resume,
        flaggedClaims: result.flaggedClaims,
        resumeVersionId: version.id,
      };
    }

    const afterScore = result.rescored.score.generic;
    const categoryDelta = computeCategoryDelta(
      (scan.score as unknown as ScoreResult).categories,
      result.rescored.score.categories,
    );

    const version = await this.prisma.resumeVersion.create({
      data: {
        scanId: scan.id,
        kind: "rewritten",
        content: result.resume as any,
        verified: true,
        diff: { changeSummary: result.changeSummary, rescored: result.rescored.score } as any,
        beforeScore,
        afterScore,
        scoreDelta: categoryDelta as any,
      },
    });

    return {
      status: "verified" as const,
      structuredResume: result.resume,
      changeSummary: result.changeSummary,
      beforeScore,
      afterScore,
      categoryDelta,
      resumeVersionId: version.id,
    };
  }

  /**
   * Phase C — POST /scan/:id/resume-versions. A human-authored edit, not an
   * AI rewrite: VerifyAgent still runs, but purely advisory — the reasoning
   * behind RewritePipeline's fail-closed gate (stopping an LLM from
   * inventing a plausible lie) doesn't transfer to a user editing their own
   * resume, who may legitimately add real content the original never
   * mentioned. This method therefore has exactly one terminal branch: the
   * edit is always persisted as submitted, and the advisory outcome is
   * reported alongside it, never used to withhold the save.
   *
   * VerifyAgent's baseline is always scan.resumeParsed (the true original),
   * never a prior edited/rewritten version — chaining would let an earlier
   * fabrication "pass" a later check just because it only has to trace back
   * to already-unverified content. Score deltas are likewise diffed against
   * the scan's original score (matching improveScan's own convention), so a
   * second saved edit shows cumulative progress, not incremental-since-last-save.
   */
  async saveEditedVersion(id: string, userId: string, dto: EditResumeVersionDto) {
    const scan = await this.assertOwnsScan(await this.getScan(id), userId);
    if (scan.status !== "COMPLETE" || !scan.resumeParsed || !scan.jdParsed || !scan.roadmap || !scan.details) {
      throw new BadRequestException("Scan must complete successfully before it can be edited.");
    }

    const editedResume = dto as unknown as ParsedResume;
    const originalResume = scan.resumeParsed as unknown as ParsedResume;
    const jd = scan.jdParsed as unknown as ParsedJD;
    const options: ScanOptions = { fresherMode: scan.fresherMode };
    const confirmed = (scan.confirmedSkills as unknown as ConfirmedSkills | null) ?? null;

    const verification = await runVerifyAgent(originalResume, editedResume, scan.id);

    const rescored = await this.scanPipeline.runFromStructured(editedResume, jd, toTierLabel(scan.tier), options, scan.id);

    const ceiling = computeCeiling(rescored.score, rescored.deterministic, rescored.quality, editedResume, confirmed);
    const verdict = computeVerdict(rescored.score, rescored.deterministic, jd, ceiling, confirmed);

    const beforeScore = (scan.score as unknown as ScoreResult).generic;
    const afterScore = rescored.score.generic;
    const categoryDelta = computeCategoryDelta((scan.score as unknown as ScoreResult).categories, rescored.score.categories);

    const version = await this.prisma.resumeVersion.create({
      data: {
        scanId: scan.id,
        kind: "edited",
        // Unlike "rewritten", `content` is never gated by `verified` here —
        // an edit is always persisted as submitted.
        content: editedResume as any,
        verified: verification.data.passed,
        flagged: verification.data.passed ? undefined : (verification.data.flaggedClaims as any),
        diff: { rescored: rescored.score, verdict } as any,
        beforeScore,
        afterScore,
        scoreDelta: categoryDelta as any,
      },
    });

    return {
      status: "saved" as const,
      resumeVersionId: version.id,
      structuredResume: editedResume,
      beforeScore,
      afterScore,
      categoryDelta,
      score: rescored.score,
      verdict,
      advisory: { passed: verification.data.passed, flaggedClaims: verification.data.flaggedClaims },
    };
  }

  /** spec §7 — generated on demand; no longer gated behind an improve. */
  async generateInterviewPrep(id: string, userId: string) {
    const scan = await this.assertOwnsScan(await this.getScan(id), userId);
    if (scan.status !== "COMPLETE" || !scan.resumeParsed || !scan.jdParsed) {
      throw new BadRequestException("Scan must complete successfully before generating interview prep.");
    }
    const prep = await runInterviewPrepAgent(
      scan.resumeParsed as unknown as ParsedResume,
      scan.jdParsed as unknown as ParsedJD,
      scan.id,
    );
    return this.prisma.interviewPrepSet.create({
      data: { scanId: scan.id, technical: prep.data.technical as any, hr: prep.data.hr as any },
    });
  }

  async getInterviewPrep(scanId: string) {
    const prep = await this.prisma.interviewPrepSet.findFirst({ where: { scanId }, orderBy: { createdAt: "desc" } });
    if (!prep) throw new NotFoundException(`No interview prep generated yet for scan ${scanId} — generate it first.`);
    return prep;
  }

  /** spec §7 — return-only, no persistence; one CHEAP call is cheaper than storing and invalidating a draft. */
  async referralMessage(id: string, userId: string, contactName?: string) {
    const scan = await this.assertOwnsScan(await this.getScan(id), userId);
    if (scan.status !== "COMPLETE" || !scan.resumeParsed || !scan.jdParsed) {
      throw new BadRequestException("Scan must complete successfully before drafting a referral message.");
    }
    const jd = scan.jdParsed as unknown as ParsedJD;
    const result = await runReferralMessageAgent(
      scan.resumeParsed as unknown as ParsedResume,
      jd.company,
      jd.title,
      contactName,
      scan.id,
    );
    return result.data;
  }

  /**
   * Phase D — portal-optimisation advice, on demand; mirrors
   * generateInterviewPrep/getInterviewPrep exactly. Reuses
   * scan.details.deterministic rather than recomputing it: deterministic
   * checks are a pure function of resume+JD text, which hasn't changed
   * since the original scan.
   */
  async generatePortalOptimization(id: string, userId: string) {
    const scan = await this.assertOwnsScan(await this.getScan(id), userId);
    if (scan.status !== "COMPLETE" || !scan.resumeParsed || !scan.jdParsed || !scan.details) {
      throw new BadRequestException("Scan must complete successfully before generating portal optimization advice.");
    }
    const det = (scan.details as any).deterministic as DeterministicResult;
    const result = await runNaukriOptimizationAgent(
      scan.resumeParsed as unknown as ParsedResume,
      scan.jdParsed as unknown as ParsedJD,
      det,
      scan.id,
    );
    return this.prisma.naukriOptimizationSet.create({
      data: {
        scanId: scan.id,
        headlineFix: result.data.headlineFix as any,
        literalTermSwaps: result.data.literalTermSwaps as any,
        recencyFixes: result.data.recencyFixes as any,
        summary: result.data.summary,
      },
    });
  }

  async getPortalOptimization(scanId: string) {
    const opt = await this.prisma.naukriOptimizationSet.findFirst({ where: { scanId }, orderBy: { createdAt: "desc" } });
    if (!opt) throw new NotFoundException(`No portal optimization generated yet for scan ${scanId} — generate it first.`);
    return opt;
  }

  /** spec §4 — pulled out of the improve pipeline; it was paid for on every rewrite and never displayed. */
  async recruiterComment(id: string, userId: string) {
    const scan = await this.assertOwnsScan(await this.getScan(id), userId);
    if (scan.status !== "COMPLETE" || !scan.resumeParsed || !scan.jdParsed) {
      throw new BadRequestException("Scan must complete successfully before generating recruiter comments.");
    }
    const result = await runRecruiterCommentAgent(
      scan.resumeParsed as unknown as ParsedResume,
      scan.jdParsed as unknown as ParsedJD,
      scan.id,
    );
    return result.data;
  }

  /** spec §5 — export never calls an LLM; pure rendering from a stored ResumeVersion's structured content. */
  async exportResumeVersion(versionId: string, userId: string, templateId: string | undefined, format: ExportFormat) {
    const version = await this.prisma.resumeVersion.findUnique({ where: { id: versionId }, include: { scan: true } });
    if (!version) throw new NotFoundException(`Resume version ${versionId} not found`);
    await this.assertOwnsScan(version.scan, userId);

    const buffer = await render(version.content as unknown as ParsedResume, templateId, format);
    const jd = version.scan.jdParsed as { title?: string; company?: string } | null;
    const label = [jd?.title, jd?.company].filter(Boolean).join(" — ") || version.kind;
    const safe = label.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "resume";
    return { buffer, contentType: contentType(format), filename: `${safe}.${format}` };
  }

  async getDiff(scanId: string) {
    const versions = await this.prisma.resumeVersion.findMany({ where: { scanId }, orderBy: { createdAt: "asc" } });
    const original = versions.find((v) => v.kind === "original");
    const rewritten = versions.filter((v) => v.kind === "rewritten").pop();
    if (!original || !rewritten) throw new NotFoundException("Both an original and a rewritten version are needed to diff.");
    return { original, rewritten };
  }
}

/**
 * GOVERNMENT is retained in the Prisma enum for existing rows but is no
 * longer written — TierDetectionAgent folds government/PSU employers into
 * PSU directly. Any legacy GOVERNMENT row maps to PSU on read.
 */
function toTierLabel(prismaTier: PrismaTier): Tier {
  const map: Record<PrismaTier, Tier> = {
    STARTUP: "Startup",
    MNC: "MNC",
    PSU: "PSU",
    GOVERNMENT: "PSU",
  };
  return map[prismaTier];
}

function computeCategoryDelta(before: ScoreCategory[], after: ScoreCategory[]) {
  return after.map((a) => {
    const b = before.find((c) => c.key === a.key);
    return { key: a.key, before: b?.earned ?? 0, after: a.earned, delta: a.earned - (b?.earned ?? 0) };
  });
}
