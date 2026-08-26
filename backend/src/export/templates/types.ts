/**
 * TemplateSpec — spec §5.2. A layout description, not a renderer. Both
 * pdf.ts and docx.ts consume the same spec so the two output formats stay
 * visually consistent without duplicating layout logic.
 *
 * Hard ATS rules live in the writers (pdf.ts/docx.ts), not here: single
 * column, real selectable text, standard section headings, no tables/text
 * boxes/header-footer content. A spec can vary type sizes, spacing, and a
 * heading accent color — never structure. All three shipped templates are
 * ATS-safe by construction; a future "designed" template that trades that
 * away must be badged accordingly and must never become the default.
 */
export interface TemplateSpec {
  id: string;
  label: string;
  description: string;
  atsSafe: true;
  nameFontSize: number;
  headingFontSize: number;
  bodyFontSize: number;
  /** Points of vertical space before a new section heading. */
  sectionGap: number;
  /** Points of vertical space between items within a section. */
  itemGap: number;
  /** Line height multiplier for body text. */
  lineGap: number;
  /** Hex color for section headings and the name line. Text only — never a background or graphic. */
  accentColor: string;
}
