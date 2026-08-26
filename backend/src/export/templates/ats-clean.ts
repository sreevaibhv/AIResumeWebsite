import { TemplateSpec } from "./types";

/** The default template — generous spacing, no color, built for maximum ATS parse accuracy. */
export const atsClean: TemplateSpec = {
  id: "ats-clean",
  label: "ATS Clean",
  description: "Single column, standard headings, no color — the safest default for portals and company ATS.",
  atsSafe: true,
  nameFontSize: 20,
  headingFontSize: 12,
  bodyFontSize: 10.5,
  sectionGap: 14,
  itemGap: 8,
  lineGap: 2,
  accentColor: "#000000",
};
