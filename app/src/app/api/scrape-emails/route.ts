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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const res = await fetch(target, { headers: { "user-agent": "Mozilla/5.0" } });
    const html = await res.text();
    const emails = extractEmails(html);
    return NextResponse.json({ emails }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Scrape error", emails: [] }, { status: 500 });
  }
}