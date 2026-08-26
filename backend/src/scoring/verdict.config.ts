/**
 * Verdict thresholds — spec §3. Placeholders to be tuned against the first
 * 20-30 real scans; kept in one module so tuning is a one-line change, not
 * a code review of the verdict logic itself.
 */
export const TARGET_SCORE = 80;
export const BORDERLINE_BAND = 10; // TARGET_SCORE - BAND .. TARGET_SCORE => borderline

/** Minimum fraction (0-1) of must-have JD keywords that must be found or confirmed. */
export const KEYWORD_FLOOR = 0.5;

/** Minimum earned points (of WEIGHTS.experience = 20) on Experience fit. */
export const EXPERIENCE_FLOOR = 8;
