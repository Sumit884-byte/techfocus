import { useState, useEffect, useLayoutEffect, useMemo, useRef, createContext, useContext, type ReactNode } from "react";
import { durationSeconds, isShort, isTechVideo, matchesCategory } from "./techFilter";

const CATEGORIES = [
  "All",
  "Programming",
  "AI / ML",
  "DevOps",
  "Cloud",
  "Data",
  "Networking",
  "Systems",
  "Hardware",
  "Robotics",
  "Security",
  "Web",
  "Mobile",
  "Open Source",
];
const CATEGORY_HINTS: Record<string, string> = {
  Programming: "programming",
  "AI / ML": "machine learning",
  DevOps: "devops",
  Cloud: "cloud computing",
  Data: "databases",
  Networking: "computer networking",
  Systems: "operating systems",
  Hardware: "hardware",
  Robotics: "robotics",
  Security: "security",
  Web: "web development",
  Mobile: "mobile development",
  "Open Source": "open source",
};
const HISTORY_KEY = "techfocus-watch-history";
const PROGRESS_KEY = "techfocus-watch-progress-v2";
const QUEUE_KEY = "techfocus-watch-queue";
const PLAYLIST_VIEW_KEY = "techfocus-playlist-view";
const LAST_PLAYLIST_KEY = "techfocus-last-playlist";
const LAST_VIDEO_KEY = "techfocus-last-video";
const RETURN_KEY = "techfocus-return-to";
const AUDIO_MODE_KEY = "techfocus-audio-mode";
const SHORTS_KEY = "techfocus-include-shorts";
const WATCH_MODE_KEY = "techfocus-watch-mode";
const AUDIO_RATE_KEY = "techfocus-audio-rate";
const AUDIO_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

type AppPage = "home" | "history" | "settings" | "playlist" | "watch";
type ReturnTo = "home" | "history" | "settings" | "playlist";

const VIDEOS = [
  {
    id: "6avJHaC3C2U",
    title: "The Art of Code",
    channel: "NDC Conferences",
    duration: "1:00:49",
    views: "1.2M",
    posted: "4 years ago",
    category: "Programming",
  },
  {
    id: "aircAruvnKk",
    title: "But What Is a Neural Network?",
    channel: "3Blue1Brown",
    duration: "19:13",
    views: "15M",
    posted: "7 years ago",
    category: "AI / ML",
  },
  {
    id: "Gjnup-PuquQ",
    title: "Docker in 100 Seconds",
    channel: "Fireship",
    duration: "2:10",
    views: "1.8M",
    posted: "3 years ago",
    category: "DevOps",
  },
  {
    id: "o8NPllzkFhE",
    title: "Linus Torvalds: The Mind Behind Linux",
    channel: "TED",
    duration: "22:28",
    views: "3.5M",
    posted: "9 years ago",
    category: "Open Source",
  },
  {
    id: "PziYflu8cB8",
    title: "Kubernetes Explained in 100 Seconds",
    channel: "Fireship",
    duration: "2:26",
    views: "2.1M",
    posted: "3 years ago",
    category: "DevOps",
  },
  {
    id: "5C_HPTJg5ek",
    title: "Rust in 100 Seconds",
    channel: "Fireship",
    duration: "2:34",
    views: "1.1M",
    posted: "2 years ago",
    category: "Programming",
  },
  {
    id: "PaCmpygFfXo",
    title: "Building makemore: Intro to Language Modeling",
    channel: "Andrej Karpathy",
    duration: "1:55:58",
    views: "650K",
    posted: "2 years ago",
    category: "AI / ML",
  },
  {
    id: "hwP7WQkmECE",
    title: "Git Explained in 100 Seconds",
    channel: "Fireship",
    duration: "1:58",
    views: "900K",
    posted: "3 years ago",
    category: "Open Source",
  },
  {
    id: "T4Df5_cojAs",
    title: "How HTTPS Works (in 6 minutes)",
    channel: "Computerphile",
    duration: "6:01",
    views: "750K",
    posted: "5 years ago",
    category: "Security",
  },
  {
    id: "cNN_tTXABUA",
    title: "How a CPU Works",
    channel: "In One Lesson",
    duration: "20:41",
    views: "4.2M",
    posted: "10 years ago",
    category: "Hardware",
  },
  {
    id: "inWWhr5tnEA",
    title: "What Is Cyber Security | How It Works?",
    channel: "Simplilearn",
    duration: "7:12",
    views: "3.1M",
    posted: "5 years ago",
    category: "Security",
  },
  {
    id: "1I5ZMmrOfnA",
    title: "How Computers Calculate — the ALU",
    channel: "Crash Course",
    duration: "11:27",
    views: "2.4M",
    posted: "8 years ago",
    category: "Hardware",
  },
  {
    id: "PH-2FfFD2PU",
    title: "Kubernetes in 5 mins",
    channel: "IBM Technology",
    duration: "5:30",
    views: "1.4M",
    posted: "4 years ago",
    category: "DevOps",
  },
  {
    id: "wjZofJX0v4M",
    title: "Transformers, the tech behind LLMs",
    channel: "3Blue1Brown",
    duration: "27:17",
    views: "8.1M",
    posted: "1 year ago",
    category: "AI / ML",
  },
  {
    id: "ci1PJexnfNE",
    title: "Why C is So Influential",
    channel: "Computerphile",
    duration: "10:50",
    views: "2M",
    posted: "8 years ago",
    category: "Programming",
  },
  {
    id: "42iQKuQodW4",
    title: "Linux Directories Explained in 100 Seconds",
    channel: "Fireship",
    duration: "2:27",
    views: "1.3M",
    posted: "3 years ago",
    category: "Open Source",
  },
];

function thumbSources(id: string) {
  return [
    `https://i.ytimg.com/vi/${id}/hq720.jpg`,
    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/0.jpg`,
  ];
}

function thumb(id: string) {
  return thumbSources(id)[2];
}

const DESC_STAMP = /(?:\d{1,2}:)?\d{1,2}:\d{2}/;
const DESC_TOKEN = /((?:\d{1,2}:)?\d{1,2}:\d{2})|(https?:\/\/[^\s<]+)/g;

function timestampToSeconds(stamp: string) {
  const parts = stamp.split(":").map(Number);
  if (!parts.length || parts.some((value) => !Number.isFinite(value))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function formatDescription(text: string) {
  let next = String(text || "").replace(/\r\n/g, "\n").trim();
  if ((next.match(/\n/g) || []).length < 2) {
    next = next.replace(/[ \t]+(?=(?:\d{1,2}:)?\d{1,2}:\d{2}\b)/g, "\n");
  }
  return next;
}

function WatchDescription({ text, onSeek }: { text: string; onSeek: (seconds: number) => void }) {
  const lines = formatDescription(text).split("\n");
  return (
    <div className="tf-watch-desc">
      <div className="tf-watch-desc-text">
        {lines.map((line, lineIdx) => {
          if (!line.trim()) return <div key={lineIdx} className="tf-watch-desc-break" />;
          const chapter = DESC_STAMP.test(line.trim().slice(0, 8));
          const parts = line.split(DESC_TOKEN);
          return (
            <p key={lineIdx} className={chapter ? "tf-watch-desc-chapter" : undefined}>
              {parts.map((part, partIdx) => {
                if (!part) return null;
                if (/^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(part)) {
                  const seconds = timestampToSeconds(part);
                  if (seconds == null) return part;
                  return (
                    <button
                      key={`${lineIdx}-${partIdx}`}
                      type="button"
                      className="tf-watch-desc-time"
                      onClick={() => onSeek(seconds)}
                    >
                      {part}
                    </button>
                  );
                }
                if (/^https?:\/\//i.test(part)) {
                  const href = part.replace(/[),.;!?]+$/g, "");
                  const extra = part.slice(href.length);
                  return (
                    <span key={`${lineIdx}-${partIdx}`}>
                      <a className="tf-watch-desc-link" href={href} target="_blank" rel="noopener noreferrer">
                        {href}
                      </a>
                      {extra}
                    </span>
                  );
                }
                return <span key={`${lineIdx}-${partIdx}`}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function StreamIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4.9 19.1a9 9 0 0 1 0-14.2" />
      <path d="M7.8 16.2a5 5 0 0 1 0-8.4" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M16.2 7.8a5 5 0 0 1 0 8.4" />
      <path d="M19.1 4.9a9 9 0 0 1 0 14.2" />
    </svg>
  );
}

function ChannelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.4-3.2 3.9-5 7-5s5.6 1.8 7 5" />
    </svg>
  );
}

function ChannelLogo({ video }: { video: Video }) {
  const known = channelThumbOf(video);
  const [src, setSrc] = useState(known);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (video.channelThumb) rememberChannelThumb(video.channel, video.channelThumb);
    if (known) {
      setSrc(known);
      setFailed(false);
      return;
    }
    if (!video.channel) return;
    const controller = new AbortController();
    fetch(`/api/channel-logo?name=${encodeURIComponent(video.channel)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.url === "string" && data.url) {
          rememberChannelThumb(video.channel, data.url);
          setSrc(data.url);
          setFailed(false);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [known, video.channel, video.channelThumb]);

  if (!src || failed) return <ChannelIcon />;
  return (
    <img
      className="tf-channel-logo"
      src={`/api/avatar?u=${encodeURIComponent(src)}`}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function LikeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 11v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z" />
      <path d="M7 11 11 3h1.5a3 3 0 0 1 2.9 3.7L14.8 11H20a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 18.8 22H7" />
    </svg>
  );
}

function ViewsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PremiereIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function Spinner({ size = 28 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid var(--tf-line)",
        borderTopColor: "var(--tf-accent)",
        animation: "tf-spin 0.7s linear infinite",
      }}
    />
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function BrandIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--tf-accent)" />
      <polygon points="10 8 17 12 10 16" fill="#111827" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

type Video = {
  id: string;
  title: string;
  channel: string;
  channelThumb?: string;
  duration: string;
  views: string;
  posted: string;
  category: string;
  short?: boolean;
};

type Playlist = {
  id: string;
  title: string;
  channel: string;
  count: string;
  duration?: string;
  thumb: string;
  category: string;
};

const CHANNEL_LOGOS = new Map<string, string>();

function rememberChannelThumb(channel?: string, url?: string) {
  const name = (channel || "").trim().toLowerCase();
  const src = (url || "").trim();
  if (name && src) CHANNEL_LOGOS.set(name, src);
}

function channelThumbOf(video: Video) {
  const name = (video.channel || "").trim().toLowerCase();
  return video.channelThumb || (name ? CHANNEL_LOGOS.get(name) || "" : "");
}

const SEARCH_CACHE = new Map<string, Video[]>();
const PLAYLIST_CACHE = new Map<string, Video[]>();
const PLAYLIST_COUNTS = new Map<string, string>();
const PLAYLIST_DURATIONS = new Map<string, string>();
const PLAYLIST_CONTINUATIONS = new Map<string, string>();
const PLAYLIST_WATCHERS = new Map<string, Set<() => void>>();
const PLAYLIST_PARTIAL = new Set<string>();
const PLAYLIST_INFLIGHT = new Set<string>();
const PLAYLIST_PRELOAD_QUEUE: string[] = [];
let playlistPreloadBusy = false;

