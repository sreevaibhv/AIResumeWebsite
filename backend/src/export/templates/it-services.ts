import { TemplateSpec } from "./types";

/**
 * Structurally identical to ats-clean's own default section order —
 * skills-before-experience is already what the unordered default does,
 * and no Naukri/Resdex-specific reordering convention beyond that turned
 * up in this session's research. Kept as its own template (rather than
 * pointing IT-services users at ats-clean) so the id/label speak to the
 * audience directly.
 */
export const itServices: TemplateSpec = {
  id: "it-services",
  label: "IT Services (Naukri-safe)",
  description: "Maximally plain, standard section labels — built for Naukri/Resdex parsing.",
  atsSafe: true,
  nameFontSize: 20,
  headingFontSize: 12,
  bodyFontSize: 10.5,
  sectionGap: 14,
  itemGap: 8,
  lineGap: 2,
  accentColor: "#000000",
  sectionOrder: ["skills", "experience", "projects", "education", "certifications"],
};
