import { useEffect, useRef, useState } from "react";
import { langLabel } from "./searchSettings";

type Segment = { start: number; text: string };

export default function AutoDubListen({
  enabled,
  lang,
  videoId,
  current,
  paused,
  onMuteOriginal,
}: {
  enabled: boolean;
  lang: string;
  videoId: string;
  current: number;
  paused: boolean;
  onMuteOriginal?: (muted: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [gemini, setGemini] = useState(false);
  const segmentsRef = useRef<Segment[]>([]);
  const spokenRef = useRef(-1);

  useEffect(() => {
    spokenRef.current = -1;
    segmentsRef.current = [];
    setNote("");
    if (!enabled || !videoId) {
      onMuteOriginal?.(false);
      return;
    }
    const controller = new AbortController();
    fetch("/api/dub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ id: videoId, hl: lang }),
    })
      .then((res) => res.json())
      .then((data) => {
        setGemini(Boolean(data.gemini));
        if (Array.isArray(data.segments) && data.segments.length) {
          segmentsRef.current = data.segments.filter((item: Segment) => item && item.text);
        }
        if (data.needsKey) {
          setNote("Auto-dub translation needs GEMINI_API_KEY on the API server. YouTube dubbed audio still plays when the lecture has it.");
        } else if (data.error && !segmentsRef.current.length) {
          setNote(String(data.error));
        } else if (segmentsRef.current.length) {
          setNote(`Listen voiceover: ${langLabel(lang)}${data.tts ? " · Gemini TTS ready" : " · browser speech"}`);
        }
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setNote("Could not load a dubbed transcript.");
      });
    return () => {
      controller.abort();
      window.speechSynthesis?.cancel();
      onMuteOriginal?.(false);
    };
  }, [enabled, lang, videoId]);

  useEffect(() => {
    if (!enabled || paused) {
      window.speechSynthesis?.cancel();
      return;
    }
    const segments = segmentsRef.current;
    if (!segments.length) return;
    let index = 0;
    for (let i = 0; i < segments.length; i += 1) {
      if (segments[i].start <= current) index = i;
    }
    if (index === spokenRef.current) return;
    spokenRef.current = index;
    const text = segments[index]?.text?.trim();
    if (!text || !window.speechSynthesis) return;
    onMuteOriginal?.(true);
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === "zh" ? "zh-CN" : lang;
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang.toLowerCase().startsWith(lang) || item.lang.toLowerCase().startsWith(utter.lang.toLowerCase()));
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);

    if (gemini && text.length < 700) {
      fetch("/api/dub-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, hl: lang }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.audio) return;
          window.speechSynthesis.cancel();
          const audio = new Audio(`data:${data.mime || "audio/mp3"};base64,${data.audio}`);
          audio.play().catch(() => window.speechSynthesis.speak(utter));
        })
        .catch(() => {
          // keep speechSynthesis
        });
    }
  }, [current, enabled, gemini, lang, paused]);

  if (!enabled || !note) return null;
  return (
    <div className="tf-dub-note" aria-live="polite">
      {note}
    </div>
  );
}
