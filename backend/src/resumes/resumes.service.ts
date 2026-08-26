import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SaveResumeDto } from "./dto/save-resume.dto";
import { ParsedResume } from "../agents/types";
import { render, ExportFormat, contentType } from "../export/render";

/**
 * spec §6 — flat, standalone, user-saved resume library. Every save is its
 * own row (no uniqueness/overwrite); editing and re-saving creates a new
 * independent entry. Cross-job lineage (§6.4) is deferred until there's
 * demand for it.
 */
@Injectable()
export class ResumesService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, dto: SaveResumeDto) {
    const resume = dto.structuredResume as unknown as ParsedResume;
    const label = dto.label?.trim() || defaultLabel(dto.role, dto.company, resume);
    return this.prisma.savedResume.create({
      data: {
        userId,
        label,
        role: dto.role ?? null,
        company: dto.company ?? null,
        score: dto.score ?? null,
        structuredResume: dto.structuredResume as any,
        sourceScanId: dto.sourceScanId ?? null,
      },
    });
  }

  async list(userId: string) {
    return this.prisma.savedResume.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, label: true, role: true, company: true, score: true, sourceScanId: true, createdAt: true,
      },
    });
  }

  private async getOwned(id: string, userId: string) {
    const saved = await this.prisma.savedResume.findUnique({ where: { id } });
    if (!saved) throw new NotFoundException(`Saved resume ${id} not found`);
    if (saved.userId !== userId) throw new ForbiddenException("You do not have access to this saved resume.");
    return saved;
  }

  async remove(id: string, userId: string) {
    await this.getOwned(id, userId);
    await this.prisma.savedResume.delete({ where: { id } });
    return { id };
  }

  /** spec §5 — export never calls an LLM; this re-renders the same stored structured resume. */
  async export(id: string, userId: string, templateId: string | undefined, format: ExportFormat) {
    const saved = await this.getOwned(id, userId);
    const buffer = await render(saved.structuredResume as unknown as ParsedResume, templateId, format);
    return { buffer, contentType: contentType(format), filename: exportFilename(saved.label, format) };
  }
}

function defaultLabel(role: string | undefined, company: string | undefined, resume: ParsedResume): string {
  if (role && company) return `${role} — ${company}`;
  if (role) return role;
  if (company) return `Resume — ${company}`;
  return resume?.headline || "Saved resume";
}

function exportFilename(label: string, format: ExportFormat): string {
  const safe = label.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "resume";
  return `${safe}.${format}`;
}
