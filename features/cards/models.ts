import type { CardBrand } from "@/types/domain";

/** Modelos visuais de cartão para o formulário (cores e rótulo). `outro` = banco digitado à mão. */
export interface CardModel {
  id: string;
  label: string;
  institution: string;
  tone: [string, string];
  /** Cor do texto sobre o degradê (BB é amarelo). */
  ink: string;
  brand: CardBrand;
}

export const CARD_MODELS: CardModel[] = [
  { id: "nu", label: "Nubank", institution: "Nu Pagamentos", tone: ["#8B43EA", "#5B1FB0"], ink: "#F1E6FF", brand: "mastercard" },
  { id: "inter", label: "Inter", institution: "Banco Inter", tone: ["#F0682A", "#B84A18"], ink: "#FFE3D2", brand: "visa" },
  { id: "c6", label: "C6 Bank", institution: "C6 Bank", tone: ["#2B2B2E", "#121213"], ink: "#FFFFFF", brand: "mastercard" },
  { id: "santander", label: "Santander", institution: "Banco Santander", tone: ["#EC0000", "#8F0000"], ink: "#FFFFFF", brand: "visa" },
  { id: "itau", label: "Itaú", institution: "Itaú Unibanco", tone: ["#EC7000", "#A94B00"], ink: "#FFF1E3", brand: "mastercard" },
  { id: "bradesco", label: "Bradesco", institution: "Banco Bradesco", tone: ["#CC092F", "#82051D"], ink: "#FFFFFF", brand: "visa" },
  { id: "bb", label: "Banco do Brasil", institution: "Banco do Brasil", tone: ["#F8D117", "#B8920A"], ink: "#0A2A66", brand: "elo" },
  { id: "caixa", label: "Caixa", institution: "Caixa Econômica Federal", tone: ["#0A6EBD", "#08457A"], ink: "#FFFFFF", brand: "elo" },
  { id: "sicredi", label: "Sicredi", institution: "Sicredi", tone: ["#3FA110", "#276609"], ink: "#FFFFFF", brand: "mastercard" },
  { id: "btg", label: "BTG Pactual", institution: "BTG Pactual", tone: ["#0B2A4A", "#05121F"], ink: "#CFE3FF", brand: "mastercard" },
  { id: "xp", label: "XP", institution: "XP Investimentos", tone: ["#1B1B1B", "#050505"], ink: "#FFD400", brand: "visa" },
  { id: "picpay", label: "PicPay", institution: "PicPay", tone: ["#11C76F", "#0A8A4D"], ink: "#FFFFFF", brand: "mastercard" },
  { id: "mercadopago", label: "Mercado Pago", institution: "Mercado Pago", tone: ["#00A1EA", "#006FA5"], ink: "#FFFFFF", brand: "mastercard" },
  { id: "neon", label: "Neon", institution: "Banco Neon", tone: ["#0CC3D9", "#087A8A"], ink: "#FFFFFF", brand: "visa" },
  { id: "outro", label: "Outro banco", institution: "", tone: ["#4B5563", "#1F2937"], ink: "#FFFFFF", brand: "mastercard" },
];

export const modelById = (id: string | undefined): CardModel => CARD_MODELS.find((m) => m.id === id) ?? CARD_MODELS[CARD_MODELS.length - 1];

export const BRAND_OPTIONS: { value: CardBrand; label: string }[] = [
  { value: "mastercard", label: "Mastercard" },
  { value: "visa", label: "Visa" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "outra", label: "Outra" },
];

/** Reconhece o modelo pelo nome só quando o cartão não guarda `issuer` (dados antigos). */
export function guessModelId(name: string, institution: string): string {
  const text = `${name} ${institution}`.toLowerCase();
  const hit = CARD_MODELS.find((m) => m.id !== "outro" && (text.includes(m.label.toLowerCase()) || text.includes(m.id)));
  return hit?.id ?? "outro";
}
