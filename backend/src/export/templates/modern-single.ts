import { TemplateSpec } from "./types";

/**
 * Human-facing option with a restrained accent color on the name and
 * section headings. Still single-column, still real text, still no
 * tables/graphics — the accent is the only concession to "designed",
 * which is why this can ship ATS-safe rather than badged as a risk.
 */
export const modernSingle: TemplateSpec = {
  id: "modern-single",
  label: "Modern Single-Column",
  description: "A restrained accent color for human readers — still single-column and fully parser-readable.",
  atsSafe: true,
  nameFontSize: 22,
  headingFontSize: 12,
  bodyFontSize: 10.5,
  sectionGap: 14,
  itemGap: 8,
  lineGap: 2,
  accentColor: "#3A2BD9",
};
