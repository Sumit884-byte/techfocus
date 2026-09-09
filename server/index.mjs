import http from "node:http";
import { URL } from "node:url";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const DATA_DIR = process.env.VERCEL
  ? join("/tmp", "techfocus-data")
  : join(dirname(fileURLToPath(import.meta.url)), "data");
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();

const PORT = Number(process.env.API_PORT || 8787);

const INVIDIOUS_INSTANCES = [
  "https://invidious.nerdvpn.de",
  "https://inv.tux.pizza",
  "https://invidious.protokolla.fi",
  "https://vid.puffyan.us",
  "https://yewtu.be",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const availabilityCache = new Map();
const AVAILABILITY_TTL_MS = 30 * 60 * 1000;
const searchCache = new Map();
const SEARCH_TTL_MS = 2 * 60 * 1000;

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body));
}

function formatDuration(seconds) {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatPlaylistDuration(seconds) {
  const total = Math.floor(Number(seconds) || 0);
  if (total <= 0) return "";
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h > 0 && m === 60) return `${h + 1}h`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(1, m)}m`;
}

function parseDurationPhrase(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, " ");
  if (!t || /\b(ago|updated|views?|videos?|lectures?)\b/.test(t)) return 0;
  const hours = t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/);
  const mins = t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|m)\b/);
  const secs = t.match(/(\d+)\s*(seconds?|secs?|s)\b/);
  if (!hours && !mins && !secs) return 0;
  return Math.round(
    (hours ? Number(hours[1]) * 3600 : 0) +
      (mins ? Number(mins[1]) * 60 : 0) +
      (secs ? Number(secs[1]) : 0),
  );
}

function durationFromNode(value, depth = 0) {
  if (!value || depth > 8) return 0;
  if (typeof value === "string" || typeof value === "number") return parseDurationPhrase(value) || durationSeconds(value);
  const text = nodeText(value);
  const fromText = parseDurationPhrase(text);
  if (fromText) return fromText;
  if (typeof value !== "object") return 0;
  for (const child of Object.values(value)) {
    if (!child || typeof child !== "object") continue;
    const found = durationFromNode(child, depth + 1);
    if (found) return found;
  }
  return 0;
}

function sumVideoDurations(videos) {
  return (videos || []).reduce((sum, video) => sum + durationSeconds(video.duration), 0);
}

function compactCount(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000_000) return `${n >= 10_000_000_000 ? Math.round(n / 1_000_000_000) : String((n / 1_000_000_000).toFixed(1)).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `${n >= 10_000_000 ? Math.round(n / 1_000_000) : String((n / 1_000_000).toFixed(1)).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${n >= 10_000 ? Math.floor(n / 1_000) : String((n / 1_000).toFixed(1)).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

function formatViews(views) {
  if (views === 0 || views === "0") return "";
  if (!views) return "";
  const raw = String(views).replace(/\s*views?/i, "").replace(/^unknown$/i, "").trim();
  if (!raw || raw === "0") return "";
  const short = raw.match(/^([\d.,]+)\s*([kmb])$/i);
  if (short) {
    const n = Number(short[1].replace(/,/g, ""));
    const mul = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[short[2].toLowerCase()];
    return compactCount(n * mul) || raw;
  }
  const n = Number(raw.replace(/,/g, ""));
  if (Number.isFinite(n)) return compactCount(n);
  return raw;
}

function looksLikeViews(text) {
  return /\bviews?\b/i.test(text || "") || /^[\d.,]+\s*[kmb]?$/i.test((text || "").trim());
}

function looksLikeDate(text) {
  return /\b(ago|streamed|premiered|yesterday|today|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text || "") ||
    /\b20\d{2}\b/.test(text || "");
}

function looksLikePlaylistMeta(text) {
  return /^(view\s+)?full\s+(playlist|course)$|^(playlist|course)$/i.test((text || "").trim());
}

function postedFromIso(iso) {
  const at = Date.parse(iso || "");
  if (!Number.isFinite(at)) return "";
  const days = Math.max(0, Math.round((Date.now() - at) / 86400000));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.max(1, Math.round(days / 7));
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function metaFromLabel(label) {
  const text = String(label || "");
  const views = formatViews((text.match(/([\d.,]+\s*[kmb]?)\s*views?/i) || [])[1] || "");
  const posted = (text.match(/\b((?:streamed|premiered)\s+)?(?:\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago|yesterday|today)\b/i) || [])[0] || "";
  return { views, posted };
}

function lockupTextParts(lockup) {
  const rows = lockup?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
  const texts = [];
  for (const row of rows) {
    for (const part of row.metadataParts || []) {
      const text = part.text?.content || "";
      if (text) texts.push(text);
    }
  }
  return texts;
}

function parseRuns(runs) {
  return (runs || []).map((run) => run.text || "").join("");
}

function absThumbUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function bestThumbUrl(thumbs) {
  const list = (Array.isArray(thumbs) ? thumbs : []).filter((item) => item?.url);
  if (!list.length) return "";
  const ranked = [...list].sort((a, b) => (Number(a.width) || 0) - (Number(b.width) || 0));
  const fit = ranked.find((item) => (Number(item.width) || 0) >= 48) || ranked[ranked.length - 1];
  return absThumbUrl(fit.url);
}

function pickChannelThumb(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return "";
  const direct = bestThumbUrl(
    node.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails ||
      node.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails ||
      node.channelThumbnail?.thumbnails ||
      node.owner?.thumbnail?.thumbnails ||
      node.avatarViewModel?.image?.sources ||
      node.avatar?.image?.sources ||
      node.image?.sources,
  );
  if (direct) return direct;
  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") continue;
    if (value.channelThumbnailWithLinkRenderer || value.avatarViewModel || value.channelThumbnailSupportedRenderers) {
      const found = pickChannelThumb(value, depth + 1);
      if (found) return found;
    }
  }
  return "";
}

function pickChannel(renderer) {
  const candidates = [
    parseRuns(renderer.ownerText?.runs),
    parseRuns(renderer.shortBylineText?.runs),
    renderer.shortBylineText?.simpleText || "",
    parseRuns(renderer.longBylineText?.runs),
  ].map((value) => value.trim());
  return candidates.find((value) => value && !looksLikeViews(value) && !looksLikeDate(value) && !/^unknown$/i.test(value)) || "";
}

function pickPosted(renderer) {
  const candidates = [
    renderer.publishedTimeText?.simpleText || "",
    parseRuns(renderer.publishedTimeText?.runs),
    parseRuns(renderer.videoInfo?.runs),
    renderer.accessibility?.accessibilityData?.label || "",
    renderer.title?.accessibility?.accessibilityData?.label || "",
  ];
  for (const value of candidates) {
    const parts = value.split(/[•·|,]/).map((part) => part.trim()).filter(Boolean);
    const date = parts.find((part) => looksLikeDate(part) && !looksLikeViews(part));
    if (date) return date;
    const fromLabel = metaFromLabel(value).posted;
    if (fromLabel) return fromLabel;
  }
  return "";
}

function pickViews(renderer) {
  const direct = renderer.viewCountText?.simpleText || renderer.shortViewCountText?.simpleText || renderer.videoInfo?.runs?.[0]?.text || "";
  if (looksLikeViews(direct) || /\d/.test(direct)) return formatViews(direct);
  const info = parseRuns(renderer.videoInfo?.runs);
  const part = info.split(/[•·|]/).map((item) => item.trim()).find((item) => looksLikeViews(item) || /^[\d.,]+[kmb]?$/i.test(item));
  if (part) return formatViews(part);
  return metaFromLabel(renderer.accessibility?.accessibilityData?.label || renderer.title?.accessibility?.accessibilityData?.label || "").views;
}

function isBlockedTitle(title) {
  const value = (title || "").trim().toLowerCase();
  return (
    !value ||
    value === "deleted video" ||
    value === "private video" ||
    value === "[deleted video]" ||
    value === "[private video]" ||
    value.includes("video unavailable")
  );
}

function findBadgeDuration(node) {
  let found = "";
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    const text = value.thumbnailBadgeViewModel?.text || value.thumbnailOverlayTimeStatusRenderer?.text?.simpleText;
    if (typeof text === "string" && /^\d+:\d+/.test(text.trim())) found = text.trim();
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  visit(node);
  return found;
}

function durationSeconds(duration) {
  if (typeof duration === "number") return duration;
  const parts = String(duration || "")
    .split(":")
    .map((part) => Number(part));
  if (!parts.length || parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function isShort(video) {
  if (video.short === true) return true;
  const seconds = durationSeconds(video.duration);
  return seconds > 0 && seconds <= 60;
}

function looksPlayable(video) {
  if (!video?.id || isBlockedTitle(video.title)) return false;
  const duration = (video.duration || "").trim().toUpperCase();
  if (duration === "LIVE" || duration === "PREMIERE") return false;
  return true;
}

async function checkAvailable(id) {
  const cached = availabilityCache.get(id);
  if (cached && Date.now() - cached.ts < AVAILABILITY_TTL_MS) return cached.ok;

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } },
    );
    const ok = res.ok;
    availabilityCache.set(id, { ok, ts: Date.now() });
    return ok;
  } catch {
    return true;
  }
}

function inferCategory(text) {
  const value = (text || "").toLowerCase();
  if (/secur|hack|crypto|owasp|inject|cve|malware| pentest|cyber/.test(value)) return "Security";
  if (/\bai\b|machine learning|\bml\b|llm|neural|gpt|transformer|(language|foundation|diffusion) models?/.test(value)) return "AI / ML";
  if (/docker|kuber|devops|ci\/cd|terraform|deploy/.test(value)) return "DevOps";
  if (/\baws\b|azure|\bgcp\b|cloud computing|cloud native/.test(value)) return "Cloud";
  if (/database|postgres|sql|data engineer|analytics|spark|warehouse/.test(value)) return "Data";
  if (/network|tcp|http|dns|routing|packet/.test(value)) return "Networking";
  if (/operating system|\bos\b|kernel|linux internals|systems programming/.test(value)) return "Systems";
  if (/robot|arduino|raspberry|ros\b/.test(value)) return "Robotics";
  if (/cpu|hardware|alu|gpu|microchip|silicon|semiconductor|transistor|wafer|pcb|circuit|ps5|playstation|xbox|\bconsole\b/.test(value)) return "Hardware";
  if (/android|ios|flutter|kotlin|swift|mobile app/.test(value)) return "Mobile";
  if (/frontend|backend|react|next\.js|html|css|web dev/.test(value)) return "Web";
  if (/linux|git|open source|foss/.test(value)) return "Open Source";
  if (/code|program|rust|python|javascript|typescript|\bc\b|java/.test(value)) return "Programming";
  return "Tech";
}

const TECH_TERMS = [
  "programming", "programmer", "code", "coding", "software", "developer", "devops",
  "linux", "unix", "kernel", "python", "rust", "javascript", "typescript", "golang",
  "java", "kotlin", "c++", "compiler", "algorithm", "database", "sql", "postgres",
  "kubernetes", "docker", "terraform", "aws", "azure", "gcp", "security", "cyber",
  "hack", "owasp", "cve", "malware", "encrypt", "https", "neural", "machine learning",
  "deep learning", "llm", "gpt", "transformer", "cpu", "gpu", "hardware", "alu",
  "microchip", "semiconductor", "silicon", "circuit", "network", "tcp", "api", "git", "open source", "foss",
  "backend", "frontend", "debug", "operating system", "cloud", "ci/cd", "github",
  "robot", "robotics", "arduino", "raspberry",
];

const TECH_CHANNELS = [
  "fireship", "3blue1brown", "computerphile", "techworld with nana",
  "andrej karpathy", "ibm technology", "crash course", "networkchuck",
  "the coding train", "freecodecamp", "traversy", "primeagen",
  "low level learning", "corey schafer", "sentdex", "ben eater",
];

const NON_TECH = [
  "vlog", "prank", "official trailer", "music video", "full album", "asmr",
  "minecraft", "fortnite", "gta ", "cricket", "football highlights", "bollywood",
  "song ", "dance", "mukbang", "janta party", "podcast clip", "stand up comedy",
  "roast", "relationship", "makeup", "unboxing haul",
  "potato chip", "tortilla chip", "corn chip", "dorito", "pringle", "lays ",
];

function isTechVideo(video) {
  const text = `${video.title || ""} ${video.channel || ""} ${video.category || ""}`.toLowerCase();
  if (!text.trim()) return false;
  if (/\bchips?\b/.test(text) && !/silicon|semi|cpu|gpu|microchip|semiconductor|wafer|transistor/.test(text) && /made|factory|snack|food|potato|crisp/.test(text)) return false;
  if (NON_TECH.some((term) => text.includes(term))) return false;
  if (TECH_CHANNELS.some((channel) => text.includes(channel))) return true;
  return TECH_TERMS.some((term) => text.includes(term));
}

function withCategory(video, query = "") {
  const fromTitle = inferCategory(`${video.title} ${video.channel}`);
  if (fromTitle !== "Tech") return { ...video, category: fromTitle };
  const fromQuery = inferCategory(query);
  return { ...video, category: fromQuery !== "Tech" ? fromQuery : "Tech" };
}

function filterPlayable(videos, limit = 16, query = "", techOnly = false, includeShorts = false) {
  return videos
    .filter(looksPlayable)
    .filter((video) => !techOnly || isTechVideo(video))
    .filter((video) => includeShorts || !isShort(video))
    .slice(0, limit)
    .map((video) => withCategory(video, query));
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const RANDOM_TOPICS = [
  "systems programming lecture",
  "linux internals explained",
  "kubernetes architecture",
  "machine learning fundamentals",
  "web application security",
  "cpu architecture explained",
  "rust programming",
  "compiler design",
  "computer networking",
  "open source software",
  "devops ci cd",
  "cryptography primitives",
];

const TOPIC_FEEDS = {
  programming: [
    "systems programming lecture",
    "rust programming explained",
    "python internals",
    "javascript deep dive",
    "compiler design",
    "data structures algorithms",
    "typescript programming",
    "golang tutorial",
    "c programming lecture",
    "functional programming",
  ],
  "machine learning": [
    "machine learning fundamentals",
    "neural networks explained",
    "large language models",
    "deep learning lecture",
    "transformers llm",
  ],
  devops: [
    "kubernetes architecture",
    "docker tutorial",
    "devops ci cd",
    "terraform explained",
    "linux servers devops",
  ],
  hardware: [
    "cpu architecture explained",
    "computer hardware lecture",
    "gpu architecture",
    "how silicon chips are made",
    "digital electronics",
  ],
  security: [
    "web application security",
    "cyber security explained",
    "cryptography primitives",
    "owasp top 10",
    "how https works",
  ],
  "open source": [
    "open source software",
    "linux internals explained",
    "git explained",
    "how linux kernel works",
    "foss programming",
  ],
  "cloud computing": [
    "aws cloud architecture",
    "azure fundamentals lecture",
    "gcp explained",
    "cloud native systems",
    "serverless computing",
  ],
  databases: [
    "sql database lecture",
    "postgres internals",
    "data engineering explained",
    "database indexes",
    "distributed databases",
  ],
  "computer networking": [
    "computer networking lecture",
    "tcp ip explained",
    "how dns works",
    "http https networking",
    "routing protocols",
  ],
  "operating systems": [
    "operating systems lecture",
    "linux internals explained",
    "systems programming lecture",
    "how kernels work",
    "process scheduling",
  ],
  robotics: [
    "robotics lecture",
    "ros robot operating system",
    "arduino robotics tutorial",
    "how robots work",
    "control systems robotics",
  ],
  "web development": [
    "web development lecture",
    "react javascript explained",
    "frontend architecture",
    "backend apis explained",
    "how browsers work",
  ],
  "mobile development": [
    "android development lecture",
    "ios swift tutorial",
    "flutter explained",
    "mobile app architecture",
    "kotlin android lecture",
  ],
};

function topicsForHint(hint) {
  const key = (hint || "").trim().toLowerCase();
  if (!key) return RANDOM_TOPICS;
  return TOPIC_FEEDS[key] || [hint];
}

async function searchInvidious(query, page = 1) {
  for (const instance of INVIDIOUS_INSTANCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;
      const videos = data
        .filter((item) => item?.type === "video" && item?.videoId && !item.liveNow && !item.premiereTimestamp)
        .map((item) => ({
          id: item.videoId,
          title: item.title,
          channel: item.author,
          channelThumb: bestThumbUrl(item.authorThumbnails),
          duration: formatDuration(item.lengthSeconds),
          views: formatViews(item.viewCount),
          posted: item.publishedText || "",
          category: inferCategory(`${item.title} ${query}`),
          short: Number(item.lengthSeconds) > 0 && Number(item.lengthSeconds) <= 60,
        }));
      if (videos.length) return videos;
    } catch {
      // try next instance
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function extractInnerTubeVideos(payload) {
  const videos = [];
  const seen = new Set();

  const visit = (node) => {
    if (!node || typeof node !== "object") return;

    const renderer = node.videoRenderer || node.compactVideoRenderer || node.gridVideoRenderer || node.playlistVideoRenderer;
    if (renderer?.videoId && !renderer.upcomingEventData && !seen.has(renderer.videoId)) {
      seen.add(renderer.videoId);
      const duration = renderer.lengthText?.simpleText || "";
      videos.push({
        id: renderer.videoId,
        title: renderer.title?.runs?.map((run) => run.text).join("") || renderer.title?.simpleText || "Untitled",
        channel: pickChannel(renderer),
        channelThumb: pickChannelThumb(renderer),
        duration,
        views: pickViews(renderer),
        posted: pickPosted(renderer),
        category: "Recommended",
        short: Boolean(renderer.navigationEndpoint?.reelWatchEndpoint) || isShort({ duration }),
      });
    }

    const lockup = node.lockupViewModel;
    const lockupThumbId = String(JSON.stringify(lockup?.contentImage || lockup?.image || {})).match(/\/vi\/([\w-]{11})\//)?.[1] || "";
    const lockupId = /^[\w-]{11}$/.test(lockupThumbId) ? lockupThumbId : lockup?.contentId;
    if (lockupId && !seen.has(lockupId) && /^[\w-]{11}$/.test(lockupId)) {
      const metadata = lockup.metadata?.lockupMetadataViewModel;
      const title = metadata?.title?.content || "Untitled";
      const parts = lockupTextParts(lockup);
      const channelRaw = parts.find((part) => part && !looksLikeViews(part) && !looksLikeDate(part) && !looksLikePlaylistMeta(part) && !/^unknown$/i.test(part)) || "";
      const views = formatViews(parts.find((part) => looksLikeViews(part) && !looksLikePlaylistMeta(part)) || "");
      const postedRaw = parts.find((part) => looksLikeDate(part) && !looksLikeViews(part) && !looksLikePlaylistMeta(part)) || "";
      seen.add(lockupId);
      videos.push({
        id: lockupId,
        title,
        channel: looksLikeViews(channelRaw) || /^unknown$/i.test(channelRaw) ? "" : channelRaw,
        channelThumb: pickChannelThumb(lockup),
        duration: findBadgeDuration(lockup) || "",
        views,
        posted: /^unknown$/i.test(postedRaw) ? "" : postedRaw,
        category: "Recommended",
      });
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };

  visit(payload);
  return videos;
}

async function innertube(endpoint, body, clientName = "WEB") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const client =
    clientName === "ANDROID"
      ? { clientName: "ANDROID", clientVersion: "19.47.37", hl: "en", gl: "US" }
      : { clientName: "WEB", clientVersion: "2.20241210.01.00", hl: "en", gl: "US" };
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
      body: JSON.stringify({
        context: { client },
        ...body,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function understandQuery(input) {
  const q = normalizeQuery(input);
  const wantsPlaylist = /\b(playlist|playlists|course|courses|full course|crash course)\b/.test(q);
  const learn = /\b(i want to learn|i wanna learn|teach me|learn|learning|getting started|get started|beginner|introduction to|intro to|roadmap|start learning|how (do i|to) (start|get started|learn))\b/;
  const specific =
    /\b(error|exception|versus|\bvs\b|implement|fix|debug|install|configure|deploy)\b/.test(q) ||
    /["'`]/.test(q) ||
    /\b[a-z]+_[a-z]+\b/.test(q) ||
    /\bv?\d+(\.\d+)+\b/.test(q);

  const topic = q
    .replace(/^(i want to |i wanna |please |help me |can you )+/, "")
    .replace(/^(learn|learning|study|understand|getting started with|get started with|introduction to|intro to)\s+/, "")
    .replace(/\b(please|playlist|playlists|course|courses|full course|crash course)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const topicWords = topic.split(" ").filter(Boolean);
  const broad = wantsPlaylist || (learn.test(q) && !specific && topicWords.length > 0 && topicWords.length <= 4);
  return {
    mode: broad ? "playlist" : "video",
    topic: topic || q,
    query: q,
  };
}

