import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const res = await fetch(target, { headers: { "user-agent": "Mozilla/5.0" } });
    const html = await res.text();

    const origin = new URL(target).origin;

    // Inject <base href> so relative assets resolve to the target origin
    const baseHref = `<base href="${origin}/">`;
    const hideLogoCss = `<style id="preview-hide-next-logo">img[src*="next.svg"], [alt*="Next"], [aria-label*="Next"], svg[aria-label*="Next"]{display:none !important;}</style>`;
    const hideLogoScript = `<script id="preview-hide-next-logo-js">(function(){function hide(){try{var nodes=document.querySelectorAll('img,svg,a,div,span');nodes.forEach(function(el){var s=getComputedStyle(el);var r=el.getBoundingClientRect();var isPos=s.position==='fixed'||s.position==='absolute';var nearLeft=r.left<=40;var nearBottom=(window.innerHeight - r.bottom)<=40;var small=r.width<=120 && r.height<=120;var hasN=(el.textContent||'').trim()==='N';var alt=(el.getAttribute('alt')||'');var aria=(el.getAttribute('aria-label')||'');var src=(el.currentSrc||el.src||'');var nextFlag=/next/i.test(alt)||/next/i.test(aria)||/next\.svg/i.test(src);if(isPos && nearLeft && nearBottom && small && (hasN||nextFlag)){el.style.setProperty('display','none','important');}});}catch(e){}}window.addEventListener('load',hide);setTimeout(hide,500);setInterval(hide,2000);}())</script>`;
    let transformed = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n${baseHref}\n${hideLogoCss}\n${hideLogoScript}`);

    // Strip meta CSP tags present in HTML to allow inline injection
    transformed = transformed.replace(
      /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      ""
    );

    // Rewrite navigation links and form actions to go through our proxy
    const proxify = (href: string) => {
      try {
        // Keep anchors and javascript/data links intact
        const trimmed = href.trim();
        if (!trimmed || trimmed.startsWith("#") ||
            trimmed.toLowerCase().startsWith("javascript:") ||
            trimmed.toLowerCase().startsWith("data:")) {
          return href;
        }
        const absolute = new URL(trimmed, origin).href;
        return `/api/proxy?url=${encodeURIComponent(absolute)}`;
      } catch {
        return href;
      }
    };

    transformed = transformed.replace(
      /(<a[^>]+href=)(["'])(.*?)(\2)/gi,
      (_match, pre, quote, value) => `${pre}${quote}${proxify(value)}${quote}`
    );

    transformed = transformed.replace(
      /(<form[^>]+action=)(["'])(.*?)(\2)/gi,
      (_match, pre, quote, value) => `${pre}${quote}${proxify(value)}${quote}`
    );

    return new NextResponse(transformed, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Intentionally omit original CSP/X-Frame headers to allow iframe render
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Proxy error" }, { status: 500 });
  }
}


