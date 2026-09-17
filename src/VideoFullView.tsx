import { useEffect } from "react";

type DocFs = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function fullscreenElement(): Element | null {
  const doc = document as DocFs;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function isHandheld(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none) and (max-width: 1366px)").matches
  );
}

export async function lockLandscape(): Promise<void> {
  if (!isHandheld()) return;
  try {
    await screen.orientation?.lock?.("landscape");
  } catch {
    try {
      await screen.orientation?.lock?.("landscape-primary");
    } catch {
      // iOS Safari and many desktop browsers reject orientation lock
    }
  }
}

export function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
}

export async function exitFullView(): Promise<void> {
  const doc = document as DocFs;
  try {
    if (fullscreenElement()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
    }
  } catch {
    // ignore
  }
  unlockOrientation();
}

async function takeOverYoutubeFullscreen(): Promise<void> {
  const fs = fullscreenElement();
  const host = document.querySelector(".tf-yt-host") as HTMLElement | null;
  const iframe = host?.querySelector("iframe") || null;
  if (!fs || !host) {
    if (fs) void lockLandscape();
    return;
  }
  if (fs === host || host.contains(fs) && fs !== iframe) {
    void lockLandscape();
    return;
  }
  if (fs === iframe) {
    try {
      const target = host as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
      if (target.requestFullscreen) await target.requestFullscreen();
      else await target.webkitRequestFullscreen?.();
    } catch {
      // keep the YouTube iframe fullscreen
    }
  }
  void lockLandscape();
}

function VideoFullView({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled && fullscreenElement()) {
      void exitFullView();
    }
  }, [enabled]);

  useEffect(() => {
    const applyLock = () => {
      if (!enabled) return;
      if (!fullscreenElement()) {
        unlockOrientation();
        return;
      }
      void takeOverYoutubeFullscreen();
    };
    applyLock();
    document.addEventListener("fullscreenchange", applyLock);
    document.addEventListener("webkitfullscreenchange", applyLock);
    return () => {
      document.removeEventListener("fullscreenchange", applyLock);
      document.removeEventListener("webkitfullscreenchange", applyLock);
      unlockOrientation();
    };
  }, [enabled]);

  return null;
}

export default VideoFullView;
