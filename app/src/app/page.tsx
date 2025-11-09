"use client";

import { useState } from "react";
import { Star, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileNav from "@/components/MobileNav";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import WebScoutModal from "@/components/WebScoutModal";
import Particles from "@/components/Particles";

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
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
    // Generate ID on the client to navigate immediately
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

    // Fire-and-forget record creation to reduce perceived latency
    fetch("/api/create-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ website_url: website, chatbot_script: scriptCode, id }),
    }).catch((err) => console.error("create-preview error", err));

    // Navigate immediately to the preview page
    window.location.href = `/preview/${id}`;
  }

  return (
    <div className="min-h-screen text-white">
      <header className="sticky top-0 z-40 mt-2 px-6 py-0">
        <div className="container mx-auto">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-full border border-white/10 bg-black/70 px-6 py-4 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black font-bold">A</div>
            <span className="font-semibold tracking-wide">CBV|ChatPreview</span>
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
      <main className="flex-1 relative">
        <Particles />
        <section className="py-24 relative">
          <div className="container mx-auto px-6 text-center">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="mx-auto mb-3 w-fit" aria-hidden="true">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-base text-gray-100 shadow-sm backdrop-blur">
              <span className="inline-flex h-6 w-6 items-center justify-center">
                <Pipette className="h-5 w-5 text-orange-400" />
              </span>
              <span className="opacity-90 font-medium">→ Scout & Preview</span>
            </div>
          </div>
          <h1 className="text-3xl font-semibold lg:text-6xl">
            Your go-to tool for all scouting purposes
          </h1>
          <p className="text-balance text-gray-200 lg:text-lg">
            Find qualified leads, collect domains and emails, generate hooks, personalize outreach, and preview chatbots—everything you need for fast, effective scouting in one place.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Button size="lg" onClick={() => setIsOpen(true)}>Generate Preview</Button>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => setScoutOpen(true)}>Web Scout</Button>
          {/* Chat Assistant removed */}
        </div>

        <div className="mx-auto mt-10 flex w-fit flex-col items-center gap-4 sm:flex-row">
          <span className="mx-4 inline-flex items-center -space-x-4">
            {[
              { src: "https://randomuser.me/api/portraits/women/65.jpg", alt: "Sophia" },
              { src: "https://randomuser.me/api/portraits/men/32.jpg", alt: "Daniel" },
              { src: "https://randomuser.me/api/portraits/women/44.jpg", alt: "Ava" },
              { src: "https://randomuser.me/api/portraits/men/75.jpg", alt: "Liam" },
              { src: "https://randomuser.me/api/portraits/men/12.jpg", alt: "Noah" },
            ].map((avatar, index) => (
              <Avatar key={index} className="size-14 border">
                <AvatarImage src={avatar.src} alt={avatar.alt} />
              </Avatar>
            ))}
          </span>
          <div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, index) => (
                <Star key={index} className="size-5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="mr-1 font-semibold">5.0</span>
            </div>
            <p className="text-left font-medium text-gray-300">Loved by 200+ teams</p>
          </div>
        </div>
          </div>

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

          {scoutOpen && (
            <WebScoutModal isOpen={scoutOpen} onClose={() => setScoutOpen(false)} />
          )}
          {/* Chat Assistant removed */}
        </section>
      </main>
      <footer className="border-t border-white/10">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-gray-300">
          copyright @ Arkilostudios | C.E.O - David A. Victor
        </div>
      </footer>
    </div>
  );
}
