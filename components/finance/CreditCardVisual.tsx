import type { CreditCard } from "@/types/finance";
import BrandBadge from "./BrandBadge";
import CardBrandMark from "./CardBrandMark";

export default function CreditCardVisual({ card }: { card: CreditCard }) {
  return (
    <div
      className="relative aspect-[16/10] w-full shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 p-5"
      style={{ background: `linear-gradient(155deg, ${card.tone[0]}, ${card.tone[1]})` }}
    >
      <div className="flex items-center justify-between">
        <CardBrandMark kind={card.wordmark} />
        <span className="h-8 w-10 rounded-md bg-gradient-to-br from-white/40 to-white/10 opacity-80" aria-hidden />
      </div>

      <p className="mt-6 text-[19px] font-semibold tracking-[0.18em] text-white/85">
        •••• •••• •••• {card.last4}
      </p>

      <div className="mt-5 flex items-end justify-between">
        <span className="text-[12px] text-white/60">{card.bank}</span>
        <BrandBadge brand={card.brand} />
      </div>
    </div>
  );
}
