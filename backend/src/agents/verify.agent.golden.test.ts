import { runVerifyAgent } from "./verify.agent";
import { ParsedResume } from "./types";

/**
 * spec §9.1 — VerifyAgent is the FR-8a safety-critical agent (fail-closed
 * rewrite guard) and its accuracy was previously unmeasured: the file's own
 * `goldenTests` export was a placeholder note, not a fixture. This is a
 * real eval against the live model, not a fixture comparison — the whole
 * point is to catch a model that misses a hallucination or, just as bad,
 * over-flags a legitimate rephrasing. Cheap models miss subtle
 * unverifiable claims (invisible in testing, fatal in production per
 * model-routing.ts's own comment) — do not downgrade the routed model for
 * this agent without this test still passing.
 *
 * Skips (not fails) without GEMINI_API_KEY so CI without provider keys
 * doesn't break on infrastructure it doesn't have.
 */
const HAS_KEY = Boolean(process.env.GEMINI_API_KEY);
const maybeIt = HAS_KEY ? it : it.skip;

function baseResume(): ParsedResume {
  return {
    contact: { name: "Jane Doe", email: "jane@example.com", phone: "9876543210" },
    headline: "Backend Developer",
    summary: "Backend engineer focused on reliable, high-throughput services.",
    experience: [
      {
        title: "Backend Developer",
        company: "Acme Corp",
        start: "2022-01",
        end: "Present",
        bullets: ["Built a payments service handling 10k requests per second using Node.js and PostgreSQL"],
      },
    ],
    projects: [],
    skills: ["Node.js", "PostgreSQL"],
    education: [{ degree: "B.Tech CSE", institution: "IIT Somewhere", year: "2021" }],
    certifications: [],
  };
}

describe("VerifyAgent eval", () => {
  if (!HAS_KEY) {
    it.skip("skipped — GEMINI_API_KEY is not set", () => {});
  }

  maybeIt("true positive: flags a skill with zero evidence anywhere in the original", async () => {
    const original = baseResume();
    const rewritten: ParsedResume = { ...original, skills: [...original.skills, "Kubernetes"] };

    const result = await runVerifyAgent(original, rewritten);

    expect(result.data.passed).toBe(false);
    expect(result.data.flaggedClaims.length).toBeGreaterThan(0);
    expect(result.data.flaggedClaims.some((c) => /kubernetes/i.test(c.claim))).toBe(true);
  });

  maybeIt("true negative: passes a rephrasing grounded in the original's actual content", async () => {
    const original = baseResume();
    const rewritten: ParsedResume = {
      ...original,
      experience: [
        {
          ...original.experience[0],
          bullets: ["Designed and shipped a high-throughput payments service processing 10k requests per second"],
        },
      ],
    };

    const result = await runVerifyAgent(original, rewritten);

    expect(result.data.passed).toBe(true);
    expect(result.data.flaggedClaims).toHaveLength(0);
  });

  maybeIt("true positive: flags an unsupported metric with no basis in the original", async () => {
    const original = baseResume();
    const rewritten: ParsedResume = {
      ...original,
      experience: [
        {
          ...original.experience[0],
          bullets: ["Built a payments service handling 10k rps, reducing checkout latency by 63%"],
        },
      ],
    };

    const result = await runVerifyAgent(original, rewritten);

    expect(result.data.passed).toBe(false);
    expect(result.data.flaggedClaims.length).toBeGreaterThan(0);
  });
});
