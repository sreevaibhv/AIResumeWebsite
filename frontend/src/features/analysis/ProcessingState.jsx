import React, { useEffect, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import { ICON } from "../../design-system";
import "./ProcessingState.css";

/**
 * Processing — the honest version.
 *
 * The brief asks for seven ticking steps. The pipeline has three waves
 * and `POST /scan` does not return until all of them finish, so there
 * is no progress stream to drive a seven-step animation. Faking one on
 * a timer would be a fabrication on the one screen where the product
 * is asking the user to wait and trust it.
 *
 * So the stages below are split by what is actually known:
 *
 *   done     things that genuinely finished before the request went out
 *            — the PDF was parsed in this browser, and the JD was read
 *            from the form. These are facts, not guesses.
 *   active   the real work, held until the response lands.
 *   pending  named so the user knows what is still coming.
 *
 * The elapsed counter is the only moving part, and it is true.
 *
 * When BE-3 lands (Scan.stage written between waves), `stage` can be
 * driven from the server and the middle rows tick over for real.
 */

const STAGES = [
  { key: "resume", label: "Resume read", done: true },
  { key: "jd", label: "Job description read", done: true },
  { key: "local", label: "Keyword and formatting checks", done: true, note: "computed on your device" },
  { key: "match", label: "Matching your experience against the requirements", active: true },
  { key: "score", label: "Scoring and prioritising fixes" },
];

export function ProcessingState({ role }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="processing" role="status" aria-live="polite">
      <div className="processing__inner">
        <div className="ds-label">Analysing</div>
        <h1 className="ds-h2 processing__title">
          {role ? `Comparing your resume with ${role}` : "Comparing your resume with the job description"}
        </h1>

        <ol className="processing__stages">
          {STAGES.map((stage) => (
            <li
              key={stage.key}
              className={`processing__stage${stage.done ? " is-done" : ""}${stage.active ? " is-active" : ""}`}
            >
              <span className="processing__icon" aria-hidden="true">
                {stage.done
                  ? <Check size={ICON.sm} strokeWidth={2} />
                  : stage.active
                    ? <Loader2 size={ICON.sm} strokeWidth={2} className="processing__spin" />
                    : <Circle size={8} strokeWidth={2} />}
              </span>
              <span className="processing__label">
                {stage.label}
                {stage.note ? <span className="processing__note"> — {stage.note}</span> : null}
              </span>
            </li>
          ))}
        </ol>

        <p className="ds-caption processing__foot">
          Usually 25–40 seconds · {seconds}s elapsed. Keep this tab open.
        </p>
      </div>
    </div>
  );
}