function parseVideoCount(value?: string) {
  const match = String(value || "").replace(/,/g, "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatVideoCount(value?: string, fallback = 0) {
  const n = parseVideoCount(value) || fallback;
  if (!n) return "";
  return n === 1 ? "1 video" : `${n.toLocaleString()} videos`;
}

function formatPlaylistDuration(seconds: number) {
  const total = Math.floor(Number(seconds) || 0);
  if (total <= 0) return "";
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0 && minutes === 60) return `${hours + 1}h`;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${Math.max(1, minutes)}m`;
}

function playlistDurationLabel(id: string, duration?: string, videos?: Video[], partial = false) {
  if (duration) return duration;
  const cached = PLAYLIST_DURATIONS.get(id);
  if (cached) return cached;
  const list = videos || PLAYLIST_CACHE.get(id) || [];
  const label = formatPlaylistDuration(list.reduce((sum, video) => sum + durationSeconds(video.duration), 0));
  return label ? (partial ? `${label}+` : label) : "";
}

function rememberPlaylist(id: string, results: Video[], count?: string, continuation?: string, duration?: string) {
  if (results.length) PLAYLIST_CACHE.set(id, results);
  const label = formatVideoCount(count);
  if (label) PLAYLIST_COUNTS.set(id, label);
  const summed = formatPlaylistDuration(results.reduce((sum, video) => sum + durationSeconds(video.duration), 0));
  if (duration && !continuation) PLAYLIST_DURATIONS.set(id, duration);
  else if (duration && !PLAYLIST_DURATIONS.has(id)) PLAYLIST_DURATIONS.set(id, duration);
  else if (!PLAYLIST_DURATIONS.has(id) && summed) PLAYLIST_DURATIONS.set(id, continuation ? `${summed}+` : summed);
  else if (!duration && summed && continuation) PLAYLIST_DURATIONS.set(id, `${summed}+`);
  else if (!duration && summed && !continuation) PLAYLIST_DURATIONS.set(id, summed);
  if (continuation !== undefined) {
    if (continuation) {
      PLAYLIST_CONTINUATIONS.set(id, continuation);
      PLAYLIST_PARTIAL.add(id);
    } else {
      PLAYLIST_CONTINUATIONS.delete(id);
      PLAYLIST_PARTIAL.delete(id);
    }
  }
  PLAYLIST_WATCHERS.get(id)?.forEach((fn) => fn());
}

function watchPlaylist(id: string, fn: () => void) {
  let set = PLAYLIST_WATCHERS.get(id);
  if (!set) {
    set = new Set();
    PLAYLIST_WATCHERS.set(id, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (!set.size) PLAYLIST_WATCHERS.delete(id);
  };
}

function firstVideoIdFromThumb(thumb?: string) {
  const match = (thumb || "").match(/\/vi\/([\w-]{11})\//);
  return match?.[1] || "";
}

function prefetchPlaylist(id: string) {
  if (!id) return Promise.resolve();
  if (PLAYLIST_CACHE.has(id)) {
    if (!PLAYLIST_COUNTS.has(id)) rememberPlaylist(id, PLAYLIST_CACHE.get(id) || []);
    return Promise.resolve();
  }
  if (PLAYLIST_INFLIGHT.has(id)) return Promise.resolve();
  PLAYLIST_INFLIGHT.add(id);
  return fetch(`/api/playlist?id=${encodeURIComponent(id)}`)
    .then((res) => res.json())
    .then((data) => {
      const results = Array.isArray(data.results) ? data.results : [];
      if (!results.length) return;
      rememberPlaylist(id, results, data.count, data.continuation || "", data.duration);
      if (results[0]?.id) preloadPlayer(results[0].id);
    })
    .catch(() => {})
    .finally(() => PLAYLIST_INFLIGHT.delete(id));
}

function enqueuePlaylistPreload(id: string, front = false) {
  if (!id || PLAYLIST_CACHE.has(id) || PLAYLIST_INFLIGHT.has(id) || PLAYLIST_PRELOAD_QUEUE.includes(id)) return;
  if (front) PLAYLIST_PRELOAD_QUEUE.unshift(id);
  else PLAYLIST_PRELOAD_QUEUE.push(id);
  drainPlaylistPreload();
}

async function drainPlaylistPreload() {
  if (playlistPreloadBusy) return;
  playlistPreloadBusy = true;
  while (PLAYLIST_PRELOAD_QUEUE.length) {
    const batch = PLAYLIST_PRELOAD_QUEUE.splice(0, 3);
    await Promise.all(batch.map((id) => prefetchPlaylist(id)));
  }
  playlistPreloadBusy = false;
}

function warmPlaylist(playlist: Playlist, priority = false) {
  const thumbId = firstVideoIdFromThumb(playlist.thumb);
  if (thumbId) preloadPlayer(thumbId);
  enqueuePlaylistPreload(playlist.id, priority);
}

function loadYoutubeApi() {
  const w = window as Window & { YT?: { Player: new (el: HTMLElement, opts: object) => { destroy: () => void } }; onYouTubeIframeAPIReady?: () => void; __ytApi?: Promise<void> };
  if (w.YT?.Player) return Promise.resolve();
  if (w.__ytApi) return w.__ytApi;
  w.__ytApi = new Promise((resolve) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return w.__ytApi;
}

function preloadPlayer(videoId: string) {
  const href = thumb(videoId);
  if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  document.head.appendChild(link);
}

function pickClosestVideos(query: string, bag: Record<string, Video[]>, suggestions: string[] = []) {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
  const keys = [query, normalized, ...suggestions];
  for (const key of keys) {
    const videos = bag[key] || bag[key.toLowerCase()];
    if (Array.isArray(videos) && videos.length) return { videos, used: key };
  }

  const words = new Set(normalized.split(" ").filter(Boolean));
  let best: Video[] = [];
  let used = normalized;
  let bestScore = -1;
  for (const [key, videos] of Object.entries(bag)) {
    if (!Array.isArray(videos) || !videos.length) continue;
    const score = key.toLowerCase().split(/\s+/).filter((word) => words.has(word)).length;
    if (score > bestScore) {
      bestScore = score;
      best = videos;
      used = key;
    }
  }
  return { videos: best, used };
}

function readHistory(): Video[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(videos: Video[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(videos.slice(0, 30)));
}

function watchedIdSet(extra: string[] = []) {
  const ids = new Set(extra.filter(Boolean));
  for (const video of readHistory()) {
    if (video?.id) ids.add(video.id);
  }
  for (const id of Object.keys(readProgressMap())) {
    if (id) ids.add(id);
  }
  return ids;
}

function watchedIdList(extra: string[] = []) {
  return [...watchedIdSet(extra)];
}

function readWatchQueue(): Video[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWatchQueue(videos: Video[]) {
  sessionStorage.setItem(QUEUE_KEY, JSON.stringify(videos));
}

function readSessionJson<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const parsed = JSON.parse(sessionStorage.getItem(key) || "null");
    return parsed ?? null;
  } catch {
    return null;
  }
}

function writeSessionJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

function stubVideo(id: string): Video {
  return { id, title: "", channel: "", duration: "", views: "", posted: "", category: "" };
}

function parseHashParts(hash = typeof window === "undefined" ? "" : window.location.hash) {
  const raw = hash.replace(/^#\/?/, "").trim();
  const qIndex = raw.indexOf("?");
  const path = (qIndex === -1 ? raw : raw.slice(0, qIndex)).replace(/\/+$/, "");
  const params = new URLSearchParams(qIndex === -1 ? "" : raw.slice(qIndex + 1));
  return { path, params };
}

function searchQueryFromParams(params: URLSearchParams) {
  return (params.get("search_query") || params.get("q") || "").trim();
}

function resultsPath(query: string) {
  return `results?search_query=${encodeURIComponent(query.trim())}`;
}

function routeFromHash(hash = typeof window === "undefined" ? "" : window.location.hash): {
  page: AppPage;
  id: string;
  searchQuery: string;
} {
  const { path, params } = parseHashParts(hash);
  const searchQuery = searchQueryFromParams(params);
  if (path === "history") return { page: "history", id: "", searchQuery: "" };
  if (path === "settings") return { page: "settings", id: "", searchQuery: "" };
  if (path === "results" || path === "search") return { page: "home", id: "", searchQuery };
  const slash = path.indexOf("/");
  const kind = slash === -1 ? path : path.slice(0, slash);
  const id = slash === -1 ? "" : path.slice(slash + 1);
  if (kind === "playlist" && id) return { page: "playlist", id, searchQuery: "" };
  if (kind === "watch") {
    if (id) return { page: "watch", id, searchQuery: "" };
    const last = readSessionJson<Video>(LAST_VIDEO_KEY);
    if (last?.id) return { page: "watch", id: last.id, searchQuery: "" };
  }
  return { page: "home", id: "", searchQuery };
}

function setHash(path: string, replace = false) {
  const next = path ? `#/${path}` : "";
  if (window.location.hash === next || (!next && !window.location.hash)) return;
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}${next}`;
    window.history.replaceState(null, "", url || "/");
    return;
  }
  window.location.hash = next;
}

function restorePlaylist(id: string): Playlist | null {
  const stored = readSessionJson<Playlist>(LAST_PLAYLIST_KEY);
  if (stored?.id === id) return stored;
  return { id, title: "Playlist", channel: "", count: "", thumb: "", category: "" };
}

function restoreVideo(id: string): Video {
  const stored = readSessionJson<Video>(LAST_VIDEO_KEY);
  if (stored?.id === id) return stored;
  const queued = readWatchQueue().find((item) => item.id === id);
  if (queued) return queued;
  const seen = readHistory().find((item) => item.id === id);
  if (seen) return seen;
  return stubVideo(id);
}

function readProgressMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function readProgress(id: string) {
  const seconds = Number(readProgressMap()[id] || 0);
  return Number.isFinite(seconds) && seconds > 5 ? Math.floor(seconds) : 0;
}

function writeProgress(id: string, seconds: number, duration = 0) {
  try {
    if (!id) return;
    const map = readProgressMap();
    const done = duration > 0 && seconds / duration >= 0.95;
    if (seconds < 5 && !done) delete map[id];
    else map[id] = Math.floor(done && duration ? duration : seconds);
    const ids = Object.keys(map);
    if (ids.length > 80) ids.slice(0, ids.length - 80).forEach((key) => delete map[key]);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

function watchPercent(id: string, durationLabel?: string) {
  const total = durationSeconds(durationLabel);
  const watched = Number(readProgressMap()[id] || 0);
  if (!Number.isFinite(watched) || watched <= 0) return 0;
  if (total <= 0) return watched > 0 ? 1 : 0;
  return Math.min(100, Math.round((watched / total) * 100));
}

function displayCategory(category: string) {
  if (!category || /external|recommended|search/i.test(category)) return "";
  return category;
}

function cleanMeta(value?: string) {
  const text = (value || "").trim();
  if (!text || /^unknown$/i.test(text) || text === "0") return "";
  return text;
}

function compactViews(views?: string) {
  const raw = cleanMeta(views)?.replace(/\s*views?$/i, "") || "";
  if (!raw) return "";
  const short = raw.match(/^([\d.,]+)\s*([kmb])$/i);
  const number = short ? Number(short[1].replace(/,/g, "")) : Number(raw.replace(/,/g, ""));
  const mul = short ? { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[short[2].toLowerCase()] : 1;
  if (!Number.isFinite(number) || !mul) return raw;
  const n = number * mul;
  if (n >= 1_000_000_000) return `${n >= 10_000_000_000 ? Math.round(n / 1_000_000_000) : String((n / 1_000_000_000).toFixed(1)).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `${n >= 10_000_000 ? Math.round(n / 1_000_000) : String((n / 1_000_000).toFixed(1)).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${n >= 10_000 ? Math.floor(n / 1_000) : String((n / 1_000).toFixed(1)).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

function viewLabel(views?: string) {
  const value = compactViews(views);
  if (!value) return "";
  return `${value} views`;
}

function postedInfo(posted?: string) {
  const raw = cleanMeta(posted) || "";
  const streamed = /\bstreamed\b/i.test(raw);
  const premiered = /\bpremiered\b/i.test(raw);
  const text = raw
    .replace(/^(streamed|premiered)\s+/i, "")
    .replace(/\b(\d+)\s+seconds?\s+ago\b/i, "$1s ago")
    .replace(/\b(\d+)\s+minutes?\s+ago\b/i, "$1m ago")
    .replace(/\b(\d+)\s+hours?\s+ago\b/i, "$1h ago")
    .replace(/\b(\d+)\s+days?\s+ago\b/i, "$1d ago")
    .replace(/\b(\d+)\s+weeks?\s+ago\b/i, "$1w ago")
    .replace(/\b(\d+)\s+months?\s+ago\b/i, "$1mo ago")
    .replace(/\b(\d+)\s+years?\s+ago\b/i, "$1y ago")
    .trim();
  return { streamed, premiered, text };
}

function videoMetaParts(video: Video) {
  const posted = postedInfo(video.posted);
  return [
    cleanMeta(video.channel) && !/views?/i.test(video.channel) ? cleanMeta(video.channel) : "",
    viewLabel(video.views),
    posted.text,
  ].filter(Boolean);
}

function VideoMetaLine({ video, className = "" }: { video: Video; className?: string }) {
  const posted = postedInfo(video.posted);
  const channel = cleanMeta(video.channel) && !/views?/i.test(video.channel) ? cleanMeta(video.channel) : "";
  const views = compactViews(video.views);
  if (!channel && !views && !posted.text) return null;
  return (
    <div className={`tf-video-meta ${className}`.trim()}>
      {channel ? (
        <span className="tf-video-meta-channel" title={channel}>
          <ChannelLogo video={video} />
          <span className="tf-video-meta-elide">{channel}</span>
        </span>
      ) : null}
      {views ? (
        <span className="tf-video-meta-stat" title={viewLabel(video.views)}>
          <ViewsIcon />
          <span>{views}</span>
        </span>
      ) : null}
      {posted.text ? (
        <span className="tf-video-meta-when" title={cleanMeta(video.posted)}>
          {posted.streamed ? <StreamIcon /> : posted.premiered ? <PremiereIcon /> : null}
          <span>{posted.text}</span>
        </span>
      ) : null}
    </div>
  );
}

function sanitizeVideo(video: Video, fallbackChannel = ""): Video {
  const channel =
    cleanMeta(video.channel) && !/views?/i.test(video.channel) ? cleanMeta(video.channel) : cleanMeta(fallbackChannel);
  rememberChannelThumb(channel || video.channel, video.channelThumb);
  return {
    ...video,
    channel,
    channelThumb: video.channelThumb || channelThumbOf({ ...video, channel }),
    views: cleanMeta(video.views)?.replace(/\s*views?$/i, "") || "",
    posted: cleanMeta(video.posted),
  };
}

function LazyThumb({ id, alt, hovered }: { id: string; alt: string; hovered: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [level, setLevel] = useState(0);
  const sources = thumbSources(id);

  useEffect(() => {
    setReady(false);
    setLevel(0);
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id]);

  function nextSource() {
    setLevel((current) => Math.min(current + 1, sources.length - 1));
  }

  return (
    <div ref={ref} className="tf-thumb-fill">
      {ready ? (
        <img
          key={`${id}-${level}`}
          src={sources[level]}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={nextSource}
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth > 0 && event.currentTarget.naturalWidth <= 120) {
              nextSource();
            }
          }}
          className={hovered ? "tf-thumb-zoom" : undefined}
        />
      ) : null}
    </div>
  );
}

function VideoCard({
  video,
  onClick,
  loading = false,
}: {
  video: Video;
  onClick: () => void;
  loading?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-left w-full h-full"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: loading ? "progress" : "pointer",
        height: "100%",
        display: "flex",
      }}
    >
      <div
        className="tf-card"
        style={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        <div className="tf-thumb">
          <LazyThumb id={video.id} alt={video.title} hovered={hovered} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: loading ? "rgba(12,12,14,0.72)" : "rgba(12,12,14,0.5)",
              opacity: hovered || loading ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
          >
            {loading ? (
              <>
                <Spinner />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-accent)" }}>loading</span>
              </>
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--tf-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#111827",
                }}
              >
                <PlayIcon />
              </div>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              background: "rgba(12,12,14,0.85)",
              color: "var(--tf-text)",
              padding: "2px 6px",
              borderRadius: "2px",
            }}
          >
            {video.duration}
          </div>
        </div>

        <div
          className="tf-card-copy"
          style={{
            padding: "12px 14px 14px",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 118,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--tf-accent)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
              minHeight: 15,
              lineHeight: "15px",
            }}
          >
            {displayCategory(video.category) || "\u00a0"}
          </div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--tf-text)",
              lineHeight: 1.45,
              marginBottom: 8,
              height: 41,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {video.title}
          </div>
          <VideoMetaLine video={video} />
        </div>
      </div>
    </button>
  );
}

function SymbolicCard({
  video,
  onSelect,
  onReject,
  loading = false,
}: {
  video: Video;
  onSelect: (video: Video) => void;
  onReject?: (video: Video) => void;
  loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"pending" | "keep" | "drop">("pending");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const keep = isTechVideo(video);
        setState(keep ? "keep" : "drop");
        if (!keep) onReject?.(video);
        observer.disconnect();
      },
      { rootMargin: "280px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video, onReject]);

  if (state === "drop") return null;
  if (state === "keep") return <VideoCard video={video} onClick={() => onSelect(video)} loading={loading} />;

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        borderRadius: "4px",
        background: "var(--tf-panel)",
        border: "1px dashed var(--tf-line)",
        aspectRatio: "16/9",
      }}
    />
  );
}

function PlaylistCard({ playlist, onClick }: { playlist: Playlist; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [countLabel, setCountLabel] = useState(() =>
    formatVideoCount(playlist.count) || PLAYLIST_COUNTS.get(playlist.id) || "",
  );
  const [durationLabel, setDurationLabel] = useState(() =>
    playlistDurationLabel(playlist.id, playlist.duration),
  );
  const cardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => {
      setCountLabel(formatVideoCount(playlist.count) || PLAYLIST_COUNTS.get(playlist.id) || "");
      setDurationLabel(playlistDurationLabel(playlist.id, playlist.duration));
    };
    sync();
    return watchPlaylist(playlist.id, sync);
  }, [playlist.id, playlist.count, playlist.duration]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) warmPlaylist(playlist);
      },
      { rootMargin: "280px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [playlist.id, playlist.thumb]);

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        warmPlaylist(playlist, true);
      }}
      onMouseLeave={() => setHovered(false)}
      className="text-left w-full h-full"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", height: "100%", display: "flex" }}
    >
      <div
        className="tf-card"
        style={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        <div className="tf-thumb">
          {playlist.thumb ? (
            <img src={playlist.thumb} alt={playlist.title} />
          ) : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent 42%, rgba(11,13,18,0.55) 68%, rgba(11,13,18,0.88) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--tf-accent)",
              textAlign: "right",
              padding: "10px 8px 10px 18px",
              borderRadius: 10,
              background: "linear-gradient(90deg, transparent, rgba(11,13,18,0.55) 28%, rgba(11,13,18,0.72))",
              textShadow: "0 1px 8px rgba(0,0,0,0.65)",
            }}
          >
            PLAYLIST
            <div style={{ color: "var(--tf-text)", marginTop: 4 }}>{countLabel || "…"}</div>
            {durationLabel ? <div style={{ color: "#d1d5db", marginTop: 4 }}>{durationLabel}</div> : null}
          </div>
        </div>
        <div
          className="tf-card-copy"
          style={{
            padding: "12px 14px 14px",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 118,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--tf-accent)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
              minHeight: 15,
              lineHeight: "15px",
            }}
          >
            {displayCategory(playlist.category) || "\u00a0"}
          </div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--tf-text)",
              lineHeight: 1.45,
              marginBottom: 8,
              height: 41,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {playlist.title}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--tf-muted)",
              lineHeight: 1.4,
              height: 16,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {playlist.channel}
          </div>
        </div>
      </div>
    </button>
  );
}

function PlaylistView({
  playlist,
  onBack,
  onSelect,
  openingId = null,
}: {
  playlist: Playlist;
  onBack: () => void;
  onSelect: (video: Video, queue?: Video[]) => void;
  openingId?: string | null;
}) {
  const cached = (PLAYLIST_CACHE.get(playlist.id) || []).map((video) => sanitizeVideo(video, playlist.channel));
  const [videos, setVideos] = useState<Video[]>(cached);
  const [loading, setLoading] = useState(!cached.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(
    Boolean(PLAYLIST_CONTINUATIONS.get(playlist.id)) ||
      parseVideoCount(playlist.count || PLAYLIST_COUNTS.get(playlist.id)) > cached.length,
  );
  const loadingMoreRef = useRef(false);
  const [listView, setListView] = useState<"cards" | "titles">(() => {
    try {
      return localStorage.getItem(PLAYLIST_VIEW_KEY) === "titles" ? "titles" : "cards";
    } catch {
      return "cards";
    }
  });

  function setPlaylistView(next: "cards" | "titles") {
    setListView(next);
    try {
      localStorage.setItem(PLAYLIST_VIEW_KEY, next);
    } catch {
      // ignore
    }
  }

  const [playlistSearch, setPlaylistSearch] = useState("");
  const lectureQuery = playlistSearch.trim().toLowerCase();
  const visibleLectures = lectureQuery
    ? videos.filter(
        (video) =>
          video.title.toLowerCase().includes(lectureQuery) ||
          video.channel.toLowerCase().includes(lectureQuery),
      )
    : videos;
  const lectureNumber = (id: string) => {
    const index = videos.findIndex((video) => video.id === id);
    return index >= 0 ? index + 1 : 0;
  };
  const durationLabel = playlistDurationLabel(
    playlist.id,
    playlist.duration,
    videos,
    Boolean(PLAYLIST_CONTINUATIONS.get(playlist.id)),
  );

  useEffect(() => {
    const ready = PLAYLIST_CACHE.get(playlist.id);
    const total = parseVideoCount(playlist.count || PLAYLIST_COUNTS.get(playlist.id));
    if (ready?.length) {
      setVideos(ready.map((video) => sanitizeVideo(video, playlist.channel)));
      setLoading(false);
      if (ready[0]) preloadPlayer(ready[0].id);
      setHasMore(Boolean(PLAYLIST_CONTINUATIONS.get(playlist.id)) || total > ready.length);
      if (PLAYLIST_CONTINUATIONS.has(playlist.id) || (total > 0 && total <= ready.length && !PLAYLIST_PARTIAL.has(playlist.id))) {
        return;
      }
    }
    const controller = new AbortController();
    setLoading(!ready?.length);
    fetch(`/api/playlist?id=${encodeURIComponent(playlist.id)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const results = (Array.isArray(data.results) ? data.results : []).map((video: Video) =>
          sanitizeVideo(video, playlist.channel),
        );
        if (results.length) rememberPlaylist(playlist.id, results, data.count, data.continuation || "", data.duration);
        setVideos(results);
        setHasMore(Boolean(data.continuation) || parseVideoCount(data.count) > results.length);
        if (results[0]) preloadPlayer(results[0].id);
      })
      .catch(() => {
        if (!controller.signal.aborted) setVideos([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [playlist.id, playlist.count]);

  async function loadMoreLectures() {
    const token = PLAYLIST_CONTINUATIONS.get(playlist.id);
    if (!token || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/playlist?id=${encodeURIComponent(playlist.id)}&continuation=${encodeURIComponent(token)}`,
      );
      const data = await res.json();
      const incoming: Video[] = (Array.isArray(data.results) ? data.results : []).map((video: Video) =>
        sanitizeVideo(video, playlist.channel),
      );
      setVideos((current) => {
        const seen = new Set(current.map((item) => item.id));
        const merged = [...current, ...incoming.filter((item: Video) => !seen.has(item.id))];
        rememberPlaylist(
          playlist.id,
          merged,
          data.count || PLAYLIST_COUNTS.get(playlist.id),
          data.continuation || "",
          data.duration,
        );
        return merged;
      });
      setHasMore(Boolean(data.continuation));
    } catch {
      setHasMore(false);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!lectureQuery || !hasMore || loading || loadingMore) return;
    loadMoreLectures();
  }, [lectureQuery, hasMore, loading, loadingMore, videos.length]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        overflow: "auto",
        overscrollBehavior: "contain",
        background: "var(--tf-bg)",
      }}
    >
      <header
        className="tf-sticky-header tf-header-bar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid var(--tf-line)",
          background: "rgba(12,12,14,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--tf-line)",
            color: "var(--tf-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: "3px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          <ArrowLeftIcon /> back
        </button>
        <span className="tf-crumb" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
          TECHFOCUS / PLAYLIST
        </span>
      </header>
      <main className="tf-main">
        <div className="tf-path" style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-accent)", letterSpacing: "0.1em", marginBottom: 10 }}>
            LEARNING PATH
          </div>
          <h1 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 700, color: "var(--tf-text)", marginBottom: 10 }}>
            {playlist.title}
          </h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-muted)" }}>
              {playlist.channel}
              {(formatVideoCount(playlist.count) || PLAYLIST_COUNTS.get(playlist.id))
                ? ` · ${formatVideoCount(playlist.count) || PLAYLIST_COUNTS.get(playlist.id)}`
                : ""}
              {durationLabel ? ` · ${durationLabel}` : ""}
            </div>
            <div style={{ display: "flex", border: "1px solid var(--tf-line)", borderRadius: "3px", overflow: "hidden" }}>
              {(["cards", "titles"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPlaylistView(mode)}
                  style={{
                    background: listView === mode ? "var(--tf-accent-soft)" : "none",
                    border: "none",
                    borderLeft: mode === "titles" ? "1px solid var(--tf-line)" : "none",
                    color: listView === mode ? "var(--tf-accent)" : "var(--tf-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  {mode === "cards" ? "cards" : "title stack"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>loading playlist...</div>
        ) : (
          <>
            <input
              value={playlistSearch}
              onChange={(event) => setPlaylistSearch(event.target.value)}
              placeholder="Search this playlist..."
              style={{
                width: "100%",
                maxWidth: 520,
                background: "var(--tf-panel)",
                border: "1px solid var(--tf-line)",
                borderRadius: "3px",
                padding: "10px 14px",
                color: "var(--tf-text)",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                outline: "none",
                marginBottom: 16,
              }}
            />
            {lectureQuery ? (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-dim)", marginBottom: 16 }}>
                {visibleLectures.length} match{visibleLectures.length === 1 ? "" : "es"}
                {hasMore ? " · loading the rest of the playlist…" : ` of ${videos.length}`}
              </div>
            ) : null}
            {visibleLectures.length === 0 ? (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
                {hasMore ? "searching remaining lectures..." : "no lectures match"}
              </div>
            ) : listView === "titles" ? (
              <PlaylistTitleStack
                videos={visibleLectures}
                lectureNumber={lectureNumber}
                openingId={openingId}
                hasMore={!lectureQuery && hasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMoreLectures}
                onSelect={(video) => {
                  const next = sanitizeVideo(video, playlist.channel);
                  const queue = videos.map((item) => sanitizeVideo(item, playlist.channel));
                  preloadPlayer(next.id);
                  onSelect(next, queue);
                }}
              />
            ) : (
              <VideoGrid
                videos={visibleLectures}
                openingId={openingId}
                hasMore={!lectureQuery && hasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMoreLectures}
                onSelect={(video) => {
                  const next = sanitizeVideo(video, playlist.channel);
                  const queue = videos.map((item) => sanitizeVideo(item, playlist.channel));
                  preloadPlayer(next.id);
                  onSelect(next, queue);
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function scrollRootOf(el: HTMLElement | null) {
  let node = el?.parentElement || null;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

function useLoadWhenScrolledThrough(
  sentinelRef: { current: HTMLElement | null },
  onLoadMore: (() => void) | undefined,
  hasMore: boolean,
  loadingMore: boolean,
  itemCount: number,
) {
  const loadingRef = useRef(loadingMore);
  const loadMoreRef = useRef(onLoadMore);
  loadingRef.current = loadingMore;
  loadMoreRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !loadMoreRef.current || !hasMore || loadingMore) return;
    const root = scrollRootOf(el);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current) loadMoreRef.current?.();
      },
      { root, rootMargin: "280px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, itemCount, loadingMore, sentinelRef]);
}

function VideoGrid({
  videos,
  onSelect,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  symbolic = false,
  openingId = null,
}: {
  videos: Video[];
  onSelect: (video: Video) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  symbolic?: boolean;
  openingId?: string | null;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const rejectedRef = useRef(0);
  useLoadWhenScrolledThrough(sentinelRef, onLoadMore, hasMore, loadingMore, videos.length);

  function rejectNonTech() {
    rejectedRef.current += 1;
    if (rejectedRef.current >= 2 && onLoadMore && !loadingMore) {
      rejectedRef.current = 0;
      onLoadMore();
    }
  }

  return (
    <>
      <div className="tf-grid">
        {videos.map((video) =>
          symbolic ? (
            <SymbolicCard
              key={video.id}
              video={video}
              onSelect={onSelect}
              onReject={rejectNonTech}
              loading={openingId === video.id}
            />
          ) : (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => onSelect(video)}
              loading={openingId === video.id}
            />
          ),
        )}
      </div>
      <div ref={sentinelRef} style={{ height: 48 }} />
      {loadingMore ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-dim)", textAlign: "center" }}>
          loading more...
        </div>
      ) : hasMore && onLoadMore ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 24px" }}>
          <button
            type="button"
            onClick={onLoadMore}
            style={{
              background: "transparent",
              border: "1px solid var(--tf-line)",
              color: "var(--tf-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "8px 16px",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            load more lectures
          </button>
        </div>
      ) : null}
    </>
  );
}

function PlaylistTitleStack({
  videos,
  onSelect,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  openingId = null,
  lectureNumber,
}: {
  videos: Video[];
  onSelect: (video: Video) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  openingId?: string | null;
  lectureNumber?: (id: string) => number;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useLoadWhenScrolledThrough(sentinelRef, onLoadMore, hasMore, loadingMore, videos.length);

  return (
    <>
      <div style={{ border: "1px solid var(--tf-line)", borderRadius: "4px", overflow: "hidden" }}>
        {videos.map((video, index) => {
          const active = openingId === video.id;
          return (
            <button
              key={video.id}
              onClick={() => onSelect(video)}
              className="text-left w-full"
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                width: "100%",
                padding: "14px 16px",
                background: active ? "var(--tf-accent)14" : "none",
                border: "none",
                borderTop: index === 0 ? "none" : "1px solid var(--tf-line)",
                cursor: active ? "progress" : "pointer",
                color: "var(--tf-text)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--tf-dim)",
                  width: 36,
                  flexShrink: 0,
                }}
              >
                {String(lectureNumber?.(video.id) || index + 1).padStart(2, "0")}
              </span>
              <span style={{ flex: 1, fontSize: "15px", fontWeight: 600, lineHeight: 1.45 }}>
                {video.title}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: active ? "var(--tf-accent)" : "var(--tf-muted)",
                  flexShrink: 0,
                }}
              >
                {active ? "loading" : video.duration}
              </span>
            </button>
          );
        })}
      </div>
      <div ref={sentinelRef} style={{ height: 48 }} />
      {loadingMore ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-dim)", textAlign: "center" }}>
          loading more...
        </div>
      ) : null}
    </>
  );
}

function PlaylistGrid({
  playlists,
  onSelect,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: {
  playlists: Playlist[];
  onSelect: (playlist: Playlist) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useLoadWhenScrolledThrough(sentinelRef, onLoadMore, hasMore, loadingMore, playlists.length);

  useEffect(() => {
    playlists.forEach((playlist, index) => {
      if (playlist.count || playlist.duration) {
        rememberPlaylist(playlist.id, PLAYLIST_CACHE.get(playlist.id) || [], playlist.count, undefined, playlist.duration);
      }
      enqueuePlaylistPreload(playlist.id, index < 4);
    });
  }, [playlists]);

  return (
    <>
      <div className="tf-grid">
        {playlists.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} onClick={() => onSelect(playlist)} />
        ))}
      </div>
      <div ref={sentinelRef} style={{ height: 48 }} />
      {loadingMore ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-dim)", textAlign: "center" }}>
          loading more...
        </div>
      ) : null}
    </>
  );
}

type VideoComment = { author: string; text: string; likes?: string; posted?: string; avatar?: string };
type VideoDetails = { comments: VideoComment[] };

function CommentAvatar({ comment }: { comment: VideoComment }) {
  const [failed, setFailed] = useState(false);
  const src = comment.avatar && !failed ? `/api/avatar?u=${encodeURIComponent(comment.avatar)}` : "";
  if (!src) {
    return (
      <span className="tf-watch-comments-avatar tf-watch-comments-avatar-fallback" aria-hidden>
        <ChannelIcon />
      </span>
    );
  }
  return (
    <img
      className="tf-watch-comments-avatar"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function WatchComments({ comments, ready }: { comments: VideoComment[]; ready: boolean }) {
  return (
    <section className="tf-watch-comments" aria-label="Comments">
      <div className="tf-watch-comments-head">
        comments{ready && comments.length ? ` · ${comments.length}` : ""}
      </div>
      {!ready ? (
        <div className="tf-watch-comments-empty">loading…</div>
      ) : comments.length ? (
        <ul>
          {comments.map((comment, index) => (
            <li key={`${comment.author}-${index}`}>
              <CommentAvatar comment={comment} />
              <div className="tf-watch-comments-body">
                <div className="tf-watch-comments-meta">
                  <strong>{comment.author}</strong>
                  {comment.posted ? <span>{comment.posted}</span> : null}
                  {comment.likes ? <em>{comment.likes}</em> : null}
                </div>
                <p>{comment.text}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tf-watch-comments-empty">no comments</div>
      )}
    </section>
  );
}

function HistoryPage({
  videos,
  onBack,
  onSelect,
  onClear,
  openingId = null,
}: {
  videos: Video[];
  onBack: () => void;
  onSelect: (video: Video) => void;
  onClear: () => void;
  openingId?: string | null;
}) {
  const [filter, setFilter] = useState("");
  const [details, setDetails] = useState<Record<string, VideoDetails>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const sync = () => setTick((n) => n + 1);
    window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, 4000);
    return () => {
      window.removeEventListener("focus", sync);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missing = videos.map((video) => video.id).filter((id) => !details[id]);
    if (!missing.length) return;
    (async () => {
      for (const id of missing.slice(0, 12)) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/details?id=${encodeURIComponent(id)}`);
          const data = await res.json();
          if (cancelled) return;
          setDetails((current) => ({
            ...current,
            [id]: {
              comments: Array.isArray(data.comments) ? data.comments : [],
            },
          }));
        } catch {
          if (!cancelled) setDetails((current) => ({ ...current, [id]: { comments: [] } }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videos, details]);

  const filtered = videos.filter((video) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    const extra = details[video.id];
    return (
      video.title.toLowerCase().includes(q) ||
      video.channel.toLowerCase().includes(q) ||
      (extra?.comments || []).some((item) => item.text.toLowerCase().includes(q) || item.author.toLowerCase().includes(q))
    );
  });
  void tick;

  return (
    <div className="tf-page">
      <header
        className="tf-sticky-header tf-header-bar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid var(--tf-line)",
          background: "rgba(12,12,14,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--tf-line)",
            color: "var(--tf-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: "3px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          <ArrowLeftIcon /> back
        </button>
        <span className="tf-crumb" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
          TECHFOCUS / HISTORY
        </span>
        {videos.length > 0 && (
          <button
            onClick={onClear}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "1px solid var(--tf-line)",
              color: "var(--tf-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              padding: "6px 12px",
              borderRadius: "3px",
            }}
          >
            clear<span className="tf-crumb-extra"> history</span>
          </button>
        )}
      </header>

      <main className="tf-main">
        <div style={{ maxWidth: 400, marginBottom: 28, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--tf-dim)",
              pointerEvents: "none",
            }}
          >
            <SearchIcon />
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter history..."
            style={{
              width: "100%",
              background: "var(--tf-panel)",
              border: "1px solid var(--tf-line)",
              borderRadius: "3px",
              padding: "8px 14px 8px 38px",
              color: "var(--tf-text)",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--tf-dim)" }}>
            {videos.length === 0 ? "watch something and it will show up here" : "no matches in history"}
          </div>
        ) : (
          <div className="tf-history-list">
            {filtered.map((video) => {
              const extra = details[video.id];
              const percent = watchPercent(video.id, video.duration);
              const done = percent >= 95;
              return (
                <article key={video.id} className="tf-history-item">
                  <button
                    type="button"
                    className="tf-history-open"
                    onClick={() => onSelect(video)}
                    style={{ cursor: openingId === video.id ? "progress" : "pointer" }}
                  >
                    <div className="tf-history-thumb">
                      <img src={thumb(video.id)} alt="" />
                      <span className="tf-history-time">{video.duration}</span>
                    </div>
                    <div className="tf-history-copy">
                      <div className="tf-history-title">{video.title || "Untitled lecture"}</div>
                      <div className="tf-history-meta">
                        <VideoMetaLine video={video} />
                      </div>
                      <div className="tf-history-progress">
                        <div className="tf-history-bar">
                          <i style={{ width: `${percent}%` }} />
                        </div>
                        <span>{done ? "completed" : percent > 0 ? `${percent}% watched` : "opened"}</span>
                      </div>
                    </div>
                  </button>
                  {extra?.comments?.length ? (
                    <ul className="tf-history-comments">
                      {extra.comments.slice(0, 3).map((comment, index) => (
                        <li key={`${video.id}-${index}`}>
                          <strong>{comment.author}</strong>
                          {comment.likes ? <em>{comment.likes}</em> : null}
                          <span>{comment.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function SettingsPage({
  audioOnly,
  onAudioOnly,
  includeShorts,
  onIncludeShorts,
  onBack,
}: {
  audioOnly: boolean;
  onAudioOnly: (next: boolean) => void;
  includeShorts: boolean;
  onIncludeShorts: (next: boolean) => void;
  onBack: () => void;
}) {
  return (
    <div className="tf-page">
      <header
        className="tf-sticky-header tf-header-bar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid var(--tf-line)",
          background: "rgba(12,12,14,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--tf-line)",
            color: "var(--tf-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: "3px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          <ArrowLeftIcon /> back
        </button>
        <span className="tf-crumb" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
          TECHFOCUS / SETTINGS
        </span>
      </header>
      <main className="tf-main" style={{ maxWidth: 560 }}>
        <div
          style={{
            background: "var(--tf-panel)",
            border: "1px solid var(--tf-line)",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tf-text)", marginBottom: 8 }}>
                Audio only
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--tf-muted)" }}>
                Off by default — lectures open as video. Turn this on to start with a still thumbnail and sound, so the moving picture doesn’t pull you off your work.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={audioOnly}
              aria-label="Audio only mode"
              onClick={() => onAudioOnly(!audioOnly)}
              style={{
                width: 52,
                height: 30,
                flexShrink: 0,
                border: "none",
                borderRadius: 999,
                background: audioOnly ? "var(--tf-accent)" : "var(--tf-line)",
                position: "relative",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: audioOnly ? 25 : 3,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: audioOnly ? "#111827" : "var(--tf-text)",
                  transition: "left 0.15s ease",
                }}
              />
            </button>
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: audioOnly ? "var(--tf-accent)" : "var(--tf-dim)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {audioOnly ? "new lectures start as audio" : "new lectures start as video"}
          </div>
        </div>
        <div
          style={{
            background: "var(--tf-panel)",
            border: "1px solid var(--tf-line)",
            borderRadius: 16,
            padding: 18,
            marginTop: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tf-text)", marginBottom: 8 }}>
                Shorts
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--tf-muted)" }}>
                Off by default. Turn this on to include YouTube Shorts in the home feed and search.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeShorts}
              aria-label="Include shorts"
              onClick={() => onIncludeShorts(!includeShorts)}
              style={{
                width: 52,
                height: 30,
                flexShrink: 0,
                border: "none",
                borderRadius: 999,
                background: includeShorts ? "var(--tf-accent)" : "var(--tf-line)",
                position: "relative",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: includeShorts ? 25 : 3,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: includeShorts ? "#111827" : "var(--tf-text)",
                  transition: "left 0.15s ease",
                }}
              />
            </button>
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: includeShorts ? "var(--tf-accent)" : "var(--tf-dim)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {includeShorts ? "shorts on" : "shorts off"}
          </div>
        </div>
      </main>
    </div>
  );
}

function isCoursePlaylistId(id?: string) {
  return Boolean(id && /^(PL|OLAK5uy_)[\w-]+$/.test(id));
}

function CoursePanel({
  video,
  known,
  queue = [],
  onOpen,
}: {
  video: Video;
  known?: Playlist | null;
  queue?: Video[];
  onOpen: (playlist: Playlist) => void;
}) {
  const inKnown =
    Boolean(known) &&
    isCoursePlaylistId(known?.id) &&
    (PLAYLIST_CACHE.get(known?.id || "")?.some((item) => item.id === video.id) ||
      queue.some((item) => item.id === video.id));
  const [courses, setCourses] = useState<Playlist[]>(() => (inKnown && known ? [known] : []));

  useEffect(() => {
    const controller = new AbortController();
    setCourses(inKnown && known ? [known] : []);
    if (inKnown) return () => controller.abort();
    fetch(`/api/courses?id=${encodeURIComponent(video.id)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const incoming = (Array.isArray(data.courses) ? data.courses : []) as Playlist[];
        setCourses(incoming.filter((item) => isCoursePlaylistId(item.id)).slice(0, 2));
      })
      .catch(() => setCourses([]));
    return () => controller.abort();
  }, [video.id, known?.id, inKnown]);

  const lectureAt = queue.findIndex((item) => item.id === video.id);
  const primary = courses[0] || (inKnown ? known : null) || null;

  if (!primary) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--tf-accent)",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        COURSE
      </div>
      {primary ? (
        <button
          onClick={() => onOpen(primary)}
          className="text-left"
          style={{
            width: "100%",
            background: "var(--tf-panel)",
            border: "1px solid var(--tf-line)",
            borderRadius: "3px",
            padding: "12px 14px",
            cursor: "pointer",
            color: "var(--tf-text)",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>
            {primary.title}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-muted)" }}>
            {[
              primary.channel,
              lectureAt >= 0 && queue.length > 1 ? `lecture ${lectureAt + 1} of ${queue.length}` : "",
              formatVideoCount(primary.count) || "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </button>
      ) : null}
      {courses.length > 1 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {courses.slice(1).map((course) => (
            <button
              key={course.id}
              onClick={() => onOpen(course)}
              style={{
                background: "none",
                border: "1px solid var(--tf-line)",
                color: "var(--tf-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                padding: "5px 10px",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              {course.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TalkToAi({ video }: { video: Video }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "limited">("idle");
  const [source, setSource] = useState<"transcript" | "description" | "title" | "">("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setStatus("idle");
    setSource("");
    setInput("");
    setBusy(false);
    setMessages([]);
  }, [video.id]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setStatus("checking");
    fetch(`/api/transcript?id=${encodeURIComponent(video.id)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setSource(data.source === "description" ? "description" : data.available ? "transcript" : "title");
          setStatus(data.available ? "ready" : "limited");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSource("title");
          setStatus("limited");
        }
      });
    return () => controller.abort();
  }, [open, video.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy || status === "checking" || status === "idle") return;
    setInput("");
    setBusy(true);
    const history = [...messages, { role: "user" as const, text }];
    setMessages(history);
    try {
      const res = await fetch("/api/talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: video.id, title: video.title, question: text, history: messages }),
      });
      const data = await res.json();
      setMessages([
        ...history,
        { role: "assistant", text: data.answer || data.error || "I could not answer that from the transcript." },
      ]);
    } catch {
      setMessages([...history, { role: "assistant", text: "Talk to AI could not reach the server." }]);
    } finally {
      setBusy(false);
    }
  }

  const prompts = ["summarize this lecture", "what are the key points?", "explain the hard parts simply"];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sourceLabel =
    status === "limited"
      ? "no captions · answering from the title"
      : source === "description"
        ? "uses the video description"
        : "uses this video transcript";

  return (
    <div>
      <button
        onClick={() => setOpen((current) => !current)}
        style={{
          background: open ? "var(--tf-accent-soft)" : "none",
          border: `1px solid ${open ? "var(--tf-accent-line)" : "var(--tf-line)"}`,
          color: open ? "var(--tf-accent)" : "var(--tf-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "6px 12px",
          borderRadius: "3px",
          cursor: "pointer",
        }}
      >
        ai
      </button>
      {open ? (
        <>
          <button
            aria-label="Close AI"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
              background: "rgba(12,12,14,0.45)",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          />
          <aside
            className="tf-ai-panel"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100%)",
              zIndex: 91,
              background: "var(--tf-panel)",
              borderLeft: "1px solid var(--tf-line)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-16px 0 40px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                padding: "16px 16px 14px",
                borderBottom: "1px solid var(--tf-line)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-accent)", letterSpacing: "0.08em" }}>
                  AI
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-muted)", marginTop: 6, lineHeight: 1.45 }}>
                  {sourceLabel}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "1px solid var(--tf-line)",
                  color: "var(--tf-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                close
              </button>
            </div>
            <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: 16 }}>
              {status === "checking" ? (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>loading transcript...</div>
              ) : messages.length === 0 ? (
                <div>
                  <div style={{ fontSize: "13px", color: "var(--tf-muted)", marginBottom: 12, lineHeight: 1.55 }}>
                    {status === "limited"
                      ? "captions are blocked, so answers use the title and topic — not the spoken lecture"
                      : "ask about what was said in this lecture"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {prompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => ask(prompt)}
                        style={{
                          background: "none",
                          border: "1px solid var(--tf-line)",
                          color: "var(--tf-text)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          padding: "6px 10px",
                          borderRadius: "3px",
                          cursor: "pointer",
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={{
                        fontSize: "13px",
                        lineHeight: 1.55,
                        color: message.role === "user" ? "var(--tf-accent)" : "var(--tf-text)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--tf-dim)", letterSpacing: "0.08em" }}>
                        {message.role === "user" ? "YOU" : "AI"}
                      </span>
                      <div style={{ marginTop: 4 }}>{message.text}</div>
                    </div>
                  ))}
                  {busy ? (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-dim)" }}>reading transcript...</div>
                  ) : null}
                </div>
              )}
            </div>
            {status === "ready" || status === "limited" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(input);
                }}
                style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--tf-line)" }}
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="ask from the transcript..."
                  disabled={busy}
                  style={{
                    flex: 1,
                    background: "var(--tf-bg)",
                    border: "1px solid var(--tf-line)",
                    color: "var(--tf-text)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    padding: "8px 10px",
                    borderRadius: "3px",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  style={{
                    background: "var(--tf-accent)",
                    border: "none",
                    color: "#111827",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "8px 12px",
                    borderRadius: "3px",
                    cursor: busy || !input.trim() ? "default" : "pointer",
                    opacity: busy || !input.trim() ? 0.5 : 1,
                  }}
                >
                  ask
                </button>
              </form>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}

type YtHandle = {
  destroy: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getPlayerState?: () => number;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  mute?: () => void;
  unMute?: () => void;
  loadVideoById?: (opts: { videoId: string; startSeconds?: number }) => void;
  setSize?: (width: number, height: number) => void;
  setPlaybackRate?: (rate: number) => void;
  getVideoData?: () => { video_id?: string };
};

function readAudioRates() {
  try {
    const raw = JSON.parse(localStorage.getItem(AUDIO_RATE_KEY) || "{}");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, number>;
  } catch {
    // ignore leftover global "1.5" values
  }
  return {};
}

function readAudioRate(id: string) {
  const value = Number(readAudioRates()[id]);
  return AUDIO_RATES.includes(value) ? value : 1;
}

function writeAudioRate(id: string, rate: number) {
  try {
    const map = readAudioRates();
    if (rate === 1) delete map[id];
    else map[id] = rate;
    localStorage.setItem(AUDIO_RATE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function formatAudioRate(rate: number) {
  return `${Number.isInteger(rate) ? rate : rate}×`;
}

function applyPlaybackRate(player?: { setPlaybackRate?: (rate: number) => void } | null, rate = 1) {
  try {
    player?.setPlaybackRate?.(rate);
  } catch {
    // ignore
  }
}

function readWatchModes() {
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_MODE_KEY) || "{}");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function readWatchMode(id: string): "listen" | "video" | null {
  const value = readWatchModes()[id];
  return value === "listen" || value === "video" ? value : null;
}

function writeWatchMode(id: string, mode: "listen" | "video") {
  try {
    const map = readWatchModes();
    map[id] = mode;
    const ids = Object.keys(map);
    if (ids.length > 80) ids.slice(0, ids.length - 80).forEach((key) => delete map[key]);
    localStorage.setItem(WATCH_MODE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function initialAudioMode(id: string, preferAudio: boolean) {
  const stored = readWatchMode(id);
  if (stored === "listen") return true;
  if (stored === "video") return false;
  return preferAudio;
}

function nextAudioRate(rate: number) {
  const index = AUDIO_RATES.indexOf(rate);
  return AUDIO_RATES[(index + 1) % AUDIO_RATES.length] ?? 1;
}

function AudioRateButton({
  rate,
  onChange,
  disabled = false,
}: {
  rate: number;
  onChange: (rate: number) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`Playback speed ${formatAudioRate(rate)}. Change speed`}
      disabled={disabled}
      onClick={() => onChange(nextAudioRate(rate))}
      style={{
        background: rate === 1 ? "none" : "var(--tf-accent-soft)",
        border: `1px solid ${rate === 1 ? "var(--tf-line)" : "var(--tf-accent-line)"}`,
        color: rate === 1 ? "var(--tf-muted)" : "var(--tf-accent)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        letterSpacing: "0.04em",
        padding: "6px 10px",
        borderRadius: "3px",
        cursor: disabled ? "default" : "pointer",
        minWidth: 46,
      }}
    >
      {formatAudioRate(rate)}
    </button>
  );
}

function playingIdOf(player: { getVideoData?: () => { video_id?: string } } | null) {
  try {
    return player?.getVideoData?.()?.video_id || "";
  } catch {
    return "";
  }
}

type ListenClock = { current: number; duration: number; paused: boolean };

type ListenApi = {
  video: Video;
  clock: ListenClock;
  status: "starting" | "playing" | "buffering" | "blocked";
  rate: number;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
};

const ListenContext = createContext<ListenApi | null>(null);

function restoreSound(
  player?: { unMute?: () => void; playVideo?: () => void } | null,
  play = false,
) {
  try {
    player?.unMute?.();
  } catch {
    // ignore
  }
  if (play) player?.playVideo?.();
}

function PersistentAudio({
  video,
  queue,
  docked,
  stage,
  autoNext = true,
  onAdvance,
  onPlaying,
  onClose,
  onOpen,
  children,
}: {
  video: Video;
  queue: Video[];
  docked: boolean;
  stage: HTMLElement | null;
  autoNext?: boolean;
  onAdvance: (video: Video) => void;
  onPlaying?: () => void;
  onClose: () => void;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const dockSlotRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtHandle | null>(null);
  const sampleRef = useRef({ t: 0, at: 0, duration: 0, playing: false, id: "", rate: 1 });
  const [rate, setRate] = useState(() => readAudioRate(video.id));
  const videoRef = useRef(video);
  const queueRef = useRef(queue);
  const autoNextRef = useRef(autoNext);
  const onAdvanceRef = useRef(onAdvance);
  const onPlayingRef = useRef(onPlaying);
  const [clock, setClock] = useState<ListenClock>({
    current: readProgress(video.id),
    duration: durationSeconds(video.duration),
    paused: true,
  });
  const [status, setStatus] = useState<ListenApi["status"]>("starting");
  videoRef.current = video;
  queueRef.current = queue;
  autoNextRef.current = autoNext;
  onAdvanceRef.current = onAdvance;
  onPlayingRef.current = onPlaying;

  function elapsedNow(sample = sampleRef.current) {
    if (!sample.playing) return sample.t;
    return sample.t + ((performance.now() - sample.at) / 1000) * (sample.rate || 1);
  }

  function applySample(current: number, duration: number, playing: boolean) {
    const nextDuration = duration || sampleRef.current.duration || durationSeconds(videoRef.current.duration);
    sampleRef.current = {
      t: current,
      at: performance.now(),
      duration: nextDuration,
      playing,
      id: videoRef.current.id,
      rate: sampleRef.current.rate || 1,
    };
    setClock({ current, duration: nextDuration, paused: !playing });
  }

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let ticking = false;
    const place = () => {
      ticking = false;
      const hideVideo = docked || document.body.dataset.listenAudio === "1";
      if (hideVideo) {
        host.style.top = "-220px";
        host.style.left = "0px";
        host.style.width = "320px";
        host.style.height = "180px";
        host.style.zIndex = "0";
        host.style.pointerEvents = "none";
        host.style.opacity = "0.01";
        host.style.clipPath = "none";
        try {
          playerRef.current?.setSize?.(320, 180);
        } catch {
          // ignore
        }
        return;
      }
      const target = stage || dockSlotRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const header = document.querySelector(".tf-watch-header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const visibleTop = Math.max(rect.top, headerBottom, 0);
      const visibleBottom = Math.min(rect.bottom, window.innerHeight);
      const onScreen = visibleBottom - visibleTop > 12 && rect.width > 1;
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      host.style.top = `${Math.round(rect.top)}px`;
      host.style.left = `${Math.round(rect.left)}px`;
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      host.style.zIndex = "81";
      host.style.pointerEvents = onScreen ? "auto" : "none";
      host.style.opacity = onScreen ? "1" : "0";
      host.style.clipPath = onScreen
        ? `inset(${Math.max(0, Math.round(visibleTop - rect.top))}px 0 ${Math.max(0, Math.round(rect.bottom - visibleBottom))}px 0)`
        : "inset(100%)";
      try {
        playerRef.current?.setSize?.(width, height);
      } catch {
        // ignore
      }
      if (onScreen) restoreSound(playerRef.current);
    };
    const requestPlace = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(place);
    };
    place();
    const frame = window.setInterval(place, 400);
    window.addEventListener("resize", requestPlace);
    window.addEventListener("scroll", requestPlace, true);
    window.visualViewport?.addEventListener("resize", requestPlace);
    window.visualViewport?.addEventListener("scroll", requestPlace);
    const observer = typeof ResizeObserver !== "undefined" && stage ? new ResizeObserver(place) : null;
    if (stage && observer) observer.observe(stage);
    return () => {
      window.clearInterval(frame);
      window.removeEventListener("resize", requestPlace);
      window.removeEventListener("scroll", requestPlace, true);
      window.visualViewport?.removeEventListener("resize", requestPlace);
      window.visualViewport?.removeEventListener("scroll", requestPlace);
      observer?.disconnect();
    };
  }, [docked, stage]);

  useEffect(() => {
    let player: YtHandle | null = null;
    let cancelled = false;
    let timer = 0;
    let advanced = false;
    let hasPlayed = false;
    const startId = video.id;
    const resumeAt = readProgress(video.id);
    setStatus("starting");
    applySample(resumeAt, durationSeconds(video.duration), false);

    function snapshot() {
      try {
        if (!hasPlayed || !player?.getCurrentTime) return;
        const liveId = playingIdOf(player);
        if (liveId && liveId !== startId) return;
        writeProgress(startId, player.getCurrentTime(), player.getDuration?.() || 0);
      } catch {
        // player already gone
      }
    }

    function nextInQueue() {
      const list = queueRef.current;
      const index = list.findIndex((item) => item.id === videoRef.current.id);
      if (index < 0 || index >= list.length - 1) return null;
      return list[index + 1];
    }

    function handleEnded() {
      if (cancelled || advanced || !hasPlayed) return;
      advanced = true;
      writeProgress(startId, 0);
      const next = nextInQueue();
      if (autoNextRef.current && next) onAdvanceRef.current(next);
    }

    loadYoutubeApi().then(() => {
      const host = hostRef.current;
      if (cancelled || !host) return;
      host.innerHTML = "";
      const target = document.createElement("div");
      target.style.width = "100%";
      target.style.height = "100%";
      host.appendChild(target);
      const YT = (window as unknown as { YT: { Player: new (el: HTMLElement, opts: object) => YtHandle } }).YT;
      player = new YT.Player(target, {
        videoId: startId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          start: resumeAt,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player;
            if (resumeAt > 5) player?.seekTo?.(resumeAt, true);
            restoreSound(player);
            applyPlaybackRate(player, readAudioRate(videoRef.current.id));
            try {
              const box = host.getBoundingClientRect();
              player?.setSize?.(Math.max(1, Math.round(box.width)), Math.max(1, Math.round(box.height)));
              const iframe = (player as YtHandle & { getIframe?: () => HTMLIFrameElement }).getIframe?.();
              iframe?.setAttribute("tabindex", "-1");
            } catch {
              // ignore
            }
            timer = window.setInterval(() => {
              snapshot();
              try {
                const current = player?.getCurrentTime?.() || 0;
                const duration = player?.getDuration?.() || 0;
                const state = player?.getPlayerState?.() ?? -1;
                applySample(current, duration, state === 1);
              } catch {
                // player already gone
              }
              const liveId = playingIdOf(player);
              if (hasPlayed && liveId && liveId !== videoRef.current.id) {
                player?.loadVideoById?.({
                  videoId: videoRef.current.id,
                  startSeconds: readProgress(videoRef.current.id),
                });
              }
              if (hasPlayed && player?.getPlayerState?.() === 0) handleEnded();
            }, 400);
          },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            if (event.data === 3) setStatus(hasPlayed ? "buffering" : "starting");
            if (event.data === 1) {
              hasPlayed = true;
              restoreSound(player);
              setStatus("playing");
              try {
                applySample(player?.getCurrentTime?.() || sampleRef.current.t, player?.getDuration?.() || 0, true);
              } catch {
                applySample(sampleRef.current.t, sampleRef.current.duration, true);
              }
              onPlayingRef.current?.();
              const upcoming = nextInQueue();
              if (upcoming) preloadPlayer(upcoming.id);
            }
            if (event.data === 2) {
              setStatus("playing");
              snapshot();
              try {
                applySample(player?.getCurrentTime?.() || sampleRef.current.t, player?.getDuration?.() || 0, false);
              } catch {
                applySample(sampleRef.current.t, sampleRef.current.duration, false);
              }
            }
            if (event.data === 0) handleEnded();
          },
          onError: (event: { data: number }) => {
            if (!cancelled && [100, 101, 150].includes(event.data)) {
              snapshot();
              setStatus("blocked");
              onPlayingRef.current?.();
            }
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try {
        snapshot();
        player?.destroy();
      } catch {
        // YouTube may have already removed the node
      }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [video.id]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const sample = sampleRef.current;
      if (sample.id === video.id && sample.playing) {
        const current = elapsedNow(sample);
        setClock({
          current: sample.duration ? Math.min(current, sample.duration) : current,
          duration: sample.duration || durationSeconds(video.duration),
          paused: false,
        });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [video.id, video.duration]);

  useEffect(() => {
    const next = readAudioRate(video.id);
    sampleRef.current.rate = next;
    setRate(next);
    applyPlaybackRate(playerRef.current, next);
  }, [video.id]);

  useEffect(() => {
    sampleRef.current.rate = rate;
    applyPlaybackRate(playerRef.current, rate);
  }, [rate]);

  const api: ListenApi = {
    video,
    clock,
    status,
    rate,
    play: () => {
      applySample(elapsedNow(), sampleRef.current.duration, true);
      restoreSound(playerRef.current, true);
    },
    pause: () => {
      applySample(elapsedNow(), sampleRef.current.duration, false);
      playerRef.current?.pauseVideo?.();
    },
    seek: (seconds: number) => {
      const next = Math.max(0, seconds);
      applySample(next, sampleRef.current.duration || durationSeconds(video.duration), true);
      playerRef.current?.seekTo?.(next, true);
      restoreSound(playerRef.current, true);
    },
    setRate: (next) => {
      const current = elapsedNow();
      writeAudioRate(videoRef.current.id, next);
      sampleRef.current.rate = next;
      applySample(current, sampleRef.current.duration, sampleRef.current.playing);
      applyPlaybackRate(playerRef.current, next);
      setRate(next);
    },
  };

  return (
    <ListenContext.Provider value={api}>
      {children}
      <div
        ref={hostRef}
        className="tf-yt-host"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          overflow: "hidden",
          background: "#000",
          zIndex: 81,
        }}
      />
      <div
        className="tf-dock"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 90,
          transform: docked ? "none" : "translateY(110%)",
          pointerEvents: docked ? "auto" : "none",
          visibility: docked ? "visible" : "hidden",
        }}
      >
        <div ref={dockSlotRef} className="tf-dock-thumb">
          <img src={thumb(video.id)} alt="" />
        </div>
        <button type="button" onClick={onOpen} className="tf-dock-meta">
          <span className="tf-dock-label">{status === "blocked" ? "OPEN ON YOUTUBE" : "LISTENING"}</span>
          <span className="tf-dock-title">{video.title}</span>
        </button>
        {status === "blocked" ? (
          <a
            className="tf-dock-stop"
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
          >
            youtube
          </a>
        ) : (
          <>
            <button
              type="button"
              className="tf-dock-play"
              aria-label={clock.paused ? "Play audio" : "Pause audio"}
              onClick={() => (clock.paused ? api.play() : api.pause())}
            >
              {clock.paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <div className="tf-dock-scrub">
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(clock.duration))}
                value={Math.min(Math.floor(clock.current), Math.max(1, Math.floor(clock.duration)))}
                onChange={(event) => api.seek(Number(event.target.value))}
              />
              <div className="tf-dock-times">
                <span>{formatClock(clock.current)}</span>
                <span>{formatClock(clock.duration || durationSeconds(video.duration))}</span>
              </div>
            </div>
          </>
        )}
        <button type="button" className="tf-dock-stop" aria-label="Stop audio" onClick={onClose}>
          Stop
        </button>
      </div>
    </ListenContext.Provider>
  );
}

function PlayerView({
  video,
  onBack,
  onSelect,
  onPlaying,
  queue = [],
  openingId = null,
  onStage,
  startPaused = false,
  course = null,
  onOpenCourse,
  preferAudio = false,
}: {
  video: Video;
  onBack: () => void;
  onSelect: (video: Video, queue?: Video[], opts?: { takeover?: boolean }) => void;
  onPlaying?: () => void;
  queue?: Video[];
  openingId?: string | null;
  onStage?: (el: HTMLElement | null) => void;
  startPaused?: boolean;
  course?: Playlist | null;
  onOpenCourse?: (playlist: Playlist) => void;
  preferAudio?: boolean;
}) {
  const listen = useContext(ListenContext);
  const shared = listen?.video.id === video.id;
  const silent = Boolean(listen && listen.video.id !== video.id);
  const silentPlayRef = useRef(false);
  const [recommended, setRecommended] = useState<Video[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [streamStatus, setStreamStatus] = useState<"starting" | "playing" | "buffering">("starting");
  const [watchOnYoutube, setWatchOnYoutube] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [audioMode, setAudioMode] = useState(() => initialAudioMode(video.id, preferAudio));
  const [audioRate, setAudioRate] = useState(() => readAudioRate(video.id));
  const [description, setDescription] = useState("");
  const [descOpen, setDescOpen] = useState(false);
  const [descReady, setDescReady] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likes, setLikes] = useState("");
  const [clock, setClock] = useState({ current: 0, duration: 0, paused: true });
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<{
    destroy: () => void;
    getCurrentTime?: () => number;
    getDuration?: () => number;
    getPlayerState?: () => number;
    seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
    playVideo?: () => void;
    pauseVideo?: () => void;
    mute?: () => void;
    unMute?: () => void;
  } | null>(null);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const autoNextRef = useRef(true);
  const queueRef = useRef(queue);
  const videoRef = useRef(video);
  const onSelectRef = useRef(onSelect);
  const onPlayingRef = useRef(onPlaying);
  autoNextRef.current = autoNext;
  queueRef.current = queue;
  videoRef.current = video;
  onSelectRef.current = onSelect;
  onPlayingRef.current = onPlaying;

  function nextInQueue() {
    const list = queueRef.current;
    const index = list.findIndex((item) => item.id === videoRef.current.id);
    if (index < 0 || index >= list.length - 1) return null;
    return list[index + 1];
  }

  function playNext() {
    const next = nextInQueue();
    if (!next) return;
    window.setTimeout(() => onSelectRef.current(next, undefined, { takeover: true }), 0);
  }

  useEffect(() => {
    return () => onStage?.(null);
  }, [onStage]);

  useEffect(() => {
    setAudioMode(initialAudioMode(video.id, preferAudio));
    setAudioRate(readAudioRate(video.id));
  }, [video.id, preferAudio]);

  function chooseWatchMode(listen: boolean) {
    setAudioMode(listen);
    writeWatchMode(video.id, listen ? "listen" : "video");
  }

  useEffect(() => {
    document.body.dataset.listenAudio = audioMode && shared ? "1" : "0";
    return () => {
      document.body.dataset.listenAudio = "0";
    };
  }, [audioMode, shared]);

  useEffect(() => {
    const controller = new AbortController();
    setRecommended([]);
    setRelatedLoading(true);
    setStreamStatus("starting");
    setWatchOnYoutube(false);
    setHasMore(true);
    pageRef.current = 1;
    loadingRef.current = false;

    const skip = new Set(watchedIdList([video.id]));
    const relatedQs = new URLSearchParams({
      id: video.id,
      title: video.title || "",
      channel: video.channel || "",
      exclude: [...skip].join(","),
      page: "1",
    });
    fetch(`/api/related?${relatedQs}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const results = (Array.isArray(data.results) ? data.results : []).filter((item: Video) => !skip.has(item.id));
        setRecommended(results);
        setHasMore(Boolean(data.hasMore && results.length));
      })
      .catch(() => {
        if (!controller.signal.aborted) setRecommended([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRelatedLoading(false);
      });

    return () => controller.abort();
  }, [video.id]);

  useEffect(() => {
    const controller = new AbortController();
    setDescription("");
    setDescOpen(false);
    setDescReady(false);
    setComments([]);
    setCommentsOpen(false);
    setLikes("");
    fetch(`/api/details?id=${encodeURIComponent(video.id)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.description === "string") setDescription(formatDescription(data.description));
        if (typeof data.likes === "string") setLikes(data.likes.trim());
        if (Array.isArray(data.comments)) {
          setComments(
            data.comments
              .filter((item: VideoComment) => item && typeof item.text === "string" && item.text.trim())
              .map((item: VideoComment) => ({
                author: String(item.author || "YouTube"),
                text: String(item.text).trim(),
                likes: item.likes ? String(item.likes) : "",
                posted: item.posted ? String(item.posted) : "",
                avatar: item.avatar ? String(item.avatar) : "",
              })),
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDescription("");
          setComments([]);
          setLikes("");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDescReady(true);
      });
    return () => controller.abort();
  }, [video.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (shared) {
      playerRef.current = null;
      setStreamStatus(listen?.status === "blocked" ? "playing" : listen?.status || "starting");
      setWatchOnYoutube(listen?.status === "blocked");
      if (listen) setClock(listen.clock);
      return;
    }
    type YtPlayer = {
      destroy: () => void;
      getCurrentTime?: () => number;
      getDuration?: () => number;
      getPlayerState?: () => number;
      seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
      playVideo?: () => void;
      pauseVideo?: () => void;
      mute?: () => void;
      unMute?: () => void;
      setPlaybackRate?: (rate: number) => void;
    };
    let player: YtPlayer | null = null;
    playerRef.current = null;
    let cancelled = false;
    let timer = 0;
    let advanced = false;
    let hasPlayed = false;
    const startId = video.id;
    const resumeAt = readProgress(startId);
    silentPlayRef.current = false;
    setStreamStatus("starting");
    setWatchOnYoutube(false);
    setClock({ current: resumeAt, duration: durationSeconds(video.duration), paused: true });

    function snapshot() {
      try {
        if (!hasPlayed || !player?.getCurrentTime) return;
        const liveId = playingIdOf(player as { getVideoData?: () => { video_id?: string } } | null);
        if (liveId && liveId !== startId) return;
        writeProgress(startId, player.getCurrentTime(), player.getDuration?.() || 0);
      } catch {
        // player already gone
      }
    }

    function handleEnded() {
      if (cancelled || advanced || !hasPlayed) return;
      advanced = true;
      writeProgress(startId, 0);
      if (autoNextRef.current) playNext();
    }

    loadYoutubeApi().then(() => {
      const shell = shellRef.current;
      if (cancelled || !shell) return;
      shell.innerHTML = "";
      const target = document.createElement("div");
      target.style.width = "100%";
      target.style.height = "100%";
      shell.appendChild(target);
      const YT = (window as unknown as { YT: { Player: new (el: HTMLElement, opts: object) => YtPlayer } }).YT;
      player = new YT.Player(target, {
        videoId: video.id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          start: resumeAt,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          mute: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player;
            restoreSound(player, true);
            applyPlaybackRate(player, readAudioRate(video.id));
            if (resumeAt > 5) player?.seekTo?.(resumeAt, true);
            try {
              const iframe = (player as YtPlayer & { getIframe?: () => HTMLIFrameElement }).getIframe?.();
              iframe?.setAttribute("tabindex", "-1");
            } catch {
              // ignore
            }
            timer = window.setInterval(() => {
              snapshot();
              try {
                const current = player?.getCurrentTime?.() || 0;
                const duration = player?.getDuration?.() || 0;
                const state = player?.getPlayerState?.();
                setClock({ current, duration, paused: state !== 1 && state !== 3 });
                const liveId = playingIdOf(player as { getVideoData?: () => { video_id?: string } } | null);
                if (hasPlayed && liveId && liveId !== video.id) {
                  (player as YtPlayer & { loadVideoById?: (opts: { videoId: string; startSeconds?: number }) => void }).loadVideoById?.({
                    videoId: video.id,
                    startSeconds: readProgress(video.id),
                  });
                }
              } catch {
                // player already gone
              }
              if (hasPlayed && player?.getPlayerState?.() === 0) handleEnded();
            }, 500);
          },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            if (event.data === 3) {
              setStreamStatus(hasPlayed ? "buffering" : "starting");
            }
            if (event.data === 1) {
              restoreSound(player);
              hasPlayed = true;
              setStreamStatus("playing");
              onPlayingRef.current?.();
              const upcoming = nextInQueue();
              if (upcoming) preloadPlayer(upcoming.id);
            }
            if (event.data === 2) {
              setStreamStatus("playing");
              snapshot();
            }
            if (event.data === 0) handleEnded();
          },
          onError: (event: { data: number }) => {
            if (!cancelled && [100, 101, 150].includes(event.data)) {
              snapshot();
              setWatchOnYoutube(true);
              setStreamStatus("playing");
              onPlayingRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try {
        snapshot();
        player?.destroy();
      } catch {
        // YouTube may have already removed the node
      }
      playerRef.current = null;
      if (shellRef.current) shellRef.current.innerHTML = "";
    };
  }, [video.id, shared, silent]);

  async function loadMoreRecommended() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const skip = watchedIdSet([video.id, ...recommended.map((item) => item.id)]);
      const relatedQs = new URLSearchParams({
        id: video.id,
        title: video.title || "",
        channel: video.channel || "",
        exclude: [...skip].join(","),
        page: String(nextPage),
      });
      const res = await fetch(`/api/related?${relatedQs}`);
      const data = await res.json();
      const incoming = Array.isArray(data.results) ? data.results : [];
      pageRef.current = nextPage;
      setRecommended((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...incoming.filter((item: Video) => !seen.has(item.id) && !skip.has(item.id))];
      });
      setHasMore(Boolean(data.hasMore && incoming.length));
    } catch {
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <div
      className={`tf-watch${audioMode ? " tf-watch-audio" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        overscrollBehavior: "contain",
        background: "var(--tf-bg)",
      }}
    >
      <header
        className="tf-sticky-header tf-header-bar tf-watch-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 82,
          borderBottom: "1px solid var(--tf-line)",
          background: "rgba(12,12,14,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--tf-line)",
            color: "var(--tf-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: "3px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--tf-text)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--tf-dim)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--tf-muted)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--tf-line)";
          }}
        >
          <ArrowLeftIcon /> back
        </button>
        <span className="tf-crumb" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
          TECHFOCUS
          {displayCategory(video.category) ? (
            <span className="tf-crumb-extra">{` / ${displayCategory(video.category).toUpperCase()}`}</span>
          ) : null}
        </span>
      </header>

      <div className="tf-player-bleed">
        <div
          className="tf-player-stage"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            background: "#000",
          }}
        >
          <div
            ref={(el) => {
              shellRef.current = el;
              onStage?.(shared ? el : null);
            }}
            style={{
              width: "100%",
              height: "100%",
              display: watchOnYoutube ? "none" : "block",
              pointerEvents: shared || audioMode ? "none" : "auto",
            }}
          />
          {audioMode && !watchOnYoutube && !silent ? (
            <div
              className="tf-listen-pad"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: 24,
                background: "var(--tf-bg)",
                pointerEvents: "auto",
              }}
            >
              <img
                src={thumb(video.id)}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.28 }}
              />
              <div
                style={{
                  position: "relative",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--tf-accent)",
                  letterSpacing: "0.1em",
                  marginBottom: 12,
                }}
              >
                {(shared && listen ? listen.status : streamStatus) === "buffering"
                  ? "LOADING AUDIO"
                  : (shared && listen ? listen.status : streamStatus) === "starting"
                    ? "STARTING AUDIO"
                    : "LISTENING"}
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  aria-label={(shared && listen ? listen.clock : clock).paused ? "Play audio" : "Pause audio"}
                  onClick={() => {
                    const paused = (shared && listen ? listen.clock : clock).paused;
                    if (shared && listen) {
                      if (paused) listen.play();
                      else listen.pause();
                      return;
                    }
                    if (paused) restoreSound(playerRef.current, true);
                    else playerRef.current?.pauseVideo?.();
                  }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: "none",
                    background: "var(--tf-accent)",
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {(shared && listen ? listen.clock : clock).paused ? <PlayIcon /> : <PauseIcon />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor((shared && listen ? listen.clock : clock).duration))}
                    value={Math.min(
                      Math.floor((shared && listen ? listen.clock : clock).current),
                      Math.max(1, Math.floor((shared && listen ? listen.clock : clock).duration)),
                    )}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (shared && listen) {
                        listen.seek(next);
                        return;
                      }
                      playerRef.current?.seekTo?.(next, true);
                      setClock((current) => ({ ...current, current: next, paused: false }));
                      restoreSound(playerRef.current, true);
                    }}
                    style={{ width: "100%", accentColor: "var(--tf-accent)" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "var(--tf-muted)",
                      marginTop: 6,
                      gap: 12,
                    }}
                  >
                    <span>{formatClock((shared && listen ? listen.clock : clock).current)}</span>
                    <AudioRateButton
                      rate={shared && listen ? listen.rate : audioRate}
                      onChange={(next) => {
                        writeAudioRate(video.id, next);
                        setAudioRate(next);
                        if (shared && listen) listen.setRate(next);
                        else applyPlaybackRate(playerRef.current, next);
                      }}
                    />
                    <span>{formatClock((shared && listen ? listen.clock : clock).duration || durationSeconds(video.duration))}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {(shared && listen ? listen.status : streamStatus) !== "playing" &&
          (shared && listen ? listen.status : streamStatus) !== "blocked" &&
          !audioMode ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                background: streamStatus === "buffering" ? "rgba(0,0,0,0.55)" : "#000",
                pointerEvents: "auto",
              }}
            >
              {streamStatus === "starting" ? (
                <img
                  src={thumb(video.id)}
                  alt=""
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }}
                />
              ) : null}
              <Spinner size={32} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-accent)", position: "relative" }}>
                {streamStatus === "buffering" ? "loading" : "starting stream"}
              </span>
            </div>
          ) : null}
          {watchOnYoutube || (shared && listen?.status === "blocked") ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 32,
                textAlign: "center",
                background: "var(--tf-bg)",
                pointerEvents: "auto",
              }}
            >
              <img
                src={thumb(video.id)}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2 }}
              />
              <div style={{ position: "relative", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--tf-text)", maxWidth: 420, lineHeight: 1.6 }}>
                this video can only be watched on YouTube. the owner disabled playback on other sites.
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  position: "relative",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "#111827",
                  background: "var(--tf-accent)",
                  padding: "8px 16px",
                  borderRadius: "3px",
                  textDecoration: "none",
                }}
              >
                watch on youtube
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <main className="tf-main tf-player-main">
        <div className="tf-path" style={{ marginBottom: 24 }}>
          {displayCategory(video.category) ? (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--tf-accent)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {displayCategory(video.category)}
            </div>
          ) : null}
          <h1
            style={{
              fontSize: "clamp(18px, 3vw, 26px)",
              fontWeight: 700,
              color: "var(--tf-text)",
              lineHeight: 1.35,
              marginBottom: 14,
            }}
          >
            {video.title}
          </h1>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--tf-muted)",
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <VideoMetaLine video={video} />
            {likes ? (
              <span className="tf-video-meta-stat" title={`${likes} likes`}>
                <LikeIcon />
                <span>{compactViews(likes) || likes}</span>
              </span>
            ) : null}
            {queue.length > 1 && !silent ? (
              <button
                onClick={() => setAutoNext((value) => !value)}
                style={{
                  marginLeft: "auto",
                  background: autoNext ? "var(--tf-accent-soft)" : "none",
                  border: `1px solid ${autoNext ? "var(--tf-accent-line)" : "var(--tf-line)"}`,
                  color: autoNext ? "var(--tf-accent)" : "var(--tf-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: "2px",
                  cursor: "pointer",
                }}
              >
                autoplay next {autoNext ? "on" : "off"}
              </button>
            ) : null}
          </div>
        </div>

        {onOpenCourse ? (
          <CoursePanel video={video} known={course} queue={queue} onOpen={onOpenCourse} />
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
          <button
            type="button"
            aria-label={audioMode ? "Switch to video" : "Switch to listen"}
            disabled={watchOnYoutube}
            onClick={() => chooseWatchMode(!audioMode)}
            style={{
              background: "none",
              border: "1px solid var(--tf-line)",
              color: watchOnYoutube ? "var(--tf-dim)" : "var(--tf-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: "3px",
              cursor: watchOnYoutube ? "default" : "pointer",
              opacity: watchOnYoutube ? 0.5 : 1,
            }}
          >
            {audioMode ? "video" : "listen"}
          </button>
          <TalkToAi video={video} />
          <button
            type="button"
            aria-expanded={descOpen}
            onClick={() => setDescOpen((open) => !open)}
            style={{
              background: descOpen ? "var(--tf-accent-soft)" : "none",
              border: `1px solid ${descOpen ? "var(--tf-accent-line)" : "var(--tf-line)"}`,
              color: descOpen ? "var(--tf-accent)" : "var(--tf-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            description
          </button>
          <button
            type="button"
            aria-expanded={commentsOpen}
            onClick={() => setCommentsOpen((open) => !open)}
            style={{
              background: commentsOpen ? "var(--tf-accent-soft)" : "none",
              border: `1px solid ${commentsOpen ? "var(--tf-accent-line)" : "var(--tf-line)"}`,
              color: commentsOpen ? "var(--tf-accent)" : "var(--tf-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            comments{descReady && comments.length ? ` · ${comments.length}` : ""}
          </button>
        </div>

        {descOpen ? (
          description ? (
            <WatchDescription
              text={description}
              onSeek={(seconds) => {
                if (shared && listen) {
                  listen.seek(seconds);
                  return;
                }
                playerRef.current?.seekTo?.(seconds, true);
                setClock((current) => ({ ...current, current: seconds, paused: false }));
                restoreSound(playerRef.current, true);
              }}
            />
          ) : (
            <div className="tf-watch-desc-empty">{descReady ? "no description" : "loading…"}</div>
          )
        ) : null}

        {commentsOpen ? <WatchComments comments={comments} ready={descReady} /> : null}

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--tf-accent)",
            letterSpacing: "0.06em",
            margin: "12px 0 20px",
          }}
        >
          RECOMMENDED
        </div>
        {relatedLoading && recommended.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
            loading...
          </div>
        ) : (
          <VideoGrid
            videos={recommended}
            onSelect={onSelect}
            openingId={openingId}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMoreRecommended}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const initialRoute = typeof window === "undefined" ? { page: "home" as AppPage, id: "" } : routeFromHash();
  const [page, setPage] = useState<AppPage>(initialRoute.page);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState(() =>
    typeof window === "undefined" ? "" : routeFromHash().searchQuery,
  );
  const [activeVideo, setActiveVideo] = useState<Video | null>(() =>
    initialRoute.page === "watch" && initialRoute.id ? restoreVideo(initialRoute.id) : null,
  );
  const [listening, setListening] = useState<Video | null>(() =>
    initialRoute.page === "watch" && initialRoute.id ? restoreVideo(initialRoute.id) : null,
  );
  const [playerStage, setPlayerStage] = useState<HTMLElement | null>(null);
  const [holdPause, setHoldPause] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [availableIds, setAvailableIds] = useState<Set<string> | null>(null);
  const [history, setHistory] = useState<Video[]>(() => (typeof window === "undefined" ? [] : readHistory()));
  const [feed, setFeed] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchMode, setSearchMode] = useState<"video" | "playlist">("video");
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(() => {
    if (initialRoute.page === "playlist" && initialRoute.id) return restorePlaylist(initialRoute.id);
    if (initialRoute.page === "watch") return readSessionJson<Playlist>(LAST_PLAYLIST_KEY);
    return null;
  });
  const [returnTo, setReturnTo] = useState<ReturnTo>(() => {
    const stored = readSessionJson<ReturnTo>(RETURN_KEY);
    if (stored === "history" || stored === "playlist" || stored === "home" || stored === "settings") return stored;
    return initialRoute.page === "watch" && readSessionJson<Playlist>(LAST_PLAYLIST_KEY) ? "playlist" : "home";
  });
  const [predictions, setPredictions] = useState<string[]>([]);
  const [includeShorts, setIncludeShorts] = useState(() => {
    try {
      return localStorage.getItem(SHORTS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [audioOnly, setAudioOnly] = useState(() => {
    try {
      return localStorage.getItem(AUDIO_MODE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [appliedQuery, setAppliedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [watchQueue, setWatchQueue] = useState<Video[]>(() =>
    typeof window === "undefined" ? [] : readWatchQueue(),
  );
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const route = routeFromHash();
      setPage(route.page);
      if (route.page === "playlist" && route.id) {
        setActiveVideo(null);
        setOpeningId(null);
        setActivePlaylist((current) => (current?.id === route.id ? current : restorePlaylist(route.id)));
      }
      if (route.page === "watch" && route.id) {
        const next = restoreVideo(route.id);
        setActiveVideo((current) => (current?.id === route.id ? current : next));
        setListening((current) => (current?.id === route.id ? current : next));
      }
      if (route.page === "home" || route.page === "history" || route.page === "settings") {
        setActiveVideo(null);
        setOpeningId(null);
        if (route.page === "home") {
          setActivePlaylist(null);
          setSearch(route.searchQuery);
        }
      }
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (page === "watch" && activeVideo?.title) document.title = `${activeVideo.title} · TechFocus`;
    else if (page === "playlist" && activePlaylist?.title) document.title = `${activePlaylist.title} · TechFocus`;
    else if (page === "history") document.title = "History · TechFocus";
    else if (page === "settings") document.title = "Settings · TechFocus";
    else document.title = "TechFocus";
  }, [activeVideo, activePlaylist, page]);

  function goHome() {
    setActiveVideo(null);
    setActivePlaylist(null);
    setOpeningId(null);
    setSearch("");
    setReturnTo("home");
    writeSessionJson(RETURN_KEY, "home");
    setPage("home");
    setHash("");
  }

  function goHistory() {
    setActiveVideo(null);
    setOpeningId(null);
    setPage("history");
    setHash("history");
  }

  function goSettings() {
    setActiveVideo(null);
    setOpeningId(null);
    setPage("settings");
    setHash("settings");
  }

  function writeAudioOnly(next: boolean) {
    setAudioOnly(next);
    try {
      localStorage.setItem(AUDIO_MODE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function writeIncludeShorts(next: boolean) {
    setIncludeShorts(next);
    try {
      localStorage.setItem(SHORTS_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function goPlaylist(playlist: Playlist) {
    setActiveVideo(null);
    setOpeningId(null);
    setActivePlaylist(playlist);
    writeSessionJson(LAST_PLAYLIST_KEY, playlist);
    setReturnTo("playlist");
    writeSessionJson(RETURN_KEY, "playlist");
    setPage("playlist");
    setHash(`playlist/${playlist.id}`);
  }

  function leaveWatch() {
    if (activeVideo) setListening((current) => current || activeVideo);
    setActiveVideo(null);
    setOpeningId(null);
    setPlayerStage(null);
    if (returnTo === "playlist" && activePlaylist) {
      setPage("playlist");
      setHash(`playlist/${activePlaylist.id}`);
      return;
    }
    if (returnTo === "history") {
      setPage("history");
      setHash("history");
      return;
    }
    if (returnTo === "settings") {
      setPage("settings");
      setHash("settings");
      return;
    }
    setPage("home");
    const q = search.trim();
    setHash(q.length >= 2 ? resultsPath(q) : "");
  }

  useEffect(() => {
    if (page !== "home") return;
    const q = search.trim();
    const { path } = parseHashParts();
    const onResults = path === "results" || path === "search";
    const current = routeFromHash();
    if (q.length >= 2) {
      if (current.searchQuery === q && onResults) return;
      setHash(resultsPath(q), onResults);
      return;
    }
    if (onResults) setHash("", true);
  }, [page, search]);

  useEffect(() => {
    const ids = VIDEOS.map((video) => video.id).join(",");
    fetch(`/api/available?ids=${encodeURIComponent(ids)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.ids)) setAvailableIds(new Set(data.ids));
      })
      .catch(() => setAvailableIds(null));
  }, []);

  const localResults = useMemo(() => {
    return VIDEOS.filter((video) => {
      if (availableIds && !availableIds.has(video.id)) return false;
      const browsing = search.trim().length < 2;
      const matchCat = !browsing || matchesCategory(video, activeCategory);
      const q = search.toLowerCase();
      const matchSearch = !q || video.title.toLowerCase().includes(q) || video.channel.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [activeCategory, search, availableIds]);

  const query = search.trim();
  const categoryHint = CATEGORY_HINTS[activeCategory] || "";
  const useRemoteFeed = true;

  useEffect(() => {
    const controller = new AbortController();
    pageRef.current = 1;
    loadingMoreRef.current = false;

    if (query.length < 2) {
      setPredictions([]);
      setAppliedQuery("");
      setSearchMode("video");
      setPlaylists([]);
      setHasMore(false);
      setIsSearching(true);
      const topic = categoryHint ? `&topic=${encodeURIComponent(categoryHint)}` : "";
      const skip = watchedIdSet();
      const exclude = skip.size ? `&exclude=${encodeURIComponent([...skip].join(","))}` : "";
      fetch(`/api/random?page=1&shorts=${includeShorts ? 1 : 0}${topic}${exclude}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          const incoming = Array.isArray(data.results) ? data.results : [];
          const results = incoming.filter(
            (item: Video) =>
              !skip.has(item.id) &&
              isTechVideo(item) &&
              (includeShorts || !isShort(item)) &&
              matchesCategory(item, activeCategory),
          );
          setFeed(results);
          setHasMore(Boolean(data.hasMore || incoming.length));
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") setHasMore(false);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
      return () => controller.abort();
    }

    setSearchMode("video");
    setPlaylists([]);
    setHasMore(true);

    const cacheKey = `${query.toLowerCase()}|shorts:${includeShorts ? 1 : 0}`;
    const cached = SEARCH_CACHE.get(cacheKey);
    if (cached?.length) {
      setFeed(cached);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }

    const timer = window.setTimeout(async () => {
      try {
        const shorts = `shorts=${includeShorts ? 1 : 0}`;
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=1&${shorts}`, {
          signal: controller.signal,
        });
        const searchData = await searchRes.json();
        const searchVideos = (Array.isArray(searchData.results) ? searchData.results : []).filter(
          (item: Video) => includeShorts || !isShort(item),
        );
        const playlistsFound = Array.isArray(searchData.playlists) ? searchData.playlists : [];

        if (searchData.mode === "playlist") {
          setSearchMode("playlist");
          setPlaylists(playlistsFound);
          setFeed(playlistsFound.length ? [] : searchVideos);
          setAppliedQuery("");
          setHasMore(searchData.hasMore !== false || playlistsFound.length > 0);
        } else if (searchVideos.length) {
          SEARCH_CACHE.set(cacheKey, searchVideos);
          setSearchMode("video");
          setFeed(searchVideos);
          setAppliedQuery("");
          setHasMore(true);
        }

        if (!controller.signal.aborted) setIsSearching(false);

        fetch(`/api/predict?q=${encodeURIComponent(query)}&${shorts}`, { signal: controller.signal })
          .then((res) => res.json())
          .then((predictData) => {
            const bag = (predictData.results && typeof predictData.results === "object" ? predictData.results : {}) as Record<string, Video[]>;
            if (searchVideos.length) bag[query.toLowerCase()] = searchVideos;
            for (const [key, videos] of Object.entries(bag)) {
              if (Array.isArray(videos) && videos.length) {
                SEARCH_CACHE.set(`${key.toLowerCase()}|shorts:${includeShorts ? 1 : 0}`, videos);
              }
            }
            setPredictions(
              (predictData.suggestions || []).filter((item: string) => {
                const normalized = item.toLowerCase().replace(/\s+/g, " ").trim();
                const current = query.toLowerCase().replace(/\s+/g, " ").trim();
                return normalized && normalized !== current && !/\b(\w+)(?: \1)+\b/.test(normalized);
              }),
            );
            const playlistResults = Array.isArray(predictData.playlists) ? predictData.playlists : [];
            if (searchData.mode === "playlist" && playlistResults.length && !playlistsFound.length) {
              setSearchMode("playlist");
              setPlaylists(playlistResults);
              setFeed([]);
              setHasMore(true);
              return;
            }
            if (!searchVideos.length && searchData.mode !== "playlist" && !playlistsFound.length) {
              const closest = pickClosestVideos(query, bag, predictData.suggestions || []);
              const fallback = closest.videos.filter((item) => includeShorts || !isShort(item));
              if (fallback.length) {
                setSearchMode("video");
                setFeed(fallback);
                setAppliedQuery(closest.used.toLowerCase() !== query.toLowerCase() ? closest.used : "");
                setHasMore(true);
              }
            }
          })
          .catch((error) => {
            if ((error as Error).name !== "AbortError") setHasMore(Boolean(searchVideos.length));
          });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setHasMore(false);
          setIsSearching(false);
        }
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, categoryHint, includeShorts, history]);

  async function loadMore() {
    if (!useRemoteFeed || loadingMoreRef.current || !hasMore || isSearching) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const shorts = `shorts=${includeShorts ? 1 : 0}`;
      const known = watchedIdList([...feed, ...localResults].map((item) => item.id)).join(",");
      const path = query.length >= 2
        ? `/api/search?q=${encodeURIComponent(query)}&page=${nextPage}&${shorts}`
        : `/api/random?page=${nextPage}&${shorts}${categoryHint ? `&topic=${encodeURIComponent(categoryHint)}` : ""}${known ? `&exclude=${encodeURIComponent(known)}` : ""}`;
      const res = await fetch(path);
      const data = await res.json();
      pageRef.current = nextPage;

      if (searchMode === "playlist" || data.mode === "playlist") {
        const incoming = Array.isArray(data.playlists) ? data.playlists : [];
        let added = 0;
        setPlaylists((current) => {
          const seen = new Set(current.map((item) => item.id));
          const extra = incoming.filter((item: Playlist) => !seen.has(item.id));
          added = extra.length;
          return extra.length ? [...current, ...extra] : current;
        });
        setHasMore(Boolean((data.hasMore || incoming.length) && (added > 0 || nextPage < 8)));
      } else {
        const incoming = (Array.isArray(data.results) ? data.results : []).filter((item: Video) => {
          if (!includeShorts && isShort(item)) return false;
          if (query.length >= 2) return true;
          return isTechVideo(item) && matchesCategory(item, activeCategory);
        });
        const knownIds = new Set(feed.map((item) => item.id));
        const extra = incoming.filter((item: Video) => !knownIds.has(item.id));
        if (extra.length) {
          setFeed((current) => {
            const seen = new Set(current.map((item) => item.id));
            return [...current, ...extra.filter((item: Video) => !seen.has(item.id))];
          });
        }
        const rawCount = Array.isArray(data.results) ? data.results.length : incoming.length;
        setHasMore(Boolean((data.hasMore || rawCount > 0) && (extra.length > 0 || nextPage < 8)));
      }
    } catch {
      setHasMore(false);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  function openVideo(video: Video, queue?: Video[], opts?: { takeover?: boolean }) {
    preloadPlayer(video.id);
    const next = [video, ...history.filter((item) => item.id !== video.id)].slice(0, 30);
    setHistory(next);
    writeHistory(next);
    if (queue?.length) {
      setWatchQueue(queue);
      writeWatchQueue(queue);
    } else {
      const current = watchQueue.some((item) => item.id === video.id) ? watchQueue : readWatchQueue();
      if (current.some((item) => item.id === video.id)) {
        if (current !== watchQueue) setWatchQueue(current);
      } else {
        setWatchQueue([]);
        writeWatchQueue([]);
      }
    }
    setListening(video);
    setHoldPause(false);
    if (page === "playlist" && activePlaylist) {
      writeSessionJson(LAST_PLAYLIST_KEY, activePlaylist);
    }
    const origin: ReturnTo = page === "playlist" || (page === "watch" && returnTo === "playlist")
      ? "playlist"
      : page === "history" || (page === "watch" && returnTo === "history")
        ? "history"
        : page === "settings" || (page === "watch" && returnTo === "settings")
          ? "settings"
          : "home";
    setReturnTo(origin);
    writeSessionJson(RETURN_KEY, origin);
    writeSessionJson(LAST_VIDEO_KEY, video);
    setOpeningId(video.id);
    setActiveVideo(video);
    setPage("watch");
    setHash(`watch/${video.id}`);
  }

  const docked = Boolean(listening && (page !== "watch" || activeVideo?.id !== listening.id));

  const gridVideos = (() => {
    const raw = (() => {
      if (query.length >= 2) {
        const seen = new Set(feed.map((video) => video.id));
        return [...feed, ...localResults.filter((video) => !seen.has(video.id))];
      }
      const seen = new Set(localResults.map((video) => video.id));
      return [...localResults, ...feed.filter((video) => !seen.has(video.id))];
    })();
    return raw
      .map((video) => {
        rememberChannelThumb(video.channel, video.channelThumb);
        return { ...video, channelThumb: video.channelThumb || channelThumbOf(video) };
      })
      .filter((video) => {
        if (!includeShorts && isShort(video)) return false;
        if (query.length < 2 && !matchesCategory(video, activeCategory)) return false;
        if (query.length < 2 && watchedIdSet([listening?.id || ""]).has(video.id)) return false;
        return true;
      });
  })();

  const home = (
    <div className={`tf-page${docked ? " tf-page-docked" : ""}`}>
      <header
        className="tf-sticky-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid var(--tf-line)",
          background: "rgba(12,12,14,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="tf-home-bar">
          <button
            onClick={goHome}
            style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <BrandIcon />
            <span
              className="tf-brand-word"
              style={{
                fontFamily: "var(--sans)",
                fontSize: "16px",
                fontWeight: 800,
                color: "var(--tf-text)",
                letterSpacing: "-0.03em",
              }}
            >
              TECH<span style={{ color: "var(--tf-accent)" }}>FOCUS</span>
            </span>
          </button>

          <div className="tf-search">
            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--tf-dim)",
                pointerEvents: "none",
              }}
            >
              <SearchIcon />
            </div>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.trim().length >= 2) setActiveCategory("All");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              }}
              placeholder="Search lectures..."
              style={{
                width: "100%",
                background: "var(--tf-panel)",
                border: "1px solid var(--tf-line)",
                borderRadius: "3px",
                padding: search.trim() ? "8px 40px 8px 38px" : "8px 14px 8px 38px",
                color: "var(--tf-text)",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={e => ((e.target as HTMLInputElement).style.borderColor = "var(--tf-accent-focus)")}
              onBlur={e => ((e.target as HTMLInputElement).style.borderColor = "var(--tf-line)")}
            />
            {search.trim() ? (
              <button
                type="button"
                className="tf-search-clear"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <CloseIcon />
              </button>
            ) : null}
          </div>

          <div className="tf-home-actions">
            <button
              onClick={goHistory}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--tf-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                flexShrink: 0,
                background: "none",
                border: "1px solid var(--tf-line)",
                padding: "6px 12px",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              history
            </button>
            <button
              onClick={goSettings}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--tf-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                flexShrink: 0,
                background: "none",
                border: "1px solid var(--tf-line)",
                padding: "6px 12px",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              settings
            </button>
          </div>
        </div>

        {query.length < 2 ? (
        <div className="tf-filters">
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setSearch("");
                  setPredictions([]);
                  setPlaylists([]);
                  setSearchMode("video");
                }}
                style={{
                  background: active ? "var(--tf-accent-soft)" : "none",
                  border: `1px solid ${active ? "var(--tf-accent-line)" : "transparent"}`,
                  color: active ? "var(--tf-accent)" : "var(--tf-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "5px 14px",
                  borderRadius: "2px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--tf-text)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--tf-muted)"; }}
              >
                {cat}
              </button>
            );
          })}
        </div>
        ) : null}
      </header>

      <main className="tf-main">
        {appliedQuery && query.length >= 2 && searchMode === "video" && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tf-dim)", marginBottom: 16 }}>
            showing closest results for "{appliedQuery}"
          </div>
        )}
        {isSearching && gridVideos.length === 0 && playlists.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
            loading...
          </div>
        ) : searchMode === "playlist" && query.length >= 2 && playlists.length > 0 ? (
          <>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--tf-accent)",
                letterSpacing: "0.06em",
                marginBottom: 20,
              }}
            >
              LEARNING PATHS
            </div>
            <PlaylistGrid
              playlists={playlists}
              onSelect={goPlaylist}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          </>
        ) : gridVideos.length === 0 && !isSearching ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--tf-dim)" }}>
            no videos found
          </div>
        ) : (
          <VideoGrid
            videos={gridVideos}
            onSelect={openVideo}
            openingId={openingId}
            hasMore={useRemoteFeed && hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            symbolic={false}
          />
        )}
      </main>
    </div>
  );

  const pageTree =
    page === "watch" && activeVideo ? (
      <PlayerView
        video={activeVideo}
        onBack={leaveWatch}
        onSelect={openVideo}
          onPlaying={() => {
            setOpeningId(null);
            setHoldPause(false);
          }}
          onStage={setPlayerStage}
          startPaused={holdPause}
          queue={watchQueue}
          openingId={openingId}
          course={
            activePlaylist &&
            isCoursePlaylistId(activePlaylist.id) &&
            (PLAYLIST_CACHE.get(activePlaylist.id)?.some((item) => item.id === activeVideo.id) ||
              (returnTo === "playlist" && watchQueue.some((item) => item.id === activeVideo.id)))
              ? activePlaylist
              : null
          }
          onOpenCourse={goPlaylist}
          preferAudio={audioOnly}
      />
    ) : page === "playlist" && activePlaylist ? (
      <div className={docked ? "tf-page-docked" : undefined}>
        <PlaylistView
          playlist={activePlaylist}
          onBack={() => {
            setActivePlaylist(null);
            setPage("home");
            setHash("");
          }}
          onSelect={openVideo}
          openingId={openingId}
        />
      </div>
    ) : page === "settings" ? (
      <div className={docked ? "tf-page-docked" : undefined}>
        <SettingsPage
          audioOnly={audioOnly}
          onAudioOnly={writeAudioOnly}
          includeShorts={includeShorts}
          onIncludeShorts={writeIncludeShorts}
          onBack={goHome}
        />
      </div>
    ) : page === "history" ? (
      <div className={docked ? "tf-page-docked" : undefined}>
        <HistoryPage
          videos={history}
          onBack={goHome}
          onSelect={openVideo}
          openingId={openingId}
          onClear={() => {
            setHistory([]);
            writeHistory([]);
          }}
        />
      </div>
    ) : (
      home
    );

  if (!listening) return pageTree;

  return (
    <PersistentAudio
      video={listening}
      queue={watchQueue}
      docked={docked}
      stage={playerStage}
      onAdvance={(next) => {
        setListening(next);
        if (!docked) openVideo(next, watchQueue, { takeover: true });
      }}
      onPlaying={() => setOpeningId(null)}
      onClose={() => {
        setListening(null);
        setPlayerStage(null);
        setHoldPause(true);
      }}
      onOpen={() => openVideo(listening, watchQueue, { takeover: true })}
    >
      {pageTree}
    </PersistentAudio>
  );
}
