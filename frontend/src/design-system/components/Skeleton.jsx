import React from "react";

/**
 * Skeleton — a placeholder that preserves the final layout.
 *
 * The point is that nothing moves when real content arrives, so a
 * skeleton should match the shape of what replaces it. Marked
 * `aria-hidden`; the surrounding region should carry `aria-busy`
 * instead, so screen readers announce "loading" once rather than
 * reading a wall of empty boxes.
 */
export function Skeleton({ width, height = 12, radius = "sm", className = "", style }) {
  return (
    <span
      aria-hidden="true"
      className={["ds-skeleton", `ds-skeleton--${radius}`, className].filter(Boolean).join(" ")}
      style={{ width, height, ...style }}
    />
  );
}

/** A few lines of text, the last one short — the way real paragraphs end. */
export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={["ds-skeleton-stack", className].filter(Boolean).join(" ")} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={10} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3, className = "" }) {
  return (
    <div className={["ds-card", "ds-card--pad-md", className].filter(Boolean).join(" ")} aria-hidden="true">
      <Skeleton height={12} width="40%" />
      <div style={{ height: 12 }} />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Matches the ScoreRing footprint so the rings do not jump in. */
export function SkeletonRing({ size = 96, className = "" }) {
  return (
    <div className={["ds-skeleton-ring", className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className="ds-skeleton ds-skeleton--full" style={{ width: size, height: size }} />
      <Skeleton height={9} width={54} />
    </div>
  );
}
