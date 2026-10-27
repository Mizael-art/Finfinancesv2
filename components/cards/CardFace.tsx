import BrandBadge from "@/components/finance/BrandBadge";
import CardBrandMark from "@/components/finance/CardBrandMark";
import { resolveModel } from "@/features/cards/viewModels";
import type { Card } from "@/types/domain";

const KNOWN_MARKS = ["inter", "c6", "nu"] as const;

/** Frente do cartão de crédito (mesma proporção e acabamento do carrossel aprovado). */
export default function CardFace({ card }: { card: Pick<Card, "issuer" | "name" | "institution" | "last4" | "brand"> }) {
  const model = resolveModel(card);
  const known = (KNOWN_MARKS as readonly string[]).includes(model.id);
  const brand = card.brand === "mastercard" || card.brand === "visa" || card.brand === "elo" ? card.brand : model.brand === "mastercard" || model.brand === "visa" || model.brand === "elo" ? model.brand : "mastercard";
  return (
    <div
      className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl border border-white/10 p-5 [container-type:inline-size]"
      style={{ background: `linear-gradient(155deg, ${model.tone[0]}, ${model.tone[1]})`, color: model.ink }}
    >
      <div className="flex items-center justify-between gap-3">
        {known ? (
          <CardBrandMark kind={model.id as (typeof KNOWN_MARKS)[number]} />
        ) : (
          <span className="block min-w-0 truncate text-[22px] font-extrabold tracking-tight" title={card.institution || card.name}>
            {model.id === "outro" ? card.institution || card.name : model.label}
          </span>
        )}
        <span className="h-8 w-10 shrink-0 rounded-md bg-gradient-to-br from-white/40 to-white/10 opacity-80" aria-hidden />
      </div>
      <p className="mt-6 whitespace-nowrap text-[clamp(13px,5.4cqw,19px)] font-semibold tracking-[0.16em] opacity-85 tabular-nums">
        •••• •••• •••• {card.last4 ?? "••••"}
      </p>
      <div className="mt-5 flex items-end justify-between gap-3">
        <span className="min-w-0 truncate text-[12px] opacity-70">{card.name}</span>
        <BrandBadge brand={brand} />
      </div>
    </div>
  );
}
