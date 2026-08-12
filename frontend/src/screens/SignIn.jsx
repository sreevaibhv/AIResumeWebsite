import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { T, globalStyleSheet } from "../signal/tokens";
import { Eyebrow, Card, Button, Field, input, Wordmark } from "../signal/ui";
import { prefs } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

/* ============================================================
   E2 — Sign in / create account.

   Heading is contextual: arriving from a finished scan it offers to
   save the analysis; from the nav it just signs you in. Never a bare
   "Sign up" on a screen that interrupts a result.
   ============================================================ */

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();
  const fromScan = location.state?.scanId ?? null;
  // Where the user was headed before the auth wall stopped them.
  const intended = location.state?.from ?? null;

  const [mode, setMode] = useState(location.state?.mode === "signin" ? "signin" : "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isSignup) {
        await signUp(email, password, name);
        // New accounts land in onboarding; returning users never see it.
        navigate(intended ?? "/app/onboarding", { replace: true });
      } else {
        await signIn(email, password);
        navigate(intended ?? (prefs.get().onboarded ? "/app" : "/app/onboarding"), { replace: true });
      }
    } catch (err) {
      setError(friendly(err.message, isSignup));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: T.sans, display: "flex", flexDirection: "column" }}>
      <style>{globalStyleSheet}</style>

      <header style={{ padding: "22px 24px" }}>
        <Wordmark />
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 24px 64px" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h1 style={{ fontFamily: T.sans, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: T.ink, margin: "0 0 6px" }}>
            {fromScan ? "Save your analysis" : isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: T.inkMid, margin: "0 0 20px" }}>
            {fromScan
              ? "Your report is ready — create an account to keep it and track your fixes."
              : isSignup
                ? "Analyse a job, see what is costing you the interview, and fix it."
                : "Sign in to pick up where you left off."}
          </p>

          <Card pad={20}>
            <form onSubmit={handleSubmit} noValidate>
              {isSignup ? (
                <Field label="Name">
                  <input
                    style={input} type="text" value={name} autoComplete="name"
                    onChange={(e) => setName(e.target.value)} placeholder="Aditya Sharma"
                  />
                </Field>
              ) : null}

              <Field label="Email">
                <input
                  style={input} type="email" value={email} required autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                />
              </Field>

              <Field label="Password" hint={isSignup ? "8+ characters" : undefined}>
                <input
                  style={input} type="password" value={password} required
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                />
              </Field>

              {error ? (
                <div
                  role="alert"
                  style={{
                    background: T.weakWash, color: T.weak, border: `1px solid transparent`,
                    borderRadius: 5, padding: "9px 11px", fontSize: 13, lineHeight: 1.45, marginBottom: 14,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <Button type="submit" disabled={busy}>
                {busy ? "Working…" : isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ height: 1, background: T.rule, flex: 1 }} />
              <Eyebrow>or</Eyebrow>
              <div style={{ height: 1, background: T.rule, flex: 1 }} />
            </div>

            <Button variant="ghost" type="button" onClick={() => { window.location.href = "/api/auth/google"; }}>
              Continue with Google
            </Button>
          </Card>

          <p style={{ fontSize: 13, color: T.inkMid, textAlign: "center", marginTop: 16 }}>
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              onClick={() => { setMode(isSignup ? "signin" : "signup"); setError(""); }}
              style={{ background: "none", border: 0, padding: 0, color: T.accent, fontSize: 13, fontFamily: T.sans, cursor: "pointer", textDecoration: "underline" }}
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function friendly(message = "", isSignup) {
  const m = message.toLowerCase();
  if (m.includes("email must be an email")) return "That does not look like an email address.";
  if (m.includes("password") && m.includes("longer")) return "Passwords need at least 8 characters.";
  if (m.includes("already")) return "An account with that email already exists — sign in instead.";
  if (m.includes("invalid") || m.includes("unauthorized") || m.includes("401")) {
    return isSignup ? "We could not create that account." : "That email and password do not match.";
  }
  if (m.includes("failed to fetch")) return "Cannot reach the server. Is the backend running?";
  return message || "Something went wrong. Please try again.";
}
