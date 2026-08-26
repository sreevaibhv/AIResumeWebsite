/**
 * assessExtraction — grades text pulled from an uploaded resume (pdfjs
 * tier 1, or a Gemini multimodal transcription tier 2) and decides whether
 * it's trustworthy enough to hand to the pipeline.
 *
 * The dangerous failure mode is silent: a PDF with a broken/missing
 * ToUnicode CMap makes pdfjs return normal-length, confident-looking text
 * that is actually a substitution cipher of the real content. It doesn't
 * throw, `text.length` looks fine, and deterministic-check.agent.ts's
 * contactValid only tests for "@" + 10 digits — a ciphered email still
 * passes that. Nothing downstream catches it, so every provenance-labelled
 * score the user sees afterward is a confident diagnosis of a document
 * that isn't their resume.
 *
 * This function is pure and tier-agnostic: it grades tier-1 and tier-2
 * output identically. The caller owns tier policy (tier 1 escalates on
 * anything short of "good"; tier 2 accepts "degraded" and only forces a
 * manual paste on "unusable") — see AnalyzePage.jsx.
 */

export const EXTRACTION_THRESHOLDS = {
  MIN_CHARS: 300,
  MIN_CHARS_PER_PAGE: 150,
  SPARSE_CHARS_PER_PAGE: 900, // single page
  SPARSE_CHARS_PER_PAGE_MULTI: 1500, // pageCount >= 2
  LEXICON_FATAL: 0.04,
  LEXICON_WEAK: 0.08,
  LEXICON_MIN_TOKENS: 60,
  UNDECODABLE_RATIO: 0.02,
  MOJIBAKE_COUNT: 3,
  MEAN_TOKEN_LEN_FATAL: 16,
  MEAN_TOKEN_LEN_WEAK: 9,
  ESCALATE_AT: 4,
};

// English function words + resume-telegraphic vocabulary. A substitution
// cipher destroys hits on both classes identically, but the vocabulary
// words lift the natural rate on terse resumes well clear of the floor.
const LEXICON = new Set([
  // function words
  "the", "and", "of", "to", "in", "a", "is", "for", "with", "on", "as", "at",
  "by", "an", "be", "this", "that", "from", "or", "are", "was", "were",
  "will", "has", "have", "had", "but", "not", "all", "we", "you", "your",
  "our", "its", "it", "my", "their", "they", "he", "she", "which", "who",
  "what", "when", "where", "how", "if", "than", "then", "so", "such",
  "more", "most", "other", "some", "no", "do", "does", "these", "into",
  // resume vocabulary
  "experience", "engineer", "engineering", "project", "projects", "skills",
  "education", "university", "college", "developer", "development", "team",
  "software", "present", "intern", "internship", "company", "management",
  "data", "year", "years", "work", "worked", "working", "built", "led",
  "managed", "designed", "developed", "implemented", "responsible",
  "technical", "degree", "role", "using", "across", "including", "within",
]);

// Section headings on Indian resumes specifically — a US-derived list
// (missing declaration/personal details/academic qualification) would
// false-positive NO_SECTION_HEADINGS on a large share of real uploads.
// Matched as substrings against text with all non-letters stripped, so
// this list itself has no spaces and survives space-loss and
// letter-spaced ("E X P E R I E N C E") headings for free.
const HEADINGS = [
  "experience", "education", "skills", "projects", "employment",
  "internship", "academic", "qualification", "objective", "summary",
  "certification", "achievement", "training", "profile", "career",
  "workhistory", "technicalskills", "declaration", "personaldetails",
  "strengths", "hobbies", "languagesknown",
];

// Blocklist, never an allowlist — an allowlist over printable ASCII would
// flag ₹ (U+20B9), en-dashes, curly quotes and Devanagari transliterations,
// all of which are routine on Indian resumes. Canva/Word contact-icon
// glyphs legitimately live in the Private Use Area, which is why the
// threshold above is a ratio (2%) rather than "any hit".
const UNDECODABLE_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uE000-\uF8FF\uFFF0-\uFFFF]/g;

