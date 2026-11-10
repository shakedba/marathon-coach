"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;

/** Pull down at the top of a page to refresh it; on the home page this also syncs (SyncStatus listens for "mc:sync"). */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const start = useRef<{ y: number; x: number } | null>(null);
  const router = useRouter();
  useEffect(() => {
    const set = (v: number) => { pullRef.current = v; setPull(v); };
    const down = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && e.touches.length === 1 ? { y: e.touches[0].clientY, x: e.touches[0].clientX } : null;
    };
    const move = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = Math.abs(e.touches[0].clientX - start.current.x);
      if (dx > dy) { start.current = null; set(0); return; } // horizontal swipe belongs to SwipeNav
      set(Math.max(0, Math.min(dy * 0.5, THRESHOLD + 20)));
    };
    const up = () => {
      if (start.current && pullRef.current >= THRESHOLD) {
        window.dispatchEvent(new Event("mc:sync")); // the home page syncs with Garmin/Strava
        router.refresh(); // every page reloads its data
      }
      start.current = null;
      set(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [router]);
  if (pull <= 4) return null;
  return (
    <div className="ptr" style={{ height: pull }} aria-hidden>
      <span className={pull >= THRESHOLD ? "spinner" : "ptr-arrow"}>{pull >= THRESHOLD ? "" : "↓"}</span>
    </div>
  );
}
