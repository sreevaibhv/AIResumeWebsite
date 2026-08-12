import React, { useRef } from "react";
import { Lock } from "lucide-react";

/**
 * Tabs — the report's panel switcher.
 *
 * Implements the WAI-ARIA tabs pattern: roving tabindex, arrow-key
 * navigation, Home/End, and `aria-controls` wiring. Only the active tab
 * is in the tab order, so keyboard users move between panels with
 * arrows rather than tabbing through six triggers.
 *
 * The strip scrolls horizontally below the tablet breakpoint rather
 * than wrapping, which keeps the panel order legible on a phone.
 */
export function Tabs({ tabs, value, onChange, idPrefix = "tab", className = "" }) {
  const refs = useRef({});

  const enabled = tabs.filter((t) => !t.disabled);

  function focusTab(key) {
    onChange(key);
    requestAnimationFrame(() => refs.current[key]?.focus());
  }

  function handleKeyDown(e) {
    const idx = enabled.findIndex((t) => t.key === value);
    if (idx === -1) return;

    let next = null;
    if (e.key === "ArrowRight") next = enabled[(idx + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];

    if (next) {
      e.preventDefault();
      focusTab(next.key);
    }
  }

  return (
    <div className={["ds-tabs", className].filter(Boolean).join(" ")}>
      <div className="ds-tabs__strip" role="tablist" onKeyDown={handleKeyDown}>
        {tabs.map((tab) => {
          const active = tab.key === value;
          return (
            <button
              key={tab.key}
              ref={(el) => { refs.current[tab.key] = el; }}
              type="button"
              role="tab"
              id={`${idPrefix}-${tab.key}`}
              aria-selected={active}
              aria-controls={`${idPrefix}-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              disabled={tab.disabled}
              title={tab.disabled ? tab.disabledReason : undefined}
              className={`ds-tabs__tab${active ? " is-active" : ""}${tab.disabled ? " is-disabled" : ""}`}
              onClick={() => !tab.disabled && onChange(tab.key)}
            >
              {tab.label}
              {tab.disabled ? <Lock size={11} aria-hidden="true" /> : null}
              {tab.count != null ? <span className="ds-tabs__count">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ tabKey, value, idPrefix = "tab", children }) {
  if (tabKey !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabKey}`}
      aria-labelledby={`${idPrefix}-${tabKey}`}
      tabIndex={0}
      className="ds-tabs__panel"
    >
      {children}
    </div>
  );
}
