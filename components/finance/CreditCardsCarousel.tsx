import type { CreditCard } from "@/types/finance";
import CreditCardVisual from "./CreditCardVisual";

export default function CreditCardsCarousel({ cards }: { cards: CreditCard[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cards.map((c) => (
        <div key={c.id} className="w-[82%] shrink-0 snap-start">
          <CreditCardVisual card={c} />
        </div>
      ))}
    </div>
  );
}
