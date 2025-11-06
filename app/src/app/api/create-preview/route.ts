import { NextResponse } from "next/server";
import { z } from "zod";
import { createPreviewRecord } from "@/lib/storage";

const CreatePreviewSchema = z.object({
  website_url: z.string().url(),
  chatbot_script: z.string().min(1).max(20000),
  category: z.string().min(1).max(100).default("Uncategorized"),
  name: z.string().min(1).max(100).optional(),
  // Accept any non-empty id so client-generated ids work even without crypto.randomUUID
  id: z.string().min(6).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_url, chatbot_script, category, name, id } = CreatePreviewSchema.parse(body);
    const rec = await createPreviewRecord(website_url, chatbot_script, category, name, id);
    return NextResponse.json({ id: rec.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
}


