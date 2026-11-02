"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import * as db from "@/lib/db";
import { weekStart } from "@/lib/dates";
import { planWeek } from "@/lib/plan";
import { proposeRebalance } from "@/lib/rebalance";
import type { SkipReason } from "@/lib/types";
import { garminClient, persistGarmin, pushWorkouts, syncAll } from "@/lib/sync";
import { todayLocal, addDays } from "@/lib/dates";
import { applyEdit, parseOp } from "@/lib/edit";
import { isIsoDate } from "@/lib/dayview";
import { getLang } from "@/lib/lang";

const REASONS: SkipReason[] = ["time", "tired", "ill", "fever", "niggle"];

function dateParam(form: FormData): string {
  const v = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new Error("bad date");
  return v;
}

export async function setLang(form: FormData) {
  (await cookies()).set("lang", form.get("lang") === "en" ? "en" : "he", { maxAge: 60 * 60 * 24 * 365, path: "/" });
  revalidatePath("/", "layout");
}

export async function markDone(form: FormData) {
  const date = dateParam(form);
  const f = Number(form.get("feel"));
  const feel = Number.isInteger(f) && f >= 1 && f <= 10 ? f : undefined;
  const note = String(form.get("note") ?? "").slice(0, 500) || undefined;
  await db.setStatus({ date, status: "done", feel, note });
  revalidatePath("/", "layout");
}

/** Skip with a reason -> store status and create a rebalance proposal for approval. */
export async function markSkipped(form: FormData) {
  const date = dateParam(form);
  const reason = String(form.get("reason")) as SkipReason;
  if (!REASONS.includes(reason)) throw new Error("bad reason");
  await db.setStatus({ date, status: "skipped", reason });
  const ws = weekStart(date);
  const overrides = await db.overridesBetween(ws, addDays(ws, 6));
  const proposal = proposeRebalance(planWeek(ws, overrides), date, reason, todayLocal());
  await db.addProposal(proposal);
  revalidatePath("/", "layout");
}

export async function decideProposal(form: FormData) {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  const accept = form.get("decision") === "accept";
  const p = await db.getProposal(id);
  if (!p || p.status !== "pending") return;
  if (accept) {
    for (const c of p.proposal.changes) await db.setOverride(c.to, `${p.proposal.trigger.reason ?? ""}:${p.proposal.trigger.date}`);
    const g = await garminClient();
    if (g) {
      await pushWorkouts(g).catch(() => null);
      await persistGarmin(g);
    }
  }
  await db.setProposalStatus(id, accept ? "accepted" : "rejected");
  revalidatePath("/", "layout");
}

export async function syncNow(): Promise<{ ok: boolean; message?: string }> {
  const r = await syncAll();
  revalidatePath("/", "layout");
  if (r.skipped) return { ok: true, message: r.skipped };
  if (r.errors.length) return { ok: false, message: r.errors.join("; ") };
  return { ok: true };
}

/** Privacy: wipe everything stored (requires typing DELETE). */
export async function deleteEverything(form: FormData): Promise<{ ok: boolean; message?: string }> {
  if (form.get("confirm") !== "DELETE") return { ok: false, message: "Type DELETE to confirm / הקלד DELETE לאישור" };
  await db.deleteAllData();
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Strength / mobility: done, skipped, or cleared. */
export async function markExtra(form: FormData) {
  const date = dateParam(form);
  const kind = String(form.get("kind"));
  if (kind !== "strength" && kind !== "mobility") throw new Error("bad kind");
  const v = String(form.get("status"));
  await db.setExtraStatus(date, kind, v === "done" || v === "skipped" ? v : null);
  revalidatePath("/", "layout");
}

/** Push changed days to Garmin; a failure is reported but never undoes the saved change (next sync retries). */
async function repushGarmin(): Promise<boolean> {
  const g = await garminClient().catch(() => null);
  if (!g) return true;
  try {
    await pushWorkouts(g);
    return true;
  } catch {
    return false;
  } finally {
    await persistGarmin(g).catch(() => null);
  }
}

export async function editWorkout(form: FormData): Promise<{ ok: boolean; message?: string }> {
  const lang = await getLang();
  const date = String(form.get("date") ?? "");
  const op = parseOp(String(form.get("op") ?? ""));
  if (!isIsoDate(date) || !op) return { ok: false };
  const ws = weekStart(date);
  const week = planWeek(ws, await db.overridesBetween(ws, addDays(ws, 6)));
  const r = applyEdit(week, date, op, todayLocal());
  if (r.block) return { ok: false, message: r.block[lang] };
  for (const x of r.writes) await db.setOverride(x.w, x.reason);
  const pushed = await repushGarmin();
  revalidatePath("/", "layout");
  return pushed ? { ok: true } : { ok: true, message: lang === "he" ? "נשמר. השעון יתעדכן בסנכרון הבא." : "Saved. The watch will update at the next sync." };
}

export async function revertDay(form: FormData): Promise<{ ok: boolean; message?: string }> {
  const lang = await getLang();
  const date = String(form.get("date") ?? "");
  if (!isIsoDate(date)) return { ok: false };
  if (date < todayLocal()) return { ok: false, message: lang === "he" ? "אי אפשר לשנות ימים שעברו." : "Past days can't be changed." };
  const ov = await db.getOverride(date);
  if (!ov) return { ok: true };
  await db.deleteOverride(date);
  // A swap is two rows pointing at each other: revert both, or the week would hold the same session twice.
  const partner = /^swap:(\d{4}-\d{2}-\d{2})$/.exec(ov.reason)?.[1];
  if (partner && partner >= todayLocal()) {
    const p = await db.getOverride(partner);
    if (p?.reason === `swap:${date}`) await db.deleteOverride(partner);
  }
  const pushed = await repushGarmin();
  revalidatePath("/", "layout");
  return pushed ? { ok: true } : { ok: true, message: lang === "he" ? "חזר לתוכנית. השעון יתעדכן בסנכרון הבא." : "Back to plan. The watch will update at the next sync." };
}
