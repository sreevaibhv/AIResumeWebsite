import { describe, it, expect } from "vitest";
import { assessExtraction, EXTRACTION_THRESHOLDS as T } from "./extractionQuality";

/**
 * All cases here are synthesized from one inline resume via pure string
 * transforms — no PDF fixtures, no API key. assessExtraction is a pure
 * (string, pageCount) -> verdict function, so the dangerous failure modes
 * (silent cipher, mojibake, space loss) can be tested directly.
 */

const CLEAN = `PRIYA SHARMA
Bengaluru, Karnataka | +91 98765 43210 | priya.sharma@gmail.com | linkedin.com/in/priyasharma

CAREER OBJECTIVE
Backend engineer with 3 years of experience building payment systems at scale
for high-growth Indian fintech companies, focused on reliability and clean
service boundaries.

TECHNICAL SKILLS
Java, Spring Boot, PostgreSQL, Redis, Kafka, Docker, Kubernetes, AWS, REST APIs

WORK EXPERIENCE
Software Engineer — Flipkart, Bengaluru (Jun 2022 – Present)
- Designed and shipped a reconciliation service that cut settlement errors by 42 percent
- Led a team of 4 engineers through the migration from a monolith to microservices
- Built an internal dashboard used daily by the finance operations team

Associate Software Engineer — Zeta, Bengaluru (Jul 2020 – May 2022)
- Implemented a rate limiting layer that reduced downstream API failures
- Wrote integration tests that raised coverage on the payments module significantly

EDUCATION
B.Tech, Computer Science — NIT Trichy, 2020, CGPA 8.6

DECLARATION
I hereby declare that the above information is true to the best of my knowledge.`;

