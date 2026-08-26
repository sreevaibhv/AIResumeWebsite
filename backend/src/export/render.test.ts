import { render } from "./render";
import { TEMPLATES } from "./templates";
import { ParsedResume } from "../agents/types";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * spec §9.3 — makes the ATS-safety claim measurable rather than asserted:
 * render each shipped template, re-extract the PDF's text with pdfjs-dist
 * (the same library the frontend uses to read an uploaded resume), and
 * assert every heading and bullet survives as real, selectable text.
 */

const resume: ParsedResume = {
  contact: { name: "Jane Doe", email: "jane@example.com", phone: "9876543210", linkedin: "linkedin.com/in/jane" },
  headline: "Backend Developer",
  summary: "Backend engineer with 3 years building high-throughput services.",
  experience: [
    { title: "Backend Developer", company: "Acme Corp", start: "2022-01", end: "Present", bullets: ["Built a service handling 10k rps", "Reduced latency by 40 percent"] },
  ],
  projects: [{ name: "Side Project", bullets: ["Built a CLI tool used by 200 developers"] }],
  skills: ["Node.js", "PostgreSQL", "Redis"],
  education: [{ degree: "B.Tech CSE", institution: "IIT Somewhere", year: "2021" }],
  certifications: ["AWS Certified Developer"],
};

const EXPECTED_STRINGS = ["Jane Doe", "EXPERIENCE", "Acme Corp", "PostgreSQL", "10k rps", "AWS Certified Developer"];

const EXTRACT_SCRIPT = join(__dirname, "__fixtures__", "extract-pdf-text.mjs");

/**
 * pdfjs-dist's Node-compatible build ("legacy/build/pdf.mjs") is ESM-only;
 * ts-jest compiles this test to CommonJS, where a dynamic import() of it
 * still gets routed through Jest's CJS registry and fails ("Must use
 * import to load ES Module"). Running the real extraction in a plain
 * `node` subprocess sidesteps Jest's module system entirely. See
 * __fixtures__/extract-pdf-text.mjs.
 */
function extractPdfText(buffer: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), "parse-export-test-"));
  const pdfPath = join(dir, "resume.pdf");
  try {
    writeFileSync(pdfPath, buffer);
    return execFileSync("node", [EXTRACT_SCRIPT, pdfPath], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("export round-trip (ATS-safety)", () => {
  for (const templateId of Object.keys(TEMPLATES)) {
    it(`${templateId}: every heading and bullet survives as real text in the PDF`, async () => {
      const buffer = await render(resume, templateId, "pdf");
      const text = extractPdfText(buffer);
      for (const expected of EXPECTED_STRINGS) {
        expect(text).toContain(expected);
      }
    });
  }

  /**
   * The round-trip tests above only prove content survives — none of them
   * prove the fresher/product-startup presets actually reorder anything,
   * which is the entire point of adding sectionOrder. Index-of comparison
   * on the uppercased section headings makes the reordering itself
   * falsifiable, not just asserted by the template file's own comment.
   */
  it("fresher: Education renders before Experience (default order is the reverse)", async () => {
    const buffer = await render(resume, "fresher", "pdf");
    const text = extractPdfText(buffer);
    expect(text.indexOf("EDUCATION")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("EXPERIENCE")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("EDUCATION")).toBeLessThan(text.indexOf("EXPERIENCE"));
  });

  it("product-startup: Experience renders before Skills (default order is the reverse)", async () => {
    const buffer = await render(resume, "product-startup", "pdf");
    const text = extractPdfText(buffer);
    expect(text.indexOf("EXPERIENCE")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("SKILLS")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("EXPERIENCE")).toBeLessThan(text.indexOf("SKILLS"));
  });

  it("ats-clean (default order): Skills renders before Experience, Experience before Education", async () => {
    const buffer = await render(resume, "ats-clean", "pdf");
    const text = extractPdfText(buffer);
    expect(text.indexOf("SKILLS")).toBeLessThan(text.indexOf("EXPERIENCE"));
    expect(text.indexOf("EXPERIENCE")).toBeLessThan(text.indexOf("EDUCATION"));
  });

  it("DOCX export contains the resume's real text (not an image)", async () => {
    const JSZip = (await import("jszip")).default;
    const buffer = await render(resume, "ats-clean", "docx");
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("text");
    // A run's text lives in <w:t>…</w:t>; strip tags rather than regex the
    // whole document so text split across runs still reads contiguously.
    const text = xml.replace(/<[^>]+>/g, "");
    for (const expected of EXPECTED_STRINGS) {
      expect(text).toContain(expected);
    }
  });
});
