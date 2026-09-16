export const LANG_KEY = "techfocus-content-lang";
export const AUTO_DUB_KEY = "techfocus-auto-dub";
export const FILTER_TYPE_KEY = "techfocus-filter-type";
export const FILTER_DURATION_KEY = "techfocus-filter-duration";
export const FILTER_UPLOAD_KEY = "techfocus-filter-upload";
export const FILTER_SORT_KEY = "techfocus-filter-sort";
export const FILTER_HD_KEY = "techfocus-filter-hd";
export const FILTER_CC_KEY = "techfocus-filter-cc";
export const FILTER_CC_LICENSE_KEY = "techfocus-filter-creativecommons";

export type ResultType = "" | "video" | "shorts" | "playlist";
export type DurationFilter = "" | "short" | "medium" | "long";
export type UploadFilter = "" | "today" | "week" | "month" | "year";
export type SortFilter = "relevance" | "date" | "views";

export type SearchPrefs = {
  lang: string;
  autoDub: boolean;
  type: ResultType;
  duration: DurationFilter;
  upload: UploadFilter;
  sort: SortFilter;
  hd: boolean;
  subtitles: boolean;
  creativeCommons: boolean;
};

export const CONTENT_LANGS = [
  { id: "en", label: "English", gl: "US" },
  { id: "hi", label: "Hindi", gl: "IN" },
  { id: "es", label: "Spanish", gl: "ES" },
  { id: "pt", label: "Portuguese", gl: "BR" },
  { id: "fr", label: "French", gl: "FR" },
  { id: "de", label: "German", gl: "DE" },
  { id: "ja", label: "Japanese", gl: "JP" },
  { id: "ko", label: "Korean", gl: "KR" },
  { id: "zh", label: "Chinese", gl: "CN" },
  { id: "ar", label: "Arabic", gl: "SA" },
  { id: "ta", label: "Tamil", gl: "IN" },
  { id: "te", label: "Telugu", gl: "IN" },
  { id: "bn", label: "Bengali", gl: "IN" },
] as const;

export const DEFAULT_PREFS: SearchPrefs = {
  lang: "en",
  autoDub: false,
  type: "",
  duration: "",
  upload: "",
  sort: "relevance",
  hd: false,
  subtitles: false,
  creativeCommons: false,
};

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function readText(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeText(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function regionForLang(hl: string) {
  return CONTENT_LANGS.find((item) => item.id === hl)?.gl || "US";
}

export function langLabel(hl: string) {
  return CONTENT_LANGS.find((item) => item.id === hl)?.label || hl || "English";
}

export function readSearchPrefs(): SearchPrefs {
  const type = readText(FILTER_TYPE_KEY, "") as ResultType;
  const duration = readText(FILTER_DURATION_KEY, "") as DurationFilter;
  const upload = readText(FILTER_UPLOAD_KEY, "") as UploadFilter;
  const sort = readText(FILTER_SORT_KEY, "relevance") as SortFilter;
  const lang = readText(LANG_KEY, "en");
  return {
    lang: CONTENT_LANGS.some((item) => item.id === lang) ? lang : "en",
    autoDub: readFlag(AUTO_DUB_KEY),
    type: ["", "video", "shorts", "playlist"].includes(type) ? type : "",
    duration: ["", "short", "medium", "long"].includes(duration) ? duration : "",
    upload: ["", "today", "week", "month", "year"].includes(upload) ? upload : "",
    sort: ["relevance", "date", "views"].includes(sort) ? sort : "relevance",
    hd: readFlag(FILTER_HD_KEY),
    subtitles: readFlag(FILTER_CC_KEY),
    creativeCommons: readFlag(FILTER_CC_LICENSE_KEY),
  };
}

export function writeSearchPrefs(prefs: SearchPrefs) {
  writeText(LANG_KEY, prefs.lang);
  writeText(AUTO_DUB_KEY, prefs.autoDub ? "1" : "0");
  writeText(FILTER_TYPE_KEY, prefs.type);
  writeText(FILTER_DURATION_KEY, prefs.duration);
  writeText(FILTER_UPLOAD_KEY, prefs.upload);
  writeText(FILTER_SORT_KEY, prefs.sort);
  writeText(FILTER_HD_KEY, prefs.hd ? "1" : "0");
  writeText(FILTER_CC_KEY, prefs.subtitles ? "1" : "0");
  writeText(FILTER_CC_LICENSE_KEY, prefs.creativeCommons ? "1" : "0");
}

export function prefsFingerprint(prefs: SearchPrefs, includeShorts: boolean) {
  const shorts = prefs.type === "shorts" ? 1 : prefs.type === "video" ? 0 : includeShorts ? 1 : 0;
  return [
    prefs.lang,
    prefs.type || "any",
    prefs.duration || "any",
    prefs.upload || "any",
    prefs.sort,
    `hd:${prefs.hd ? 1 : 0}`,
    `cc:${prefs.subtitles ? 1 : 0}`,
    `cr:${prefs.creativeCommons ? 1 : 0}`,
    `shorts:${shorts}`,
  ].join("|");
}

export function searchApiQuery(prefs: SearchPrefs, includeShorts: boolean) {
  const shorts = prefs.type === "shorts" ? 1 : prefs.type === "video" ? 0 : includeShorts ? 1 : 0;
  const params = new URLSearchParams();
  params.set("shorts", String(shorts));
  params.set("hl", prefs.lang);
  params.set("gl", regionForLang(prefs.lang));
  if (prefs.type) params.set("type", prefs.type);
  if (prefs.duration) params.set("duration", prefs.duration);
  if (prefs.upload) params.set("upload", prefs.upload);
  if (prefs.sort && prefs.sort !== "relevance") params.set("sort", prefs.sort);
  if (prefs.hd) params.set("hd", "1");
  if (prefs.subtitles) params.set("cc", "1");
  if (prefs.creativeCommons) params.set("creativecommons", "1");
  return params.toString();
}

export function applyPreferredAudio(
  player: {
    getAvailableAudioTracks?: () => Array<Record<string, unknown>>;
    setAudioTrack?: (track: unknown) => void;
    setOption?: (module: string, option: string, value: unknown) => void;
  } | null,
  hl: string,
  autoDub: boolean,
) {
  if (!player || !hl) return false;
  try {
    player.setOption?.("captions", "track", { languageCode: hl });
  } catch {
    // captions module may be closed
  }
  if (!autoDub) return false;
  try {
    const tracks = player.getAvailableAudioTracks?.() || [];
    const needle = langLabel(hl).toLowerCase();
    const match = tracks.find((track) => {
      const blob = `${track.id || ""} ${track.languageCode || ""} ${track.caption || ""} ${track.displayName || ""} ${track.name || ""}`.toLowerCase();
      return blob.includes(hl.toLowerCase()) || blob.includes(needle);
    });
    if (match) {
      player.setAudioTrack?.(match);
      return true;
    }
  } catch {
    // IFrame audio-track API is not always present
  }
  return false;
}
