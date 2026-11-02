"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";

/** Horizontal swipe between weeks. In RTL the next week sits on the left, so a rightward swipe brings it in. */
export function SwipeNav({ prev, next, rtl, children }: { prev: string; next: string; rtl: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x;
        const dy = e.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // ignore scrolls and taps
        // Finger moving right reveals the "previous" side in LTR and the "next" side in RTL.
        const goNext = rtl ? dx > 0 : dx < 0;
        try { navigator.vibrate?.(10); } catch { /* ignore */ }
        router.push(goNext ? next : prev);
      }}
    >
      {children}
    </div>
  );
}
