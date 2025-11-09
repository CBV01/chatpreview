"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

type Result = {
  domain: string;
  email?: string;
  firstName?: string;
  status: "pending" | "found" | "none" | "error";
  error?: string;
  socials?: { platform: string; url: string }[];
};

function isIpv4Host(host: string): boolean {
  // Simple IPv4 check: four octets 0-255 (we don't enforce range strictly here)
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isValidDomainHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  // Disallow underscores and spaces
  if (/[\s_]/.test(host)) return false;
  // Disallow raw IPv4 addresses (e.g., 0.0.0.14)
  if (isIpv4Host(host)) return false;
  // Must contain at least one dot and a reasonable TLD
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,24}$/.test(tld)) return false;
  // Deny common placeholders and generic provider roots that may be noise
  const deny = new Set([
    "domain_url",
    "emails",
    "products_sold",
    "gmail.com",
    "outlook.com",
    "hotmail.com",
  ]);
  if (deny.has(host)) return false;
  return true;
}

function normalizeDomain(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let urlStr = s;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    if (!isValidDomainHost(host)) return null;
    return `${u.protocol}//${host}`;
  } catch {
    return null;
  }
}

export default function WebScoutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<"domains" | "emails">("domains");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preferPersonal, setPreferPersonal] = useState(true);
  const [excludeGeneric, setExcludeGeneric] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mailtoBatchIndex, setMailtoBatchIndex] = useState(0);
  const [socialMenuOpen, setSocialMenuOpen] = useState(false);
  const [mailtoMode, setMailtoMode] = useState<'bcc' | 'tabs'>('tabs');
  const [popupWarning, setPopupWarning] = useState<string | null>(null);
  const [showTemplateOverlay, setShowTemplateOverlay] = useState(false);
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [variants, setVariants] = useState<{ subject: string; body: string }[]>([]);

  function isValidEmail(s: string): boolean {
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(s);
  }

  // Sanitize tokens and emails from pasted/uploaded content
  function cleanToken(s: string): string {
    return s.trim().replace(/^["'`\s]+|["'`\s]+$/g, "");
  }

  function cleanEmail(s: string): string {
    return s
      .trim()
      .replace(/^mailto:/i, "")
      .replace(/^["'`<\(\[]+|["'`>\)\]]+$/g, "");
  }

  function looksGeneric(local: string): boolean {
    const l = local.toLowerCase();
    return ["info","support","sales","hello","contact","admin","service","help","team"].some((g) => l.includes(g));
  }

  function toTitleCase(word: string): string {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  function businessNameFromHostname(hostname: string): string {
    if (!hostname) return "";
    let host = hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    const knownSuffixes = [
      "myshopify.com",
      "shopify.com",
      "shopifycloud.com",
      "wixsite.com",
      "webflow.io",
      "square.site",
      "squarespace.com",
      "weebly.com",
      "bigcartel.com",
    ];
    for (const suf of knownSuffixes) {
      if (host.endsWith("." + suf) || host === suf) {
        const parts = host.split(".");
        const suffixLabels = suf.split(".").length;
        const labelIndex = parts.length - suffixLabels - 1;
        if (labelIndex >= 0) host = parts[labelIndex];
        break;
      }
    }
    if (host.includes(".")) host = host.split(".")[0];
    const name = host
      .split(/[-_]+/)
      .filter(Boolean)
      .map(toTitleCase)
      .join(" ");
    return name || toTitleCase(host);
  }

  function deriveFirstNameFromEmail(email?: string): string | undefined {
    if (!email) return undefined;
    const local = email.split("@")[0];
    const parts = local.split(/[._\-+]/).filter(Boolean);
    for (const p of parts) {
      if (/^[a-zA-Z]{2,}$/.test(p) && !looksGeneric(p)) {
        return toTitleCase(p);
      }
    }
    if (/^[a-zA-Z]{2,}$/.test(local)) return toTitleCase(local);
    return undefined;
  }

  function pickEmail(list: string[]): string | undefined {
    if (!list.length) return undefined;
    if (excludeGeneric) {
      const personals = list.filter((e) => !looksGeneric(e.split("@")[0] ?? ""));
      if (personals.length) return personals[0];
      return undefined;
    }
    if (preferPersonal) {
      const sorted = list.slice().sort((a, b) => Number(looksGeneric(a.split("@")[0] ?? "")) - Number(looksGeneric(b.split("@")[0] ?? "")));
      return sorted[0];
    }
    return list[0];
  }

  async function runDomainsProgressive(normalized: string[]) {
    setRunning(true);
    setResults(normalized.map((n) => ({ domain: new URL(n).hostname, status: "pending" })));
    setDoneCount(0);
    setTotalCount(normalized.length);
    const limit = Math.min(6, normalized.length);
    let i = 0;
    async function worker() {
      while (i < normalized.length) {
        const idx = i++;
        const url = normalized[idx];
        try {
          const res = await fetch(`/api/scrape-emails?url=${encodeURIComponent(url)}`);
          const data = await res.json();
          const emails: string[] = Array.isArray(data?.emails) ? data.emails.map((e: string) => cleanEmail(e)).filter((e: string) => isValidEmail(e)) : [];
          const socials: { platform: string; url: string }[] = Array.isArray(data?.socials) ? data.socials : [];
          const host = new URL(url).hostname;
          const brand = businessNameFromHostname(host);
          if (!emails.length) {
            setResults((prev) => {
              const next = [...prev];
              next[idx] = { domain: host, status: "none", firstName: brand, ...(socials.length ? { socials } : {}) };
              return next;
            });
          } else {
            const chosen = pickEmail(emails);
            if (!chosen) {
              setResults((prev) => {
                const next = [...prev];
                next[idx] = { domain: host, status: "none", firstName: brand, ...(socials.length ? { socials } : {}) };
                return next;
              });
            } else {
              const fn = brand;
              setResults((prev) => {
                const next = [...prev];
                next[idx] = { domain: host, email: cleanEmail(chosen), firstName: fn, status: "found", ...(socials.length ? { socials } : {}) };
                return next;
              });
            }
          }
          // Domain verification removed per request
        } catch (e: any) {
          setResults((prev) => {
            const next = [...prev];
            next[idx] = { domain: (() => { try { return new URL(url).hostname; } catch { return url; } })(), status: "error", error: e?.message ?? "fetch error" };
            return next;
          });
        } finally {
          setDoneCount((d) => d + 1);
        }
      }
    }
    await Promise.all(Array.from({ length: limit }, () => worker()));
    setRunning(false);
  }

  async function runEmailsProgressive(seedEmails: string[]) {
    setRunning(true);
    // Initialize results with pending entries based on email domains
    setResults(seedEmails.map((em) => ({ domain: (em.split("@")[1] ?? ""), status: "pending" })));
    setDoneCount(0);
    setTotalCount(seedEmails.length);
    const limit = Math.min(6, seedEmails.length);
    let i = 0;
    async function worker() {
      while (i < seedEmails.length) {
        const idx = i++;
        const em = cleanEmail(seedEmails[idx]);
        const domainPart = em.split("@")[1] ?? "";
        const normalizedUrl = normalizeDomain(domainPart ?? "");
        // If we can't normalize a domain, still mark found using the provided email
        if (!normalizedUrl) {
          const fn = businessNameFromHostname((domainPart || "").replace(/^www\./, ""));
          setResults((prev) => {
            const next = [...prev];
            next[idx] = { domain: domainPart, email: em, firstName: fn, status: "found" };
            return next;
          });
          setDoneCount((d) => d + 1);
          continue;
        }
        try {
          const res = await fetch(`/api/scrape-emails?url=${encodeURIComponent(normalizedUrl)}`);
          const data = await res.json();
          const socials: { platform: string; url: string }[] = Array.isArray(data?.socials) ? data.socials : [];
          const host = new URL(normalizedUrl).hostname;
          const brand = businessNameFromHostname(host);
          const fn = brand;
          setResults((prev) => {
            const next = [...prev];
            next[idx] = { domain: host, email: em, firstName: fn, status: "found", ...(socials.length ? { socials } : {}) };
            return next;
          });
          // Email verification removed per request
        } catch (e: any) {
          setResults((prev) => {
            const next = [...prev];
            const host = (() => { try { return new URL(normalizedUrl!).hostname; } catch { return domainPart; } })();
            const brand = businessNameFromHostname(host ?? "");
            next[idx] = { domain: host, email: em, firstName: brand, status: "found", error: e?.message ?? "fetch error" };
            return next;
          });
        } finally {
          setDoneCount((d) => d + 1);
        }
      }
    }
    await Promise.all(Array.from({ length: limit }, () => worker()));
    setRunning(false);
  }

  async function onRun() {
    setError(null);
    const raw = input.split(/\r?\n/).map((l) => cleanToken(l)).filter(Boolean);
    const uniq = Array.from(new Set(raw));
    if (tab === "domains") {
      const normalized = uniq
        .map((t) => normalizeDomain(t))
        .filter((v): v is string => Boolean(v));
      if (normalized.length === 0) {
        setError("Please paste at least one valid domain (one per line).");
        return;
      }
      if (normalized.length > 500) {
        setError("Please limit to 500 domains per run.");
        return;
      }
      setShowResults(true);
      await runDomainsProgressive(normalized);
    } else {
      // Emails tab: progressive scrape based on domains inferred from emails
      const emails = uniq.map((e) => cleanEmail(e)).filter(isValidEmail).slice(0, 500);
      if (emails.length === 0) {
        setError("Please paste valid email addresses (one per line).");
        return;
      }
      setShowResults(true);
      await runEmailsProgressive(emails);
    }
  }

  function copy(text: string) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }

  function getFoundEmails(): string[] {
    return results
      .filter((r) => r.status === "found" && r.email && isValidEmail(r.email))
      .map((r) => r.email!);
  }

  function getFoundEmailCount(): number {
    return getFoundEmails().length;
  }

  function collectEmailsFromDOM(): string[] {
    try {
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      const fromMailto = anchors
        .map((a) => (a.getAttribute('href') || ''))
        .filter((href) => /^mailto:/i.test(href))
        .map((href) => href.replace(/^mailto:/i, ''))
        .filter((e) => isValidEmail(e));
      const fromGmail = anchors
        .map((a) => a.href)
        .filter((href) => /mail\.google\.com\/mail\//.test(href) && /[?&]tf=cm/.test(href))
        .map((href) => {
          try {
            const u = new URL(href);
            const to = u.searchParams.get('to');
            return to ?? '';
          } catch {
            return '';
          }
        })
        .filter((e) => isValidEmail(e));
      const fromState = getFoundEmails();
      return Array.from(new Set([...fromState, ...fromMailto, ...fromGmail]));
    } catch {
      return getFoundEmails();
    }
  }

  function getTotalMailBatches(): number {
    const emails = getFoundEmails();
    const chunkSize = 10;
    if (!emails.length) return 0;
    return Math.ceil(emails.length / chunkSize);
  }

  function gmailComposeUrlForTo(email: string, accountIndex = 0): string {
    const base = `https://mail.google.com/mail/u/${accountIndex}/?fs=1&tf=cm`;
    // Use raw '@' to match expected visual format; Gmail accepts it
    return `${base}&to=${email}`;
  }

  function gmailComposeUrlForBcc(emails: string[], accountIndex = 0): string {
    const base = `https://mail.google.com/mail/u/${accountIndex}/?fs=1&tf=cm`;
    return `${base}&bcc=${emails.join(',')}`;
  }

  function gmailComposeUrlWithContentForTo(email: string, subject?: string, body?: string, accountIndex = 0): string {
    const base = gmailComposeUrlForTo(email, accountIndex);
    const parts = [base];
    if (subject && subject.length) parts.push(`&su=${encodeURIComponent(subject)}`);
    if (body && body.length) parts.push(`&body=${encodeURIComponent(body)}`);
    return parts.join("");
  }

  function gmailComposeUrlWithContentForBcc(emails: string[], subject?: string, body?: string, accountIndex = 0): string {
    const base = gmailComposeUrlForBcc(emails, accountIndex);
    const parts = [base];
    if (subject && subject.length) parts.push(`&su=${encodeURIComponent(subject)}`);
    if (body && body.length) parts.push(`&body=${encodeURIComponent(body)}`);
    return parts.join("");
  }

  function applyTemplate(tpl: string, data: { firstName?: string; email?: string; domain?: string }): string {
    let out = tpl ?? "";
    const map: Record<string, string> = {
      firstName: data.firstName ?? "",
      email: data.email ?? "",
      domain: data.domain ?? "",
    };
    for (const key of Object.keys(map)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      out = out.replace(re, map[key]);
    }
    return out;
  }

  

  function generateHookVariants(rawPurpose: string, sample?: { domain?: string; firstName?: string }): { subject: string; body: string }[] {
    const { intent } = classifyPurpose(rawPurpose);
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
      support: [
        "Quick question about {{domain}}",
        "New customer inquiry",
        "Are you available this week?",
        "Small idea for {{domain}}",
        "Interested in {{domain}}",
      ],
      partnership: [
        "Quick question about {{domain}}",
        "Interested in {{domain}}",
        "Are you available this week?",
        "Exploring a fit with {{domain}}",
        "Small idea for {{domain}}",
      ],
      feedback: [
        "Quick question about {{domain}}",
        "Small idea for {{domain}}",
        "Are you available this week?",
        "Interested in {{domain}}",
        "New customer inquiry",
      ],
      intro: [
        "Quick question about {{domain}}",
        "Hello from a fellow buyer",
        "Are you available this week?",
        "Interested in {{domain}}",
        "New customer inquiry",
      ],
    };
    const subjects = subjBase[intent] || subjBase.generic;
    const bodies = [
      "Hi {{firstName}}, are you currently taking orders? I had a small note that could help more buyers check out at {{domain}} — want me to share?",
      "Looking at {{domain}} — are you accepting new clients? Also spotted a quick win that might lift sales; happy to send it if useful.",
      "Hi {{firstName}}, love what you’re building at {{domain}}. Open to a 2‑minute idea that could help more customers through checkout?",
      "Are you available this week? I have a short suggestion for {{domain}} that could help — should I send it?",
      "Hi {{firstName}}, I’m browsing {{domain}} and had a couple questions. I also noticed a tiny tweak that might boost conversions — okay to share?",
    ];
    const count = Math.min(5, subjects.length);
    const variants: { subject: string; body: string }[] = [];
    for (let i = 0; i < count; i++) {
      variants.push({ subject: subjects[i], body: bodies[i % bodies.length] });
    }
    return variants;
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

  function generateDraftFromPurpose(rawPurpose: string, sample?: { domain?: string; firstName?: string }): { subject: string; body: string } {
    const cls = classifyPurpose(rawPurpose);
    const brand = sample?.domain ? businessNameFromHostname(sample.domain) : undefined;
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

  function personalizationForEmail(email: string): { firstName?: string; email: string; domain?: string } {
    const r = results.find((x) => x.email === email);
    const domain = r?.domain ?? (email.split("@")[1] ?? "");
    const firstName = r?.firstName ?? deriveFirstNameFromEmail(email);
    return { firstName, email, domain };
  }

  function openMailtoBatch() {
    const emails = collectEmailsFromDOM();
    const chunkSize = 10;
    if (!emails.length) return;
    const totalBatches = Math.ceil(emails.length / chunkSize);
    const idx = Math.min(mailtoBatchIndex, totalBatches - 1);
    const batch = emails.slice(idx * chunkSize, idx * chunkSize + chunkSize);
    const accountIndex = 0;
    if (mailtoMode === 'bcc') {
      const subj = subjectTemplate?.trim() || undefined;
      const body = bodyTemplate?.trim() || undefined;
      const url = gmailComposeUrlWithContentForBcc(batch, subj, body, accountIndex);
      try { window.open(url, '_blank'); } catch { window.location.href = url; }
      // Sent flag removed per request
    } else {
      // Try window.open first to detect popup blocking; fallback to anchor click
      let opened = 0;
      for (const e of batch) {
        const info = personalizationForEmail(e);
        const subj = subjectTemplate?.trim() ? applyTemplate(subjectTemplate, info) : undefined;
        const body = bodyTemplate?.trim() ? applyTemplate(bodyTemplate, info) : undefined;
        const url = gmailComposeUrlWithContentForTo(e, subj, body, accountIndex);
        let win: Window | null = null;
        try { win = window.open(url, '_blank'); } catch {}
        if (win) {
          opened++;
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          try { a.click(); } catch { try { window.location.href = url; } catch {} }
          a.remove();
        }
      }
      // Remove automatic sent flag marking per request
      if (opened < batch.length) {
        setPopupWarning(`Your browser blocked ${batch.length - opened} of ${batch.length} tabs. Please allow pop-ups for this site or use Reliable mode.`);
      } else {
        setPopupWarning(null);
      }
    }
    // Do not auto-advance; user controls batch via arrows
  }

  function handleScoutClick() {
    // Open the template overlay first; user can set subject/body, then send
    setShowTemplateOverlay(true);
  }

  function prevMailBatch() {
    const total = getTotalMailBatches();
    if (total === 0) return;
    setMailtoBatchIndex((i) => Math.max(0, i - 1));
  }

  function nextMailBatch() {
    const total = getTotalMailBatches();
    if (total === 0) return;
    setMailtoBatchIndex((i) => Math.min(total - 1, i + 1));
  }

  function availablePlatforms(): string[] {
    const setPlat = new Set<string>();
    for (const r of results) {
      for (const s of r.socials ?? []) setPlat.add(s.platform);
    }
    return Array.from(setPlat).sort();
  }

  function socialCountByPlatform(): Record<string, number> {
    const map: Record<string, Set<string>> = {};
    for (const r of results) {
      for (const s of r.socials ?? []) {
        if (!map[s.platform]) map[s.platform] = new Set<string>();
        map[s.platform].add(s.url);
      }
    }
    const out: Record<string, number> = {};
    for (const k of Object.keys(map)) out[k] = map[k].size;
    return out;
  }

  function openSocialsByPlatform(platform: string) {
    const urls = new Set<string>();
    for (const r of results) {
      for (const s of r.socials ?? []) {
        if (s.platform === platform) urls.add(s.url);
      }
    }
    // Open each link in its own tab
    Array.from(urls).forEach((u) => {
      try { window.open(u, '_blank'); } catch {}
    });
    setSocialMenuOpen(false);
  }

  if (!isOpen) return null;

  // If results are not being shown yet, render the input modal only
  if (!showResults) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-3xl rounded-xl border border-white/20 bg-black/60 p-6 shadow-2xl">
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-semibold">Web Scout</h2>
            <p className="mt-1 text-gray-300">Paste domains or emails, then run.</p>
          </div>
          <div className="mb-4 flex items-center justify-center gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "domains" ? "bg-white text-black" : "bg-white/10 text-white"}`}
              onClick={() => setTab("domains")}
            >
              Domains
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "emails" ? "bg-white text-black" : "bg-white/10 text-white"}`}
              onClick={() => setTab("emails")}
            >
              Emails
            </button>
          </div>
          <div className="space-y-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={10}
              placeholder={tab === "domains" ? `example.com\nstore.example\nhttps://brand.com` : `jane.doe@example.com\nhello@brand.com`}
              className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-300">Upload .txt or .csv — we'll strictly extract {tab === 'emails' ? 'valid emails' : 'valid domains'}.</div>
              <div className="flex items-center gap-2">
                <Button type="button" className="bg-purple-600 hover:bg-purple-700" onClick={() => fileInputRef.current?.click()}>Upload File</Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const text = await f.text();
                      const tokens = text
                        .split(/\r?\n/)
                        .flatMap((line) => line.split(/,|;|\s+/))
                        .map((t) => cleanToken(t))
                        .filter(Boolean);
                      let filtered: string[] = [];
                      if (tab === 'emails') {
                        filtered = tokens.map((t) => cleanEmail(t)).filter((t) => isValidEmail(t));
                      } else {
                        const normalized = tokens.map((t) => normalizeDomain(t)).filter((v): v is string => Boolean(v));
                        filtered = normalized;
                      }
                      const uniq = Array.from(new Set(filtered));
                      setInput(uniq.length ? uniq.join("\n") : "");
                    } catch {}
                  }}
                  className="hidden"
                />
              </div>
            </div>
            {tab === "domains" && (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={preferPersonal} onChange={(e) => setPreferPersonal(e.target.checked)} />
                  <span>Prefer personal-looking emails</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={excludeGeneric} onChange={(e) => setExcludeGeneric(e.target.checked)} />
                  <span>Exclude generic addresses</span>
                </label>
              </div>
            )}
            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button type="button" onClick={onClose} className="bg-white/5 hover:bg-white/10">Close</Button>
              <Button onClick={onRun} disabled={running} className="bg-blue-600 hover:bg-blue-700">
                {tab === "domains" ? "Run Scout" : "Process Emails"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full-screen results overlay
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <div className="text-xl font-semibold">Scout Results</div>
          {tab === "domains" && (
            <div className="text-sm text-gray-300">Processed {doneCount}/{totalCount}</div>
          )}
          <div className="text-sm text-gray-300">Emails found: {getFoundEmailCount()}</div>
          {popupWarning && (
            <div className="mt-1 text-xs text-amber-300">
              {popupWarning} — In Chrome, click the pop-up icon and choose "Always allow pop-ups and redirects" for this site.
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button type="button" className="bg-white/5 hover:bg-white/10" onClick={prevMailBatch} disabled={getTotalMailBatches() === 0 || mailtoBatchIndex === 0}>
              {"<"}
            </Button>
            <div className="text-sm text-gray-300">
              Batch {Math.min(mailtoBatchIndex + 1, Math.max(1, getTotalMailBatches()))}{getTotalMailBatches() > 0 ? ` / ${getTotalMailBatches()}` : ""}
            </div>
            <Button type="button" className="bg-white/5 hover:bg-white/10" onClick={nextMailBatch} disabled={getTotalMailBatches() === 0 || mailtoBatchIndex >= getTotalMailBatches() - 1}>
              {">"}
            </Button>
            <div className="ml-3 flex items-center rounded-md border border-white/15 overflow-hidden">
              <button
                className={`px-2 py-1 text-xs ${mailtoMode === 'bcc' ? 'bg-white/10 text-white' : 'text-gray-300'}`}
                onClick={() => setMailtoMode('bcc')}
                title="Reliable: open one compose with BCC"
              >Reliable</button>
              <button
                className={`px-2 py-1 text-xs ${mailtoMode === 'tabs' ? 'bg-white/10 text-white' : 'text-gray-300'}`}
                onClick={() => setMailtoMode('tabs')}
                title="Multiple tabs: one compose per email"
              >Tabs</button>
            </div>
          </div>
          <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={handleScoutClick} disabled={getFoundEmails().length === 0}>
            Scout
          </Button>
          <div className="relative">
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setSocialMenuOpen((o) => !o)}>
              Open Socials
            </Button>
            {socialMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-md border border-white/20 bg-black/80 p-2 shadow-xl">
                {availablePlatforms().length === 0 ? (
                  <div className="text-sm text-gray-300">No socials</div>
                ) : (
                  (() => {
                    const counts = socialCountByPlatform();
                    return availablePlatforms().map((p) => (
                      <button key={p} onClick={() => openSocialsByPlatform(p)} className="w-full rounded px-2 py-1 text-left text-sm text-white hover:bg-white/10">
                        {p} ({counts[p] ?? 0})
                      </button>
                    ));
                  })()
                )}
              </div>
            )}
          </div>
          <Button type="button" className="bg-gray-600 hover:bg-gray-700" onClick={() => setShowResults(false)}>Back</Button>
          <Button type="button" className="bg-amber-600 hover:bg-amber-700" onClick={() => {
            const header = "domain,email,firstName,status,socials";
            const rows = results.filter((r) => r.status !== "pending").map((r) => {
              const d = r.domain ?? "";
              const e = r.email ?? "";
              const f = r.firstName ?? "";
              const s = r.status;
              const soc = (r.socials ?? []).map((x) => x.url).join("|");
              return `${d},${e},${f},${s},${soc}`;
            });
            const csv = [header, ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "scout-results.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}>Export CSV</Button>
          <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={onClose}>Close</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {showTemplateOverlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowTemplateOverlay(false)} />
            <div className="relative z-10 w-full max-w-2xl rounded-lg border border-white/20 bg-black/70 p-4 shadow-xl">
              <div className="text-lg font-semibold mb-2">Message Template</div>
              <div className="text-xs text-gray-300 mb-3">{'Use variables: {{firstName}}, {{email}}, {{domain}}'}</div>
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
                  value={subjectTemplate}
                  onChange={(e) => setSubjectTemplate(e.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  rows={6}
                  placeholder="Write your message… e.g. Hi {{firstName}}, I love your store at {{domain}}!"
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    className="bg-white/5 hover:bg-white/10"
                    onClick={() => {
                      const sample = results.find((r) => r.status !== 'pending');
                      const v = generateHookVariants(purpose, { domain: sample?.domain, firstName: sample?.firstName });
                      // Keep placeholders intact; personalize per-email at send time
                      setVariants(v);
                      if (v.length > 0) {
                        setSubjectTemplate(v[0].subject);
                        setBodyTemplate(v[0].body);
                      }
                    }}
                  >Generate hooks</Button>
                  {variants.length > 0 && (
                    <select
                      className="rounded-md border border-white/20 bg-white/95 px-2 py-2 text-sm text-gray-900"
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        const v = variants[idx];
                        setSubjectTemplate(v.subject);
                        setBodyTemplate(v.body);
                      }}
                    >
                      {variants.map((v, i) => (
                        <option key={i} value={i}>{v.subject}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" className="bg-white/5 hover:bg-white/10" onClick={() => setShowTemplateOverlay(false)}>Cancel</Button>
                  <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => { setShowTemplateOverlay(false); openMailtoBatch(); }}>Send Now</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid auto-rows-fr gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
          {results.map((r, idx) => (
            <div key={idx} className="rounded-lg border border-white/15 bg-black/40 p-4 overflow-hidden">
              <div className="mb-1 text-xs text-gray-300 break-words">{r.domain}</div>
              {r.status === "pending" ? (
                <div className="text-gray-300">Scanning…</div>
              ) : r.status === "found" && r.email ? (
                <>
                  <div className="text-base font-semibold">{r.firstName ?? "—"}</div>
                  <div className="text-sm text-blue-200 break-all">
                    <a href={`https://mail.google.com/mail/u/0/?fs=1&tf=cm&to=${r.email!}`}
                       target="_blank" rel="noopener noreferrer" className="underline">
                      {r.email}
                    </a>
                  </div>
                  <div className="mt-1 flex items-center gap-2" />
                  {r.socials && r.socials.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-gray-300">Socials</div>
                      <div className="flex flex-wrap gap-2">
                        {r.socials.map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs underline text-gray-200 hover:text-white">
                            {s.platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-2">
                    <Button size="sm" className="bg-white/5 hover:bg-white/10" onClick={() => copy(`${r.firstName ?? ""}, ${r.email}`)}>Copy</Button>
                  </div>
                </>
              ) : r.status === "none" ? (
                <>
                  <div className="text-sm text-gray-300">No email found</div>
                  
                  {r.socials && r.socials.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-gray-300">Socials</div>
                      <div className="flex flex-wrap gap-2">
                        {r.socials.map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs underline text-gray-200 hover:text-white">
                            {s.platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-red-400">Error: {r.error ?? "Unable to scrape"}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}