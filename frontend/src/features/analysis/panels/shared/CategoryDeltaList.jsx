import React from "react";
import { Chip } from "../../../../design-system";

/**
 * Per-category score delta chips — shared between FixesPanel (post-improve)
 * and EditPanel (post-save), same shape in both: [{key, before, after, delta}].
 */
export function CategoryDeltaList({ categoryDelta }) {
  if (!categoryDelta?.length) return null;
  const changed = categoryDelta.filter((c) => c.delta !== 0);
  if (!changed.length) return null;

  return (
    <ul className="fixes__delta">
      {changed.map((c) => (
        <li key={c.key} className="ds-body-sm">
          {c.key}: {c.before} → {c.after}
          <Chip tone={c.delta > 0 ? "good" : "critical"}>{c.delta > 0 ? "+" : ""}{c.delta}</Chip>
        </li>
      ))}
    </ul>
  );
}
