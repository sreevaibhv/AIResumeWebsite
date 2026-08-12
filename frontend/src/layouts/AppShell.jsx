import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileSearch, FileText, MessagesSquare, Settings } from "lucide-react";
import { Sidebar, TopBar, BottomNav, Chip, Button, ICON } from "../design-system";
import { useIsMobile } from "../hooks/useMediaQuery";
import { useAuth } from "../contexts/AuthContext";
import { Wordmark } from "../signal/ui";
import "./AppShell.css";

/**
 * AppShell — sidebar + top bar + content, or bottom nav on a phone.
 *
 * Sidebar width is a user preference, persisted, with one exception:
 * report routes force the rail, because on the screen that carries
 * side-by-side diffs the 176px difference is worth more as content
 * than as labels. Leaving a report restores the user's own choice.
 */

const SIDEBAR_KEY = "parse.sidebar.collapsed";

const NAV = [
  { key: "dashboard", label: "Dashboard", to: "/app", end: true, icon: <LayoutDashboard size={ICON.md} strokeWidth={ICON.stroke} /> },
  { key: "analyze", label: "Analyze", to: "/app/analyze", icon: <FileSearch size={ICON.md} strokeWidth={ICON.stroke} /> },
  { key: "resumes", label: "My Resumes", to: "/app/resumes", icon: <FileText size={ICON.md} strokeWidth={ICON.stroke} />, disabled: true, disabledReason: "coming with resume management" },
  { key: "prep", label: "Interview Prep", to: "/app/prep", icon: <MessagesSquare size={ICON.md} strokeWidth={ICON.stroke} />, disabled: true, disabledReason: "coming with interview prep" },
  { key: "settings", label: "Settings", to: "/app/settings", icon: <Settings size={ICON.md} strokeWidth={ICON.stroke} />, disabled: true, disabledReason: "coming with account settings" },
];

function readPreference() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppShell({ children, crumb, crumbTo, heading, actions }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();

  const [preference, setPreference] = useState(readPreference);

  const forcedRail = location.pathname.startsWith("/report");
  const collapsed = forcedRail || preference;

  const toggle = useCallback(() => {
    setPreference((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* preference is not load-bearing */ }
      return next;
    });
  }, []);

  // Moving between pages should not silently strand keyboard focus at
  // the bottom of the previous document — but only on an actual
  // navigation. Focusing on first mount would drop focus past the skip
  // link, making it unreachable by the keyboard users it exists for.
  //
  // Guarding on the pathname rather than a "first render" flag is
  // deliberate: StrictMode mounts effects twice in development, so a
  // boolean ref is already false on the second run and focus moves
  // anyway. Comparing the path is idempotent under double-invocation.
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname]);

  function handleSignOut() {
    signOut();
    navigate("/", { replace: true });
  }

  // The email is dropped on a phone rather than truncated: a long
  // address squeezes the wordmark out of the bar, and the account it
  // belongs to is already evident from being signed in.
  const accountActions = (
    <>
      {user?.email && !isMobile ? <Chip tone="neutral">{user.email}</Chip> : null}
      <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign out</Button>
    </>
  );

  return (
    <div className="app-shell">
      <a href="#main-content" className="app-shell__skip">Skip to content</a>

      {isMobile ? null : (
        <Sidebar
          items={NAV}
          collapsed={collapsed}
          onToggle={toggle}
          /* On a report the rail is not the user's choice to make, so the
             control is removed rather than left there doing nothing. */
          canToggle={!forcedRail}
          brand={<Wordmark size={13} />}
        />
      )}

      <div className="app-shell__body">
        <TopBar
          brand={isMobile ? <Wordmark size={13} /> : null}
          crumb={crumb}
          crumbTo={crumbTo}
          heading={heading}
          actions={actions ?? accountActions}
        />

        <main id="main-content" className="app-shell__main" tabIndex={-1}>
          {children}
        </main>
      </div>

      {isMobile ? <BottomNav items={NAV} /> : null}
    </div>
  );
}
