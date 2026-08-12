import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ScanService } from "./scan.service";
import { CreateScanDto } from "./dto/create-scan.dto";
import { OptionalJwtGuard, JwtAuthGuard, userIdOf, AuthedUser } from "../auth/optional-jwt.guard";

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

  @Post("scan/:id/rewrite")
  async rewrite(@Param("id") id: string) {
    return this.scanService.rewriteScan(id);
  }

  @Get("scan/:id/interview-prep")
  async interviewPrep(@Param("id") id: string) {
    return this.scanService.getInterviewPrep(id);
  }

  @Get("scan/:id/diff")
  async diff(@Param("id") id: string) {
    return this.scanService.getDiff(id);
  }
}