// Mojibake preserves ASCII, so it's invisible to the lexicon, heading and
// char-blocklist checks — it needs its own signal.
const MOJIBAKE_RE = /â€|Ã¢|Ã©|Ã¨|Ã¯|Â[\u00A0-\u00BF]|ï»¿|â‚¬|â‚¹/g;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const YEAR_RE = /\b(?:19[89]\d|20[0-3]\d)\b/;
// Quantifiers are bounded (not \S+) so this can't degenerate on a
// whitespace-stripped ("words merged") document: unbounded \S+@\S+ has no
// stopping point when the entire document is one non-whitespace run, and
// will swallow it whole — silently zeroing out the token count that
// WORDS_MERGED needs to fire on exactly that case.
const URL_EMAIL_RE = /[^\s@]{1,64}@[^\s@]{1,63}\.[A-Za-z]{2,24}\b|https?:\/\/[^\s]{1,200}|www\.[^\s]{1,200}|[^\s]{1,200}\.(?:com|in|org|net|io|dev|co|edu|ac)\b[^\s]*/gi;

/**
 * Deliberately India-first: a NANP-shaped regex silently returns false on
 * "+91 98765 43210" / "98765 43210", and since NO_CONTACT escalates alone,
 * that single mistake would roughly double the Gemini fallback rate.
 * Deliberately rejects comma-grouped amounts ("12,00,000"), CGPA ("8.6
 * CGPA") and en-dash date ranges ("2019 – 2023") — none of those
 * characters are in the scan class, so the digit run never reaches the
 * 9-char minimum.
 */
function detectPhone(text) {
  if (/\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/.test(text)) return true; // NANP / diaspora
  const candidates = text.match(/\+?\d[\d\s().-]{7,18}\d/g) ?? [];
  return candidates.some((raw) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return /^[6-9]/.test(digits); // Indian mobile
    if (digits.length === 11) return /^0[1-9]/.test(digits); // STD landline
    if (digits.length === 12) return /^91[6-9]/.test(digits); // +91
    if (digits.length === 13) return /^091[6-9]/.test(digits);
    return false;
  });
}

function signal(code, severity, weight, value, threshold, message) {
  return { code, severity, weight, value, threshold, message };
}

/**
 * @param {string} rawText
 * @param {{ pageCount?: number }} [options]
 */
