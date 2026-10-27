import { CARD_MODELS } from "@/features/cards/models";
import type { Account, AccountType } from "@/types/domain";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  corrente: "Conta corrente",
  poupanca: "Conta poupança",
  carteira: "Carteira",
  dinheiro: "Dinheiro",
  digital: "Conta digital",
  investimento: "Investimento",
  outra: "Outra",
};

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = (Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((value) => ({ value, label: ACCOUNT_TYPE_LABEL[value] }));

export type Tone = [string, string];

/** Visual de uma conta: bancos conhecidos mantêm cores e logotipos; o resto vira iniciais com cor pelo tipo. */
export interface AccountLook {
  bankId: string; // "outro" quando não reconhecido
  tone: Tone;
  glyph: string;
  wordmark: "inter" | "c6" | "nu" | "generic";
}

const TYPE_TONE: Record<AccountType, Tone> = {
  corrente: ["#2F6FEB", "#1B47A8"],
  poupanca: ["#2BA39B", "#176A64"],
  digital: ["#7C5CFF", "#4A2FC0"],
  carteira: ["#1E7F69", "#155F50"],
  dinheiro: ["#1E7F69", "#155F50"],
  investimento: ["#B8860B", "#7A5906"],
  outra: ["#4B5563", "#1F2937"],
};

const norm = (s: string | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const GLYPH: Record<string, string> = { nu: "Nu", inter: "In", c6: "C6", itau: "It", bb: "BB", xp: "XP", btg: "BTG" };

const ALIASES: Record<string, string[]> = {
  nu: ["nubank", "nu pagamentos"],
  inter: ["inter", "banco inter"],
  c6: ["c6"],
  santander: ["santander"],
  itau: ["itau"],
  bradesco: ["bradesco"],
  bb: ["banco do brasil"],
  caixa: ["caixa"],
  sicredi: ["sicredi"],
  btg: ["btg"],
  xp: ["xp investimentos"],
  picpay: ["picpay"],
  mercadopago: ["mercado pago", "mercadopago"],
  neon: ["neon"],
};

const hasWord = (hay: string, key: string) => new RegExp(`(^|[^a-z0-9])${key}([^a-z0-9]|$)`).test(hay);

/** Qual banco conhecido combina com o nome/instituição (ex.: "Nubank", "Banco Inter"). */
export function matchBank(name: string, institution?: string): string {
  const hay = `${norm(name)} ${norm(institution)}`;
  for (const [id, keys] of Object.entries(ALIASES)) if (keys.some((k) => hasWord(hay, k))) return id;
  return "outro";
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).charAt(0).toUpperCase() + words[0].slice(1, 2).toLowerCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function lookFor(a: Pick<Account, "name" | "institution" | "type" | "tone" | "glyph">): AccountLook {
  const bankId = matchBank(a.name, a.institution);
  const model = CARD_MODELS.find((m) => m.id === bankId);
  const cash = a.type === "carteira" || a.type === "dinheiro";
  const tone: Tone = a.tone ?? (model && bankId !== "outro" ? model.tone : TYPE_TONE[a.type]);
  const glyph = a.glyph ?? (cash ? "$" : GLYPH[bankId] ?? initialsOf(a.name));
  const wordmark = bankId === "nu" || bankId === "inter" || bankId === "c6" ? bankId : "generic";
  return { bankId, tone, glyph, wordmark };
}
