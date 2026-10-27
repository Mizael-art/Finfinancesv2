import type { BankAccountCardData, FullAccount, WalletCard } from "@/types/finance";
import type { AccountWithBalance } from "@/services/accounts";
import { ACCOUNT_TYPE_LABEL, lookFor } from "./banks";

const reais = (cents: number) => cents / 100;

export function toFullAccount(a: AccountWithBalance): FullAccount & { archived: boolean } {
  const look = lookFor(a);
  return { id: a.id, name: a.name, institution: a.institution || ACCOUNT_TYPE_LABEL[a.type], type: a.type, balance: reais(a.balanceCents), tone: look.tone, glyph: look.glyph, archived: !!a.archivedAt };
}

export function toBankCard(a: AccountWithBalance): BankAccountCardData {
  const look = lookFor(a);
  return { id: a.id, name: a.name, balance: reais(a.balanceCents), trend: a.series.map(reais), wordmark: look.wordmark, tone: look.tone, label: look.glyph };
}

/** Os três lugares da carteira: [fundo, meio, frente] (coordenadas do viewBox aprovado). */
const SLOTS = [
  { x: 78, y: 5, w: 920, h: 395 },
  { x: 78, y: 90, w: 920, h: 310 },
  { x: 72, y: 190, w: 931, h: 210 },
] as const;

/** Até 3 contas de maior saldo; a maior na frente. Com menos de 3, ocupam os lugares da frente. */
export function toWalletCards(accounts: AccountWithBalance[]): WalletCard[] {
  const top = [...accounts].sort((a, b) => b.balanceCents - a.balanceCents || a.createdAt.localeCompare(b.createdAt)).slice(0, 3);
  // top[0] (maior) -> frente (último slot); as demais para trás
  const slots = SLOTS.slice(SLOTS.length - top.length);
  return [...top].reverse().map((a, i) => {
    const look = lookFor(a);
    return { id: a.id, name: a.name, balance: reais(a.balanceCents), ...slots[i], gradient: look.tone, wordmark: look.wordmark, label: look.glyph } as WalletCard;
  });
}

export const totalReais = (cents: number) => reais(cents);