function playlistIdFrom(value) {
  if (!value || typeof value !== "string") return "";
  const id = value.replace(/^VL/, "");
  return /^(PL|OLAK5uy_|UU|FL)[\w-]+$/.test(id) ? id : "";
}

function nodeText(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value.simpleText === "string") return value.simpleText;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text || "").join("");
  return "";
}

function videoCountLabel(value) {
  if (typeof value === "number" && value > 0) {
    return value === 1 ? "1 video" : `${value} videos`;
  }
  const text = nodeText(value);
  const match = text.replace(/,/g, "").match(/(\d+)\s+(videos?|lectures?)\b/i);
  if (!match) return "";
  const n = Number(match[1]);
  if (!n) return "";
  return n === 1 ? "1 video" : `${n} videos`;
}

function countsFromMetadata(meta) {
  return (meta?.metadataRows || [])
    .flatMap((row) => (row.metadataParts || []).map((part) => videoCountLabel(part.text)))
    .find(Boolean) || "";
}

function badgeCountFrom(root, depth = 0) {
  if (!root || typeof root !== "object" || depth > 10) return "";
  const labeled =
    videoCountLabel(root.thumbnailBadgeViewModel?.text) ||
    videoCountLabel(root.thumbnailOverlayBadgeViewModel?.thumbnailBadges) ||
    videoCountLabel(root.thumbnailOverlayBottomPanelRenderer?.text) ||
    videoCountLabel(root.text);
  if (labeled) return labeled;
  for (const value of Object.values(root)) {
    if (value && typeof value === "object") {
      const found = badgeCountFrom(value, depth + 1);
      if (found) return found;
    }
  }
  return "";
}

