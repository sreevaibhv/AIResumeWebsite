import { TemplateSpec } from "./types";

/**
 * Education/Projects-forward — a fresher's strongest evidence is usually
 * academic and project work, not a short or nonexistent employment
 * history, so those come before Experience. There's no distinct
 * internships field on ParsedResume; internship entries live in
 * `experience` like any other role and are ordered the same way.
 */
export const fresher: TemplateSpec = {
  id: "fresher",
  label: "Fresher / Campus",
  description: "Education and projects lead — built for a first resume with little or no work history.",
  atsSafe: true,
  nameFontSize: 20,
  headingFontSize: 12,
  bodyFontSize: 10.5,
  sectionGap: 14,
  itemGap: 8,
  lineGap: 2,
  accentColor: "#000000",
  sectionOrder: ["education", "projects", "experience", "skills", "certifications"],
};
