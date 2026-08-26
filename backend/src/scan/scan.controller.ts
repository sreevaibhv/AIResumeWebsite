import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { ScanService } from "./scan.service";
import { CreateScanDto } from "./dto/create-scan.dto";
import { ConfirmScanDto } from "./dto/confirm-scan.dto";
import { ReferralMessageDto } from "./dto/referral-message.dto";
import { OptionalJwtGuard, JwtAuthGuard, userIdOf, AuthedUser } from "../auth/optional-jwt.guard";
import { ExportFormat } from "../export/render";

/**
 * §7.2 API surface (scan-related subset).
 *
 * BE-1: POST /scan takes an *optional* guard — a scan started from the
 * landing page before signup still works, but a signed-in request is
 * attributed to its user so the dashboard and library have something to
 * list. GET /scans is per-user and therefore requires a real token.
 *
 * GET /scan/:id stays unguarded on purpose: report links are shareable
 * and a WhatsApp deep link opens for someone with no account. The id is
 * an unguessable cuid, and that is the whole access control — worth
 * revisiting if resumes ever become more sensitive than they already are.
 *
 * Every endpoint below that spends LLM calls or mutates a scan requires a
 * real token and scan ownership (ScanService.assertOwnsScan) — the old
 * unguarded POST /scan/:id/rewrite let anyone with a scan id trigger a
 * dozen LLM calls, and this build adds several more such endpoints.
 */
@Controller()
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post("scan")
  @UseGuards(OptionalJwtGuard)
  async create(@Body() dto: CreateScanDto, @Req() req: { user?: AuthedUser }) {
    return this.scanService.createScan(dto, userIdOf(req));
  }

  /** The signed-in user's scans, newest first. */
  @Get("scans")
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: { user: AuthedUser }, @Query("take") take?: string) {
    return this.scanService.listScans(req.user.userId, Number(take) || 25);
  }

  @Get("scan/:id")
  async get(@Param("id") id: string) {
    return this.scanService.getScan(id);
  }

  /** spec §2.2 — confirm missing must-have keywords / profile links; recomputes the ceiling + verdict. */
  @Post("scan/:id/confirm")
  @UseGuards(JwtAuthGuard)
  async confirm(@Param("id") id: string, @Body() dto: ConfirmScanDto, @Req() req: { user: AuthedUser }) {
    return this.scanService.confirmScan(id, req.user.userId, dto);
  }

  /** spec §4 — replaces the old POST /scan/:id/rewrite. */
  @Post("scan/:id/improve")
  @UseGuards(JwtAuthGuard)
  async improve(@Param("id") id: string, @Req() req: { user: AuthedUser }) {
    return this.scanService.improveScan(id, req.user.userId);
  }

  @Post("scan/:id/interview-prep")
  @UseGuards(JwtAuthGuard)
  async generateInterviewPrep(@Param("id") id: string, @Req() req: { user: AuthedUser }) {
    return this.scanService.generateInterviewPrep(id, req.user.userId);
  }

  @Get("scan/:id/interview-prep")
  async interviewPrep(@Param("id") id: string) {
    return this.scanService.getInterviewPrep(id);
  }

  @Post("scan/:id/referral-message")
  @UseGuards(JwtAuthGuard)
  async referralMessage(@Param("id") id: string, @Body() dto: ReferralMessageDto, @Req() req: { user: AuthedUser }) {
    return this.scanService.referralMessage(id, req.user.userId, dto.contactName);
  }

  @Post("scan/:id/recruiter-comment")
  @UseGuards(JwtAuthGuard)
  async recruiterComment(@Param("id") id: string, @Req() req: { user: AuthedUser }) {
    return this.scanService.recruiterComment(id, req.user.userId);
  }

  @Get("scan/:id/diff")
  async diff(@Param("id") id: string) {
    return this.scanService.getDiff(id);
  }

  @Get("resume-version/:versionId/export")
  @UseGuards(JwtAuthGuard)
  async exportResumeVersion(
    @Param("versionId") versionId: string,
    @Query("template") template: string | undefined,
    @Query("format") format: string | undefined,
    @Req() req: { user: AuthedUser },
    @Res() res: Response,
  ) {
    const fmt = (format === "docx" ? "docx" : "pdf") as ExportFormat;
    const { buffer, contentType, filename } = await this.scanService.exportResumeVersion(versionId, req.user.userId, template, fmt);
    res.set({ "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` });
    res.send(buffer);
  }
}
