/** Fundo da carteira (painel traseiro), atrás dos cartões. */
export default function WalletBack() {
  return (
    <svg viewBox="0 0 1080 830" className="absolute inset-0 z-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="wb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7A0B22" />
          <stop offset="1" stopColor="#3A0210" />
        </linearGradient>
      </defs>
      <rect x="0" y="135" width="1078" height="690" rx="80" fill="url(#wb)" />
      <rect x="1.5" y="136.5" width="1075" height="687" rx="79" fill="none" stroke="#FF6A85" strokeOpacity="0.35" strokeWidth="3" />
      <path d="M22 190 Q22 152 60 152 H130 M950 152 H1020 Q1056 152 1056 190" fill="none" stroke="#FF8CA2" strokeOpacity="0.5" strokeWidth="3" strokeDasharray="12 9" />
    </svg>
  );
}