function playlistCountFromRenderer(renderer) {
  if (!renderer) return "";
  const metadata = renderer.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel;
  return (
    videoCountLabel(renderer.videoCount) ||
    videoCountLabel(renderer.videoCountShortText) ||
    videoCountLabel(renderer.videoCountText) ||
    countsFromMetadata(metadata) ||
    badgeCountFrom(renderer.thumbnailOverlays) ||
    badgeCountFrom(renderer.contentImage) ||
    badgeCountFrom(renderer.thumbnailRenderer) ||
    ""
  );
}

function playlistCountFromBrowse(data) {
  const header = data?.header?.playlistHeaderRenderer;
  const pageMeta = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata?.contentMetadataViewModel;
  const sidebar = data?.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer;
  return (
    videoCountLabel(header?.numVideosText) ||
    videoCountLabel(header?.briefStats) ||
    countsFromMetadata(pageMeta) ||
    videoCountLabel(sidebar?.stats) ||
    badgeCountFrom(data?.header?.pageHeaderRenderer) ||
    badgeCountFrom(header) ||
    ""
  );
}

function playlistDurationFromBrowse(data) {
  const header = data?.header?.playlistHeaderRenderer;
  const pageMeta = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata?.contentMetadataViewModel;
  const sidebar = data?.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer;
  const seconds =
    durationFromNode(header?.briefStats) ||
    durationFromNode(header?.stats) ||
    durationFromNode(pageMeta) ||
    durationFromNode(sidebar?.stats) ||
    durationFromNode(data?.header);
  return formatPlaylistDuration(seconds);
}

function playlistDurationFromRenderer(renderer) {
  if (!renderer) return "";
  const metadata = renderer.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel;
  const seconds =
    durationFromNode(renderer.playlistInfo) ||
    durationFromNode(metadata) ||
    durationFromNode(renderer.videoCountShortText) ||
    durationFromNode(renderer.publishedTimeText);
  return formatPlaylistDuration(seconds);
}

