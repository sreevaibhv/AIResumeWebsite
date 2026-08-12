import React from "react";

/**
 * Card — the default container.
 *
 * tone: default | accent | good | warn | critical
 *   Tone tints the border and background. It carries meaning
 *   (a failed verification, a next-step band) and is never decorative.
 *
 * `interactive` makes the whole card a button. When you use it, the
 * card must be reachable by keyboard — pass `onClick` and it renders
 * as a real <button>, not a clickable <div>.
 */
export function Card({
  children,
  tone = "default",
  pad = "md",
  interactive = false,
  as,
  className = "",
  ...rest
}) {
  const classes = [
    "ds-card",
    tone !== "default" ? `ds-card--${tone}` : "",
    `ds-card--pad-${pad}`,
    interactive ? "ds-card--interactive" : "",
    className,
  ].filter(Boolean).join(" ");

  const Tag = as ?? (interactive ? "button" : "div");
  const extra = Tag === "button" ? { type: "button" } : {};

  return (
    <Tag className={classes} {...extra} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div className={["ds-card__header", className].filter(Boolean).join(" ")}>
      <div className="ds-card__headtext">
        {title ? <div className="ds-h3">{title}</div> : null}
        {subtitle ? <div className="ds-caption">{subtitle}</div> : null}
      </div>
      {actions ? <div className="ds-card__actions">{actions}</div> : null}
    </div>
  );
}

export function Divider({ vertical = false, className = "" }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={["ds-divider", vertical ? "ds-divider--v" : "", className].filter(Boolean).join(" ")}
    />
  );
}
