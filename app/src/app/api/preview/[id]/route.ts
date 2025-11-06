import { NextResponse } from "next/server";
import { deletePreviewRecord, getPreviewRecord } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const rec = await getPreviewRecord(id);
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rec);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  await deletePreviewRecord(id);
  return NextResponse.json({ ok: true });
}


