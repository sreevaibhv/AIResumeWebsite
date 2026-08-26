/**
 * Single source of truth for the export template picker — was previously
 * three independently hardcoded copies (FixesPanel's ExportControls,
 * ResumesPage's inline <option> list, and this file's own new entries for
 * the India presets). Add a template here once; every picker updates.
 */
export const TEMPLATE_OPTIONS = [
  { value: "ats-clean", label: "ATS Clean (recommended)" },
  { value: "ats-compact", label: "ATS Compact" },
  { value: "modern-single", label: "Modern Single-Column" },
  { value: "fresher", label: "Fresher / Campus" },
  { value: "it-services", label: "IT Services (Naukri-safe)" },
  { value: "product-startup", label: "Product / Startup" },
];
