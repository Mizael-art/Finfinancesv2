import type { CardBrand } from "@/types/finance";

/** Selo discreto da bandeira, canto do cartão. */
export default function BrandBadge({ brand }: { brand: CardBrand }) {
  const label = brand === "mastercard" ? "Mastercard" : brand === "visa" ? "VISA" : "Elo";
  if (brand === "mastercard")
    return (
      <span className="flex items-center" aria-label="Mastercard">
        <span className="h-6 w-6 rounded-full bg-[#EB001B] opacity-90" />
        <span className="-ml-2.5 h-6 w-6 rounded-full bg-[#F79E1B] opacity-90 mix-blend-screen" />
      </span>
    );
  return <span className="text-[15px] font-black italic tracking-tight text-white/90">{label}</span>;
}
