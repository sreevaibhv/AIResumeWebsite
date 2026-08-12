import React from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "../signal/ui";
import "./AppShell.css";

/**
 * PublicShell — landing, auth, and the report when it is opened by
 * someone who is not signed in (a WhatsApp deep link).
 *
 * No sidebar: a signed-out visitor has nowhere to navigate to, and a
 * nav full of destinations that bounce to /login is worse than none.
 */
export function PublicShell({ children, nav = true, footer = true }) {
  return (
    <div className="public-shell">
      <a href="#main-content" className="app-shell__skip">Skip to content</a>

      <header className="public-shell__header">
        <Link to="/" aria-label="PARSE home" style={{ textDecoration: "none" }}>
          <Wordmark size={14} />
        </Link>

        {nav ? (
          <nav className="public-shell__nav">
            <Link to="/login" className="ds-data" style={{ color: "var(--ink-mid)" }}>Sign in</Link>
          </nav>
        ) : null}
      </header>

      <main id="main-content" className="public-shell__main" tabIndex={-1}>
        {children}
      </main>

      {footer ? (
        <footer className="public-shell__footer">
          PARSE// — resume intelligence. Your resume is analysed against the job you name, and nothing else.
        </footer>
      ) : null}
    </div>
  );
}
