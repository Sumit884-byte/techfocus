import { useState } from "react";
import SearchFilterPanel, { activeFilterLabels } from "./SearchFilterPanel";
import type { SearchPrefs } from "./searchSettings";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function SearchFilterChips({
  prefs,
  onChange,
  variant = "search",
}: {
  prefs: SearchPrefs;
  onChange: (next: SearchPrefs) => void;
  variant?: "search" | "settings";
}) {
  const [open, setOpen] = useState(false);
  const labels = activeFilterLabels(prefs);
  const summary = labels.length ? labels.join(" · ") : "None";

  if (variant === "settings") {
    return (
      <div>
        <button
          type="button"
          className="tf-filter-row"
          aria-expanded={open}
          onClick={() => setOpen((next) => !next)}
        >
          <span>
            <span className="tf-filter-row-title">Filter</span>
            <span className="tf-filter-row-copy">
              Type, duration, upload date, features, and sort for search.
            </span>
          </span>
          <span className="tf-filter-row-meta">
            <span className="tf-filter-row-status">{summary}</span>
            <Chevron open={open} />
          </span>
        </button>
        {open ? (
          <div className="tf-filter-panel">
            <SearchFilterPanel prefs={prefs} onChange={onChange} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="tf-filter-toolbar">
      <button
        type="button"
        className={`tf-filter-btn${open || labels.length ? " is-active" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        Filter
        {labels.length ? <span className="tf-filter-count">{labels.length}</span> : null}
        <Chevron open={open} />
      </button>
      {!open && labels.length ? (
        <div className="tf-chip-row">
          {labels.map((label) => (
            <span key={label} className="tf-filter-active-chip">
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {open ? <SearchFilterPanel prefs={prefs} onChange={onChange} /> : null}
    </div>
  );
}
