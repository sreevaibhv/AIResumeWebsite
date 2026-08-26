import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { ResumesService } from "./resumes.service";
import { SaveResumeDto } from "./dto/save-resume.dto";
import { JwtAuthGuard, AuthedUser } from "../auth/optional-jwt.guard";
import { ExportFormat } from "../export/render";

/** spec §6.2 — all guarded; a saved resume is per-user, never shareable like a scan report is. */
@Controller("resumes")
@UseGuards(JwtAuthGuard)
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  async save(@Body() dto: SaveResumeDto, @Req() req: { user: AuthedUser }) {
    return this.resumesService.save(req.user.userId, dto);
  }

  @Get()
  async list(@Req() req: { user: AuthedUser }) {
    return this.resumesService.list(req.user.userId);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: { user: AuthedUser }) {
    return this.resumesService.remove(id, req.user.userId);
  }

  @Get(":id/export")
  async export(
    @Param("id") id: string,
    @Query("template") template: string | undefined,
    @Query("format") format: string | undefined,
    @Req() req: { user: AuthedUser },
    @Res() res: Response,
  ) {
    const fmt = (format === "docx" ? "docx" : "pdf") as ExportFormat;
    const { buffer, contentType, filename } = await this.resumesService.export(id, req.user.userId, template, fmt);
    res.set({ "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` });
    res.send(buffer);
  }
}
