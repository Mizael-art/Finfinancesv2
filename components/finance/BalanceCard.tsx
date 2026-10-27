import type { ReactNode } from "react";
import { box, cq } from "@/lib/wallet";
import { formatBRL } from "@/lib/format";
import TransactionButton from "./TransactionButton";

type Props = {
  total: number;
  chipCard: number;
  chipCash: number;
  /** oculta os valores (olho) */
  hidden?: boolean;
  onToggleHidden?: () => void;
  onNewTransaction?: () => void;
  onCalendar?: () => void;
};

const MASK = "R$••••";

const FRONT = "M12 268 Q540 350 1066 268 V745 Q1066 826 985 826 H93 Q12 826 12 745 Z";
const STITCH = "M38 292 Q540 372 1040 292 V742 Q1040 802 980 802 H98 Q38 802 38 742 Z";

const Icon = ({ d, size = 30 }: { d: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: cq(size), height: cq(size) }}>
    {d}
  </svg>
);

const circleBtn = "grid place-items-center rounded-full border border-white/25 bg-gradient-to-b from-white/12 to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition active:scale-90 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

export default function BalanceCard({ total, chipCard, chipCash, hidden = false, onToggleHidden, onNewTransaction, onCalendar }: Props) {
  const show = (v: number) => (hidden ? MASK : formatBRL(v));
  return (
    <section aria-label="Saldo total" className="absolute inset-0 z-30">
      <svg viewBox="0 0 1080 830" className="absolute inset-0 h-full w-full" style={{ filter: "drop-shadow(0 -14px 22px rgba(0,0,0,0.55))" }} aria-hidden>
        <defs>
          <linearGradient id="leather" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A0132F" />
            <stop offset="0.3" stopColor="#7E0A23" />
            <stop offset="1" stopColor="#4C0414" />
          </linearGradient>
          <radialGradient id="sheen" cx="0.3" cy="0.15" r="0.7">
            <stop offset="0" stopColor="#FF7A93" stopOpacity="0.28" />
            <stop offset="1" stopColor="#FF7A93" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={FRONT} fill="url(#leather)" />
        <path d={FRONT} fill="url(#sheen)" />
        <path d={FRONT} fill="none" stroke="#FF8CA2" strokeOpacity="0.55" strokeWidth="4" />
        <path d={STITCH} fill="none" stroke="#FF9AB0" strokeOpacity="0.6" strokeWidth="3.5" strokeDasharray="14 10" />
      </svg>

      <div style={{ ...box(85, 418, 500, 60), fontSize: cq(33) }} className="flex items-center gap-[1.4cqw] text-white/90">
        <Icon size={32} d={<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />} />
        Saldo Total
      </div>
      <div style={{ ...box(80, 470, 560, 110), fontSize: cq(62) }} className="flex items-center font-extrabold leading-none tracking-tight tabular-nums text-white">
        {show(total)}
      </div>

      <div style={{ ...box(652, 422, 346, 70), fontSize: cq(31), gap: cq(14) }} className="flex items-center rounded-full border border-[#FF6A85]/60 bg-[#7A0620]/70 px-[3.2cqw] font-bold tabular-nums text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
        <Icon size={34} d={<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></>} />
        {show(chipCard)}
      </div>
      <div style={{ ...box(652, 500, 346, 68), fontSize: cq(31), gap: cq(14) }} className="flex items-center rounded-full border border-white/40 bg-[#8C7C80]/60 px-[3.2cqw] font-bold tabular-nums text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
        <Icon size={34} d={<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>} />
        {show(chipCash)}
      </div>

      <div style={box(78, 647, 347, 100)}>
        <TransactionButton onClick={onNewTransaction} />
      </div>
      <button type="button" aria-label="Calendário: ver transações por período" onClick={onCalendar} className={circleBtn} style={box(772, 647, 100, 100)}>
        <Icon size={38} d={<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>} />
      </button>
      <button type="button" aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} aria-pressed={hidden} onClick={onToggleHidden} className={circleBtn} style={box(897, 647, 100, 100)}>
        <Icon size={42} d={hidden ? <><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16 16 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>} />
      </button>
    </section>
  );
}
