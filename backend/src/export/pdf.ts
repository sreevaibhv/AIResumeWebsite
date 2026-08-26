import PDFDocument from "pdfkit";
import { ParsedResume } from "../agents/types";
import { TemplateSpec } from "./templates/types";
import { buildSections, ResumeSection } from "./sections";

/**
 * PDF writer — spec §5.2/§5.3. Hard ATS rules enforced here, not left to
 * convention: single flowing column (no absolute x-positioning, no
 * multi-column layout), real selectable text (never text-as-image),
 * standard section headings, no tables/text boxes/header-footer content.
 * Export never calls an LLM (invariant #4) — this is pure rendering from
 * already-structured data.
 */
export function renderPdf(resume: ParsedResume, spec: TemplateSpec): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 48, bottom: 48, left: 54, right: 54 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const section of buildSections(resume, spec.sectionOrder)) {
      renderSection(doc, section, spec);
    }

    doc.end();
  });
}

function heading(doc: PDFKit.PDFDocument, label: string, spec: TemplateSpec) {
  doc.fillColor(spec.accentColor).fontSize(spec.headingFontSize).font("Helvetica-Bold").text(label.toUpperCase());
  doc.fillColor("#000000");
  doc.moveDown(0.2);
}

function bulletList(doc: PDFKit.PDFDocument, bullets: string[], spec: TemplateSpec) {
  doc.font("Helvetica").fontSize(spec.bodyFontSize);
  for (const bullet of bullets) {
    doc.text(`•  ${bullet}`, { indent: 10, lineGap: spec.lineGap });
  }
}

function renderSection(doc: PDFKit.PDFDocument, section: ResumeSection, spec: TemplateSpec) {
  switch (section.kind) {
    case "contact": {
      doc.fillColor(spec.accentColor).font("Helvetica-Bold").fontSize(spec.nameFontSize).text(section.name);
      doc.fillColor("#000000");
      if (section.headline) {
        doc.font("Helvetica").fontSize(spec.bodyFontSize + 1).text(section.headline);
      }
      if (section.lines.length) {
        doc.font("Helvetica").fontSize(spec.bodyFontSize).text(section.lines.join("   ·   "));
      }
      doc.moveDown(spec.sectionGap / 10);
      return;
    }
    case "summary": {
      heading(doc, "Summary", spec);
      doc.font("Helvetica").fontSize(spec.bodyFontSize).text(section.text, { lineGap: spec.lineGap });
      doc.moveDown(spec.sectionGap / 10);
      return;
    }
    case "skills": {
      heading(doc, "Skills", spec);
      doc.font("Helvetica").fontSize(spec.bodyFontSize).text(section.items.join(", "), { lineGap: spec.lineGap });
      doc.moveDown(spec.sectionGap / 10);
      return;
    }
    case "experience": {
      heading(doc, "Experience", spec);
      for (const item of section.items) {
        doc.font("Helvetica-Bold").fontSize(spec.bodyFontSize + 0.5).text(item.heading);
        if (item.subheading) doc.font("Helvetica-Oblique").fontSize(spec.bodyFontSize - 0.5).text(item.subheading);
        bulletList(doc, item.bullets, spec);
        doc.moveDown(spec.itemGap / 10);
      }
      doc.moveDown(Math.max(0, spec.sectionGap / 10 - spec.itemGap / 10));
      return;
    }
    case "projects": {
      heading(doc, "Projects", spec);
      for (const item of section.items) {
        doc.font("Helvetica-Bold").fontSize(spec.bodyFontSize + 0.5).text(item.heading);
        bulletList(doc, item.bullets, spec);
        doc.moveDown(spec.itemGap / 10);
      }
      doc.moveDown(Math.max(0, spec.sectionGap / 10 - spec.itemGap / 10));
      return;
    }
    case "education": {
      heading(doc, "Education", spec);
      for (const item of section.items) {
        doc.font("Helvetica-Bold").fontSize(spec.bodyFontSize + 0.5).text(item.heading);
        if (item.subheading) doc.font("Helvetica").fontSize(spec.bodyFontSize).text(item.subheading);
        doc.moveDown(spec.itemGap / 10);
      }
      doc.moveDown(Math.max(0, spec.sectionGap / 10 - spec.itemGap / 10));
      return;
    }
    case "certifications": {
      heading(doc, "Certifications", spec);
      doc.font("Helvetica").fontSize(spec.bodyFontSize).text(section.items.join(", "), { lineGap: spec.lineGap });
      doc.moveDown(spec.sectionGap / 10);
      return;
    }
  }
}
