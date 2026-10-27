import type { CSSProperties } from "react";

/** Sistema de coordenadas da carteira: viewBox 1080 x 830 (extraído da referência). */
export const W = 1080;
export const H = 830;

const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;

export const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
  position: "absolute",
  left: pct(x, W),
  top: pct(y, H),
  width: pct(w, W),
  height: pct(h, H),
});

/** px do viewBox -> unidade relativa à largura da carteira (container query). */
export const cq = (px: number) => `${((px / W) * 100).toFixed(3)}cqw`;
