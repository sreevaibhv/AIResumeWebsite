/**
 * Verdict thresholds — spec §3. Placeholders to be tuned against the first
 * 20-30 real scans; kept in one module so tuning is a one-line change, not
 * a code review of the verdict logic itself.
 */
export const TARGET_SCORE = 80;
export const BORDERLINE_BAND = 10; // TARGET_SCORE - BAND .. TARGET_SCORE => borderline

/**
 * P0 — score-stability fix. A separate concept from BORDERLINE_BAND above:
 * that one is a fixed margin around TARGET_SCORE for the APPLY/BORDERLINE
 * split; this one is about repeat-call LLM variance on the score itself.
 * Placeholder pending score-stability.golden.test.ts's measured post-fix
 * spread — tune this to that number once real data exists, same spirit as
 * every other constant in this file.
 *
 * When projectedScore sits within this band of either the APPLY threshold
 * (TARGET_SCORE) or the BORDERLINE floor (TARGET_SCORE - BORDERLINE_BAND),
 * computeVerdict resolves to BORDERLINE instead of committing to a hard
 * label a re-score's noise could just as easily flip.
 */
export const SCORE_NOISE_BAND = 5;

/** Minimum fraction (0-1) of must-have JD keywords that must be found or confirmed. */
export const KEYWORD_FLOOR = 0.5;

/** Minimum earned points (of WEIGHTS.experience = 20) on Experience fit. */
export const EXPERIENCE_FLOOR = 8;