function extractPlaylistContinuation(payload) {
  let token = "";
  const visit = (node) => {
    if (!node || typeof node !== "object" || token) return;
    const contents = node.itemSectionRenderer?.contents || node.playlistVideoListRenderer?.contents;
    if (Array.isArray(contents)) {
      for (const item of contents) {
        const next = item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
        if (next) token = next;
      }
    }
    for (const value of Object.values(node)) {
      if (token) return;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(payload);
  return token;
}

function keepPlaylistVideos(videos, includeShorts = false) {
  return videos
    .filter(looksPlayable)
    .filter((video) => includeShorts || !isShort(video))
    .map((video) => withCategory(video, "playlist"));
}

function extractPlaylists(payload) {
  const playlists = [];
  const seen = new Set();

  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    const renderer = node.playlistRenderer || node.compactPlaylistRenderer || node.gridPlaylistRenderer || node.lockupViewModel;
    const rendererId = playlistIdFrom(
      renderer?.playlistId ||
        renderer?.contentId ||
        node.playlistId ||
        node.watchEndpoint?.playlistId ||
        node.navigationEndpoint?.watchEndpoint?.playlistId ||
        "",
    );
    if (renderer && rendererId && !seen.has(rendererId)) {
      seen.add(rendererId);
      const metadata = renderer.metadata?.lockupMetadataViewModel;
      const thumbs = renderer.thumbnails?.[0]?.thumbnails || renderer.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails || [];
      const lockupThumb = renderer.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url || "";
      playlists.push({
        id: rendererId,
        title: renderer.title?.simpleText || renderer.title?.runs?.map((run) => run.text).join("") || metadata?.title?.content || "Playlist",
        channel: renderer.shortBylineText?.runs?.[0]?.text || renderer.ownerText?.runs?.[0]?.text || metadata?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || "",
        channelThumb: pickChannelThumb(renderer) || pickChannelThumb(metadata) || pickChannelThumb(metadata?.image),
        count: playlistCountFromRenderer(renderer),
        duration: playlistDurationFromRenderer(renderer),
        thumb: thumbs.slice(-1)[0]?.url || lockupThumb,
        category: inferCategory(renderer.title?.simpleText || metadata?.title?.content || ""),
      });
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };

  visit(payload);
  return playlists;
}

function collectPlaylistVideoIds(node, ids = new Set(), depth = 0) {
  if (!node || typeof node !== "object" || depth > 12) return ids;
  const videoId = node.videoId || node.playlistPanelVideoRenderer?.videoId || node.watchEndpoint?.videoId;
  if (typeof videoId === "string" && videoId.length === 11) ids.add(videoId);
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collectPlaylistVideoIds(value, ids, depth + 1);
  }
  return ids;
}

function isCoursePlaylistId(id) {
  return /^(PL|OLAK5uy_)[\w-]+$/.test(id);
}

function extractWatchCourses(payload, videoId) {
  const courses = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    const panel = node.playlist && node.playlist.playlistId ? node.playlist : null;
    const id = playlistIdFrom(panel?.playlistId || "");
    if (panel && id && isCoursePlaylistId(id) && !seen.has(id)) {
      const memberIds = collectPlaylistVideoIds(panel);
      const inPlaylist = memberIds.has(videoId) || Number.isFinite(Number(panel.currentIndex));
      if (inPlaylist) {
        seen.add(id);
        courses.push({
          id,
          title: nodeText(panel.title) || "Course",
          channel: nodeText(panel.ownerName) || nodeText(panel.shortBylineText) || nodeText(panel.longBylineText) || "",
          count:
            typeof panel.totalVideos === "number"
              ? panel.totalVideos === 1 ? "1 video" : `${panel.totalVideos} videos`
              : videoCountLabel(panel.totalVideos),
          duration: "",
          thumb: "",
          category: inferCategory(nodeText(panel.title)),
          index: Number.isFinite(Number(panel.currentIndex)) ? Number(panel.currentIndex) + 1 : 0,
        });
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(payload);
  return courses;
}

function extractLinkedPlaylists(payload) {
  const found = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    const label = node.content || node.text?.content || "";
    const looksLink = /playlist|full course/i.test(label);
    const blob = looksLink ? JSON.stringify(node) : "";
    const fromUrl = playlistIdFrom((blob.match(/[?&]list=([^&"\\]+)/) || [])[1] || "");
    const fromBrowse = looksLink
      ? playlistIdFrom(node.browseEndpoint?.browseId || node.playlistId || node.watchEndpoint?.playlistId || "")
      : "";
    const id = fromUrl || fromBrowse;
    if (id && isCoursePlaylistId(id) && !seen.has(id)) {
      seen.add(id);
      found.push({
        id,
        title: /full (playlist|course)/i.test(label) ? "" : nodeText(label) || "",
        channel: "",
        count: "",
        duration: "",
        thumb: "",
        category: "",
        kind: /course/i.test(label) ? "course" : "playlist",
        linked: /full (playlist|course)/i.test(label),
      });
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(payload);
  return found;
}

function extractSuperTitleCourses(payload) {
  const found = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    const superTitle = node.superTitleLink || node.superTitleText;
    for (const run of superTitle?.runs || []) {
      const url = run.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || "";
      const id = playlistIdFrom(
        (url.match(/[?&]list=([^&]+)/) || [])[1] ||
          run.navigationEndpoint?.browseEndpoint?.browseId ||
          run.navigationEndpoint?.watchEndpoint?.playlistId ||
          "",
      );
      if (id && isCoursePlaylistId(id) && !seen.has(id)) {
        seen.add(id);
        const title = nodeText(run.text) || nodeText(superTitle) || "Course";
        found.push({
          id,
          title,
          channel: "",
          count: "",
          duration: "",
          thumb: "",
          category: inferCategory(title),
          kind: "course",
        });
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(payload);
  return found;
}

function extractCourseLessonCount(payload) {
  let count = "";
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    const summary = node.courseProgressViewModel?.progressSummary?.content || "";
    const match = summary.match(/(\d+)\s+lessons/i);
    if (match) count = `${match[1]} videos`;
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(payload);
  return count;
}

async function findCoursesForVideo(videoId) {
  const next = await innertube("next", { videoId });
  if (!next) return [];
  const titled = extractSuperTitleCourses(next);
  const panel = extractWatchCourses(next, videoId);
  const linked = extractLinkedPlaylists(next).filter((item) => item.linked);
  const listed = extractPlaylists(next);
  const lessonCount = extractCourseLessonCount(next);
  const byId = new Map();
  for (const item of [...titled, ...panel, ...listed, ...linked]) {
    if (!isCoursePlaylistId(item.id)) continue;
    const prev = byId.get(item.id) || {};
    byId.set(item.id, {
      ...prev,
      ...item,
      title: item.title && item.title !== "Playlist" ? item.title : prev.title || item.title || "Course",
      channel: item.channel || prev.channel || "",
      count: item.count || prev.count || lessonCount || "",
      thumb: item.thumb || prev.thumb || "",
      category: item.category || prev.category || inferCategory(item.title || prev.title || ""),
      kind: item.kind || prev.kind || (titled.some((course) => course.id === item.id) ? "course" : "playlist"),
    });
  }
  const order = titled.length
    ? titled.map((item) => item.id)
    : [...new Set([...panel.map((item) => item.id), ...linked.map((item) => item.id)])];
  return order.map((id) => byId.get(id)).filter(Boolean).slice(0, 3);
}

async function searchPlaylists(topic, page = 1) {
  const variants = [
    `${topic} full course playlist`,
    `${topic} beginner course playlist`,
    `${topic} complete course`,
    `${topic} lecture series playlist`,
    `${topic} tutorial playlist`,
  ];
  const query = `${variants[(page - 1) % variants.length]}${page > variants.length ? ` ${page}` : ""}`;
  const key = `playlists:${query}:${page}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < SEARCH_TTL_MS) return cached.results;

  const data = await innertube("search", { query, params: "EgIQAw==" });
  let playlists = data ? extractPlaylists(data) : [];
  if (!playlists.length) {
    const unfiltered = await innertube("search", { query });
    playlists = unfiltered ? extractPlaylists(unfiltered) : [];
  }
  if (!playlists.length) {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const res = await fetch(
          `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=playlist&page=${page}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) continue;
        const items = await res.json();
        playlists = (Array.isArray(items) ? items : [])
          .filter((item) => item.playlistId)
          .map((item) => ({
            id: item.playlistId,
            title: item.title,
            channel: item.author || "",
            channelThumb: bestThumbUrl(item.authorThumbnails),
            count: typeof item.videoCount === "number" && item.videoCount > 0
              ? item.videoCount === 1 ? "1 video" : `${item.videoCount} videos`
              : videoCountLabel(item.videoCount),
            duration: "",
            thumb: item.playlistThumbnail || "",
            category: inferCategory(item.title),
          }));
        if (playlists.length) break;
      } catch {
        // next instance
      }
    }
  }

  playlists = playlists
    .filter((playlist) => playlist.id && playlist.title && playlist.title !== "Playlist")
    .filter((playlist) => !NON_TECH.some((term) => `${playlist.title} ${playlist.channel}`.toLowerCase().includes(term)))
    .slice(0, 12);
  if (playlists.length) searchCache.set(key, { results: playlists, ts: Date.now() });
  return playlists;
}

async function playlistVideos(playlistId, includeShorts = false, continuation = "") {
  const key = continuation
    ? `plist:${playlistId}:c:${continuation.slice(0, 32)}:shorts:${includeShorts ? 1 : 0}`
    : `plist:${playlistId}:shorts:${includeShorts ? 1 : 0}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < SEARCH_TTL_MS) return cached.results;

  const data = continuation
    ? await innertube("browse", { continuation })
    : await innertube("browse", { browseId: `VL${playlistId}` });
  const author =
    data?.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text ||
    data?.metadata?.playlistMetadataRenderer?.owner ||
    "";
  const headerCount = playlistCountFromBrowse(data);
  const headerDuration = playlistDurationFromBrowse(data);
  const nextContinuation = extractPlaylistContinuation(data);
  const videos = extractInnerTubeVideos(data).map((video) => ({
    ...withCategory(video, "playlist"),
    channel: video.channel || author,
  }));
  const filtered = keepPlaylistVideos(videos, includeShorts);
  if (filtered.length) {
    const payload = {
      results: filtered,
      count: headerCount,
      duration: headerDuration || formatPlaylistDuration(sumVideoDurations(filtered)),
      continuation: nextContinuation,
      hasMore: Boolean(nextContinuation),
    };
    searchCache.set(key, { results: payload, ts: Date.now() });
    return payload;
  }

  const instance = INVIDIOUS_INSTANCES[0];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${instance}/api/v1/playlists/${playlistId}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const body = await res.json();
      const mapped = (body.videos || []).map((item) => ({
        id: item.videoId,
        title: item.title,
        channel: item.author || body.author || "",
        channelThumb: bestThumbUrl(item.authorThumbnails),
        duration: formatDuration(item.lengthSeconds),
        views: formatViews(item.viewCount),
        posted: item.publishedText || "",
        category: inferCategory(item.title),
        short: Number(item.lengthSeconds) > 0 && Number(item.lengthSeconds) <= 60,
      }));
      const fallback = keepPlaylistVideos(mapped, includeShorts);
      const count =
        (typeof body.videoCount === "number" && body.videoCount > 0
          ? body.videoCount === 1 ? "1 video" : `${body.videoCount} videos`
          : videoCountLabel(body.videoCount)) ||
        headerCount ||
        "";
      const payload = {
        results: fallback,
        count,
        duration: headerDuration || formatPlaylistDuration(sumVideoDurations(fallback)),
        continuation: "",
        hasMore: false,
      };
      searchCache.set(key, { results: payload, ts: Date.now() });
      return payload;
    }
  } catch {
    // empty
  }
  return {
    results: [],
    count: headerCount || "",
    duration: headerDuration || "",
    continuation: nextContinuation || "",
    hasMore: Boolean(nextContinuation),
  };
}

async function searchInnerTube(query, page = 1) {
  const data = await innertube("search", { query: page > 1 ? `${query} ${page}` : query });
  if (!data) return null;
  const videos = extractInnerTubeVideos(data).map((video) => withCategory(video, query));
  return videos.length ? videos : null;
}

async function searchRaw(query, page = 1) {
  const inner = await searchInnerTube(query, page);
  if (inner?.length) return inner;
  return (await searchInvidious(query, page)) || [];
}

async function searchVideos(query, page = 1, includeShorts = false) {
  const key = `search:${query}:${page}:shorts:${includeShorts ? 1 : 0}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < SEARCH_TTL_MS) return cached.results;

  const results = filterPlayable(await searchRaw(query, page), 16, query, false, includeShorts);
  searchCache.set(key, { results, ts: Date.now() });
  return results;
}

async function randomVideos(excludeIds = [], page = 1, includeShorts = false, topicHint = "") {
  const collected = [];
  const seen = new Set(excludeIds);
  const bank = topicsForHint(topicHint);
  const flavors = ["", "lecture", "explained", "talk", "course"];
  const start = ((Math.max(1, page) - 1) * 3) % bank.length;
  const queries = [0, 1, 2].map((attempt) => {
    const topic = bank[(start + attempt) % bank.length];
    const flavor = flavors[(Math.max(1, page) - 1 + attempt) % flavors.length];
    return flavor ? `${topic} ${flavor}` : topic;
  });

  const batches = await Promise.all(queries.map((query) => searchRaw(query, 1)));
  for (const raw of batches) {
    for (const video of shuffle(raw)) {
      if (seen.has(video.id) || !looksPlayable(video) || !isTechVideo(video)) continue;
      if (!includeShorts && isShort(video)) continue;
      seen.add(video.id);
      collected.push(withCategory(video, video.category || topicHint));
      if (collected.length >= 12) break;
    }
    if (collected.length >= 12) break;
  }

  return collected;
}

const RELATED_STOP = new Set([
  "this", "that", "these", "those", "with", "from", "your", "you", "why", "how",
  "what", "when", "where", "who", "the", "and", "for", "are", "was", "were",
  "is", "its", "it's", "into", "over", "under", "about", "just", "very",
  "awesome", "amazing", "official", "video", "full", "part", "episode",
  "lecture", "series", "introduction", "intro", "tutorial", "explained",
  "course", "watch", "new", "best", "really", "still",
]);

function relatedTokens(title) {
  return [
    ...new Set(
      String(title || "")
        .toLowerCase()
        .replace(/[^a-z0-9+#.\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 2 && !RELATED_STOP.has(word)),
    ),
  ].slice(0, 8);
}

function relatedScore(video, source) {
  const tokens = relatedTokens(source.title);
  const hay = `${video.title || ""} ${video.channel || ""}`.toLowerCase();
  let score = 0;
  if (source.channel && video.channel && source.channel.trim().toLowerCase() === video.channel.trim().toLowerCase()) {
    score += 10;
  }
  for (const token of tokens) {
    if (hay.includes(token)) score += token.length > 3 ? 4 : 2;
  }
  return score;
}

function relatedQueries(title, channel, page = 1) {
  const tokens = relatedTokens(title);
  const cleaned = tokens.join(" ");
  const queries = [];
  if (cleaned) queries.push(cleaned);
  if (title) queries.push(String(title).replace(/[|]/g, " ").slice(0, 90));
  if (channel && tokens.length) queries.push(`${channel} ${tokens.slice(0, 3).join(" ")}`);
  if (tokens.length >= 2) queries.push(tokens.slice(0, 4).join(" "));
  const start = Math.max(0, (Math.max(1, page) - 1) * 2);
  const slice = queries.slice(start, start + 3);
  return slice.length ? slice : queries.slice(0, 2);
}

async function relatedVideos(source, excludeIds = [], page = 1, includeShorts = false) {
  const id = (source.id || "").trim();
  const title = (source.title || "").trim();
  const channel = (source.channel || "").trim();
  const key = `related:${id}:${title}:${channel}:${page}:shorts:${includeShorts ? 1 : 0}:${excludeIds.join(",")}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < SEARCH_TTL_MS) return cached.results;

  const seen = new Set([id, ...excludeIds].filter(Boolean));
  const queries = relatedQueries(title, channel, page);
  const [fromNext, ...searches] = await Promise.all([
    page === 1 && id ? innertube("next", { videoId: id }).then((data) => (data ? extractInnerTubeVideos(data) : [])) : Promise.resolve([]),
    ...queries.map((query) => searchRaw(query, 1)),
  ]);

  const ranked = [];
  for (const video of [...fromNext, ...searches.flat()]) {
    if (!video?.id || seen.has(video.id) || !looksPlayable(video)) continue;
    if (!includeShorts && isShort(video)) continue;
    const junk = `${video.title || ""} ${video.channel || ""}`.toLowerCase();
    if (NON_TECH.some((term) => junk.includes(term))) continue;
    seen.add(video.id);
    ranked.push({
      video: withCategory(video, title || channel),
      score: relatedScore(video, { title, channel }),
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  const scored = ranked.filter((item) => item.score > 0).map((item) => item.video);
  const neighbors = ranked.filter((item) => item.score === 0).map((item) => item.video);
  const results = [...scored, ...neighbors].slice(0, 12);
  searchCache.set(key, { results, ts: Date.now() });
  return results;
}

const QUERY_BANK = [
  "ai for security",
  "ai security",
  "ai for beginners",
  "machine learning",
  "neural networks",
  "large language models",
  "kubernetes explained",
  "docker tutorial",
  "rust programming",
  "linux kernel",
  "cyber security",
  "web security",
  "sql injection",
  "how https works",
  "cpu architecture",
  "git explained",
  "transformers llm",
  "python tutorial",
  "devops ci cd",
  "open source",
  "compiler design",
  "computer networking",
  "how to make robots",
  "robotics tutorial",
  "build a robot",
];

function normalizeQuery(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(\w+)(?: \1)+\b/g, "$1");
}

function predictQueries(input) {
  const q = normalizeQuery(input);
  if (q.length < 2) return [];
  const words = new Set(q.split(" "));

  const scored = QUERY_BANK.filter((item) => item !== q)
    .map((item) => {
      let score = 0;
      if (item.startsWith(q)) score += 4;
      else if (item.includes(q)) score += 3;
      else if (q.split(" ").every((word) => word && item.includes(word))) score += 2;
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  const extras = ["tutorial", "explained", "course", "for beginners"]
    .filter((suffix) => !suffix.split(" ").some((word) => words.has(word)))
    .map((suffix) => `${q} ${suffix}`);

  return [...new Set([q, ...scored, ...extras].map(normalizeQuery))].slice(0, 4);
}

async function predictiveFetch(input, includeShorts = false) {
  const suggestions = predictQueries(input);
  const entries = await Promise.all(
    suggestions.map(async (suggestion) => [suggestion, await searchVideos(suggestion, 1, includeShorts)]),
  );
  return {
    suggestions,
    results: Object.fromEntries(entries),
  };
}

const transcriptCache = new Map();
const TRANSCRIPT_TTL_MS = 30 * 60 * 1000;

function decodeCaptionText(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCaptionPayload(raw) {
  const segments = [];
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { text: "", segments };

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      for (const event of json.events || []) {
        const text = (event.segs || []).map((seg) => seg.utf8 || "").join("").replace(/\n+/g, " ").trim();
        if (text) segments.push({ start: Math.floor((event.tStartMs || 0) / 1000), text: decodeCaptionText(text) });
      }
    } catch {
      // fall through to xml
    }
  }

  if (!segments.length) {
    const matches = trimmed.matchAll(/<text[^>]*start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g);
    for (const match of matches) {
      const text = decodeCaptionText(match[2]);
      if (text) segments.push({ start: Math.floor(Number(match[1]) || 0), text });
    }
  }

  return { text: segments.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim(), segments };
}

async function fetchCaptionTrack(url, extraHeaders = {}) {
  const variants = [url.includes("fmt=") ? url : `${url}${url.includes("?") ? "&" : "?"}fmt=json3`, url];
  for (const href of variants) {
    try {
      const res = await fetch(href, {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*", Referer: "https://www.youtube.com/", ...extraHeaders },
      });
      if (!res.ok) continue;
      const parsed = parseCaptionPayload(await res.text());
      if (parsed.text) return parsed;
    } catch {
      // next
    }
  }
  return null;
}

async function watchPlayerResponse(videoId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|<\/script>)/s);
    if (!match) return null;
    return JSON.parse(match[1]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function captionTracksFromPlayer(player) {
  return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
}

function findEndpointParams(node, key, found = { value: "" }) {
  if (!node || typeof node !== "object" || found.value) return found.value;
  if (node[key]?.params) found.value = node[key].params;
  for (const value of Object.values(node)) {
    if (found.value) return found.value;
    if (value && typeof value === "object") findEndpointParams(value, key, found);
  }
  return found.value;
}

function commentAvatarUrl(node) {
  if (!node || typeof node !== "object") return "";
  const direct = absThumbUrl(node.author?.avatarThumbnailUrl || node.avatarThumbnailUrl || "");
  if (direct) return direct;
  return (
    bestThumbUrl(node.authorThumbnail?.thumbnails) ||
    bestThumbUrl(node.authorPhoto?.thumbnails) ||
    bestThumbUrl(node.author?.avatarThumbnail?.image?.sources) ||
    bestThumbUrl(node.author?.avatar?.image?.sources) ||
    bestThumbUrl(node.author?.thumbnail?.thumbnails) ||
    bestThumbUrl(node.avatarThumbnail?.image?.sources) ||
    bestThumbUrl(node.avatar?.image?.sources) ||
    pickChannelThumb(node) ||
    ""
  );
}

function pushComment(comments, item, limit) {
  const text = String(item.text || "").replace(/\s+/g, " ").trim();
  const author = String(item.author || "").trim() || "YouTube";
  if (!text || comments.length >= limit) return;
  const avatar = item.avatar ? String(item.avatar) : "";
  const existing = comments.find((comment) => comment.text === text && comment.author === author);
  if (existing) {
    if (!existing.avatar && avatar) existing.avatar = avatar;
    return;
  }
  comments.push({
    author,
    text: text.slice(0, 480),
    likes: item.likes ? String(item.likes) : "",
    posted: item.posted ? String(item.posted) : "",
    avatar,
  });
}

function collectComments(node, comments = [], limit = 24) {
  if (!node || typeof node !== "object" || comments.length >= limit) return comments;
  const thread = node.commentThreadRenderer?.comment?.commentRenderer || node.commentRenderer;
  if (thread?.contentText) {
    pushComment(comments, {
      author: thread.authorText?.simpleText || thread.authorText?.runs?.[0]?.text || "",
      text: thread.contentText.runs?.map((run) => run.text).join("") || thread.contentText.simpleText || "",
      likes: thread.voteCount?.simpleText || thread.voteCount?.runs?.[0]?.text || "",
      posted: thread.publishedTimeText?.simpleText || thread.publishedTimeText?.runs?.[0]?.text || "",
      avatar: commentAvatarUrl(thread),
    }, limit);
  }
  const entity = node.commentEntityPayload;
  if (entity?.properties?.content?.content) {
    pushComment(comments, {
      author: entity.author?.displayName || "",
      text: entity.properties.content.content,
      likes: entity.toolbar?.likeCountNotliked || entity.toolbar?.likeCountLiked || "",
      posted: entity.properties?.publishedTime || "",
      avatar: commentAvatarUrl(entity),
    }, limit);
  }
  const view = node.commentViewModel;
  const viewText = view?.comment?.content?.content || view?.properties?.content?.content || view?.content?.content;
  if (viewText) {
    pushComment(comments, {
      author: view.author?.displayName || view.comment?.author?.displayName || "",
      text: viewText,
      likes: view.toolbar?.likeCountNotliked || view.likeCountLiked || "",
      posted: view.publishedTime || view.comment?.publishedTime || "",
      avatar: commentAvatarUrl(view) || commentAvatarUrl(view.comment),
    }, limit);
  }
  for (const value of Object.values(node)) {
    if (comments.length >= limit) break;
    if (value && typeof value === "object") collectComments(value, comments, limit);
  }
  return comments;
}

function cleanDescription(raw) {
  let text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if ((text.match(/\n/g) || []).length < 2) {
    text = text.replace(/[ \t]+(?=(?:\d{1,2}:)?\d{1,2}:\d{2}\b)/g, "\n");
  }
  return text;
}

async function invidiousDetails(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const [videoRes, commentRes] = await Promise.all([
        fetch(`${instance}/api/v1/videos/${videoId}`, { headers: { Accept: "application/json" }, signal: controller.signal }),
        fetch(`${instance}/api/v1/comments/${videoId}`, { headers: { Accept: "application/json" }, signal: controller.signal }),
      ]);
      const video = videoRes.ok ? await videoRes.json() : null;
      const commentData = commentRes.ok ? await commentRes.json() : null;
      const description = cleanDescription(video?.description || video?.descriptionHtml || "");
      const comments = Array.isArray(commentData?.comments)
        ? commentData.comments.slice(0, 24).map((item) => ({
            author: item.author || "YouTube",
            text: String(item.content || "").replace(/\s+/g, " ").trim().slice(0, 480),
            likes: item.likeCount ? String(item.likeCount) : "",
            posted: item.publishedText || "",
            avatar: bestThumbUrl(item.authorThumbnails),
          })).filter((item) => item.text)
        : [];
      const likes = formatViews(video?.likeCount);
      if (description || comments.length || likes) return { description, comments, likes };
    } catch {
      // try next instance
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function extractLikes(payload) {
  let likes = "";
  const visit = (node, depth = 0) => {
    if (likes || !node || typeof node !== "object" || depth > 16) return;
    if (node.commentRenderer || node.commentThreadRenderer || node.commentViewModel) return;
    if (typeof node.likeCount === "number" && node.likeCount > 0) {
      likes = formatViews(node.likeCount);
      return;
    }
    if (typeof node.likeCount === "string" && /\d/.test(node.likeCount)) {
      likes = formatViews(node.likeCount);
      return;
    }
    const fact = node.factoidRenderer;
    if (fact && /like/i.test(`${fact.label?.simpleText || ""} ${fact.accessibilityText || ""}`)) {
      likes = formatViews(fact.value?.simpleText || fact.factoidA11yText || "");
      return;
    }
    const label = node.accessibility?.accessibilityData?.label || node.accessibilityText || "";
    if (/[\d,.]+/.test(label) && /\blikes?\b/i.test(label) && !/comment/i.test(label)) {
      const match = label.match(/([\d,.]+(?:\.\d+)?\s*[kmb]?)\s*likes?/i);
      if (match) likes = formatViews(match[1]);
      return;
    }
    for (const value of Object.values(node)) {
      if (likes) return;
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(payload);
  return likes;
}

const detailsCache = new Map();
const DETAILS_TTL_MS = 20 * 60 * 1000;

function findCommentToken(node, found = { value: "" }, inComments = false) {
  if (!node || typeof node !== "object" || found.value) return found.value;
  const title = node.simpleText || node.title?.simpleText || node.header?.engagementPanelTitleHeaderRenderer?.title?.simpleText || "";
  const target = String(node.targetId || node.panelIdentifier || node.identifier || "");
  const commentsHere = inComments || /comment/i.test(`${title} ${target}`);
  const token =
    node.continuationCommand?.token ||
    node.reloadContinuationData?.continuation ||
    node.nextContinuationData?.continuation ||
    "";
  if (token && commentsHere) found.value = token;
  for (const value of Object.values(node)) {
    if (found.value) return found.value;
    if (value && typeof value === "object") findCommentToken(value, found, commentsHere);
  }
  return found.value;
}

const channelLogoCache = new Map();

function extractChannelLogo(payload) {
  let url = "";
  const visit = (node, depth = 0) => {
    if (url || !node || typeof node !== "object" || depth > 12) return;
    const channel = node.channelRenderer || node.gridChannelRenderer || node.compactChannelRenderer;
    if (channel) {
      url =
        bestThumbUrl(channel.thumbnail?.thumbnails) ||
        pickChannelThumb(channel) ||
        "";
    }
    if (!url) url = pickChannelThumb(node);
    if (url) return;
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(payload);
  return url;
}

async function lookupChannelLogo(name) {
  const key = name.trim().toLowerCase();
  if (!key) return "";
  const cached = channelLogoCache.get(key);
  if (cached && Date.now() - cached.ts < DETAILS_TTL_MS) return cached.url;

  const inner = await innertube("search", { query: name });
  let url = extractChannelLogo(inner);
  if (!url) {
    for (const instance of INVIDIOUS_INSTANCES.slice(0, 2)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(
          `${instance}/api/v1/search?q=${encodeURIComponent(name)}&type=channel`,
          { headers: { Accept: "application/json" }, signal: controller.signal },
        );
        if (!res.ok) continue;
        const data = await res.json();
        const channel = Array.isArray(data) ? data.find((item) => item?.authorThumbnails) : null;
        url = bestThumbUrl(channel?.authorThumbnails);
        if (url) break;
      } catch {
        // next
      } finally {
        clearTimeout(timer);
      }
    }
  }

  channelLogoCache.set(key, { url: url || "", ts: Date.now() });
  return url || "";
}

async function videoDetails(videoId) {
  const cached = detailsCache.get(videoId);
  if (cached && Date.now() - cached.ts < DETAILS_TTL_MS) return cached;

  const [watchPage, next, player] = await Promise.all([
    watchPlayerResponse(videoId),
    innertube("next", { videoId }),
    innertube("player", { videoId }),
  ]);
  const watch = watchPage || player;

  let comments = collectComments(next);
  if (!comments.length) {
    const token = findCommentToken(next);
    if (token) {
      const more = await innertube("next", { continuation: token });
      comments = collectComments(more);
    }
  }
  if (!comments.length) {
    const android = await innertube("next", { videoId }, "ANDROID");
    comments = collectComments(android);
    if (!comments.length) {
      const token = findCommentToken(android);
      if (token) comments = collectComments(await innertube("next", { continuation: token }, "ANDROID"));
    }
  }

  let likes = extractLikes(watch) || extractLikes(next);

  let description = cleanDescription(
    watch?.videoDetails?.shortDescription ||
      watch?.microformat?.playerMicroformatRenderer?.description?.simpleText ||
      nextWriteup(next) ||
      "",
  );

  if (!description || !comments.length) {
    const inv = await Promise.race([
      invidiousDetails(videoId),
      new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    if (!description) description = cleanDescription(inv?.description || "");
    if (!comments.length) comments = inv?.comments || [];
    if (!likes) likes = inv?.likes || "";
  }

  const payload = { description, comments, likes: likes || "", ts: Date.now() };
  if (description || comments.length || likes) detailsCache.set(videoId, payload);
  return payload;
}

const metaCache = new Map();

async function videoPublicMeta(videoId) {
  const cached = metaCache.get(videoId);
  if (cached && Date.now() - cached.ts < DETAILS_TTL_MS) return cached;
  const watch = (await watchPlayerResponse(videoId)) || (await innertube("player", { videoId }));
  const views = formatViews(watch?.videoDetails?.viewCount);
  const posted = postedFromIso(
    watch?.microformat?.playerMicroformatRenderer?.publishDate ||
      watch?.microformat?.playerMicroformatRenderer?.uploadDate ||
      "",
  );
  const payload = { views, posted, ts: Date.now() };
  if (views || posted) metaCache.set(videoId, payload);
  return payload;
}

function collectTranscriptSegments(node, segments = []) {
  if (!node || typeof node !== "object") return segments;
  const renderer = node.transcriptSegmentRenderer;
  const text = renderer?.snippet?.runs?.map((run) => run.text).join("") || renderer?.snippet?.simpleText || "";
  if (text) {
    const start = Number(renderer.startMs || renderer.startTimeMs || 0);
    segments.push({ start: Math.floor((Number.isFinite(start) ? start : 0) / 1000), text: decodeCaptionText(text) });
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collectTranscriptSegments(value, segments);
  }
  return segments;
}

function nextWriteup(next) {
  const parts = [];
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 14) return;
    const attributed = node.attributedDescription?.content || node.videoSecondaryInfoRenderer?.attributedDescription?.content;
    if (typeof attributed === "string" && attributed.trim().length > 40) parts.push(attributed.trim());
    const chapter = node.macroMarkersListItemRenderer;
    if (chapter?.title?.simpleText && chapter?.timeDescription?.simpleText) {
      parts.push(`${chapter.timeDescription.simpleText} ${chapter.title.simpleText}`);
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(next);
  return [...new Set(parts)].join("\n\n");
}

async function innertubeTranscript(videoId) {
  const next = await innertube("next", { videoId });
  if (!next) return null;
  let params = findEndpointParams(next, "getTranscriptEndpoint");
  if (params) {
    try {
      params = decodeURIComponent(params);
    } catch {
      // already decoded
    }
    const data = await innertube("get_transcript", { params });
    const segments = collectTranscriptSegments(data);
    if (segments.length) {
      return {
        text: segments.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim(),
        segments,
        source: "transcript",
      };
    }
  }
  const writeup = nextWriteup(next);
  if (writeup.length > 40) return { text: writeup, segments: [], source: "description" };
  return null;
}

async function videoTranscript(videoId) {
  const cached = transcriptCache.get(videoId);
  if (cached && Date.now() - cached.ts < TRANSCRIPT_TTL_MS) return cached;

  const watch = await watchPlayerResponse(videoId);
  const fromWatch = captionTracksFromPlayer(watch);
  const tracks = fromWatch.length ? fromWatch : captionTracksFromPlayer(await innertube("player", { videoId }));
  const preferred =
    tracks.find((track) => /^en/i.test(track.languageCode || "") && !track.kind) ||
    tracks.find((track) => /^en/i.test(track.languageCode || "")) ||
    tracks[0];
  const trackList = preferred ? [preferred, ...tracks.filter((track) => track !== preferred)] : tracks;
  for (const track of trackList) {
    if (!track?.baseUrl) continue;
    const parsed = await fetchCaptionTrack(track.baseUrl);
    if (parsed?.text) {
      const payload = { ...parsed, source: "transcript", ts: Date.now() };
      transcriptCache.set(videoId, payload);
      return payload;
    }
  }

  const fromNext = await innertubeTranscript(videoId);
  if (fromNext?.text) {
    const payload = { ...fromNext, ts: Date.now() };
    transcriptCache.set(videoId, payload);
    return payload;
  }

  const description = (
    watch?.videoDetails?.shortDescription ||
    watch?.microformat?.playerMicroformatRenderer?.description?.simpleText ||
    ""
  ).trim();
  if (description.length > 40) {
    const payload = { text: description, segments: [], source: "description", ts: Date.now() };
    transcriptCache.set(videoId, payload);
    return payload;
  }

  return { text: "", segments: [], source: "" };
}

function scoreChunk(question, text) {
  const words = String(question || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const hay = text.toLowerCase();
  if (!words.length) return 0;
  return words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
}

function relevantTranscript(question, transcript, limit = 9000) {
  const segments = transcript.segments?.length
    ? transcript.segments
    : transcript.text.split(/(?<=[.?!])\s+/).map((text) => ({ start: 0, text }));
  if (!segments.length) return "";
  const ranked = segments
    .map((item, index) => ({ index, score: scoreChunk(question, item.text), item }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .sort((a, b) => a.index - b.index);
  const picked = (ranked.length ? ranked.map((row) => row.item) : segments.slice(0, 40))
    .map((item) => item.text)
    .join(" ");
  return picked.slice(0, limit);
}

function topicAnswer(title, question, { mentionMissingCaptions = false } = {}) {
  const q = String(question || "").toLowerCase();
  const topic = String(title || "this topic").replace(/\s+/g, " ").trim();
  const note = mentionMissingCaptions ? "I could not hear this lecture, but I can still answer the question. " : "";

  if (/memor(y|ize|ise)|rote|by heart/.test(q) && /chart|table|graph|plot|figure|slide|z-?table/.test(q)) {
    return `${note}No. You do not need to memorize every chart in "${topic}". Learn the shape and how to reconstruct it: for a normal distribution that is the bell curve, center at the mean, spread from the standard deviation, the 68-95-99.7 rule, and how to use a z-score or calculator. Know how to read a table or graph, not every picture from the slides.`;
  }
  if (/memor(y|ize|ise)|rote|by heart/.test(q)) {
    return `${note}Usually no. For "${topic}", understand the idea and be able to use it in a problem. Memorize only a few core facts (definitions, the empirical rule, how z-scores work), not the whole lecture.`;
  }
  if (/summar|overview|what (is|does) this (lecture|video)/.test(q)) {
    return `${note}This video is titled "${topic}". A lecture with that name typically defines the idea, shows the main properties, and works examples. Ask about a specific piece (mean, variance, z-score, empirical rule) and I will explain that part.`;
  }
  if (/exam|test|quiz|important|need to know|will i need/.test(q)) {
    return `${note}For "${topic}", you are more likely to be tested on using the idea than on copying slides. Practice a few calculations and be able to explain the definition in your own words.`;
  }
  return `${note}Your question is about "${topic}": ${question.trim()} I do not have the spoken lecture, so I cannot quote the instructor. For this topic, focus on the definition, when to use it, and one worked example rather than memorizing visuals.`;
}

function extractiveAnswer(question, transcript) {
  const sentences = transcript.text.split(/(?<=[.?!])\s+/).filter((item) => item.length > 40);
  if (!sentences.length) return "I could not find enough spoken text in this video to answer that.";
  const ranked = sentences
    .map((text) => ({ text, score: scoreChunk(question, text) }))
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score > 0)
    .slice(0, 5)
    .map((row) => row.text);
  if (!ranked.length) {
    return `From the transcript, the lecture covers: ${sentences.slice(0, 3).join(" ")}`;
  }
  return ranked.join(" ");
}

async function askLanguageModel(title, question, context, history = []) {
  const system = `You are TechFocus Talk to AI, a study assistant. Answer the student's actual question. If a transcript is provided, prefer it. If there is no transcript, answer from the video title topic and general knowledge of that topic. Be concise and concrete. Do not repeat a captions warning if you already said it. Video title: ${title}`;
  const messages = [
    { role: "system", content: system },
    ...history.slice(-6).map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.text || "").slice(0, 1200),
    })),
    { role: "user", content: `Transcript:\n${context}\n\nQuestion: ${question}` },
  ];

  const groq = process.env.GROQ_API_KEY || "";
  const openai = process.env.OPENAI_API_KEY || "";
  const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
  const openrouter = process.env.OPENROUTER_API_KEY || "";

  try {
    if (groq) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groq}` },
        body: JSON.stringify({ model: "llama-3.1-8b-instant", messages, temperature: 0.2, max_tokens: 500 }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text.trim();
    }
    if (openai) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openai}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.2, max_tokens: 500 }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text.trim();
    }
    if (openrouter) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openrouter}` },
        body: JSON.stringify({ model: "meta-llama/llama-3.1-8b-instruct:free", messages, temperature: 0.2, max_tokens: 500 }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text.trim();
    }
    if (gemini) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${messages.filter((item) => item.role !== "system").map((item) => item.content).join("\n\n")}` }] }],
        }),
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("");
      if (text) return text.trim();
    }
  } catch {
    return "";
  }
  return "";
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function userStorePath(sub) {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, `${String(sub).replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

function shareIndexPath() {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, "_shares.json");
}

function readShareIndex() {
  const file = shareIndexPath();
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function rememberShare(shareId, sub) {
  const index = readShareIndex();
  if (index[shareId] === sub) return;
  index[shareId] = sub;
  writeFileSync(shareIndexPath(), JSON.stringify(index));
}

function ensureShareId(sub, store) {
  if (store.shareId) {
    rememberShare(store.shareId, sub);
    return store.shareId;
  }
  const shareId = randomBytes(6).toString("hex");
  rememberShare(shareId, sub);
  return shareId;
}

function readUserStore(sub) {
  const file = userStorePath(sub);
  if (!existsSync(file)) return { history: [], progress: {}, shareId: "" };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
      shareId: parsed.shareId || "",
    };
  } catch {
    return { history: [], progress: {}, shareId: "" };
  }
}

function writeUserStore(sub, data) {
  const previous = readUserStore(sub);
  const shareId = ensureShareId(sub, { shareId: data.shareId || previous.shareId });
  const next = {
    history: Array.isArray(data.history) ? data.history.slice(0, 30) : [],
    progress: data.progress && typeof data.progress === "object" ? data.progress : {},
    shareId,
    updatedAt: Date.now(),
  };
  writeFileSync(userStorePath(sub), JSON.stringify(next));
  return { history: next.history, progress: next.progress, shareId };
}

function findStoreByShareId(shareId) {
  if (!shareId) return null;
  const index = readShareIndex();
  let sub = index[shareId];
  if (!sub && existsSync(DATA_DIR)) {
    for (const name of readdirSync(DATA_DIR)) {
      if (!name.endsWith(".json") || name.startsWith("_")) continue;
      try {
        const parsed = JSON.parse(readFileSync(join(DATA_DIR, name), "utf8"));
        if (parsed.shareId === shareId) {
          sub = name.replace(/\.json$/, "");
          rememberShare(shareId, sub);
          break;
        }
      } catch {
        // skip
      }
    }
  }
  if (!sub) return null;
  return { sub, ...readUserStore(sub) };
}

async function verifyGoogleToken(token) {
  if (!token || !GOOGLE_CLIENT_ID) return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload.aud !== GOOGLE_CLIENT_ID) return null;
    if (payload.email_verified !== "true" && payload.email_verified !== true) return null;
    return {
      sub: payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email || "Google user",
      picture: payload.picture || "",
    };
  } catch {
    return null;
  }
}

export async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/api/search" || url.pathname === "/search")) {
    const query = (url.searchParams.get("q") || "").trim();
    if (!query) {
      sendJson(res, 400, { error: "Missing search query", results: [] });
      return;
    }

    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
    const includeShorts = url.searchParams.get("shorts") === "1";

    try {
      const intent = understandQuery(query);
      if (intent.mode === "playlist") {
        const playlists = await searchPlaylists(intent.topic, page);
        sendJson(res, 200, {
          mode: "playlist",
          intent,
          playlists,
          results: [],
          page,
          hasMore: playlists.length > 0,
        });
        return;
      }
      const results = await searchVideos(query, page, includeShorts);
      sendJson(res, 200, { mode: "video", intent, playlists: [], results, page, hasMore: results.length > 0 });
    } catch {
      sendJson(res, 500, { error: "Search failed. Stay on this site and try again.", results: [], playlists: [], hasMore: false });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/related" || url.pathname === "/related")) {
    const exclude = (url.searchParams.get("exclude") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
    const includeShorts = url.searchParams.get("shorts") === "1";

    try {
      const results = await relatedVideos(
        {
          id: (url.searchParams.get("id") || "").trim(),
          title: (url.searchParams.get("title") || "").trim(),
          channel: (url.searchParams.get("channel") || "").trim(),
        },
        exclude,
        page,
        includeShorts,
      );
      sendJson(res, 200, { results, page, hasMore: results.length > 0 });
    } catch {
      sendJson(res, 500, { error: "Recommendations failed.", results: [], hasMore: false });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/random" || url.pathname === "/random")) {
    const exclude = (url.searchParams.get("exclude") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
    const includeShorts = url.searchParams.get("shorts") === "1";
    const topicHint = (url.searchParams.get("topic") || "").trim();

    try {
      const results = await randomVideos(exclude, page, includeShorts, topicHint);
      sendJson(res, 200, { results, page, hasMore: results.length > 0 });
    } catch {
      sendJson(res, 500, { error: "Recommendations failed.", results: [], hasMore: false });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/available" || url.pathname === "/available")) {
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    try {
      const checks = await Promise.all(ids.map(async (id) => ({ id, ok: await checkAvailable(id) })));
      sendJson(res, 200, { ids: checks.filter((item) => item.ok).map((item) => item.id) });
    } catch {
      sendJson(res, 200, { ids });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/predict" || url.pathname === "/predict")) {
    const query = (url.searchParams.get("q") || "").trim();
    if (query.length < 2) {
      sendJson(res, 200, { suggestions: [], results: {} });
      return;
    }

    try {
      const includeShorts = url.searchParams.get("shorts") === "1";
      const intent = understandQuery(query);
      if (intent.mode === "playlist") {
        const playlists = await searchPlaylists(intent.topic);
        sendJson(res, 200, {
          query,
          mode: "playlist",
          intent,
          suggestions: [`${intent.topic} course`, `${intent.topic} for beginners`, `${intent.topic} explained`].filter((item, index, list) => list.indexOf(item) === index && item !== intent.query),
          results: {},
          playlists,
        });
        return;
      }
      const payload = await predictiveFetch(query, includeShorts);
      sendJson(res, 200, { query, mode: "video", intent, playlists: [], ...payload });
    } catch {
      sendJson(res, 500, { suggestions: [], results: {} });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/courses" || url.pathname === "/courses")) {
    const id = (url.searchParams.get("id") || "").trim();
    if (!id) {
      sendJson(res, 400, { courses: [], error: "Missing video id" });
      return;
    }
    try {
      const courses = await findCoursesForVideo(id);
      sendJson(res, 200, { courses });
    } catch {
      sendJson(res, 200, { courses: [] });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/playlist" || url.pathname === "/playlist")) {
    const id = (url.searchParams.get("id") || "").trim();
    const includeShorts = url.searchParams.get("shorts") === "1";
    const continuation = (url.searchParams.get("continuation") || "").trim();
    if (!id) {
      sendJson(res, 400, { error: "Missing playlist id", results: [] });
      return;
    }
    try {
      const payload = await playlistVideos(id, includeShorts, continuation);
      sendJson(res, 200, payload);
    } catch {
      sendJson(res, 500, { results: [] });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/auth/config" || url.pathname === "/auth/config")) {
    sendJson(res, 200, { clientId: GOOGLE_CLIENT_ID });
    return;
  }

  if (req.method === "POST" && (url.pathname === "/api/auth/google" || url.pathname === "/auth/google")) {
    const body = await readJsonBody(req);
    const user = await verifyGoogleToken(body.credential || body.token || "");
    if (!user) {
      sendJson(res, 401, { error: "Invalid Google sign-in" });
      return;
    }
    sendJson(res, 200, { user });
    return;
  }

  if ((req.method === "GET" || req.method === "PUT") && (url.pathname === "/api/sync" || url.pathname === "/sync")) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    const user = await verifyGoogleToken(token);
    if (!user) {
      sendJson(res, 401, { error: "Sign in again" });
      return;
    }
    if (req.method === "GET") {
      const store = readUserStore(user.sub);
      const shareId = ensureShareId(user.sub, store);
      if (!store.shareId) writeUserStore(user.sub, { ...store, shareId });
      sendJson(res, 200, { user, ...store, shareId });
      return;
    }
    const body = await readJsonBody(req);
    const next = writeUserStore(user.sub, {
      history: Array.isArray(body.history) ? body.history.slice(0, 30) : [],
      progress: body.progress && typeof body.progress === "object" ? body.progress : {},
    });
    sendJson(res, 200, { user, ...next });
    return;
  }

  const published = url.pathname.match(/^\/(?:api\/)?u\/([a-zA-Z0-9]+)$/);
  if (req.method === "GET" && published) {
    const store = findStoreByShareId(published[1]);
    if (!store) {
      sendJson(res, 404, { error: "History link not found", history: [] });
      return;
    }
    sendJson(res, 200, { shareId: store.shareId || published[1], history: store.history || [] });
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/transcript" || url.pathname === "/transcript")) {
    const id = (url.searchParams.get("id") || "").trim();
    if (!id) {
      sendJson(res, 400, { available: false, error: "Missing video id" });
      return;
    }
    try {
      const transcript = await videoTranscript(id);
      sendJson(res, 200, {
        available: Boolean(transcript.text),
        chars: transcript.text.length,
        source: transcript.source || (transcript.text ? "transcript" : ""),
      });
    } catch {
      sendJson(res, 200, { available: false, chars: 0 });
    }
    return;
  }

  if (req.method === "POST" && (url.pathname === "/api/talk" || url.pathname === "/talk")) {
    const body = await readJsonBody(req);
    const id = String(body.id || "").trim();
    const question = String(body.question || "").trim();
    const title = String(body.title || "this video").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    if (!id || !question) {
      sendJson(res, 400, { answer: "", error: "Missing video or question" });
      return;
    }
    try {
      const transcript = await videoTranscript(id);
      if (!transcript.text) {
        const context = `There is no readable transcript. Video title: "${title}". Answer the student's question about this topic.`;
        const modeled = await askLanguageModel(title, question, context, history);
        const alreadyNoted = history.some((item) => /could not hear|could not read caption/i.test(item.text || ""));
        sendJson(res, 200, {
          answer: modeled || topicAnswer(title, question, { mentionMissingCaptions: !alreadyNoted }),
          available: false,
          source: "title",
        });
        return;
      }
      const context = relevantTranscript(question, transcript);
      const modeled = await askLanguageModel(title, question, context, history);
      sendJson(res, 200, {
        answer: modeled || extractiveAnswer(question, transcript),
        available: true,
        source: transcript.source || "transcript",
      });
    } catch {
      sendJson(res, 500, { answer: "", error: "Talk to AI failed" });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/channel-logo" || url.pathname === "/channel-logo")) {
    const name = (url.searchParams.get("name") || "").trim();
    if (!name) {
      sendJson(res, 400, { url: "" });
      return;
    }
    try {
      sendJson(res, 200, { url: await lookupChannelLogo(name) });
    } catch {
      sendJson(res, 200, { url: "" });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/avatar" || url.pathname === "/avatar")) {
    const raw = url.searchParams.get("u") || "";
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (!/^(yt3\.ggpht\.com|yt3\.googleusercontent\.com|lh3\.googleusercontent\.com|i\.ytimg\.com)$/.test(parsed.hostname)) {
      res.writeHead(400);
      res.end();
      return;
    }
    try {
      const img = await fetch(parsed.href, { headers: { "User-Agent": USER_AGENT, Accept: "image/*" } });
      if (!img.ok) {
        res.writeHead(img.status);
        res.end();
        return;
      }
      const bytes = Buffer.from(await img.arrayBuffer());
      res.writeHead(200, {
        "Content-Type": img.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(bytes);
    } catch {
      res.writeHead(502);
      res.end();
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/meta" || url.pathname === "/meta")) {
    const id = (url.searchParams.get("id") || "").trim();
    if (!/^[\w-]{11}$/.test(id)) {
      sendJson(res, 400, { views: "", posted: "" });
      return;
    }
    try {
      const meta = await videoPublicMeta(id);
      sendJson(res, 200, { id, views: meta.views || "", posted: meta.posted || "" });
    } catch {
      sendJson(res, 200, { id, views: "", posted: "" });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/details" || url.pathname === "/details")) {
    const id = (url.searchParams.get("id") || "").trim();
    if (!id) {
      sendJson(res, 400, { error: "Missing video id", description: "", comments: [], likes: "" });
      return;
    }
    try {
      const details = await videoDetails(id);
      sendJson(res, 200, {
        id,
        description: details.description || "",
        comments: details.comments || [],
        likes: details.likes || "",
      });
    } catch {
      sendJson(res, 500, { id, description: "", comments: [], likes: "", error: "Details failed" });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/api/health" || url.pathname === "/health")) {
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

if (!process.env.VERCEL) {
  http.createServer(handleRequest).listen(PORT, "0.0.0.0", () => {
    console.log(`TechFocus API listening on http://localhost:${PORT}`);
  });
}
