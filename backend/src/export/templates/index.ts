import { TemplateSpec } from "./types";
import { atsClean } from "./ats-clean";
import { atsCompact } from "./ats-compact";
import { modernSingle } from "./modern-single";

export { TemplateSpec } from "./types";

export const TEMPLATES: Record<string, TemplateSpec> = {
  "ats-clean": atsClean,
  "ats-compact": atsCompact,
  "modern-single": modernSingle,
};

export const DEFAULT_TEMPLATE_ID = "ats-clean";

export function resolveTemplate(templateId?: string): TemplateSpec {
  return TEMPLATES[templateId ?? DEFAULT_TEMPLATE_ID] ?? TEMPLATES[DEFAULT_TEMPLATE_ID];
}
