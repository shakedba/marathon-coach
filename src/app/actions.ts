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

export async function syncNow() {
  await syncAll();
  revalidatePath("/", "layout");
}

/** Privacy: wipe everything stored (requires typing DELETE). */
export async function deleteEverything(form: FormData) {
  if (form.get("confirm") !== "DELETE") return;
  await db.deleteAllData();
  revalidatePath("/", "layout");
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
