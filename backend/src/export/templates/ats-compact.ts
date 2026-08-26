import { TemplateSpec } from "./types";

/** Tighter spacing for an experienced candidate with a lot to fit on the page — same parse-safety as ats-clean. */
export const atsCompact: TemplateSpec = {
  id: "ats-compact",
  label: "ATS Compact",
  description: "Same single-column safety as ATS Clean, tighter spacing for longer work histories.",
  atsSafe: true,
  nameFontSize: 18,
  headingFontSize: 11,
  bodyFontSize: 9.5,
  sectionGap: 9,
  itemGap: 5,
  lineGap: 1,
  accentColor: "#000000",
};
