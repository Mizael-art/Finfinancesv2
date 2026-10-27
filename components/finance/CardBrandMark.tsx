import type { CreditCard } from "@/types/finance";

/** Mesmo estilo de wordmark usado nos cartões da carteira (Home). */
export default function CardBrandMark({ kind, size = 26 }: { kind: CreditCard["wordmark"]; size?: number }) {
  if (kind === "inter")
    return <span style={{ fontSize: size, fontStyle: "italic", letterSpacing: "-0.02em", color: "#FFD9C2" }} className="font-black">inter</span>;
  if (kind === "c6")
    return <span style={{ fontSize: size, letterSpacing: "-0.04em" }} className="font-black text-white">C6</span>;
  return <span style={{ fontSize: size + 6, letterSpacing: "-0.04em", color: "#E7D6FF" }} className="font-black">nu</span>;
}
