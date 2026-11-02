"use client";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

export type ActionResult = { ok: boolean; message?: string } | void;

/**
 * Wraps a server action: shows a toast when it is confirmed or fails.
 * `success` may be a map keyed by the clicked button's value (e.g. accept/reject).
 */
export function ActionForm({
  action, success, error, className, style, children, confirm, redirectTo,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  success: string | Record<string, string>;
  error: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  confirm?: string;
  /** Navigate here after a confirmed success (e.g. close a preview). */
  redirectTo?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className={className}
      style={style}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      action={async (fd: FormData) => {
        try {
          const r = await action(fd);
          if (r && r.ok === false) return toast("error", r.message ?? error);
          const pick = (v: FormDataEntryValue | null) => (typeof success === "string" ? success : success[String(v)] ?? Object.values(success)[0]);
          const clicked = fd.get("decision") ?? fd.get("status") ?? fd.get("reason") ?? fd.get("lang");
          toast("success", r && r.message ? r.message : pick(clicked));
          if (redirectTo) router.replace(redirectTo, { scroll: false });
        } catch {
          toast("error", error);
        }
      }}
    >
      {children}
    </form>
  );
}

/** Submit button: spinner + disabled while its form is pending; only the clicked one spins. */
export function SubmitButton({
  children, name, value, primary, pendingLabel,
}: { children: React.ReactNode; name?: string; value?: string; primary?: boolean; pendingLabel?: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button name={name} value={value} className={primary ? "primary" : undefined} disabled={pending} aria-busy={mine || undefined}>
      {mine ? <><span className="spinner" aria-hidden /> {pendingLabel ?? children}</> : children}
    </button>
  );
}
