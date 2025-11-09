import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export type PreviewRecord = {
  id: string;
  website_url: string;
  chatbot_script: string;
  created_at: string;
  category?: string;
  name?: string;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    return createClient(url, anonKey);
  }
  return null;
}

function isEphemeralServerless(): boolean {
  // On Vercel, serverless functions run on ephemeral filesystems.
  // Skip local fs writes/reads when Supabase is not configured.
  return !!process.env.VERCEL;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "previews.json");

async function ensureDataFile(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE).catch(async () => {
      await fs.writeFile(DATA_FILE, JSON.stringify({ previews: [] }, null, 2), "utf-8");
    });
  } catch {}
}

async function readLocal(): Promise<PreviewRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const json = JSON.parse(raw) as { previews: PreviewRecord[] };
  return json.previews ?? [];
}

async function writeLocal(previews: PreviewRecord[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify({ previews }, null, 2), "utf-8");
}

export async function createPreviewRecord(
  website_url: string,
  chatbot_script: string,
  category: string = "Uncategorized",
  name?: string,
  providedId?: string
): Promise<PreviewRecord> {
  const id = providedId ?? (globalThis.crypto?.randomUUID?.() ?? (await import("crypto")).randomUUID());
  const created_at = new Date().toISOString();
  const record: PreviewRecord = { id, website_url, chatbot_script, created_at, category, name };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("previews").insert({
      id,
      website_url,
      chatbot_script,
      created_at,
      category,
      name,
    });
    if (!error) {
      return record;
    }
    // Fallback to local storage if Supabase insert fails
    try {
      console.warn("Supabase insert failed, falling back to local storage", error?.message);
    } catch {}
  }

  const all = await readLocal();
  all.push(record);
  if (!isEphemeralServerless()) {
    await writeLocal(all);
  }
  return record;
}

export async function getPreviewRecord(id: string): Promise<PreviewRecord | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("previews")
      .select("id, website_url, chatbot_script, created_at, category, name")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      return data as PreviewRecord;
    }
    // Fallback to local storage if Supabase query fails or no data found
    try {
      if (error) console.warn("Supabase fetch failed, falling back to local storage", error?.message);
    } catch {}
  }
  const all = await readLocal();
  const rec = isEphemeralServerless() ? null : (all.find((p) => p.id === id) ?? null);
  if (!rec) return null;
  // Backfill defaults for older records
  rec.category = rec.category ?? "Uncategorized";
  return rec;
}

export async function deletePreviewRecord(id: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("previews").delete().eq("id", id);
    if (!error) return;
    try {
      console.warn("Supabase delete failed, proceeding to local delete", error?.message);
    } catch {}
  }
  const all = await readLocal();
  if (!isEphemeralServerless()) {
    const filtered = all.filter((p) => p.id !== id);
    await writeLocal(filtered);
  }
}

export async function listPreviewRecords(): Promise<PreviewRecord[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("previews")
      .select("id, website_url, chatbot_script, created_at, category, name")
      .order("created_at", { ascending: false });
    if (!error && data) {
      return data as PreviewRecord[];
    }
    try {
      if (error) console.warn("Supabase list failed, falling back to local storage", error?.message);
    } catch {}
  }
  const all = await readLocal();
  return (isEphemeralServerless() ? [] : all)
    .map((p) => ({ ...p, category: p.category ?? "Uncategorized" }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}


