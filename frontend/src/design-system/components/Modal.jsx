import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal — a focus trap with a dialog inside it.
 *
 * The accessibility work is the reason this is a shared component:
 * `role="dialog"` + `aria-modal`, focus moved in on open and restored
 * to the trigger on close, Tab cycling held inside, Escape to dismiss,
 * and background scroll locked. Hand-rolled modals get all six wrong.
 *
 * `size`: sm | md | lg
 * `dismissible`: set false for a decision the user must actually make.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  const close = useCallback(() => {
    if (dismissible) onClose?.();
  }, [dismissible, onClose]);

  // Remember what had focus, move focus into the dialog, restore on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;

    const node = panelRef.current;
    const first = node?.querySelector(FOCUSABLE);
    (first ?? node)?.focus();

    return () => {
      const el = restoreRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  // Lock background scroll without letting the page jump as the
  // scrollbar disappears.
  useEffect(() => {
    if (!open) return;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [open]);

  // Escape closes; Tab cycles within the panel.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const items = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? []);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, close]);

  if (!open) return null;

  const titleId = "ds-modal-title";
  const descId = description ? "ds-modal-desc" : undefined;

  return createPortal(
    <div className="ds-modal__overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={descId}
        tabIndex={-1}
        className={`ds-modal ds-modal--${size}`}
      >
        {(title || dismissible) ? (
          <div className="ds-modal__header">
            <div>
              {title ? <h2 id={titleId} className="ds-h3">{title}</h2> : null}
              {description ? <p id={descId} className="ds-modal__desc">{description}</p> : null}
            </div>
            {dismissible ? (
              <button type="button" className="ds-modal__close" onClick={close} aria-label="Close">
                <X size={16} />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="ds-modal__body">{children}</div>

        {footer ? <div className="ds-modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
