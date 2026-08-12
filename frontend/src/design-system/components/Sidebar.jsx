import React from "react";
import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ICON } from "./Icon";

/**
 * Sidebar — primary navigation, 240px expanded or a 64px icon rail.
 *
 * Collapsed, labels are removed from the DOM rather than hidden, and
 * each item carries an `aria-label` plus a native tooltip, so the rail
 * is still navigable without sight of the icons.
 *
 * Items that are not built yet are rendered `disabled` rather than
 * omitted: the nav should show the shape of the product, but must not
 * offer a destination that does not exist.
 */
export function Sidebar({ items, collapsed, onToggle, canToggle = true, footer, brand }) {
  return (
    <aside className={`ds-sidebar${collapsed ? " is-collapsed" : ""}`} aria-label="Main">
      <div className="ds-sidebar__head">
        {collapsed ? null : <div className="ds-sidebar__brand">{brand}</div>}
        {canToggle ? (
          <button
            type="button"
            className="ds-sidebar__toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
          >
            {collapsed
              ? <PanelLeftOpen size={ICON.md} strokeWidth={ICON.stroke} />
              : <PanelLeftClose size={ICON.md} strokeWidth={ICON.stroke} />}
          </button>
        ) : null}
      </div>

      <nav className="ds-sidebar__nav">
        <ul>
          {items.map((item) => (
            <li key={item.key}>
              {item.disabled ? (
                <span
                  className="ds-sidebar__item is-disabled"
                  aria-disabled="true"
                  title={`${item.label} — ${item.disabledReason ?? "not available yet"}`}
                >
                  <span className="ds-sidebar__icon" aria-hidden="true">{item.icon}</span>
                  {collapsed ? (
                    <span className="ds-sr-only">{item.label} — {item.disabledReason ?? "not available yet"}</span>
                  ) : (
                    <>
                      <span className="ds-sidebar__label">{item.label}</span>
                      <span className="ds-sidebar__soon">Soon</span>
                    </>
                  )}
                </span>
              ) : (
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `ds-sidebar__item${isActive ? " is-active" : ""}`}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="ds-sidebar__icon" aria-hidden="true">{item.icon}</span>
                  {collapsed ? <span className="ds-sr-only">{item.label}</span> : <span className="ds-sidebar__label">{item.label}</span>}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {footer ? <div className="ds-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}