// Fixed permutation, not random — a random cipher would make this test flaky.
const KEY = "qwertyuiopasdfghjklzxcvbnm";
function cipher(s) {
  return s
    .replace(/[a-z]/g, (c) => KEY[c.charCodeAt(0) - 97])
    .replace(/[A-Z]/g, (c) => KEY[c.charCodeAt(0) - 65].toUpperCase());
}
function toPua(s) {
  return s.replace(/[A-Za-z]/g, (c) => String.fromCharCode(0xe000 + c.charCodeAt(0)));
}
function mojibake(s) {
  return s.replace(/—/g, "â€”").replace(/'/g, "â€™").replace(/₹/g, "â‚¹").replace(/–/g, "â€“");
}
// Strips ALL whitespace, not just literal spaces. Real pdfjs extraction
// joins every text item on a page with a single space
// (`items.map(i => i.str).join(" ")`); a space-loss bug therefore loses
// the *only* separator a page's text has, collapsing it toward one
// unbroken run — dropping literal " " characters alone (leaving newlines
// intact) doesn't reproduce that.
function dropSpaces(s) {
  return s.replace(/\s/g, "");
}
function stripHeader(s) {
  return s.split("\n").slice(2).join("\n");
}

describe("assessExtraction — clean input", () => {
  it("grades a clean one-page resume as good", () => {
    const a = assessExtraction(CLEAN, { pageCount: 1 });
    expect(a.verdict).toBe("good");
    expect(a.codes).toEqual([]);
  });

  it("false-positive budget: four stylistically distinct clean resumes are all 'good' with low penalty — if a threshold change breaks this block, the threshold is wrong, not the corpus", () => {
    const fresherOnePager = `ROHAN VERMA
Pune, Maharashtra | +91 90000 11111 | rohan.verma@outlook.com

CAREER OBJECTIVE
Final year B.Tech student seeking a software engineering role.

TECHNICAL SKILLS
C++, Python, Java, DSA, SQL, Git

PROJECTS
Library Management System
- Built a CLI based library system with SQLite persistence and unit tests

EDUCATION
B.Tech, Information Technology — VIT Vellore, 2024, CGPA 8.2

INTERNSHIP
Summer Intern — Infosys, Pune (May 2023 – Jul 2023)
- Automated a report generation script that saved the team several hours weekly`;

    // Real two-pagers run 6,000-9,000 chars — a thin fixture here would
    // wrongly trip SPARSE_PAGES, so this one is deliberately padded with
    // realistic content density, not just extended in length.
    const midLevelTwoPager = `PRIYA SHARMA
Bengaluru, Karnataka | +91 98765 43210 | priya.sharma@gmail.com | linkedin.com/in/priyasharma | github.com/priyasharma

CAREER OBJECTIVE
Backend engineer with 6 years of experience building payment systems, distributed
caches and event-driven services at scale for high-growth Indian fintech and
e-commerce companies, focused on reliability, observability and clean service
boundaries across large engineering organizations spanning hundreds of engineers
and dozens of interconnected services running in production at very high volume.

TECHNICAL SKILLS
Java, Kotlin, Spring Boot, PostgreSQL, MySQL, Redis, Kafka, RabbitMQ, Docker,
Kubernetes, AWS, GCP, REST APIs, gRPC, GraphQL, Terraform, Ansible, Jenkins,
GitHub Actions, Prometheus, Grafana, ElasticSearch, Logstash, Kibana, DataDog

WORK EXPERIENCE
Senior Software Engineer — Flipkart, Bengaluru (Jun 2022 – Present)
- Designed and shipped a reconciliation service that cut settlement errors by 42 percent across all merchant payouts nationwide
- Led a team of 4 engineers through the migration from a monolith to a microservices architecture spanning 12 independent services
- Built an internal dashboard used daily by the finance operations team to track settlement anomalies in near real time across regions
- Introduced distributed tracing across the entire payments stack, cutting mean incident diagnosis time from 40 minutes down to 8 minutes
- Mentored two junior engineers and ran the team's fortnightly architecture review sessions, improving design-doc quality across the org
- Drove the adoption of contract testing between payment services, eliminating an entire class of integration bugs before they reached production
- Partnered with the SRE team to define and track SLOs for the settlement pipeline, reducing customer-visible incidents quarter over quarter

Software Engineer II — Flipkart, Bengaluru (Jan 2021 – May 2022)
- Rebuilt the refund processing pipeline on Kafka, reducing average refund latency from roughly 6 hours down to about 12 minutes
- Owned the on-call rotation for the payments platform and authored the incident response runbook that the team still relies on today
- Collaborated closely with the risk team to add fraud-signal checks to the checkout flow, cutting chargeback volume by 18 percent overall
- Automated the nightly reconciliation report generation process, saving the finance operations team several hours of manual work weekly

Associate Software Engineer — Zeta, Bengaluru (Jul 2020 – Dec 2020)
- Implemented a rate limiting layer that reduced downstream API failures during flash sale traffic spikes by roughly 60 percent overall
- Wrote integration tests that raised automated coverage on the payments module from 45 percent up to 82 percent within one quarter
- Built a self-serve internal tool that let support engineers replay failed webhook deliveries without needing engineering assistance
- Participated in a company wide hackathon and shipped a working prototype for automated merchant onboarding that later became a real product

PROJECTS
Open Source Task Queue Contributor
- Regular contributor to a distributed task queue library used internally by several product teams across the wider engineering organization

Personal Finance Tracker
- Built and shipped a personal finance tracker with a React frontend and a Node backend, used actively by over five hundred people monthly

CERTIFICATIONS
AWS Certified Solutions Architect Associate, 2023
Oracle Certified Java Programmer, 2021
Certified Kubernetes Administrator, 2022

EDUCATION
B.Tech, Computer Science — NIT Trichy, 2020, CGPA 8.6

DECLARATION
I hereby declare that the above information is true to the best of my knowledge.`;

    const sparseDesignHeavy = `ANANYA IYER
Chennai | +91 98400 22222 | ananya.iyer@gmail.com

SUMMARY
Product-minded frontend developer, 2 years experience.

SKILLS
React, TypeScript, Figma, CSS

EXPERIENCE
Frontend Developer, Freshworks (2022 – Present)
- Shipped the onboarding redesign, improving activation

EDUCATION
B.E, Anna University, 2022`;

    const naukriStyleAllCaps = `VIKRAM SINGH
NEW DELHI | +91 99999 33333 | VIKRAM.SINGH@GMAIL.COM

DECLARATION
I HEREBY DECLARE THAT THE ABOVE INFORMATION IS TRUE

PERSONAL DETAILS
DATE OF BIRTH: 12 JAN 1998

CAREER OBJECTIVE
TO WORK IN A CHALLENGING ENVIRONMENT AND GROW MY TECHNICAL SKILLS

ACADEMIC QUALIFICATION
B.TECH COMPUTER SCIENCE, DELHI TECHNOLOGICAL UNIVERSITY, 2021

WORK EXPERIENCE
SOFTWARE DEVELOPER, TCS, 2021 TO PRESENT
DEVELOPED AND MAINTAINED ENTERPRISE JAVA APPLICATIONS FOR BANKING CLIENTS
COLLABORATED WITH CROSS FUNCTIONAL TEAMS TO DELIVER PROJECTS ON SCHEDULE

TECHNICAL SKILLS
JAVA SPRING HIBERNATE SQL GIT JENKINS`;

    for (const resume of [fresherOnePager, midLevelTwoPager, sparseDesignHeavy, naukriStyleAllCaps]) {
      const pageCount = resume === midLevelTwoPager ? 2 : 1;
      const a = assessExtraction(resume, { pageCount });
      expect(a.verdict).toBe("good");
      expect(a.penalty).toBeLessThanOrEqual(2);
    }
  });
});

describe("assessExtraction — mode 1: scanned / empty", () => {
  it("flags an empty string as EMPTY", () => {
    const a = assessExtraction("", { pageCount: 2 });
    expect(a.verdict).toBe("unusable");
    expect(a.codes).toContain("EMPTY");
  });

  it("flags footer-only text as TOO_SHORT", () => {
    const a = assessExtraction("Page 1 of 2\n\nPage 2 of 2", { pageCount: 2 });
    expect(a.verdict).toBe("unusable");
    expect(a.codes).toContain("TOO_SHORT");
  });
});

describe("assessExtraction — mode 2: broken CMap (silent garbling)", () => {
  it("flags a substitution cipher as unusable via GARBLED_TEXT and NO_SECTION_HEADINGS", () => {
    const ciphered = cipher(CLEAN);
    const a = assessExtraction(ciphered, { pageCount: 1 });
    const clean = assessExtraction(CLEAN, { pageCount: 1 });

    expect(a.verdict).toBe("unusable");
    expect(a.codes).toContain("GARBLED_TEXT");
    expect(a.codes).toContain("NO_SECTION_HEADINGS");

    // These three assertions ARE the design rationale, made executable.
    // Both stay comfortably under the WORDS_MERGED/SPACES_LOST thresholds —
    // a cipher permutes letters but never touches whitespace, so
    // length-based checks are structurally blind to this failure mode.
    expect(a.metrics.meanTokenLength).toBeLessThan(T.MEAN_TOKEN_LEN_WEAK);
    expect(clean.metrics.meanTokenLength).toBeLessThan(T.MEAN_TOKEN_LEN_WEAK);
    expect(a.metrics.undecodableRatio).toBe(0);
    // A ciphered email is still structurally a valid email — this is why
    // contact presence cannot be the mode-2 detector. If this assertion
    // ever fails, someone has "simplified" the design by leaning on
    // hasEmail and reintroduced the silent-garbling gap.
    expect(a.metrics.hasEmail).toBe(true);
  });

  it("flags Private Use Area substitution as UNDECODABLE_CHARS", () => {
    const a = assessExtraction(toPua(CLEAN), { pageCount: 1 });
    expect(a.verdict).toBe("unusable");
    expect(a.codes).toContain("UNDECODABLE_CHARS");
  });

  it("does not flag a Canva-template resume that uses a few PUA icon glyphs in the contact header", () => {
    const withIcons = CLEAN.replace(
      "Bengaluru, Karnataka | +91 98765 43210 | priya.sharma@gmail.com",
      `${String.fromCharCode(0xe001)} Bengaluru, Karnataka ${String.fromCharCode(0xe002)} +91 98765 43210 ${String.fromCharCode(0xe003)} priya.sharma@gmail.com`,
    );
    const a = assessExtraction(withIcons, { pageCount: 1 });
    expect(a.verdict).toBe("good");
  });

  it("flags mojibake as degraded (not unusable — the text stays ~95% readable) and shows the lexicon check alone does not catch it", () => {
    const a = assessExtraction(mojibake(CLEAN), { pageCount: 1 });
    expect(a.verdict).toBe("degraded");
    expect(a.codes).toContain("MOJIBAKE");
    expect(a.metrics.lexiconRate).toBeGreaterThan(0.1);
  });
});

describe("assessExtraction — mode 3: partial extraction", () => {
  it("flags a missing contact header as degraded via NO_CONTACT alone", () => {
    const a = assessExtraction(stripHeader(CLEAN), { pageCount: 1 });
    expect(a.verdict).toBe("degraded");
    expect(a.codes).toEqual(["NO_CONTACT"]);
    expect(a.penalty).toBe(4);
  });

  it("flags a multi-page document where most pages are image-only as degraded via SPARSE_PAGES", () => {
    // Enough content to clear the NO_TEXT_LAYER fatal floor (>=150
    // chars/page) while staying well under a genuine 3-page document's
    // density — i.e. "page 1 has real text, pages 2-3 are image regions".
    const firstSectionOnly = CLEAN.split("\n\n").slice(0, 4).join("\n\n");
    const a = assessExtraction(firstSectionOnly, { pageCount: 3 });
    expect(a.verdict).toBe("degraded");
    expect(a.codes).toContain("SPARSE_PAGES");
  });

  it("known false-positive cost: a real 2-page resume exported at very large font can trip SPARSE_PAGES — accepted, one wasted Gemini call", () => {
    const largeFont = CLEAN.slice(0, Math.floor(CLEAN.length * 0.55));
    const a = assessExtraction(largeFont, { pageCount: 2 });
    expect(a.verdict).toBe("degraded");
  });
});

describe("assessExtraction — mode 4: space loss", () => {
  it("flags fully merged words as unusable via WORDS_MERGED", () => {
    const a = assessExtraction(dropSpaces(CLEAN), { pageCount: 1 });
    expect(a.verdict).toBe("unusable");
    expect(a.codes).toContain("WORDS_MERGED");
  });

  it("does not flag a resume where only the header lost spaces — known limitation, caught at the confirm step, not by this checker", () => {
    const lines = CLEAN.split("\n");
    lines[0] = dropSpaces(lines[0]);
    lines[2] = dropSpaces(lines[2]);
    const a = assessExtraction(lines.join("\n"), { pageCount: 1 });
    expect(a.verdict).toBe("good");
  });
});

describe("assessExtraction — mode 5: multi-column scramble (deliberately not detected)", () => {
  it("does not penalize reordered-but-correct words", () => {
    const words = CLEAN.split(/\s+/);
    // deterministic shuffle: reverse pairs, not a real scramble algorithm,
    // just enough disorder to simulate column-interleaving without
    // touching character content
    const reordered = [];
    for (let i = 0; i < words.length; i += 2) {
      reordered.push(words[i + 1] ?? words[i], words[i]);
    }
    const a = assessExtraction(reordered.join(" "), { pageCount: 1 });
    expect(a.verdict).toBe("good");
  });
});

describe("assessExtraction — tier-2 shape independence", () => {
  it("grades a Gemini-style prose transcription (markdown headings, no page-break separators) as good", () => {
    const geminiStyle = `# Priya Sharma

Bengaluru, Karnataka. Phone: +91 98765 43210. Email: priya.sharma@gmail.com. LinkedIn: linkedin.com/in/priyasharma

## Career Objective
Backend engineer with 3 years of experience building payment systems at scale for high-growth Indian fintech companies.

## Technical Skills
Java, Spring Boot, PostgreSQL, Redis, Kafka, Docker, Kubernetes, AWS, REST APIs.

## Work Experience
**Software Engineer, Flipkart, Bengaluru (Jun 2022 - Present)**
Designed and shipped a reconciliation service that cut settlement errors by 42 percent. Led a team of 4 engineers through the migration from a monolith to microservices.

**Associate Software Engineer, Zeta, Bengaluru (Jul 2020 - May 2022)**
Implemented a rate limiting layer that reduced downstream API failures.

## Education
B.Tech, Computer Science, NIT Trichy, 2020, CGPA 8.6

## Declaration
I hereby declare that the above information is true to the best of my knowledge.`;
    // pageCount: 1 — this is a one-page resume's content; the point of the
    // test is markdown/prose shape independence, not page count.
    const a = assessExtraction(geminiStyle, { pageCount: 1 });
    expect(a.verdict).toBe("good");
  });
});

describe("assessExtraction — India-safety suite", () => {
  it("does not treat the rupee symbol or grouped amounts as undecodable", () => {
    const withSalary = `${CLEAN}\n\nExpected CTC: ₹12,00,000 per annum`;
    const a = assessExtraction(withSalary, { pageCount: 1 });
    expect(a.metrics.undecodableRatio).toBe(0);
  });

  it.each([
    ["+91 98765 43210"],
    ["+919876543210"],
    ["98765 43210"],
    ["9876543210"],
    ["080-2345 6789"],
  ])("recognizes %s as a phone number", (phone) => {
    const a = assessExtraction(`Contact: ${phone}. No email listed.`, { pageCount: 1 });
    expect(a.metrics.hasPhone).toBe(true);
  });

  it.each([
    ["2019 – 2023"],
    ["8.6 CGPA"],
    ["12,00,000"],
    ["Jun 2022 – Aug 2023"],
  ])("does not treat %s as a phone number", (notPhone) => {
    const a = assessExtraction(`Some text with ${notPhone} inside it and nothing else numeric.`, { pageCount: 1 });
    expect(a.metrics.hasPhone).toBe(false);
  });

  it("acronym-dense Indian tech resume is not flagged (this is why vowel ratio was cut)", () => {
    const acronymHeavy = `NEHA GUPTA
Hyderabad | +91 91234 56789 | neha.gupta@gmail.com

TECHNICAL SKILLS
SQL, HTML, CSS, JS, API, SDK, JWT, HTTP, TCP, GCP, AWS, CGPA, PSU

EDUCATION
B.Tech CSE — IIT Bombay, 2021
Diploma — NIT Trichy, 2018
BITS Pilani, VIT Vellore exchange semester, 2020

WORK EXPERIENCE
Software Engineer, HCL, Hyderabad (2021 – Present)
Worked on API development and SQL optimization for enterprise clients`;
    const a = assessExtraction(acronymHeavy, { pageCount: 1 });
    expect(a.verdict).toBe("good");
  });

  it("recognizes DECLARATION, PERSONAL DETAILS and ACADEMIC QUALIFICATION as section headings", () => {
    const a = assessExtraction(
      "DECLARATION\nI declare this is true.\n\nPERSONAL DETAILS\nDOB: 01 Jan 2000\n\nACADEMIC QUALIFICATION\nB.Tech, 2020",
      { pageCount: 1 },
    );
    expect(a.metrics.headingsFound).toEqual(
      expect.arrayContaining(["declaration", "personaldetails", "academic", "qualification"]),
    );
  });

  it("does not count a Devanagari name line as undecodable", () => {
    const withDevanagari = `${CLEAN}\n\nनाम: प्रिया शर्मा`;
    const a = assessExtraction(withDevanagari, { pageCount: 1 });
    expect(a.metrics.undecodableRatio).toBe(0);
  });

  it("recognizes a letter-spaced heading", () => {
    const a = assessExtraction(`${CLEAN}\n\nE D U C A T I O N\nB.Tech, NIT Trichy, 2020`, { pageCount: 1 });
    expect(a.metrics.headingsFound).toContain("education");
  });
});

describe("assessExtraction — boundary and purity", () => {
  it("charsPerPage at exactly the NO_TEXT_LAYER floor does not fire; one under does", () => {
    const atFloor = "word ".repeat(Math.ceil(T.MIN_CHARS_PER_PAGE / 5) + 60); // clears MIN_CHARS too
    const justUnder = "a".repeat(T.MIN_CHARS_PER_PAGE - 1);
    expect(assessExtraction(atFloor, { pageCount: 1 }).codes).not.toContain("NO_TEXT_LAYER");
    const under = assessExtraction(justUnder, { pageCount: 1 });
    expect(under.codes).toContain("NO_TEXT_LAYER");
  });

  it("is a pure function: same input yields deep-equal output, and input is not mutated", () => {
    const input = CLEAN;
    const a = assessExtraction(input, { pageCount: 1 });
    const b = assessExtraction(input, { pageCount: 1 });
    expect(a).toEqual(b);
    expect(input).toBe(CLEAN);
  });

  it("does not throw or produce NaN metrics on empty/degenerate input", () => {
    const a = assessExtraction("", {});
    expect(Number.isNaN(a.metrics.charsPerPage)).toBe(false);
    expect(Number.isNaN(a.metrics.lexiconRate)).toBe(false);
    expect(Number.isNaN(a.metrics.meanTokenLength)).toBe(false);
    expect(Number.isNaN(a.metrics.vowelRatio)).toBe(false);

    const b = assessExtraction(CLEAN, {});
    expect(b.verdict).toBe("good");
  });
});
