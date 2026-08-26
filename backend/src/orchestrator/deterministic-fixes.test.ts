import { applyDeterministicFixes } from "./deterministic-fixes";
import { DeterministicResult, ParsedResume } from "../agents/types";

function resume(overrides: Partial<ParsedResume> = {}): ParsedResume {
  return {
    contact: { name: "Jane Doe", email: " jane@example.com ", phone: "98-765-43210" },
    headline: "Backend Developer",
    summary: "Backend engineer.",
    experience: [],
    projects: [],
    skills: ["Node.js"],
    education: [],
    certifications: [],
    ...overrides,
  };
}

function det(missingKeywords: DeterministicResult["missingKeywords"] = []): DeterministicResult {
  return {
    contactValid: true,
    lengthWords: 100,
    timelineGaps: [],
    actionVerbDensity: 0.5,
    metricBearingBulletRatio: 0.5,
    exactMatchPct: 50,
    foundKeywords: [],
    missingKeywords,
    overusedPhrases: [],
  };
}

const JD_SKILLS = ["Kubernetes", "gRPC", "Terraform"];

describe("applyDeterministicFixes", () => {
  it("never inserts a skill the user did not confirm (invariant #1)", () => {
    const missing = det([{ term: "kubernetes", priority: "critical", where: "Skills" }]);
    const result = applyDeterministicFixes(resume(), missing, null, JD_SKILLS);
    expect(result.skills).not.toContain("Kubernetes");
    expect(result.skills).toEqual(["Node.js"]);
  });

  it("never inserts a confirmed term that isn't an actual missing keyword", () => {
    // "kubernetes" wasn't flagged as missing at all — a stray confirmation must not fabricate a skill
    const noMissing = det([]);
    const result = applyDeterministicFixes(resume(), noMissing, { skills: ["kubernetes"], contact: {} }, JD_SKILLS);
    expect(result.skills).not.toContain("Kubernetes");
  });

  it("never inserts a confirmed important/nice-to-have term, only critical must-haves", () => {
    const missing = det([{ term: "grpc", priority: "important", where: "Skills" }]);
    const result = applyDeterministicFixes(resume(), missing, { skills: ["grpc"], contact: {} }, JD_SKILLS);
    expect(result.skills).not.toContain("gRPC");
  });

  it("inserts a confirmed critical missing keyword with the JD's original casing", () => {
    const missing = det([{ term: "kubernetes", priority: "critical", where: "Skills" }]);
    const result = applyDeterministicFixes(resume(), missing, { skills: ["kubernetes"], contact: {} }, JD_SKILLS);
    expect(result.skills).toContain("Kubernetes");
  });

  it("does not duplicate a skill that is already present", () => {
    const missing = det([{ term: "node.js", priority: "critical", where: "Skills" }]);
    const result = applyDeterministicFixes(resume({ skills: ["Node.js"] }), missing, { skills: ["node.js"], contact: {} }, JD_SKILLS);
    expect(result.skills.filter((s) => s.toLowerCase() === "node.js")).toHaveLength(1);
  });

  it("fills a confirmed profile link only when the resume doesn't already have one", () => {
    const withExisting = resume({ contact: { name: "Jane", email: "a@b.com", phone: "9876543210", linkedin: "linkedin.com/in/existing" } });
    const result = applyDeterministicFixes(withExisting, det(), { skills: [], contact: { linkedin: "linkedin.com/in/confirmed" } }, JD_SKILLS);
    expect(result.contact.linkedin).toBe("linkedin.com/in/existing");
  });

  it("adds a confirmed profile link when the resume has none", () => {
    const result = applyDeterministicFixes(resume(), det(), { skills: [], contact: { github: "github.com/jane" } }, JD_SKILLS);
    expect(result.contact.github).toBe("github.com/jane");
  });

  it("trims email and normalises a noisy but valid-length phone number", () => {
    const result = applyDeterministicFixes(resume(), det(), null, JD_SKILLS);
    expect(result.contact.email).toBe("jane@example.com");
    expect(result.contact.phone).toBe("9876543210");
  });

  it("leaves an implausible phone number untouched rather than mangling it further", () => {
    const result = applyDeterministicFixes(resume({ contact: { name: "Jane", email: "a@b.com", phone: "123" } }), det(), null, JD_SKILLS);
    expect(result.contact.phone).toBe("123");
  });

  it("does not mutate the original resume object", () => {
    const original = resume();
    const originalSkillsRef = original.skills;
    applyDeterministicFixes(original, det([{ term: "kubernetes", priority: "critical", where: "Skills" }]), { skills: ["kubernetes"], contact: {} }, JD_SKILLS);
    expect(original.skills).toBe(originalSkillsRef);
    expect(original.skills).toEqual(["Node.js"]);
  });
});
