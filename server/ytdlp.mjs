import { spawn } from "node:child_process";
import { chmodSync, createWriteStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN_DIR = join(ROOT, "bin");
const BIN_PATH = join(BIN_DIR, "yt-dlp");
const MIN_BIN_BYTES = 5_000_000;

function releaseName() {
  if (process.platform === "darwin") return "yt-dlp_macos";
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.arch === "arm64") return "yt-dlp_linux_aarch64";
  return "yt-dlp_linux";
}

function candidateBins() {
  return [
    process.env.YT_DLP_PATH,
    BIN_PATH,
    join(tmpdir(), "techfocus-yt-dlp"),
    "yt-dlp",
  ].filter(Boolean);
}

function usableFile(path) {
  if (!path || path === "yt-dlp" || !existsSync(path)) return false;
  try {
    const size = statSync(path).size;
    if (size < MIN_BIN_BYTES) return false;
    chmodSync(path, 0o755);
    return true;
  } catch {
    return false;
  }
}

async function downloadYtDlp(dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${releaseName()}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`yt-dlp download failed (${res.status})`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  chmodSync(dest, 0o755);
  if (!usableFile(dest)) throw new Error("yt-dlp download was too small");
  return dest;
}

export async function ensureYtDlp() {
  for (const path of candidateBins()) {
    if (usableFile(path)) return path;
  }

  const dest = process.argv.includes("--ensure") ? BIN_PATH : join(tmpdir(), "techfocus-yt-dlp");
  return downloadYtDlp(dest);
}

function cookieArgs() {
  const raw = (process.env.YT_DLP_COOKIES || process.env.YT_COOKIES || "").trim();
  if (!raw) return [];
  const file = join(tmpdir(), "techfocus-yt-cookies.txt");
  if (!existsSync(file) || statSync(file).size < 20) {
    writeFileSync(file, raw.includes("# Netscape") ? raw : `# Netscape HTTP Cookie File\n${raw}\n`);
  }
  return ["--cookies", file];
}

function runJson(bin, videoId, extraArgs, timeoutMs = 22000) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      [
        "-J",
        "--skip-download",
        "--no-warnings",
        "--no-playlist",
        "--no-check-certificates",
        "--socket-timeout",
        "12",
        ...cookieArgs(),
        ...extraArgs,
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("yt-dlp timeout"));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((err || `yt-dlp exited ${code}`).slice(0, 400)));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function langKeys(bucket, want) {
  const keys = Object.keys(bucket || {});
  const base = String(want || "en").toLowerCase().split("-")[0];
  const rank = (key) => {
    const lower = key.toLowerCase();
    if (lower === String(want || "en").toLowerCase()) return 0;
    if (lower === base || lower.startsWith(`${base}-`) || lower.startsWith(`${base}.`)) return 1;
    if (lower === "en" || lower.startsWith("en-") || lower.startsWith("en.")) return 2;
    return 3;
  };
  return keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function formatScore(item) {
  const ext = String(item?.ext || "").toLowerCase();
  if (ext === "json3") return 0;
  if (ext === "srv3" || ext === "srv1") return 1;
  if (ext === "vtt") return 2;
  if (ext === "ttml") return 3;
  return 4;
}

export function captionUrlsFromInfo(info, want = "en") {
  const urls = [];
  for (const bucket of [info?.subtitles, info?.automatic_captions]) {
    if (!bucket) continue;
    for (const key of langKeys(bucket, want)) {
      const formats = [...(bucket[key] || [])].sort((a, b) => formatScore(a) - formatScore(b));
      for (const item of formats) {
        if (item?.url) urls.push(item.url);
      }
      if (urls.length) break;
    }
    if (urls.length) break;
  }
  return [...new Set(urls)];
}

async function resolveBin() {
  for (const path of candidateBins()) {
    if (path !== "yt-dlp" && !existsSync(path)) continue;
    const ok = await new Promise((resolve) => {
      const child = spawn(path, ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
    if (ok) return path;
  }
  return ensureYtDlp();
}

export async function ytDlpCaptionUrls(videoId, want = "en") {
  const bin = await resolveBin();
  const attempts = [
    [],
    ["--extractor-args", "youtube:player_client=web,web_embedded"],
    ["--extractor-args", "youtube:player_client=ios,mweb"],
  ];
  let lastError = new Error("yt-dlp failed");
  for (const extra of attempts) {
    try {
      const info = await runJson(bin, videoId, extra);
      const urls = captionUrlsFromInfo(info, want);
      if (urls.length) return urls;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes("--ensure")) {
  ensureYtDlp()
    .then((path) => {
      console.log(path);
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}
