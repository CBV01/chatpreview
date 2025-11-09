"use client";

import { use, useEffect, useRef, useState } from "react";

type Social = { platform: string; url: string };

async function fetchPreviewWithRetry(id: string, attempts = 4, delayMs = 200) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`/api/preview/${id}`);
    if (res.ok) {
      return (await res.json()) as { id: string; website_url: string; chatbot_script: string };
    }
    // 404 likely means record not yet persisted; wait and retry
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Preview not found");
}

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [chatbotScript, setChatbotScript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [emails, setEmails] = useState<string[]>([]);
  const [socials, setSocials] = useState<Social[]>([]);
  const [showInfoPopup, setShowInfoPopup] = useState<boolean>(true);
  const [showComposeOverlay, setShowComposeOverlay] = useState<boolean>(false);
  const [purpose, setPurpose] = useState<string>("");
  const [subjectTpl, setSubjectTpl] = useState<string>("");
  const [bodyTpl, setBodyTpl] = useState<string>("");
  const [variants, setVariants] = useState<{ subject: string; body: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setLoading(true);
    // Prefer client-side data first for serverless environments
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(`preview:${id}`) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { website_url: string; chatbot_script: string };
        setWebsiteUrl(parsed.website_url);
        setChatbotScript(parsed.chatbot_script);
        setError(null);
        setLoading(false);
        return;
      }
    } catch {}

    // Fallback to server API if client storage missing
    fetchPreviewWithRetry(id)
      .then((data) => {
        setWebsiteUrl(data.website_url);
        setChatbotScript(data.chatbot_script);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  // Fetch emails from the target website once URL is known
  useEffect(() => {
    async function run() {
      try {
        if (!websiteUrl) return;
        const res = await fetch(`/api/scrape-emails?url=${encodeURIComponent(websiteUrl)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { emails: string[]; socials?: Social[] };
        if (Array.isArray(data.emails)) {
          setEmails(data.emails);
        }
        if (Array.isArray(data.socials)) {
          setSocials(data.socials);
        }
        if ((Array.isArray(data.emails) && data.emails.length > 0) || (Array.isArray(data.socials) && data.socials.length > 0)) {
          setShowInfoPopup(true);
        }
      } catch {}
    }
    run();
  }, [websiteUrl]);

  useEffect(() => {
    function inject() {
      if (!iframeRef.current || !chatbotScript) return;
      const doc = iframeRef.current.contentWindow?.document;
      if (!doc) return;
      // Many embeds provide a full <script>...</script> snippet. Strip the
      // outer tags and run the inner code so it can attach its own loader.
      const code = chatbotScript
        .trim()
        .replace(/<script[^>]*>/i, "")
        .replace(/<\/script>/i, "");
      const s = doc.createElement("script");
      s.type = "text/javascript";
      s.defer = false;
      s.async = false;
      s.textContent = code;
      doc.body.appendChild(s);

      // Auto-open the chatbot shortly after the embed initializes.
      const auto = doc.createElement("script");
      auto.type = "text/javascript";
      auto.textContent = `(() => {
        function attemptOpen() {
          try {
            const w = window as any;
            // Try known APIs if present
            if (w.chatbase && typeof w.chatbase.open === 'function') { w.chatbase.open(); return; }
            if (w.embeddedChatbot && typeof w.embeddedChatbot.open === 'function') { w.embeddedChatbot.open(); return; }
            if (w.Chatbase && typeof w.Chatbase.open === 'function') { w.Chatbase.open(); return; }
          } catch {}
          // Fallback: click a small fixed button near bottom-right (typical chat bubble)
          try {
            const nodes = Array.from(document.querySelectorAll('*')) as HTMLElement[];
            for (const el of nodes) {
              const s = getComputedStyle(el);
              const pos = s.position === 'fixed' || s.position === 'absolute' || s.position === 'sticky';
              if (!pos) continue;
              const r = el.getBoundingClientRect();
              const nearRight = (window.innerWidth - r.right) <= 80;
              const nearBottom = (window.innerHeight - r.bottom) <= 80;
              const small = r.width <= 120 && r.height <= 120;
              const clickable = (el.tagName === 'BUTTON') || (el.getAttribute('role') === 'button') || !!(el as any).onclick;
              if (nearRight && nearBottom && small && clickable) {
                try { (el as any).click?.(); } catch {}
                break;
              }
            }
          } catch {}
        }
        // Run a few times to catch late-loading embeds
        window.addEventListener('load', () => setTimeout(attemptOpen, 300));
        const iv = setInterval(attemptOpen, 1500);
        setTimeout(() => clearInterval(iv), 12000);
      })();`;
      doc.body.appendChild(auto);

      // Client-side social extraction from rendered DOM (faster, catches JS-rendered links)
      try {
        const extractFromDoc = () => {
          try {
            const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[];
            const found: Social[] = [];
            const push = (platform: string, url: string) => {
              try {
                const u = new URL(url, (doc.URL || ''));
                const normalized = `${u.protocol}//${u.hostname}${u.pathname}`;
                if (!found.find((s) => s.url === normalized)) found.push({ platform, url: normalized });
              } catch {}
            };
            const matchers: { platform: string; test: (u: string) => boolean }[] = [
              { platform: 'instagram', test: (u) => /instagram\.com\//i.test(u) },
              { platform: 'twitter', test: (u) => /(twitter|x)\.com\//i.test(u) },
              { platform: 'facebook', test: (u) => /facebook\.com\//i.test(u) },
              { platform: 'linkedin', test: (u) => /linkedin\.com\//i.test(u) },
              { platform: 'tiktok', test: (u) => /tiktok\.com\//i.test(u) },
              { platform: 'youtube', test: (u) => /(youtube\.com|youtu\.be)\//i.test(u) },
              { platform: 'pinterest', test: (u) => /pinterest\.com\//i.test(u) },
              { platform: 'threads', test: (u) => /threads\.net\//i.test(u) },
              { platform: 'snapchat', test: (u) => /snapchat\.com\//i.test(u) },
              { platform: 'reddit', test: (u) => /reddit\.com\//i.test(u) },
              { platform: 'whatsapp', test: (u) => /(wa\.me|api\.whatsapp\.com)\//i.test(u) },
              { platform: 'telegram', test: (u) => /(t\.me|telegram\.me|telegram\.dog)\//i.test(u) },
              { platform: 'discord', test: (u) => /(discord\.gg|discord\.com\/invite)\//i.test(u) },
              { platform: 'linktree', test: (u) => /(linktr\.ee|beacons\.ai|taplink\.cc)\//i.test(u) },
            ];
            for (const a of anchors) {
              const href = a.href || a.getAttribute('href') || '';
              for (const { platform, test } of matchers) {
                if (test(href)) { push(platform, href); break; }
              }
            }
            if (found.length > 0) {
              // Merge with existing socials state (dedupe by url)
              setSocials((prev) => {
                const seen = new Set(prev.map((p) => p.url));
                const merged = [...prev];
                for (const s of found) { if (!seen.has(s.url)) { merged.push(s); seen.add(s.url); } }
                return merged;
              });
            }

            // Extract emails from DOM (mailto and Gmail compose links)
            try {
              const emailSet = new Set<string>();
              // mailto links
              for (const a of anchors) {
                const href = a.getAttribute('href') || '';
                if (/^mailto:/i.test(href)) {
                  const addr = href.replace(/^mailto:/i, '').trim();
                  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(addr)) emailSet.add(addr);
                }
              }
              // Gmail compose links
              for (const a of anchors) {
                const href = a.href || '';
                if (/mail\.google\.com\/mail\//.test(href) && /[?&]tf=cm/.test(href)) {
                  try {
                    const u = new URL(href);
                    const to = u.searchParams.get('to');
                    if (to && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(to)) emailSet.add(to);
                  } catch {}
                }
              }
              if (emailSet.size > 0) {
                setEmails((prev) => {
                  const seen = new Set(prev);
                  const merged = [...prev];
                  for (const e of emailSet) { if (!seen.has(e)) { merged.push(e); seen.add(e); } }
                  return merged;
                });
              }
            } catch {}
          } catch {}
        };
        // Run after load and a few times to catch SPA render
        extractFromDoc();
        setTimeout(extractFromDoc, 600);
        setTimeout(extractFromDoc, 1600);
        setTimeout(extractFromDoc, 3000);
      } catch {}
    }
    const el = iframeRef.current;
    if (el) {
      el.addEventListener("load", inject);
      return () => el.removeEventListener("load", inject);
    }
  }, [chatbotScript]);

  const iframeSrc = websiteUrl ? `/api/proxy?url=${encodeURIComponent(websiteUrl)}&fast=1` : "about:blank";

  function businessNameFromHostname(hostname: string): string {
    if (!hostname) return "";
    let host = hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (host.includes(".")) host = host.split(".")[0];
    const name = host
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return name || host.charAt(0).toUpperCase() + host.slice(1).toLowerCase();
  }

  function classifyPurpose(raw: string): { intent: string; cta: string } {
    const p = (raw || "").toLowerCase();
    if (/support|bug|issue|problem|error/.test(p)) return { intent: "support", cta: "Could we schedule a quick call to fix this?" };
    if (/partnership|partner|collaborat|affiliate|resell/.test(p)) return { intent: "partnership", cta: "Open to exploring a quick partnership chat this week?" };
    if (/web|site|design|redesign|shopify|store/.test(p)) return { intent: "web", cta: "Would you be open to a quick audit of your store?" };
    if (/seo|search|traffic|growth/.test(p)) return { intent: "seo", cta: "Can I share a 3‑point plan to lift organic traffic?" };
    if (/chatbot|bot|automation|ai/.test(p)) return { intent: "bot", cta: "May I send a short demo tailored to your site?" };
    if (/feedback|suggestion|improv|optimiz/.test(p)) return { intent: "feedback", cta: "Mind if I send a few quick suggestions?" };
    if (/intro|introduc|hello|hi|present/.test(p)) return { intent: "intro", cta: "Could we do a 10‑minute intro next week?" };
    return { intent: "generic", cta: "Open to a short chat to see if this helps?" };
  }

  function generateDraftFromPurpose(rawPurpose: string): { subject: string; body: string } {
    const cls = classifyPurpose(rawPurpose);
    const host = (() => { try { return websiteUrl ? new URL(websiteUrl).hostname : ""; } catch { return ""; } })();
    const brand = host ? businessNameFromHostname(host) : undefined;
    const subjectByIntent: Record<string, string> = {
      support: `Quick help for {{domain}}`,
      partnership: `Exploring a partner fit with {{domain}}`,
      web: `Ideas to improve {{domain}}`,
      seo: `SEO lift opportunities for {{domain}}`,
      bot: `A tailored chatbot demo for {{domain}}`,
      feedback: `Suggestions for {{domain}}`,
      intro: `Hello from a fellow builder`,
      generic: `A quick note for {{domain}}`,
    };
    const subject = subjectByIntent[cls.intent] || subjectByIntent.generic;
    const greeting = `Hi {{firstName}},`;
    const opener = brand
      ? `I was checking out {{domain}} and wanted to share a ${cls.intent === 'support' ? 'quick fix' : 'few ideas'} aligned with your goals.`
      : `I wanted to share a quick note aligned with your goals.`;
    const purposeLine = rawPurpose.trim().length ? `Purpose: ${rawPurpose.trim()}.` : `Purpose: Quick value tailored to your site.`;
    const valueBullets = cls.intent === 'bot'
      ? "• Welcome visitors and capture emails automatically\n• Answer common questions instantly\n• Escalate complex chats to you by email"
      : cls.intent === 'web'
      ? "• Speed up load time and reduce bounce\n• Clarify product pages to lift conversion\n• Smooth checkout and trust signals"
      : cls.intent === 'seo'
      ? "• Fix technical crawl blockers\n• Improve key pages’ titles/descriptions\n• Plan content for buyer intents"
      : "• Keep it concise and useful\n• Tailor to {{domain}}\n• Respect your time";
    const closing = cls.cta + "\n\n— Thanks!\n";
    const body = [greeting, '', opener, '', purposeLine, '', valueBullets, '', closing].join('\n');
    return { subject, body };
  }

  function applyTemplate(tpl: string, data: { firstName?: string; domain?: string }): string {
    let out = tpl ?? "";
    const map: Record<string, string> = {
      firstName: data.firstName ?? "",
      domain: data.domain ?? "",
    };
    for (const key of Object.keys(map)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      out = out.replace(re, map[key]);
    }
    return out;
  }

  function generateHookVariants(rawPurpose: string, sample?: { domain?: string; firstName?: string }): { subject: string; body: string }[] {
    const p = (rawPurpose || "").toLowerCase();
    const intent = (/web|site|design|redesign|shopify|store/.test(p)) ? "web"
      : (/seo|search|traffic|growth/.test(p)) ? "seo"
      : (/chatbot|bot|automation|ai/.test(p)) ? "bot"
      : (/partnership|partner|collaborat|affiliate|resell/.test(p)) ? "partnership"
      : "generic";

    const subjBase: Record<string, string[]> = {
      generic: [
        "Quick question about {{domain}}",
        "Interested in {{domain}}",
        "Are you available this week?",
        "New customer inquiry",
        "Small idea for {{domain}}",
      ],
      web: [
        "Quick question about {{domain}}",
        "Ideas for {{domain}}",
        "Are you available this week?",
        "New customer inquiry",
        "Small idea for {{domain}}",
      ],
      seo: [
        "Quick question about {{domain}}",
        "Found a quick win for {{domain}}",
        "Are you available this week?",
        "New customer inquiry",
        "Small idea for {{domain}}",
      ],
      bot: [
        "Quick question about {{domain}}",
        "Interested in {{domain}}",
        "Are you available this week?",
        "New customer inquiry",
        "Small idea for {{domain}}",
      ],
      partnership: [
        "Quick question about {{domain}}",
        "Interested in {{domain}}",
        "Are you available this week?",
        "Exploring a fit with {{domain}}",
        "Small idea for {{domain}}",
      ],
    };
    const bodies = [
      "Hi {{firstName}}, are you currently taking orders? I had a small note that could help more buyers check out at {{domain}} — want me to share?",
      "Looking at {{domain}} — are you accepting new clients? Also spotted a quick win that might lift sales; happy to send it if useful.",
      "Hi {{firstName}}, love what you’re building at {{domain}}. Open to a 2‑minute idea that could help more customers through checkout?",
      "Are you available this week? I have a short suggestion for {{domain}} that could help — should I send it?",
      "Hi {{firstName}}, I’m browsing {{domain}} and had a couple questions. I also noticed a tiny tweak that might boost conversions — okay to share?",
    ];
    const subjects = subjBase[intent] || subjBase.generic;
    const count = Math.min(5, subjects.length);
    const vs: { subject: string; body: string }[] = [];
    for (let i = 0; i < count; i++) {
      vs.push({ subject: subjects[i], body: bodies[i % bodies.length] });
    }
    return vs;
  }

  return (
    <div className="min-h-screen">
      <div className="px-0 py-0">
        {/* Removed header and external link for a clean preview */}
        {loading && (
          <div className="mb-4 rounded-md border border-white/20 bg-black/30 p-3 text-white">Preparing preview…</div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>
        )}
        {/* Email notification popup: top-left */}
        {showInfoPopup && (emails.length > 0 || socials.length > 0) && (
          <div className="fixed top-4 left-4 z-50 max-w-sm rounded-md border border-white/20 bg-black/80 p-3 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                <div className="font-semibold">Website Info Found</div>
                {emails.length > 0 && (
                  <div className="mt-1 break-all opacity-90">{emails[0]}</div>
                )}
                {socials.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="opacity-80">Socials:</div>
                    <ul className="list-disc pl-5">
                      {socials.slice(0, 5).map((s, idx) => (
                        <li key={`${s.platform}-${idx}`} className="break-all">
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {s.platform}: {s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowInfoPopup(false)}
                aria-label="Dismiss"
                className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowComposeOverlay(true)}
                className="inline-flex items-center rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20 disabled:opacity-50"
                disabled={emails.length === 0}
                aria-label="Open email compose with scraped address"
              >
                Scout
              </button>
            </div>
          </div>
        )}
        {showComposeOverlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowComposeOverlay(false)} />
            <div className="relative z-10 w-full max-w-2xl rounded-lg border border-white/20 bg-black/70 p-4 shadow-xl text-white">
              <div className="text-lg font-semibold mb-2">Scout Compose</div>
              <div className="text-xs text-gray-300 mb-3">{'Use variables: {{firstName}}, {{domain}}'}</div>
              <div className="mb-3">
                <label className="block text-xs text-gray-300 mb-1">Purpose of the message</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Offer a tailored chatbot demo, propose a quick partnership, request feedback"
                  className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Subject (optional)"
                  value={subjectTpl}
                  onChange={(e) => setSubjectTpl(e.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  rows={6}
                  placeholder="Write your message… e.g. Hi {{firstName}}, I love your store at {{domain}}!"
                  value={bodyTpl}
                  onChange={(e) => setBodyTpl(e.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
                    onClick={() => {
                      const email = emails[0];
                      const host = (() => { try { return websiteUrl ? new URL(websiteUrl).hostname : ""; } catch { return ""; } })();
                      const firstName = email ? email.split('@')[0] : undefined;
                      const v = generateHookVariants(purpose, { domain: host, firstName });
                      // Keep placeholders intact; personalize on Compose
                      setVariants(v);
                      if (v.length > 0) {
                        setSubjectTpl(v[0].subject);
                        setBodyTpl(v[0].body);
                      }
                    }}
                  >Generate hooks</button>
                  {variants.length > 0 && (
                    <select
                      className="rounded-md border border-white/20 bg-white/95 px-2 py-2 text-sm text-gray-900"
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        const v = variants[idx];
                        setSubjectTpl(v.subject);
                        setBodyTpl(v.body);
                      }}
                    >
                      {variants.map((v, i) => (
                        <option key={i} value={i}>{v.subject}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
                    onClick={() => setShowComposeOverlay(false)}
                  >Cancel</button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded bg-green-600 px-3 py-1 text-sm hover:bg-green-700"
                    onClick={() => {
                      try {
                        const email = emails[0];
                        if (!email) return;
                        const host = (() => { try { return websiteUrl ? new URL(websiteUrl).hostname : ""; } catch { return ""; } })();
                        const firstName = email.split('@')[0];
                        const subj = subjectTpl.trim().length ? applyTemplate(subjectTpl, { firstName, domain: host }) : '';
                        const body = bodyTpl.trim().length ? applyTemplate(bodyTpl, { firstName, domain: host }) : '';
                        const base = `https://mail.google.com/mail/u/0/?fs=1&tf=cm&to=${encodeURIComponent(email)}`;
                        const url = base + (subj ? `&su=${encodeURIComponent(subj)}` : '') + (body ? `&body=${encodeURIComponent(body)}` : '');
                        window.open(url, "_blank", "noopener,noreferrer");
                        setShowComposeOverlay(false);
                      } catch {}
                    }}
                  >Compose</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="h-screen w-screen overflow-hidden">
          <iframe ref={iframeRef} id="preview-frame" src={iframeSrc} className="h-full w-full" />
        </div>
        {/* Removed external link for a focused preview experience */}
      </div>
    </div>
  );
}


