import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";

export const maxDuration = 60;

export async function POST() {
  return NextResponse.json(await syncAll());
}
