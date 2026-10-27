"use client";

import { useEffect, useState } from "react";
import { SPLASH_LONG_MS, SPLASH_SESSION_KEY, SPLASH_SHORT_MS, SPLASH_VISITED_KEY } from "@/features/splash";
import { BRAND_BARS } from "@/features/brand";

/**
 * Entrada animada com a logo do FinFinance, centralizada: o F aparece, as três barras sobem uma a uma,
 * um brilho passa pela logo e o nome surge. Não captura cliques e some sozinha; o app já carrega por baixo.
 * (As animações ficam em app/globals.css.)
 */
export default function Splash() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const mode = root.getAttribute("data-splash");
    if (!mode) { setDone(true); return; }
    try { sessionStorage.setItem(SPLASH_SESSION_KEY, "1"); localStorage.setItem(SPLASH_VISITED_KEY, "1"); } catch { /* sem armazenamento: só toca de novo */ }
    const t = window.setTimeout(() => { root.removeAttribute("data-splash"); setDone(true); }, mode === "long" ? SPLASH_LONG_MS : SPLASH_SHORT_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (done) return null;
  return (
    <div aria-hidden className="ff-splash">
      <div className="ff-glow" />
      <div className="ff-stage">
        <div className="ff-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ff-body" src="/brand/mark-body.webp" alt="" decoding="async" draggable={false} />
          {BRAND_BARS.map((b, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={b.src} className="ff-bar" src={b.src} alt="" decoding="async" draggable={false} style={{ "--i": i, "--ox": b.originX } as React.CSSProperties} />
          ))}
          <div className="ff-sheen" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ff-word" src="/brand/wordmark.webp" alt="" width={686} height={128} decoding="async" draggable={false} />
      </div>
    </div>
  );
}
