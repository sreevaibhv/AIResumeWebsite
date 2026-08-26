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

type ReorderableKind = "skills" | "experience" | "projects" | "education" | "certifications";

const DEFAULT_ORDER: ReorderableKind[] = ["skills", "experience", "projects", "education", "certifications"];

function buildReorderable(resume: ParsedResume): Record<ReorderableKind, ResumeSection | null> {
  return {
    skills: resume.skills.length ? { kind: "skills", items: resume.skills } : null,
    experience: resume.experience.length
      ? {
          kind: "experience",
          items: resume.experience.map((e) => ({
            heading: [e.title, e.company].filter(Boolean).join(" — "),
            subheading: [e.start, e.end].filter(Boolean).join(" – "),
            bullets: e.bullets,
          })),
        }
      : null,
    projects: resume.projects.length
      ? { kind: "projects", items: resume.projects.map((p) => ({ heading: p.name, bullets: p.bullets })) }
      : null,
    education: resume.education.length
      ? {
          kind: "education",
          items: resume.education.map((ed) => ({
            heading: ed.degree,
            subheading: [ed.institution, ed.year].filter(Boolean).join(" · "),
          })),
        }
      : null,
    certifications: resume.certifications.length ? { kind: "certifications", items: resume.certifications } : null,
  };
}

/**
 * `order` lets a TemplateSpec reorder the five reorderable sections
 * (spec.sectionOrder — see templates/types.ts). Omitted, it reproduces the
 * original hardcoded skills->experience->projects->education->certifications
 * sequence exactly. A kind present in `order` but empty on the resume is
 * skipped, same as before; a kind with real content but absent from `order`
 * (a template author forgot one) is appended rather than silently dropped.
 */
export function buildSections(resume: ParsedResume, order?: ReorderableKind[]): ResumeSection[] {
  const sections: ResumeSection[] = [];

  const lines = [resume.contact.email, resume.contact.phone, resume.contact.linkedin, resume.contact.github].filter(
    (v): v is string => Boolean(v?.trim()),
  );
  sections.push({ kind: "contact", name: resume.contact.name || "—", headline: resume.headline ?? "", lines });

  if (resume.summary?.trim()) sections.push({ kind: "summary", text: resume.summary.trim() });

  const built = buildReorderable(resume);
  const sequence = order ?? DEFAULT_ORDER;
  const missing = DEFAULT_ORDER.filter((kind) => !sequence.includes(kind));

  for (const kind of [...sequence, ...missing]) {
    const section = built[kind];
    if (section) sections.push(section);
  }

  return sections;
}
