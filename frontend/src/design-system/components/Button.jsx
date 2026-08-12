import React from "react";

/**
 * Button — variants, not copies.
 *
 * variant: primary | secondary | ghost | danger | link
 * size:    sm | md | lg
 *
 * While `loading`, the label is replaced by a spinner but the button
 * keeps its width, so layout never jumps. It is also disabled and
 * announces `aria-busy`.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  type = "button",
  className = "",
  ...rest
}) {
  const classes = [
    "ds-btn",
    `ds-btn--${variant}`,
    `ds-btn--${size}`,
    fullWidth ? "ds-btn--full" : "",
    loading ? "is-loading" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ds-btn__spinner" aria-hidden="true" /> : null}
      <span className="ds-btn__content">
        {iconLeft ? <span className="ds-btn__icon">{iconLeft}</span> : null}
        {children ? <span className="ds-btn__label">{children}</span> : null}
        {iconRight ? <span className="ds-btn__icon">{iconRight}</span> : null}
      </span>
    </button>
  );
}

/** Square button that carries only an icon. `label` is required — it becomes the accessible name. */
export function IconButton({ icon, label, variant = "ghost", size = "md", className = "", ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={["ds-btn", "ds-btn--icon", `ds-btn--${variant}`, `ds-btn--${size}`, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {icon}
    </button>
  );
}
