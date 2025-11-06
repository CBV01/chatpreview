import { NextResponse } from "next/server";
import { listPreviewRecords } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await listPreviewRecords();
    return NextResponse.json({ previews: list }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to list" }, { status: 500 });
  }
}