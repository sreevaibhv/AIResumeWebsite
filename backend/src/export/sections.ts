import { ParsedResume } from "../agents/types";

/**
 * A provider-agnostic description of the resume's content, in render
 * order. pdf.ts and docx.ts both walk this instead of ParsedResume
 * directly, so "what sections exist, in what order" is defined once.
 */
export type ResumeSection =
  | { kind: "contact"; name: string; headline: string; lines: string[] }
  | { kind: "summary"; text: string }
  | { kind: "skills"; items: string[] }
  | { kind: "experience"; items: Array<{ heading: string; subheading: string; bullets: string[] }> }
  | { kind: "projects"; items: Array<{ heading: string; bullets: string[] }> }
  | { kind: "education"; items: Array<{ heading: string; subheading: string }> }
  | { kind: "certifications"; items: string[] };

export const SECTION_LABEL: Record<Exclude<ResumeSection["kind"], "contact">, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
};

export function buildSections(resume: ParsedResume): ResumeSection[] {
  const sections: ResumeSection[] = [];

  const lines = [resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.github].filter(
    (v): v is string => Boolean(v?.trim()),
  );
  sections.push({ kind: "contact", name: resume.contact.name || "—", headline: resume.headline ?? "", lines });

  if (resume.summary?.trim()) sections.push({ kind: "summary", text: resume.summary.trim() });
  if (resume.skills.length) sections.push({ kind: "skills", items: resume.skills });

  if (resume.experience.length) {
    sections.push({
      kind: "experience",
      items: resume.experience.map((e) => ({
        heading: [e.title, e.company].filter(Boolean).join(" — "),
        subheading: [e.start, e.end].filter(Boolean).join(" – "),
        bullets: e.bullets,
      })),
    });
  }

  if (resume.projects.length) {
    sections.push({
      kind: "projects",
      items: resume.projects.map((p) => ({ heading: p.name, bullets: p.bullets })),
    });
  }

  if (resume.education.length) {
    sections.push({
      kind: "education",
      items: resume.education.map((ed) => ({
        heading: ed.degree,
        subheading: [ed.institution, ed.year].filter(Boolean).join(" · "),
      })),
    });
  }

  if (resume.certifications.length) sections.push({ kind: "certifications", items: resume.certifications });

  return sections;
}
