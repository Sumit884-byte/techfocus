import { YoutubeTranscript } from "youtube-transcript";

function toPayload(rows) {
  const segments = (rows || [])
    .map((row) => ({
      start: Math.floor(Number(row.offset || row.start || 0) / (Number(row.offset) > 1000 ? 1000 : 1)),
      text: String(row.text || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((item) => item.text);
  const text = segments.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return { text, segments, source: "transcript" };
}

export async function libraryTranscript(videoId, want = "en") {
  const langs = [...new Set([want, String(want).split("-")[0], "en", undefined])];
  for (const lang of langs) {
    try {
      const rows = lang
        ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
        : await YoutubeTranscript.fetchTranscript(videoId);
      const parsed = toPayload(rows);
      if (parsed) return parsed;
    } catch {
      // next language
    }
  }
  return null;
}
