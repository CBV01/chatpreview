"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileNav from "@/components/MobileNav";

export default function GuidePage() {
  const [isOpen, setIsOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const website = websiteUrl.trim();
    const scriptCode = script.trim();
    if (!website || !scriptCode) {
      setError("Please provide a valid website URL and chatbot script.");
      return;
    }
    setError(null);
    setLoading(true);
    const id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
      ? globalThis.crypto.randomUUID()
      : `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

    // Persist locally so the preview works on Vercel without server-side storage
    try {
      localStorage.setItem(
        `preview:${id}`,
        JSON.stringify({ website_url: website, chatbot_script: scriptCode })
      );
    } catch {}

    fetch("/api/create-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ website_url: website, chatbot_script: scriptCode, id }),
    }).catch((err) => console.error("create-preview error", err));

    window.location.href = `/preview/${id}`;
  }

  return (
    <div className="min-h-screen text-white">
      {/* Local header */}
      <header className="sticky top-0 z-40 mt-2 px-6 py-0">
        <div className="container mx-auto">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-full border border-white/10 bg-black/70 px-6 py-4 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black font-bold">A</div>
            <a href="/" className="font-semibold tracking-wide hover:opacity-90">CBV|ChatPreview</a>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-200">
              <a href="/" className="hover:text-white">Home</a>
              <a href="/guide" className="hover:text-white">Guide</a>
            </nav>
            <button
              onClick={() => setIsOpen(true)}
              className="hidden md:inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-sm font-semibold text-black hover:from-orange-600 hover:to-amber-600"
            >
              Generate Preview
            </button>
            <MobileNav onGenerateClick={() => setIsOpen(true)} />
          </div>
        </div>
      </header>

      {/* Two-column content with left sidebar */}
      <main className="container mx-auto px-6 py-10">
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8">
          {/* Left sidebar */}
          <aside className="sticky top-24 self-start rounded-lg border border-white/10 bg-black/60 p-4 text-sm">
            <div className="mb-3 text-xs uppercase tracking-wide opacity-70">Guide</div>
            <nav className="space-y-2">
              <a href="#overview" className="block rounded px-2 py-1 hover:bg-white/10">Overview</a>
              <a href="#quick-start" className="block rounded px-2 py-1 hover:bg-white/10">Quick Start</a>
              <a href="#home" className="block rounded px-2 py-1 hover:bg-white/10">Home Page</a>
              <a href="#generate-preview" className="block rounded px-2 py-1 hover:bg-white/10">Preview</a>
              <a href="#preview-socials" className="block rounded px-2 py-1 hover:bg-white/10">Socials (Preview)</a>
              <a href="#email-scout" className="block rounded px-2 py-1 hover:bg-white/10">Scout</a>
              <a href="#web-scout" className="block rounded px-2 py-1 hover:bg-white/10">Web Scout</a>
              <a href="#message-templates" className="block rounded px-2 py-1 hover:bg-white/10">Message Templates</a>
              <a href="#emails-tab" className="block rounded px-2 py-1 hover:bg-white/10">Emails Tab</a>
              <a href="#domains-tab" className="block rounded px-2 py-1 hover:bg-white/10">Domains Tab</a>
              <a href="#speed-tips" className="block rounded px-2 py-1 hover:bg-white/10">Speed Tips</a>
              <a href="#troubleshooting" className="block rounded px-2 py-1 hover:bg-white/10">Troubleshooting</a>
            </nav>
          </aside>
          {/* Toolbar */}
          <section className="space-y-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-orange-400" />
                <h1 className="text-3xl font-semibold">Installation & Usage</h1>
              </div>
              {/* Save Guide button removed */}
            </div>

            {/* Content */}
            <article className="space-y-8 text-lg leading-relaxed">
              <section id="overview" className="scroll-mt-24">
                <p className="text-gray-200">
                  Preview your chatbot on any website before deploying. Provide a website URL and paste your provider’s embed script to render a live test page with the bot injected.
                </p>
              </section>

              <section id="prerequisites" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Prerequisites</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 text-gray-200">
                  <li>
                    Create a chatbot on a provider such as
                    {" "}
                    <a className="text-blue-400 hover:underline inline-flex items-center" href="https://www.chatbase.co/" target="_blank" rel="noreferrer">
                      Chatbase <ExternalLink className="ml-1 h-3 w-3" />
                    </a>,
                    {" "}
                    <a className="text-blue-400 hover:underline inline-flex items-center" href="https://chatfuel.com/" target="_blank" rel="noreferrer">
                      Chatfuel <ExternalLink className="ml-1 h-3 w-3" />
                    </a>, or a similar platform.
                  </li>
                  <li>Copy the chatbot’s web embed script (usually a &lt;script&gt; snippet).</li>
                  <li>Have the target website URL you want to preview.</li>
                </ul>
              </section>

              <section id="quick-start" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Quick start</h2>
                <ol className="mt-3 list-decimal pl-6 space-y-3 text-gray-200">
                  <li>Open Home and click <span className="font-semibold">Get Started</span> or <span className="font-semibold">Generate Preview</span>.</li>
                  <li>Enter your <span className="font-semibold">Website URL</span> and paste your <span className="font-semibold">Chatbot Script</span>.</li>
                  <li>Click <span className="font-semibold">Generate</span> to open the preview page.</li>
                </ol>
              </section>

              <section id="home" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Home Page</h2>
                <p className="mt-3 text-gray-200">The Home page is your starting point to either generate a chatbot preview or run bulk scouting.</p>
                <ol className="mt-3 list-decimal pl-6 space-y-3 text-gray-200">
                  <li>To preview your bot on a site, click <span className="font-semibold">Generate Preview</span>.</li>
                  <li>To find emails and socials from domains or email lists, click <span className="font-semibold">Web Scout</span>.</li>
                  <li>Follow the steps in each respective section below for a detailed walkthrough.</li>
                </ol>
              </section>

              <section id="generate-preview" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Generate preview</h2>
                <p className="mt-3 text-gray-200">We render your site and inject your script so you can test placement, behavior, and UX in a realistic environment.</p>
                <ul className="mt-3 list-disc pl-6 space-y-2 text-gray-200">
                  <li>Preview loads faster on repeat views thanks to caching.</li>
                  <li>The top-left popup shows scraped email and social links if found.</li>
                  <li>Click <span className="font-semibold">Scout</span> to open your email app pre-filled with the address.</li>
                </ul>
              </section>

              <section id="preview-socials" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Socials in Preview</h2>
                <p className="mt-3 text-gray-200">We automatically discover social links (Instagram, X/Twitter, Facebook, LinkedIn, TikTok, YouTube, Pinterest, Threads, Snapchat, Reddit, WhatsApp, Telegram, Discord, Linktree) from the page and common subpages (e.g., Contact, About). The preview also scans the live DOM to catch SPA-rendered links.</p>
                <ul className="mt-3 list-disc pl-6 space-y-2 text-gray-200">
                  <li>Click social links directly from the popup to open in new tabs.</li>
                  <li>Discovery runs quickly with short timeouts and deduping.</li>
                </ul>
              </section>

              <section id="email-scout" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Email scout</h2>
                <p className="mt-3 text-gray-200">If the page contains email addresses, use the <span className="font-semibold">Scout</span> button to open your mail client with the address pre-filled.</p>
                <ul className="mt-3 list-disc pl-6 space-y-2 text-gray-200">
                  <li><span className="font-semibold">Tabs</span>: opens one Gmail compose per recipient; supports per-person personalization.</li>
                  <li><span className="font-semibold">Reliable (BCC)</span>: opens a single compose window with shared subject/body for all recipients; fastest load.</li>
                  <li>Sending remains manual (you click Send). Browsers block auto-send without an API.</li>
                </ul>
                <h3 className="mt-4 text-xl font-semibold">Step-by-step (Preview page)</h3>
                <ol className="mt-2 list-decimal pl-6 space-y-2 text-gray-200">
                  <li>Open a preview via <span className="font-semibold">Generate Preview</span> and wait for the page to render.</li>
                  <li>Watch the top-left popup for discovered <span className="font-semibold">Emails</span> and <span className="font-semibold">Socials</span>.</li>
                  <li>Click <span className="font-semibold">Scout</span> to open the compose overlay.</li>
                  <li>Select <span className="font-semibold">Tabs</span> or <span className="font-semibold">Reliable (BCC)</span>.</li>
                  <li>Fill in your <span className="font-semibold">Subject</span> and <span className="font-semibold">Body</span> (you can use variables).</li>
                  <li>Confirm and open your mail client; review and click <span className="font-semibold">Send</span>.</li>
                </ol>
              </section>

              <section id="web-scout" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Web Scout</h2>
                <p className="mt-3 text-gray-200">Run domain or email-based scouting from Home to collect emails, socials, and prepare messages at scale.</p>
                <div className="mt-2 rounded-md border border-white/10 bg-black/50 p-3 text-sm">
                  <div className="font-semibold">Two tabs:</div>
                  <ul className="mt-2 list-disc pl-6 space-y-1 text-gray-200">
                    <li><span className="font-semibold">Domains</span>: paste domains or full URLs to discover emails/socials.</li>
                    <li><span className="font-semibold">Emails</span>: paste email addresses; we infer domains and enrich.</li>
                  </ul>
                </div>
                <h3 className="mt-4 text-xl font-semibold">Domains tab — step-by-step</h3>
                <ol className="mt-2 list-decimal pl-6 space-y-2 text-gray-200">
                  <li>From Home, click <span className="font-semibold">Web Scout</span> and select <span className="font-semibold">Domains</span>.</li>
                  <li>Paste one domain or URL per line (e.g., <code>brand.com</code> or <code>https://brand.com</code>).</li>
                  <li>Click <span className="font-semibold">Run Scout</span>.</li>
                  <li>We normalize domains, fetch the homepage, and check common subpages to discover emails and socials.</li>
                  <li>Review results: domain, found emails, derived first name, and social links.</li>
                  <li>Open the <span className="font-semibold">Message Template</span> overlay to set subject/body and variables.</li>
                  <li>Choose <span className="font-semibold">Tabs</span> or <span className="font-semibold">Reliable (BCC)</span> and click <span className="font-semibold">Scout</span> to open your mail client.</li>
                  <li>(Optional) Export results to CSV for records or follow-ups.</li>
                </ol>
                <h3 className="mt-4 text-xl font-semibold">Emails tab — step-by-step</h3>
                <ol className="mt-2 list-decimal pl-6 space-y-2 text-gray-200">
                  <li>From Home, click <span className="font-semibold">Web Scout</span> and select <span className="font-semibold">Emails</span>.</li>
                  <li>Paste one email per line.</li>
                  <li>Click <span className="font-semibold">Process Emails</span>.</li>
                  <li>We infer the domain for each email and derive a business-style first name from the brand.</li>
                  <li>Review enriched rows: email, inferred domain, first name, discovered socials.</li>
                  <li>Open the <span className="font-semibold">Message Template</span> overlay, set subject/body (variables supported).</li>
                  <li>Select send mode (<span className="font-semibold">Tabs</span> or <span className="font-semibold">Reliable (BCC)</span>) and click <span className="font-semibold">Scout</span>.</li>
                </ol>
                <div className="mt-3 rounded-md border border-white/10 bg-black/50 p-3 text-sm">
                  <div className="font-semibold">Notes</div>
                  <ul className="mt-2 list-disc pl-6 space-y-1 text-gray-200">
                    <li>Sending is manual; auto-send requires an email API and authorization.</li>
                    <li>For fastest Gmail load, prefer <span className="font-semibold">Reliable (BCC)</span>.</li>
                  </ul>
                </div>
              </section>

              <section id="message-templates" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Message Templates</h2>
                <p className="mt-3 text-gray-200">Click <span className="font-semibold">Scout</span> to open the <span className="font-semibold">Message Template</span> overlay. Set <span className="font-semibold">Subject</span> and <span className="font-semibold">Body</span> with variables:</p>
                <div className="mt-2 rounded-md border border-white/10 bg-black/50 p-3 text-sm">
                  <div>Available variables:</div>
                  <div className="mt-1">{"{{firstName}}"}, {"{{email}}"}, {"{{domain}}"}</div>
                </div>
                <ul className="mt-3 list-disc pl-6 space-y-2 text-gray-200">
                  <li>Variables are filled per recipient in <span className="font-semibold">Tabs</span> mode.</li>
                  <li>In <span className="font-semibold">Reliable (BCC)</span>, subject/body are the same for all recipients.</li>
                </ul>
              </section>

              <section id="emails-tab" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Emails Tab</h2>
                <p className="mt-3 text-gray-200">Paste emails to process. We infer domains, scrape socials, and derive a business-style <span className="font-semibold">First name</span> from the domain brand for personalization.</p>
                <h3 className="mt-3 text-xl font-semibold">Step-by-step</h3>
                <ol className="mt-2 list-decimal pl-6 space-y-2 text-gray-200">
                  <li>Open <span className="font-semibold">Web Scout</span> and switch to <span className="font-semibold">Emails</span>.</li>
                  <li>Paste one email per line and click <span className="font-semibold">Process Emails</span>.</li>
                  <li>Review enriched data: email, inferred domain, first name, socials.</li>
                  <li>Set your template and click <span className="font-semibold">Scout</span> to open compose windows.</li>
                </ol>
              </section>

              <section id="domains-tab" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Domains Tab</h2>
                <p className="mt-3 text-gray-200">Submit website URLs. We normalize domains, discover emails and socials, and provide quick actions to scout.</p>
                <h3 className="mt-3 text-xl font-semibold">Step-by-step</h3>
                <ol className="mt-2 list-decimal pl-6 space-y-2 text-gray-200">
                  <li>Open <span className="font-semibold">Web Scout</span> and switch to <span className="font-semibold">Domains</span>.</li>
                  <li>Paste domains or full URLs (one per line) and click <span className="font-semibold">Run Scout</span>.</li>
                  <li>Review discovered emails and socials for each domain.</li>
                  <li>Apply your template and click <span className="font-semibold">Scout</span> to open your mail client.</li>
                </ol>
              </section>

              <section id="deployment" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Deployment</h2>
                <p className="mt-3 text-gray-200">Once satisfied, deploy the embed script to your production site via your CMS, theme, or directly in HTML.</p>
              </section>

              <section id="snippet" className="scroll-mt-24">
                <h3 className="text-xl font-semibold">Example embed snippet</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-4 text-sm">
{`<!-- Replace this with your provider's embed code -->
<script>
  // Example placeholder
  window.myChatbotConfig = { botId: "YOUR_BOT_ID" };
  (function() {
    var s = document.createElement('script');
    s.src = 'https://provider.example.com/embed.js';
    s.async = true; document.head.appendChild(s);
  })();
</script>`}
                </pre>
                <div className="mt-4 flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Tip: Keep your bot keys secure. Never expose secrets client-side.</span>
                </div>
              </section>

              <section id="troubleshooting" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Troubleshooting</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 text-gray-200">
                  <li>Confirm the script URL is correct and accessible.</li>
                  <li>Check the browser console for provider script errors.</li>
                  <li>Ensure your site’s CSP allows third-party scripts, and avoid mixed content.</li>
                  <li>If Gmail loads slowly, prefer <span className="font-semibold">Reliable (BCC)</span> mode to reduce UI load.</li>
                </ul>
              </section>

              <section id="speed-tips" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Speed Tips</h2>
                <ul className="mt-3 list-disc pl-6 space-y-2 text-gray-200">
                  <li>Preview uses caching and fast mode to reduce load time on repeat views.</li>
                  <li>Emails/Socials scraping is deduped with short timeouts and limited subpage crawling.</li>
                  <li>For sending, <span className="font-semibold">Reliable (BCC)</span> opens one compose; <span className="font-semibold">Tabs</span> allows personalization but loads multiple windows.</li>
                </ul>
              </section>
            </article>
          </section>
        </div>
      </main>

      {/* Modal for Generate Preview */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-xl border border-white/20 bg-black/50 p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <h2 className="text-2xl font-semibold">Generate Chatbot Preview</h2>
              <p className="mt-1 text-gray-300">Enter your website URL and paste your chatbot script.</p>
            </div>
            <form onSubmit={onGenerate} className="space-y-4 text-left">
              <div>
                <label className="mb-2 block text-sm font-medium">Website URL</label>
                <input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  type="url"
                  required
                  placeholder="https://example.com"
                  className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Chatbot Script</label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  required
                  rows={10}
                  placeholder="Paste your chatbot embed code here"
                  className="w-full rounded-md border border-white/20 bg-white/95 px-3 py-2 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>
              )}
              <div className="flex items-center justify-end gap-3">
                <Button type="button" onClick={() => setIsOpen(false)} className="bg-white/5 hover:bg-white/10">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? "Generating..." : "Generate"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-gray-300">
          copyright @ Arkilostudios | C.E.O - David A. Victor
        </div>
      </footer>
    </div>
  );
}