import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import * as db from "@/lib/db";
import { login } from "@/lib/garmin/client";
import { saveGarminTokens } from "@/lib/sync";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) return NextResponse.json({ error: "email and password required" }, { status: 400 });
  try {
    const r = await login(email.trim(), password);
    if (r.status === "mfa") {
      await db.kvSet("garmin_mfa", { blob: encrypt(r.state), at: Date.now() });
      return NextResponse.json({ status: "mfa" });
    }
    await saveGarminTokens(r.tokens);
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
