import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import { ScanPipeline, ScanPipelineResult } from "../orchestrator/scan-pipeline";
import { RewritePipeline } from "../orchestrator/rewrite-pipeline";
import { CreateScanDto } from "./dto/create-scan.dto";
import { ScanOptions } from "../agents/types";
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
      tier: (dto.tier ?? "Startup") as ScanOptions["tier"],
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
        tier: options.tier.toUpperCase() as PrismaTier,
        fresherMode: options.fresherMode,
      },
    });

    try {
      const result = await this.scanPipeline.run(dto.resumeText, dto.jdText, options, scan.id);
      const updated = await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETE",
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
          } as any,
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
      },
    });

    // The rewrite and diff endpoints both start from the "original"
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
      // The list only needs how many fixes remain and what they are worth.
      roadmapCount: Array.isArray(scan.roadmap) ? scan.roadmap.length : 0,
      roadmapGain: Array.isArray(scan.roadmap)
        ? (scan.roadmap as Array<{ gain?: number }>).reduce((n, r) => n + (r?.gain ?? 0), 0)
        : 0,
      role: (scan.jdParsed as { title?: string } | null)?.title ?? null,
      company: (scan.jdParsed as { company?: string } | null)?.company ?? null,
      optimized: scan.resumeVersions.some((v) => v.kind === "rewritten" && v.verified),
      hasPrep: scan.interviewPreps.length > 0,
    }));
  }

  async getScan(id: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id },
      include: { resumeVersions: true, interviewPreps: true },
    });
    if (!scan) throw new NotFoundException(`Scan ${id} not found`);
    return scan;
  }

  async rewriteScan(id: string) {
    const scan = await this.getScan(id);
    if (scan.status !== "COMPLETE" || !scan.resumeParsed || !scan.jdParsed || !scan.roadmap) {
      throw new BadRequestException("Scan must complete successfully before it can be rewritten.");
    }
    const options: ScanOptions = {
      tier: toTierLabel(scan.tier),
      fresherMode: scan.fresherMode,
    };

    const result = await this.rewritePipeline.run(
      scan.resumeParsed as any,
      scan.roadmap as any,
      scan.jdParsed as any,
      options,
      scan.id,
    );

    if (result.status === "verification_failed") {
      await this.prisma.resumeVersion.create({
        data: { scanId: scan.id, kind: "rewritten", content: result.resume as any, verified: false, flagged: result.flaggedClaims as any },
      });
      return { status: "verification_failed", flaggedClaims: result.flaggedClaims };
    }

    const version = await this.prisma.resumeVersion.create({
      data: {
        scanId: scan.id,
        kind: "rewritten",
        content: result.resume as any,
        verified: true,
        diff: { changeSummary: result.changeSummary, rescored: result.rescored.score } as any,
      },
    });
    await this.prisma.interviewPrepSet.create({
      data: { scanId: scan.id, technical: result.interviewPrep.technical as any, hr: result.interviewPrep.hr as any },
    });

    return { ...result, resumeVersionId: version.id };
  }

  async getInterviewPrep(scanId: string) {
    const prep = await this.prisma.interviewPrepSet.findFirst({ where: { scanId }, orderBy: { createdAt: "desc" } });
    if (!prep) throw new NotFoundException(`No interview prep generated yet for scan ${scanId} — run a rewrite first.`);
    return prep;
  }

  async getDiff(scanId: string) {
    const versions = await this.prisma.resumeVersion.findMany({ where: { scanId }, orderBy: { createdAt: "asc" } });
    const original = versions.find((v) => v.kind === "original");
    const rewritten = versions.filter((v) => v.kind === "rewritten").pop();
    if (!original || !rewritten) throw new NotFoundException("Both an original and a rewritten version are needed to diff.");
    return { original, rewritten };
  }
}

function toTierLabel(prismaTier: PrismaTier): ScanOptions["tier"] {
  const map: Record<PrismaTier, ScanOptions["tier"]> = {
    STARTUP: "Startup",
    MNC: "MNC",
    PSU: "PSU",
    GOVERNMENT: "Government",
  };
  return map[prismaTier];
}