export function assessExtraction(rawText, { pageCount } = {}) {
  const text = typeof rawText === "string" ? rawText : "";
  const T = EXTRACTION_THRESHOLDS;
  const pages = pageCount && pageCount > 0 ? pageCount : 1;

  const chars = text.trim().length;
  const charsPerPage = chars / pages;

  const undecodableCount = (text.match(UNDECODABLE_RE) ?? []).length;
  const undecodableRatio = text.length ? undecodableCount / text.length : 0;
  const mojibakeCount = (text.match(MOJIBAKE_RE) ?? []).length;

  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const alphaTokens = words.filter((w) => w.length >= 2);
  const lexiconHits = alphaTokens.filter((w) => LEXICON.has(w)).length;
  const lexiconRate = alphaTokens.length ? lexiconHits / alphaTokens.length : 0;

  const strippedOfLinksAndEmails = text.replace(URL_EMAIL_RE, " ");
  const collapsed = strippedOfLinksAndEmails.replace(/\s+/g, " ").trim();
  const tokens = collapsed ? collapsed.split(" ") : [];
  const meanTokenLength = tokens.length
    ? tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length
    : 0;

  const letters = text.match(/[a-zA-Z]/g) ?? [];
  const vowelCount = letters.filter((c) => "aeiouAEIOU".includes(c)).length;
  const vowelRatio = letters.length ? vowelCount / letters.length : 0; // logged only, weight 0 — see module doc

  const hasEmail = EMAIL_RE.test(text);
  const hasPhone = detectPhone(text);
  const hasYear = YEAR_RE.test(text);

  const squashed = text.toLowerCase().replace(/[^a-z]/g, "");
  const headingsFound = HEADINGS.filter((h) => squashed.includes(h));

  const metrics = {
    chars,
    pageCount: pages,
    charsPerPage,
    tokens: tokens.length,
    meanTokenLength,
    alphaTokens: alphaTokens.length,
    lexiconRate,
    undecodableRatio,
    mojibakeCount,
    vowelRatio,
    hasEmail,
    hasPhone,
    hasYear,
    headingsFound,
  };

  const fatal = [];
  if (chars === 0) {
    fatal.push(signal("EMPTY", "fatal", 0, chars, 0, "No text could be found in this document."));
  } else if (chars < T.MIN_CHARS) {
    fatal.push(signal("TOO_SHORT", "fatal", 0, chars, T.MIN_CHARS, "This looks like far too little text for a resume."));
  }
  if (charsPerPage < T.MIN_CHARS_PER_PAGE) {
    fatal.push(signal("NO_TEXT_LAYER", "fatal", 0, charsPerPage, T.MIN_CHARS_PER_PAGE, "This document doesn't seem to have a readable text layer."));
  }
  if (alphaTokens.length >= T.LEXICON_MIN_TOKENS && lexiconRate < T.LEXICON_FATAL) {
    fatal.push(signal("GARBLED_TEXT", "fatal", 0, lexiconRate, T.LEXICON_FATAL, "The extracted text doesn't look like readable English."));
  }
  if (undecodableRatio > T.UNDECODABLE_RATIO) {
    fatal.push(signal("UNDECODABLE_CHARS", "fatal", 0, undecodableRatio, T.UNDECODABLE_RATIO, "This document contains many unreadable characters."));
  }
  if (chars >= T.MIN_CHARS && meanTokenLength > T.MEAN_TOKEN_LEN_FATAL) {
    fatal.push(signal("WORDS_MERGED", "fatal", 0, meanTokenLength, T.MEAN_TOKEN_LEN_FATAL, "Words in this document appear to be merged together."));
  }

  const isFatal = fatal.length > 0;

  const weak = [];
  if (!hasEmail && !hasPhone) {
    weak.push(signal("NO_CONTACT", "weak", 4, null, null, "We couldn't find an email or phone number."));
  }
  if (pages >= 2 && charsPerPage < T.SPARSE_CHARS_PER_PAGE_MULTI) {
    weak.push(signal("SPARSE_PAGES", "weak", 4, charsPerPage, T.SPARSE_CHARS_PER_PAGE_MULTI, "Some pages may contain little to no extractable text."));
  }
  if (mojibakeCount >= T.MOJIBAKE_COUNT) {
    weak.push(signal("MOJIBAKE", "weak", 4, mojibakeCount, T.MOJIBAKE_COUNT, "This document may contain encoding errors."));
  }
  if (alphaTokens.length >= T.LEXICON_MIN_TOKENS && lexiconRate >= T.LEXICON_FATAL && lexiconRate < T.LEXICON_WEAK) {
    weak.push(signal("LOW_LEXICON", "weak", 3, lexiconRate, T.LEXICON_WEAK, "The extracted text has unusually few recognizable words."));
  }
  if (headingsFound.length === 0) {
    weak.push(signal("NO_SECTION_HEADINGS", "weak", 3, 0, null, "We couldn't find typical resume section headings."));
  }
  if (chars >= T.MIN_CHARS && meanTokenLength > T.MEAN_TOKEN_LEN_WEAK && meanTokenLength <= T.MEAN_TOKEN_LEN_FATAL) {
    weak.push(signal("SPACES_LOST", "weak", 3, meanTokenLength, T.MEAN_TOKEN_LEN_WEAK, "Spacing between words may be missing."));
  }
  if (pages === 1 && charsPerPage < T.SPARSE_CHARS_PER_PAGE) {
    weak.push(signal("SPARSE_TEXT", "weak", 2, charsPerPage, T.SPARSE_CHARS_PER_PAGE, "This document has less text than a typical resume."));
  }
  if (!hasYear) {
    weak.push(signal("NO_DATE", "weak", 2, null, null, "We couldn't find any dates in this document."));
  }

  let verdict;
  let penalty;
  if (isFatal) {
    verdict = "unusable";
    penalty = 0;
  } else {
    penalty = weak.reduce((sum, s) => sum + s.weight, 0);
    verdict = penalty >= T.ESCALATE_AT ? "degraded" : "good";
  }

  // fatal first, then weight descending — matches the intended read order
  // in the confirm-step UI.
  const signals = [...fatal, ...weak.sort((a, b) => b.weight - a.weight)];

  return {
    verdict,
    penalty,
    signals,
    codes: signals.map((s) => s.code),
    metrics,
  };
}
