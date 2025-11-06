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
      <header className="sticky top-0 z-40 px-6 py-7">
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

      {/* Single-column content */}
      <main className="container mx-auto px-6 py-10">
        <div className="mx-auto max-w-4xl">
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

              <section id="generate-preview" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Generate preview</h2>
                <p className="mt-3 text-gray-200">We render your site and inject your script so you can test placement, behavior, and UX in a realistic environment.</p>
              </section>

              <section id="email-scout" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold">Email scout</h2>
                <p className="mt-3 text-gray-200">If the page contains email addresses, use the <span className="font-semibold">Scout</span> button to open your mail client with the address pre-filled.</p>
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