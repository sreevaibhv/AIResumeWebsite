import { TemplateSpec } from "./types";

/** Experience-forward — ownership/impact bullets lead, ahead of the skills list. */
export const productStartup: TemplateSpec = {
  id: "product-startup",
  label: "Product / Startup",
  description: "Impact bullets lead — for candidates whose recent ownership is the strongest pitch.",
  atsSafe: true,
  nameFontSize: 22,
  headingFontSize: 12,
  bodyFontSize: 10.5,
  sectionGap: 14,
  itemGap: 8,
  lineGap: 2,
  accentColor: "#3A2BD9",
  sectionOrder: ["experience", "projects", "skills", "education", "certifications"],
};
