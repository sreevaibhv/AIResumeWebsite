import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { ParsedResume } from "../agents/types";
import { TemplateSpec } from "./templates/types";
import { buildSections, ResumeSection } from "./sections";

const HALF_PT = 2; // docx sizes are in half-points

/**
 * DOCX writer — spec §5.2/§5.3. Same ATS rules as pdf.ts, same
 * ResumeSection walk, so the two formats never drift apart: single
 * section-per-paragraph flow, no tables, no text boxes, real text.
 */
export async function renderDocx(resume: ParsedResume, spec: TemplateSpec): Promise<Buffer> {
  const children: Paragraph[] = [];
  for (const section of buildSections(resume)) {
    children.push(...renderSection(section, spec));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

function heading(label: string, spec: TemplateSpec): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: spec.sectionGap * 10, after: spec.itemGap * 5 },
    children: [
      new TextRun({ text: label.toUpperCase(), bold: true, size: spec.headingFontSize * HALF_PT, color: spec.accentColor.replace("#", "") }),
    ],
  });
}

function bulletParagraphs(bullets: string[], spec: TemplateSpec): Paragraph[] {
  return bullets.map(
    (b) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: spec.lineGap * 20 },
        children: [new TextRun({ text: b, size: spec.bodyFontSize * HALF_PT })],
      }),
  );
}

function renderSection(section: ResumeSection, spec: TemplateSpec): Paragraph[] {
  switch (section.kind) {
    case "contact": {
      const paras: Paragraph[] = [
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: section.name, bold: true, size: spec.nameFontSize * HALF_PT, color: spec.accentColor.replace("#", "") }),
          ],
        }),
      ];
      if (section.headline) {
        paras.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: section.headline, size: (spec.bodyFontSize + 1) * HALF_PT })],
          }),
        );
      }
      if (section.lines.length) {
        paras.push(
          new Paragraph({
            spacing: { after: spec.sectionGap * 10 },
            children: [new TextRun({ text: section.lines.join("   ·   "), size: spec.bodyFontSize * HALF_PT })],
          }),
        );
      }
      return paras;
    }
    case "summary":
      return [
        heading("Summary", spec),
        new Paragraph({
          spacing: { after: spec.sectionGap * 10 },
          children: [new TextRun({ text: section.text, size: spec.bodyFontSize * HALF_PT })],
        }),
      ];
    case "skills":
      return [
        heading("Skills", spec),
        new Paragraph({
          spacing: { after: spec.sectionGap * 10 },
          children: [new TextRun({ text: section.items.join(", "), size: spec.bodyFontSize * HALF_PT })],
        }),
      ];
    case "experience": {
      const paras: Paragraph[] = [heading("Experience", spec)];
      for (const item of section.items) {
        paras.push(
          new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({ text: item.heading, bold: true, size: (spec.bodyFontSize + 0.5) * HALF_PT })],
          }),
        );
        if (item.subheading) {
          paras.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: item.subheading, italics: true, size: (spec.bodyFontSize - 0.5) * HALF_PT })],
            }),
          );
        }
        paras.push(...bulletParagraphs(item.bullets, spec));
      }
      return paras;
    }
    case "projects": {
      const paras: Paragraph[] = [heading("Projects", spec)];
      for (const item of section.items) {
        paras.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: item.heading, bold: true, size: (spec.bodyFontSize + 0.5) * HALF_PT })],
          }),
        );
        paras.push(...bulletParagraphs(item.bullets, spec));
      }
      return paras;
    }
    case "education": {
      const paras: Paragraph[] = [heading("Education", spec)];
      for (const item of section.items) {
        paras.push(
          new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({ text: item.heading, bold: true, size: (spec.bodyFontSize + 0.5) * HALF_PT })],
          }),
        );
        if (item.subheading) {
          paras.push(
            new Paragraph({
              spacing: { after: spec.itemGap * 10 },
              children: [new TextRun({ text: item.subheading, size: spec.bodyFontSize * HALF_PT })],
            }),
          );
        }
      }
      return paras;
    }
    case "certifications":
      return [
        heading("Certifications", spec),
        new Paragraph({
          children: [new TextRun({ text: section.items.join(", "), size: spec.bodyFontSize * HALF_PT })],
        }),
      ];
  }
}
