import { ParsedResume } from "../agents/types";
import { resolveTemplate } from "./templates";
import { renderPdf } from "./pdf";
import { renderDocx } from "./docx";

export type ExportFormat = "pdf" | "docx";

/**
 * The one entry point for §5 — export never calls an LLM (invariant #4).
 * Pure function: same structured resume + template + format always
 * produces the same bytes.
 */
export async function render(resume: ParsedResume, templateId: string | undefined, format: ExportFormat): Promise<Buffer> {
  const spec = resolveTemplate(templateId);
  if (format === "pdf") return renderPdf(resume, spec);
  if (format === "docx") return renderDocx(resume, spec);
  throw new Error(`Unknown export format "${format}". Expected "pdf" or "docx".`);
}

export function contentType(format: ExportFormat): string {
  return format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
