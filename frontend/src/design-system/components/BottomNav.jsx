import React from "react";
import { NavLink } from "react-router-dom";

/**
 * BottomNav — phone navigation, replacing the sidebar below 768px.
 *
 * Rendered only when the viewport actually matches, not hidden with
 * CSS: a nav that is display:none is still in the accessibility tree
 * on some combinations, and duplicating five destinations for a screen
 * reader is worse than not shipping them.
 *
 * Items sit on a 56px row with `env(safe-area-inset-bottom)` padding so
 * they clear the home indicator on modern phones.
 */
export function BottomNav({ items }) {
  return (
    <nav className="ds-bottomnav" aria-label="Main">
      {items.map((item) => (
        item.disabled ? (
          <span
            key={item.key}
            className="ds-bottomnav__item is-disabled"
            aria-disabled="true"
            title={`${item.label} — ${item.disabledReason ?? "not available yet"}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="ds-bottomnav__label">{item.label}</span>
          </span>
        ) : (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `ds-bottomnav__item${isActive ? " is-active" : ""}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="ds-bottomnav__label">{item.label}</span>
          </NavLink>
        )
      ))}
    </nav>
  );
}
