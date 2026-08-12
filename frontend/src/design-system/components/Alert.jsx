import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

/**
 * Alert — an inline message attached to the thing it is about.
 *
 * tone: info | good | warn | critical
 *
 * Critical and warning alerts announce themselves (`role="alert"`);
 * informational ones do not interrupt. Every tone carries an icon as
 * well as colour.
 */
const TONES = {
  info:     { Icon: Info,         role: "status" },
  good:     { Icon: CheckCircle2, role: "status" },
  warn:     { Icon: AlertTriangle, role: "alert" },
  critical: { Icon: XCircle,      role: "alert" },
};

export function Alert({ tone = "info", title, children, actions, onDismiss, className = "" }) {
  const meta = TONES[tone] ?? TONES.info;
  const { Icon } = meta;

  return (
    <div role={meta.role} className={["ds-alert", `ds-alert--${tone}`, className].filter(Boolean).join(" ")}>
      <span className="ds-alert__icon" aria-hidden="true"><Icon size={16} /></span>
      <div className="ds-alert__body">
        {title ? <div className="ds-alert__title">{title}</div> : null}
        {children ? <div className="ds-alert__text">{children}</div> : null}
        {actions ? <div className="ds-alert__actions">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="ds-alert__dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
      ) : null}
    </div>
  );
}

/**
 * EmptyState — never a shrug. Names the thing that is missing and
 * offers the one action that creates it.
 */
export function EmptyState({ icon = null, title, description, action, className = "" }) {
  return (
    <div className={["ds-empty", className].filter(Boolean).join(" ")}>
      {icon ? <span className="ds-empty__icon" aria-hidden="true">{icon}</span> : null}
      <div className="ds-h3">{title}</div>
      {description ? <p className="ds-empty__text">{description}</p> : null}
      {action ? <div className="ds-empty__action">{action}</div> : null}
    </div>
  );
}

/**
 * ErrorState — answers the three questions a user actually has:
 * what happened, what happened to my data and my money, what now.
 */
export function ErrorState({ title, description, reassurance, action, secondaryAction, className = "" }) {
  return (
    <div className={["ds-error", className].filter(Boolean).join(" ")} role="alert">
      <span className="ds-error__icon" aria-hidden="true"><XCircle size={20} /></span>
      <div className="ds-h3">{title}</div>
      {description ? <p className="ds-error__text">{description}</p> : null}
      {reassurance ? <p className="ds-error__reassurance">{reassurance}</p> : null}
      {(action || secondaryAction) ? (
        <div className="ds-error__actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
