import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type DocFs = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElFs = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
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
    // iOS Safari and many desktop browsers reject orientation lock
  }
}

export function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
}

export async function requestFullView(el: HTMLElement): Promise<boolean> {
  const tryFs = async (node: HTMLElement) => {
    const target = node as ElFs;
    if (target.requestFullscreen) {
      await target.requestFullscreen();
      return true;
    }
    if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
      return true;
    }
    return false;
  };

  try {
    if (await tryFs(el)) return true;
  } catch {
    // fall through to iframe
  }
  const iframe = el.querySelector("iframe");
  if (iframe) {
    try {
      if (await tryFs(iframe)) return true;
    } catch {
      // ignore
    }
  }
  return false;
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

export function videoFullViewTarget(stage: HTMLElement | null, videoId: string): HTMLElement | null {
  const host = document.querySelector(".tf-yt-host") as HTMLElement | null;
  const hostForThis = host?.dataset.videoId === videoId;
  const listenHidden = document.body.dataset.listenAudio === "1";
  if (hostForThis && !listenHidden && host?.querySelector("iframe")) return host;
  return stage;
}

function FullViewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function VideoFullView({
  enabled,
  stage,
  videoId,
}: {
  enabled: boolean;
  stage: HTMLElement | null;
  videoId: string;
}) {
  const [active, setActive] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    const sync = () => setActive(Boolean(fullscreenElement()));
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled && fullscreenElement()) {
      void exitFullView();
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      void exitFullView();
    };
  }, []);

  useEffect(() => {
    const applyLock = () => {
      if (fullscreenElement() && enabled) void lockLandscape();
      else unlockOrientation();
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

  useEffect(() => {
    if (!stage || !enabled) return;
    let ticking = false;
    const place = () => {
      ticking = false;
      const rect = stage.getBoundingClientRect();
      setBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    const requestPlace = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(place);
    };
    place();
    window.addEventListener("resize", requestPlace);
    window.addEventListener("scroll", requestPlace, true);
    window.visualViewport?.addEventListener("resize", requestPlace);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    observer?.observe(stage);
    return () => {
      window.removeEventListener("resize", requestPlace);
      window.removeEventListener("scroll", requestPlace, true);
      window.visualViewport?.removeEventListener("resize", requestPlace);
      observer?.disconnect();
    };
  }, [stage, enabled]);

  if (!enabled || !stage || active || box.width < 80 || box.height < 80) return null;

  return createPortal(
    <button
      type="button"
      className="tf-fullview-btn"
      aria-label="Full view"
      style={{
        top: box.top + box.height - 40,
        left: box.left + box.width - 76,
      }}
      onClick={() => {
        const target = videoFullViewTarget(stage, videoId);
        if (!target) return;
        void requestFullView(target).then((ok) => {
          if (ok) void lockLandscape();
        });
      }}
    >
      <FullViewIcon />
      <span>full</span>
    </button>,
    document.body,
  );
}

export default VideoFullView;
