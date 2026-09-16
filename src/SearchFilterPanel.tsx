import type { ReactNode } from "react";
import { DEFAULT_PREFS, type DurationFilter, type ResultType, type SearchPrefs, type SortFilter, type UploadFilter } from "./searchSettings";

const TYPES: { id: ResultType; label: string }[] = [
  { id: "", label: "Any" },
  { id: "video", label: "Videos" },
  { id: "shorts", label: "Shorts" },
  { id: "playlist", label: "Playlists" },
];

const DURATIONS: { id: DurationFilter; label: string }[] = [
  { id: "", label: "Any length" },
  { id: "short", label: "Under 3 min" },
  { id: "medium", label: "3–20 min" },
  { id: "long", label: "Over 20 min" },
];

const UPLOADS: { id: UploadFilter; label: string }[] = [
  { id: "", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

const SORTS: { id: SortFilter; label: string }[] = [
  { id: "relevance", label: "Relevance" },
  { id: "date", label: "Upload date" },
  { id: "views", label: "View count" },
];

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "var(--tf-accent-soft)" : "none",
        border: `1px solid ${active ? "var(--tf-accent-line)" : "var(--tf-line)"}`,
        color: active ? "var(--tf-accent)" : "var(--tf-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        letterSpacing: "0.04em",
        padding: "5px 10px",
        borderRadius: "999px",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tf-filter-group">
      <div className="tf-filter-group-label">{title}</div>
      <div className="tf-chip-row">{children}</div>
    </div>
  );
}

export function activeFilterLabels(prefs: SearchPrefs) {
  const labels: string[] = [];
  const type = TYPES.find((item) => item.id === prefs.type && item.id);
  const duration = DURATIONS.find((item) => item.id === prefs.duration && item.id);
  const upload = UPLOADS.find((item) => item.id === prefs.upload && item.id);
  const sort = SORTS.find((item) => item.id === prefs.sort && item.id !== "relevance");
  if (type) labels.push(type.label);
  if (duration) labels.push(duration.label);
  if (upload) labels.push(upload.label);
  if (prefs.hd) labels.push("HD");
  if (prefs.subtitles) labels.push("CC");
  if (prefs.creativeCommons) labels.push("Creative Commons");
  if (sort) labels.push(sort.label);
  return labels;
}

export function clearSearchFilters(prefs: SearchPrefs): SearchPrefs {
  return {
    ...prefs,
    type: DEFAULT_PREFS.type,
    duration: DEFAULT_PREFS.duration,
    upload: DEFAULT_PREFS.upload,
    sort: DEFAULT_PREFS.sort,
    hd: DEFAULT_PREFS.hd,
    subtitles: DEFAULT_PREFS.subtitles,
    creativeCommons: DEFAULT_PREFS.creativeCommons,
  };
}

export default function SearchFilterPanel({
  prefs,
  onChange,
}: {
  prefs: SearchPrefs;
  onChange: (next: SearchPrefs) => void;
}) {
  const active = activeFilterLabels(prefs);
  return (
    <div className="tf-search-chips">
      <Group title="Type">
        {TYPES.map((item) => (
          <Chip
            key={item.id || "any-type"}
            label={item.label}
            active={prefs.type === item.id}
            onClick={() => onChange({ ...prefs, type: item.id })}
          />
        ))}
      </Group>
      <Group title="Duration">
        {DURATIONS.map((item) => (
          <Chip
            key={item.id || "any-dur"}
            label={item.label}
            active={prefs.duration === item.id}
            onClick={() => onChange({ ...prefs, duration: item.id })}
          />
        ))}
      </Group>
      <Group title="Upload date">
        {UPLOADS.map((item) => (
          <Chip
            key={item.id || "any-up"}
            label={item.label}
            active={prefs.upload === item.id}
            onClick={() => onChange({ ...prefs, upload: item.id })}
          />
        ))}
      </Group>
      <Group title="Features">
        <Chip label="HD" active={prefs.hd} onClick={() => onChange({ ...prefs, hd: !prefs.hd })} />
        <Chip
          label="Subtitles/CC"
          active={prefs.subtitles}
          onClick={() => onChange({ ...prefs, subtitles: !prefs.subtitles })}
        />
        <Chip
          label="Creative Commons"
          active={prefs.creativeCommons}
          onClick={() => onChange({ ...prefs, creativeCommons: !prefs.creativeCommons })}
        />
      </Group>
      <Group title="Sort / Prioritise">
        {SORTS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={prefs.sort === item.id}
            onClick={() => onChange({ ...prefs, sort: item.id })}
          />
        ))}
      </Group>
      {active.length > 0 ? (
        <button
          type="button"
          className="tf-filter-clear"
          onClick={() => onChange(clearSearchFilters(prefs))}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
