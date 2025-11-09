"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type MobileNavProps = {
  onGenerateClick?: () => void;
};

export default function MobileNav({ onGenerateClick }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current) return;
      const target = e.target as Node;
      if (open && panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-black/60 p-2 text-white hover:bg-black/80"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="fixed right-4 top-16 z-50 w-[85vw] max-w-xs rounded-2xl border border-white/15 bg-black/75 p-4 shadow-2xl backdrop-blur"
          >
            <nav className="flex flex-col gap-3 text-sm text-gray-200">
              <a href="/" className="rounded-lg px-3 py-2 hover:bg-white/5">Home</a>
              <a href="/guide" className="rounded-lg px-3 py-2 hover:bg-white/5">Guide</a>
            </nav>
            <div className="mt-4">
              <Button
                className="w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:from-orange-600 hover:to-amber-600"
                onClick={() => {
                  onGenerateClick?.();
                  setOpen(false);
                }}
              >
                Generate Preview
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}