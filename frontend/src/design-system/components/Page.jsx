import React from "react";

/**
 * Page — the content column inside the shell.
 *
 * `width` sets the reading measure, and this is where the old 480px
 * cap dies: analysis screens get `wide`, forms get `narrow`, and
 * nothing hardcodes a pixel value at the call site.
 *
 *   narrow   560   auth, single forms
 *   default  940   dashboard, lists
 *   wide    1200   report, side-by-side diffs
 *   full    100%   edge-to-edge
 */
export function Page({ title, subtitle, actions, width = "default", children, className = "" }) {
  return (
    <div className={["ds-page", `ds-page--${width}`, className].filter(Boolean).join(" ")}>
      {(title || actions) ? (
        <div className="ds-page__header">
          <div className="ds-page__headtext">
            {title ? <h1 className="ds-h1">{title}</h1> : null}
            {subtitle ? <p className="ds-page__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="ds-page__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** A titled block within a page. */
export function Section({ title, actions, children, className = "" }) {
  return (
    <section className={["ds-section", className].filter(Boolean).join(" ")}>
      {(title || actions) ? (
        <div className="ds-section__header">
          {title ? <div className="ds-label">{title}</div> : null}
          {actions ? <div className="ds-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Grid — responsive by intrinsic sizing rather than by breakpoint.
 *
 * `min` is the narrowest a column may get before the grid reflows, so
 * the same markup works at every width without a media query. Pass
 * `cols` only when a fixed column count is genuinely required.
 */
export function Grid({ min = 220, cols, gap = "var(--grid-gutter)", children, className = "" }) {
  const style = cols
    ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }
    : { gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap };

  return <div className={["ds-grid", className].filter(Boolean).join(" ")} style={style}>{children}</div>;
}

/**
 * Split — the analysis two-column layout.
 * Collapses to one column below the laptop breakpoint.
 */
export function Split({ side, children, sideWidth = 320, sideFirst = false, className = "" }) {
  return (
    <div
      className={["ds-split", sideFirst ? "ds-split--side-first" : "", className].filter(Boolean).join(" ")}
      style={{ "--side-w": `${sideWidth}px` }}
    >
      <div className="ds-split__side">{side}</div>
      <div className="ds-split__main">{children}</div>
    </div>
  );
}
