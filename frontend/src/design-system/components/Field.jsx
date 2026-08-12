import React, { useId } from "react";

/**
 * Form controls.
 *
 * Every control is wrapped by <Field>, which owns the label, the hint,
 * the error message and the wiring between them: the label's `htmlFor`,
 * `aria-describedby` for the hint, and `aria-invalid` + `role="alert"`
 * for the error. Getting that wiring right once here is why controls
 * should never be hand-rolled in a page.
 */
export function Field({ label, hint, error, required, children, htmlFor, className = "" }) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={["ds-field", error ? "is-invalid" : "", className].filter(Boolean).join(" ")}>
      {label ? (
        <div className="ds-field__head">
          <label className="ds-label ds-field__label" htmlFor={id}>
            {label}
            {required ? <span className="ds-field__required" aria-hidden="true"> *</span> : null}
          </label>
          {hint ? <span className="ds-field__hint" id={hintId}>{hint}</span> : null}
        </div>
      ) : null}

      {typeof children === "function"
        ? children({ id, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })
        : children}

      {error ? (
        <p className="ds-field__error" id={errorId} role="alert">{error}</p>
      ) : null}
    </div>
  );
}

export function Input({ invalid, className = "", ...rest }) {
  return <input className={["ds-input", invalid ? "is-invalid" : "", className].filter(Boolean).join(" ")} {...rest} />;
}

export function Textarea({ invalid, rows = 6, className = "", ...rest }) {
  return (
    <textarea
      rows={rows}
      className={["ds-input", "ds-textarea", invalid ? "is-invalid" : "", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

export function Select({ children, invalid, className = "", ...rest }) {
  return (
    <select className={["ds-input", "ds-select", invalid ? "is-invalid" : "", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, description, id, className = "", ...rest }) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={["ds-choice", className].filter(Boolean).join(" ")}>
      <input type="checkbox" id={inputId} className="ds-choice__input" {...rest} />
      <label htmlFor={inputId} className="ds-choice__label">
        <span className="ds-choice__title">{label}</span>
        {description ? <span className="ds-choice__desc">{description}</span> : null}
      </label>
    </div>
  );
}

export function Radio({ label, description, id, className = "", ...rest }) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={["ds-choice", className].filter(Boolean).join(" ")}>
      <input type="radio" id={inputId} className="ds-choice__input" {...rest} />
      <label htmlFor={inputId} className="ds-choice__label">
        <span className="ds-choice__title">{label}</span>
        {description ? <span className="ds-choice__desc">{description}</span> : null}
      </label>
    </div>
  );
}

/**
 * Segmented single-choice control — the tier and experience pickers.
 * Rendered as a real radiogroup so arrow keys and screen readers work;
 * it only looks like a row of chips.
 */
export function ChoiceGroup({ label, name, value, onChange, options, columns }) {
  return (
    <div className="ds-field" role="radiogroup" aria-label={label}>
      {label ? <div className="ds-label ds-field__label">{label}</div> : null}
      <div className="ds-choicegroup" style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
        {options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          const selected = value === val;
          return (
            <label key={val} className={`ds-choicegroup__item${selected ? " is-selected" : ""}`}>
              <input
                type="radio"
                name={name}
                value={val}
                checked={selected}
                onChange={() => onChange(val)}
                className="ds-sr-only"
              />
              <span>{text}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
