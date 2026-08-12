import React, { createContext, useContext, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

/**
 * Toast — transient confirmation, mounted once at the app root.
 *
 *   const toast = useToast();
 *   toast.success("Change accepted");
 *   toast.error("Could not save", { description: "Check your connection." });
 *
 * The live region is polite for success/info and assertive for errors,
 * so a failure interrupts a screen reader but a confirmation does not.
 * Toasts are for things that succeeded; anything the user must act on
 * belongs in an inline <Alert>, not here.
 */

const ToastContext = createContext(null);

const ICONS = { good: CheckCircle2, warn: AlertTriangle, critical: XCircle, info: Info };

export function ToastProvider({ children, duration = 4500 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((tone, message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list, { id, tone, message, description: options.description }]);
    const ms = options.duration ?? duration;
    if (ms > 0) timers.current[id] = setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss, duration]);

  const api = useMemo(() => ({
    success: (m, o) => push("good", m, o),
    error:   (m, o) => push("critical", m, { duration: 8000, ...o }),
    warn:    (m, o) => push("warn", m, o),
    info:    (m, o) => push("info", m, o),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ds-toasts">
          <div aria-live="polite" aria-atomic="false" className="ds-toasts__region">
            {toasts.filter((t) => t.tone !== "critical").map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
          <div aria-live="assertive" aria-atomic="false" className="ds-toasts__region">
            {toasts.filter((t) => t.tone === "critical").map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.tone] ?? Info;
  return (
    <div className={`ds-toast ds-toast--${toast.tone}`}>
      <span className="ds-toast__icon" aria-hidden="true"><Icon size={16} /></span>
      <div className="ds-toast__body">
        <div className="ds-toast__message">{toast.message}</div>
        {toast.description ? <div className="ds-toast__desc">{toast.description}</div> : null}
      </div>
      <button type="button" className="ds-toast__dismiss" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">×</button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}
