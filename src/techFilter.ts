const TECH_TERMS = [
  "programming", "programmer", "code", "coding", "software", "developer", "devops",
  "linux", "unix", "kernel", "python", "rust", "javascript", "typescript", "golang",
  "java", "kotlin", "c++", "compiler", "algorithm", "datastructure", "database",
  "sql", "postgres", "kubernetes", "docker", "terraform", "aws", "azure", "gcp",
  "security", "cyber", "hack", "owasp", "cve", "malware", "encrypt", "https",
  "neural", "machine learning", "deep learning", "llm", "gpt", "transformer",
  "cpu", "gpu", "hardware", "alu", "microchip", "semiconductor", "silicon", "circuit", "network", "tcp", "api",
  "git", "open source", "foss", "backend", "frontend", "fullstack", "debug",
  "operating system", "distributed", "cloud", "ci/cd", "github", "vim",
  "robot", "robotics", "arduino", "raspberry",
];

const TECH_CHANNELS = [
  "fireship", "3blue1brown", "computerphile", "techworld with nana",
  "andrej karpathy", "ibm technology", "crash course", "networkchuck",
  "the coding train", "freecodecamp", "traversy", "primeagen", "theo",
  "low level learning", "corey schafer", "sentdex", "ben eater",
];

const NON_TECH = [
  "vlog", "prank", "official trailer", "music video", "full album", "asmr",
  "minecraft", "fortnite", "gta ", "cricket", "football highlights", "bollywood",
  "song ", "dance", "mukbang", "janta party", "podcast clip", "stand up comedy",
  "roast", "relationship", "makeup", "unboxing haul",
  "potato chip", "tortilla chip", "corn chip", "dorito", "pringle", "lays ",
];

export function durationSeconds(duration?: string | number) {
  if (typeof duration === "number") return duration;
  const parts = String(duration || "")
    .split(":")
    .map((part) => Number(part));
  if (!parts.length || parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function isShort(video: { duration?: string; short?: boolean }) {
  if (video.short === true) return true;
  const seconds = durationSeconds(video.duration);
  return seconds > 0 && seconds <= 60;
}

export function inferCategory(text: string) {
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

export function matchesCategory(
  item: { title?: string; channel?: string; category?: string },
  category: string,
) {
  if (!category || category === "All") return true;
  const inferred = inferCategory(`${item.title || ""} ${item.channel || ""}`);
  if (inferred === category) return true;
  const labeled = (item.category || "").trim();
  return inferred === "Tech" && labeled === category;
}

export function isTechVideo(video: { title?: string; channel?: string; category?: string }) {
  const text = `${video.title || ""} ${video.channel || ""} ${video.category || ""}`.toLowerCase();
  if (!text.trim()) return false;
  if (/\bchips?\b/.test(text) && !/silicon|semi|cpu|gpu|microchip|semiconductor|wafer|transistor/.test(text) && /made|factory|snack|food|potato|crisp/.test(text)) return false;
  if (NON_TECH.some((term) => text.includes(term))) return false;
  if (TECH_CHANNELS.some((channel) => text.includes(channel))) return true;
  return TECH_TERMS.some((term) => text.includes(term));
}
