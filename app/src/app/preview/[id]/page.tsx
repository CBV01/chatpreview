"use client";

import { use, useEffect, useRef, useState } from "react";

async function fetchPreviewWithRetry(id: string, attempts = 6, delayMs = 300) {
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
  const [showEmailPopup, setShowEmailPopup] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setLoading(true);
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
        const data = (await res.json()) as { emails: string[] };
        if (Array.isArray(data.emails) && data.emails.length > 0) {
          setEmails(data.emails);
          setShowEmailPopup(true);
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
    }
    const el = iframeRef.current;
    if (el) {
      el.addEventListener("load", inject);
      return () => el.removeEventListener("load", inject);
    }
  }, [chatbotScript]);

  const iframeSrc = websiteUrl ? `/api/proxy?url=${encodeURIComponent(websiteUrl)}` : "about:blank";

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
        {showEmailPopup && emails.length > 0 && (
          <div className="fixed top-4 left-4 z-50 max-w-sm rounded-md border border-white/20 bg-black/80 p-3 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                <div className="font-semibold">Website Email Found</div>
                <div className="mt-1 break-all opacity-90">{emails[0]}</div>
              </div>
              <button
                onClick={() => setShowEmailPopup(false)}
                aria-label="Dismiss"
                className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  try {
                    const email = emails[0];
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                      navigator.userAgent
                    );
                    const mailtoUrl = `mailto:${encodeURIComponent(email)}`;
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
                    const url = isMobile ? mailtoUrl : gmailUrl;
                    window.open(url, "_blank", "noopener,noreferrer");
                  } catch {}
                }}
                className="inline-flex items-center rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
                aria-label="Open email compose with scraped address"
              >
                Scout
              </button>
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


