import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import * as db from "@/lib/db";
import { verifyMfa, type MfaState } from "@/lib/garmin/client";
import { saveGarminTokens, syncAll } from "@/lib/sync";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { code } = await req.json();
  const pending = await db.kvGet<{ blob: string; at: number }>("garmin_mfa");
  if (!pending || Date.now() - pending.at > 10 * 60 * 1000) {
    await db.kvDel("garmin_mfa");
    return NextResponse.json({ error: "Login expired - start again" }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(String(code ?? "").trim())) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  try {
    const tokens = await verifyMfa(decrypt<MfaState>(pending.blob), String(code).trim());
    await db.kvDel("garmin_mfa");
    await saveGarminTokens(tokens);
    await syncAll({ push: true }).catch(() => null);
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
