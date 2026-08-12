import React from "react";
import { Link } from "react-router-dom";

/**
 * TopBar — page identity and account actions.
 *
 * Carries the wordmark only below the tablet breakpoint, where the
 * sidebar is gone. Above it the sidebar owns the brand and the top bar
 * shows where you are: an optional breadcrumb above the page title.
 */
export function TopBar({ brand, crumb, crumbTo, heading, actions }) {
  return (
    <header className="ds-topbar">
      {brand ? <div className="ds-topbar__brand">{brand}</div> : null}

      <div className="ds-topbar__title">
        {crumb ? (
          crumbTo
            ? <Link to={crumbTo} className="ds-topbar__crumb">← {crumb}</Link>
            : <span className="ds-topbar__crumb">{crumb}</span>
        ) : null}
        {heading ? <div className="ds-topbar__heading">{heading}</div> : null}
      </div>

      {actions ? <div className="ds-topbar__actions">{actions}</div> : null}
    </header>
  );
}
