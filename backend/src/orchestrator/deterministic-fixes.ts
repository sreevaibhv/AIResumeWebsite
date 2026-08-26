import { ParsedResume, DeterministicResult } from "../agents/types";
import { ConfirmedSkills } from "../scoring/achievable-ceiling";

/**
 * DeterministicFixes — spec §4, step 2. Pure code, no LLM. The narrow half
 * of improve: it only places data the user explicitly supplied — a
 * confirmed must-have keyword, a confirmed profile URL, a normalised
 * email/phone. It never writes prose; anything that reframes a bullet or
 * writes a summary goes through RewriteAgent → VerifyAgent instead
 * (invariant #2). This is the temptation this module exists to resist —
 * do not extend it to "helpfully" rewrite anything.
 */

function normalize(term: string): string {
  return term.toLowerCase().trim();
}

/** Restore a confirmed skill's JD casing for display, falling back to the confirmed term itself. */
function displayCase(term: string, jdSkills: string[]): string {
  const match = jdSkills.find((s) => normalize(s) === normalize(term));
  return match ?? term;
}

function normalizeEmail(email: string): string {
  return (email ?? "").trim();
}

/** Strips formatting noise; never invents digits — if that doesn't yield a plausible number, leaves it as-is. */
function normalizePhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : phone;
}

export function applyDeterministicFixes(
  resume: ParsedResume,
  det: DeterministicResult,
  confirmed: ConfirmedSkills | null,
  jdSkills: string[],
): ParsedResume {
  const next: ParsedResume = {
    ...resume,
    contact: { ...resume.contact },
    skills: [...resume.skills],
  };

  next.contact.email = normalizeEmail(next.contact.email);
  next.contact.phone = normalizePhone(next.contact.phone);

  if (!confirmed) return next;

  const confirmedTerms = new Set(confirmed.skills.map(normalize));
  const existingTerms = new Set(next.skills.map(normalize));
  for (const missing of det.missingKeywords) {
    if (missing.priority !== "critical") continue;
    const term = normalize(missing.term);
    if (!confirmedTerms.has(term) || existingTerms.has(term)) continue;
    next.skills.push(displayCase(missing.term, jdSkills));
    existingTerms.add(term);
  }

  if (confirmed.contact.linkedin && !next.contact.linkedin) next.contact.linkedin = confirmed.contact.linkedin;
  if (confirmed.contact.github && !next.contact.github) next.contact.github = confirmed.contact.github;

  return next;
}
