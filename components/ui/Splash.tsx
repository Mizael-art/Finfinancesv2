"use client";

import { useEffect, useState } from "react";
import { SPLASH_MS } from "@/features/splash";
import { BRAND_BARS } from "@/features/brand";

/**
 * Entrada animada com a logo do FinFinance, a cada abertura do app: o F aparece, as três barras sobem uma a uma,
 * dois anéis pulsam, um brilho passa pela logo, o nome e a frase surgem e uma barra de carregamento enche.
 * Não captura cliques e some sozinha; o app já carrega por baixo. (As animações ficam em app/globals.css.)
 */
export default function Splash() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-splash")) { setDone(true); return; }
    const t = window.setTimeout(() => { root.removeAttribute("data-splash"); setDone(true); }, SPLASH_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (done) return null;
  return (
    <div aria-hidden className="ff-splash">
      <div className="ff-glow" />
      <div className="ff-stage">
        <div className="ff-mark">
          <div className="ff-ring" />
          <div className="ff-ring ff-ring-2" />
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
        <p className="ff-tagline">Seu dinheiro, inteligente.</p>
        <div className="ff-loader"><div className="ff-loader-fill" /></div>
      </div>
    </div>
  );
}
