import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function extractEmails(html: string): string[] {
  const emails = new Set<string>();
  // mailto links
  const mailtoRegex = /mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  let m;
  while ((m = mailtoRegex.exec(html)) !== null) {
    emails.add(m[1]);
  }
  // plain email text
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
    { platform: "threads", regex: /https?:\/\/(?:www\.)?threads\.net\/@[A-Za-z0-9._-]+/gi },
    { platform: "snapchat", regex: /https?:\/\/(?:www\.)?snapchat\.com\/add\/[A-Za-z0-9._-]+/gi },
    { platform: "reddit", regex: /https?:\/\/(?:www\.)?reddit\.com\/(?:r|u)\/[A-Za-z0-9._-]+/gi },
    { platform: "whatsapp", regex: /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[0-9A-Za-z?=&%._-]+/gi },
    { platform: "telegram", regex: /https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/[A-Za-z0-9._-]+/gi },
    { platform: "discord", regex: /https?:\/\/(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+/gi },
    { platform: "linktree", regex: /https?:\/\/(?:linktr\.ee|beacons\.ai|taplink\.cc)\/[A-Za-z0-9._-]+/gi },
  ];
  for (const { platform, regex } of patterns) {
    let m;
    while ((m = regex.exec(html)) !== null) {
      push(platform, m[0]);
    }
  }
  return socials;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  // Stateless per-request budgets to prevent overload
  const start = Date.now();
  const MAX_DURATION_MS = 6000; // overall time budget per request
  const MAX_SUBFETCHES = 5; // limit internal candidate fetches

  // Simple in-memory cache for scrape results
  const globalAny = globalThis as any;
  if (!globalAny.__scrapeCache) globalAny.__scrapeCache = new Map<string, { emails: string[]; socials: Social[]; ts: number }>();
  const cache: Map<string, { emails: string[]; socials: Social[]; ts: number }> = globalAny.__scrapeCache;
  const now = Date.now();
  const TTL_MS = 10 * 60 * 1000; // 10 minutes
  const cached = cache.get(target);
  if (cached && (now - cached.ts) < TTL_MS) {
    return NextResponse.json(
      { emails: cached.emails, socials: cached.socials },
      { status: 200, headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=60" } }
    );
  }

  async function fetchHtml(u: string, timeoutMs = 4000): Promise<string> {
    const headers = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(u, { headers, signal: ctrl.signal });
      return await res.text();
    } catch (e) {
      clearTimeout(to);
      // Fallback to http if https fails
      try {
        const url = new URL(u);
        const httpUrl = `http://${url.hostname}`;
        const ctrl2 = new AbortController();
        const to2 = setTimeout(() => ctrl2.abort(), timeoutMs);
        const res2 = await fetch(httpUrl, { headers, signal: ctrl2.signal });
        clearTimeout(to2);
        return await res2.text();
      } catch (e2) {
        throw e2;
      }
    }
    finally { clearTimeout(to); }
  }

  function collectInternalCandidates(html: string, base: string): string[] {
    const urls = new Set<string>();
    const origin = new URL(base).origin;
    const hrefRegex = /href=("|')(.*?)(\1)/gi;
    let m;
    const keywords = [
      "contact", "contact-us", "support", "help", "about", "team", "staff", "social", "follow", "find-us", "connect", "community",
      "instagram", "facebook", "twitter", "x.com", "linkedin", "youtube", "tiktok",
    ];
    while ((m = hrefRegex.exec(html)) !== null) {
      const raw = m[2];
      try {
        const abs = new URL(raw, origin).href;
        // Prefer internal pages
        if (abs.startsWith(origin) && keywords.some((k) => abs.toLowerCase().includes(k))) {
          urls.add(abs);
        }
      } catch {}
    }
    try {
      const u = new URL(base);
      if (u.pathname && u.pathname !== "/") {
        urls.add(`${u.protocol}//${u.hostname}/`);
      }
    } catch {}
    return Array.from(urls).slice(0, 10);
  }

  try {
    const html = await fetchHtml(target);
    const emails = extractEmails(html);
    const baseSocials = extractSocials(html);
    const candidates = collectInternalCandidates(html, target);
    const limited = candidates.slice(0, MAX_SUBFETCHES);
    if ((Date.now() - start) > MAX_DURATION_MS) {
      return NextResponse.json(
        { error: "Busy, retry later", emails, socials: baseSocials },
        { status: 429, headers: { "retry-after": "5" } }
      );
    }
    let extraSocials: Social[] = [];
    if (limited.length > 0) {
      const results = await Promise.allSettled(limited.map((u) => fetchHtml(u)));
      for (const r of results) {
        if (r.status === "fulfilled") {
          extraSocials = extraSocials.concat(extractSocials(r.value));
        }
      }
    }
    const deduped: Social[] = [];
    const seen = new Set<string>();
    for (const s of [...baseSocials, ...extraSocials]) {
      if (!seen.has(s.url)) { seen.add(s.url); deduped.push(s); }
    }
    const payload = { emails, socials: deduped };
    if ((emails && emails.length > 0) || (deduped && deduped.length > 0)) {
      cache.set(target, { emails, socials: deduped, ts: Date.now() });
    }
    return NextResponse.json(payload, { status: 200, headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=60" } });
  } catch (e: any) {
    // Return 200 with empty emails to avoid hard errors in the UI; include error message for debugging
    return NextResponse.json({ error: e?.message ?? "Scrape error", emails: [], socials: [] }, { status: 200 });
  }
}