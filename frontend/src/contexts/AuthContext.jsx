import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, session, prefs } from "../api/client";
import { track } from "../services/analytics";

/**
 * The one place the app asks "who is signed in?".
 *
 * Before this, components read localStorage directly, which meant a
 * sign-out in the shell did not re-render anything else. Session state
 * lives here so every consumer updates together.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => session.get());

  const signIn = useCallback(async (email, password) => {
    const tokens = await api.login(email, password);
    const next = { ...tokens, email, name: session.get()?.name ?? email.split("@")[0] };
    session.set(next);
    setUser(next);
    track("signin");
    return next;
  }, []);

  const signUp = useCallback(async (email, password, name) => {
    const tokens = await api.register(email, password, name);
    const next = { ...tokens, email, name: name || email.split("@")[0] };
    session.set(next);
    setUser(next);
    track("signup");
    return next;
  }, []);

  const signOut = useCallback(() => {
    session.clear();
    prefs.clear();
    setUser(null);
    track("signout");
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user?.accessToken), signIn, signUp, signOut }),
    [user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
