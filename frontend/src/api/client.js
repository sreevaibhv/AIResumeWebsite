const BASE = "/api";

/* ------------------------------------------------------------------
   Session
   ------------------------------------------------------------------ */
const SESSION_KEY = "parse.session";
const PREFS_KEY = "parse.prefs";

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    } catch {
      return null;
    }
  },
  set(value) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};

/**
 * Onboarding answers.
 *
 * These are client preferences, not profile data: the `User` table has
 * no experience or tier column, so there is nowhere on the server to
 * put them. They exist to pre-fill the analyse form — the values that
 * actually matter are sent per scan as ScanOptions. Persisting them to
 * the profile needs a schema change; until then localStorage is the
 * honest home for them.
 */
export const prefs = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") ?? {};
    } catch {
      return {};
    }
  },
  set(patch) {
    const next = { ...prefs.get(), ...patch };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    return next;
  },
  clear() {
    localStorage.removeItem(PREFS_KEY);
  },
};

/* ------------------------------------------------------------------
   Transport
   ------------------------------------------------------------------ */

/** Raised when a request fails after the refresh attempt. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let refreshInFlight = null;

/**
 * Exchange the refresh token for a new pair.
 *
 * Concurrent 401s share one refresh: without the in-flight promise, a
 * dashboard firing three requests at once would rotate the refresh
 * token three times and invalidate its own session.
 */
async function refreshSession() {
  const current = session.get();
  if (!current?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const tokens = await res.json();
        const next = { ...current, ...tokens };
        session.set(next);
        return next;
      })
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }

  return refreshInFlight;
}

async function request(path, options = {}, { retryOn401 = true } = {}) {
  const token = session.get()?.accessToken;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  // An expired access token should be invisible to the user: rotate and
  // retry once. Only a failed refresh ends the session.
  if (res.status === 401 && retryOn401 && session.get()?.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, options, { retryOn401: false });
    session.clear();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new ApiError(message ?? `Request to ${path} failed with ${res.status}`, res.status);
  }

  return res.json();
}

export const api = {
  // auth — `name` is always sent: RegisterDto marks it @IsString() with no
  // @IsOptional(), so omitting it fails validation under whitelist: true.
  register: (email, password, name) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name: name || email.split("@")[0] }),
    }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  // scans
  listScans: () => request("/scans"),
  createScan: (payload) => request("/scan", { method: "POST", body: JSON.stringify(payload) }),
  getScan: (id) => request(`/scan/${id}`),
  rewriteScan: (id) => request(`/scan/${id}/rewrite`, { method: "POST" }),
  getInterviewPrep: (id) => request(`/scan/${id}/interview-prep`),
  getDiff: (id) => request(`/scan/${id}/diff`),
};
