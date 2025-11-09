import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function extractEmails(html: string): string[] {
  const emails = new Set<string>();
  const mailtoRegex = /mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  let m;
  while ((m = mailtoRegex.exec(html)) !== null) {
    emails.add(m[1]);
  }
  const textEmailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  let t;
  while ((t = textEmailRegex.exec(html)) !== null) {
    emails.add(t[0]);
  }
  return Array.from(emails);
}

type Social = { platform: string; url: string };

function extractSocials(html: string): Social[] {
  const socials: Social[] = [];
  const push = (platform: string, url: string) => {
    try {
      const u = new URL(url);
      const normalized = `${u.protocol}//${u.hostname}${u.pathname}`;
      if (!socials.find((s) => s.url === normalized)) socials.push({ platform, url: normalized });
    } catch {}
  };
  const patterns: { platform: string; regex: RegExp }[] = [
    { platform: "instagram", regex: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/gi },
    { platform: "twitter", regex: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9._-]+/gi },
    { platform: "facebook", regex: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/gi },
    { platform: "linkedin", regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9._-]+/gi },
    { platform: "tiktok", regex: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/gi },
    { platform: "youtube", regex: /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:channel|c|user|@)[A-Za-z0-9._-]+|youtu\.be\/[A-Za-z0-9_-]+)/gi },
    { platform: "pinterest", regex: /https?:\/\/(?:www\.)?pinterest\.com\/[A-Za-z0-9._-]+/gi },
  ];
  for (const { platform, regex } of patterns) {
    let m;
    while ((m = regex.exec(html)) !== null) {
      push(platform, m[0]);
    }
  }
  return socials;
}

function looksGeneric(local: string): boolean {
  const l = local.toLowerCase();
  return ["info","support","sales","hello","contact","admin","service","help","team"].some((g) => l.includes(g));
}

function toTitleCase(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function deriveFirstName(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const local = email.split("@")[0];
  const parts = local.split(/[._\-+]/).filter(Boolean);
  for (const p of parts) {
    if (/^[a-zA-Z]{2,}$/.test(p) && !looksGeneric(p)) {
      return toTitleCase(p);
    }
  }
  // fallback: if local is clean alphabetic, use it
  if (/^[a-zA-Z]{2,}$/.test(local)) return toTitleCase(local);
  return undefined;
}

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function processUrl(url: string) {
  try {
    const res = await fetchWithTimeout(url, 12000);
    const html = await res.text();
    const emails = extractEmails(html);
    const socials = extractSocials(html);
    if (emails.length === 0) {
      const domain = new URL(url).hostname;
      return { domain, status: "none" as const, ...(socials.length ? { socials } : {}) };
    }
    // choose best email: prefer non-generic local parts
    const sorted = emails.sort((a, b) => Number(looksGeneric(a.split("@")[0])) - Number(looksGeneric(b.split("@")[0])));
    const chosen = sorted[0];
    const domain = new URL(url).hostname;
    const firstName = deriveFirstName(chosen);
    return { domain, email: chosen, firstName, status: "found" as const, ...(socials.length ? { socials } : {}) };
  } catch (e: any) {
    try {
      const domain = new URL(url).hostname;
      return { domain, status: "error" as const, error: e?.message ?? "fetch error" };
    } catch {
      return { domain: url, status: "error" as const, error: e?.message ?? "fetch error" };
    }
  }
}

async function runWithConcurrency<T>(items: string[], limit: number, fn: (x: string) => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      const r = await fn(item);
      results[idx] = r;
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];
    if (!urls.length) return NextResponse.json({ error: "No urls provided", results: [] }, { status: 400 });
    if (urls.length > 50) return NextResponse.json({ error: "Limit is 50 per run", results: [] }, { status: 400 });

    // normalize to scheme-only + hostname
    const normalized = urls.map((u) => {
      try {
        const url = new URL(u);
        return `${url.protocol}//${url.hostname}`;
      } catch {
        return u;
      }
    });

    const results = await runWithConcurrency(normalized, 8, processUrl);
    return NextResponse.json({ results }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Batch error", results: [] }, { status: 500 });
  }
}