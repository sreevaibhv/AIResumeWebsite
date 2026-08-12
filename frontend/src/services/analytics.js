/**
 * Analytics — one funnel, one call site per event.
 *
 * There is no analytics backend yet (BE-11), so this currently only
 * logs in development. It exists now anyway because the alternative is
 * sprinkling tracking calls through JSX later and then having to find
 * them all: every screen built from here on calls `track()`, and
 * wiring a real provider becomes a change to this file alone.
 *
 * Event names are fixed here rather than passed as free strings, so a
 * typo is a build-time reference error instead of a silent gap in the
 * funnel.
 */

export const EVENTS = {
  signup: "signup",
  signin: "signin",
  signout: "signout",
  onboarding_completed: "onboarding_completed",
  onboarding_skipped: "onboarding_skipped",
  resume_uploaded: "resume_uploaded",
  jd_submitted: "jd_submitted",
  scan_started: "scan_started",
  scan_completed: "scan_completed",
  scan_failed: "scan_failed",
  report_viewed: "report_viewed",
  optimization_started: "optimization_started",
  rewrite_accepted: "rewrite_accepted",
  rewrite_rejected: "rewrite_rejected",
  rescan_started: "rescan_started",
  score_improved: "score_improved",
  interview_prep_opened: "interview_prep_opened",
  interview_question_viewed: "interview_question_viewed",
  upgrade_clicked: "upgrade_clicked",
  checkout_started: "checkout_started",
  payment_completed: "payment_completed",
  // Not in the original list, and both matter: the first says how often
  // the trust path actually fires, the second whether anyone engages
  // with a flagged claim rather than clicking past it.
  verification_failed_shown: "verification_failed_shown",
  claim_verification_responded: "claim_verification_responded",
};

export function track(event, properties = {}) {
  if (!Object.values(EVENTS).includes(event)) {
    // eslint-disable-next-line no-console
    console.warn(`[analytics] unknown event "${event}" — add it to EVENTS.`);
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, properties);
  }
  // Phase 9/11: forward to a real provider here.
}
