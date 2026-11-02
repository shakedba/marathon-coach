"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };
const Ctx = createContext<(kind: ToastKind, text: string) => void>(() => {});

/** Short haptic tick on supporting devices (Android Chrome); silently ignored elsewhere. */
export function haptic(kind: ToastKind) {
  try {
    navigator.vibrate?.(kind === "error" ? [30, 60, 30] : 15);
  } catch {
    /* not supported */
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const show = useCallback((kind: ToastKind, text: string) => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    if (kind !== "info") haptic(kind);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            <span aria-hidden>{t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "…"}</span> {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
