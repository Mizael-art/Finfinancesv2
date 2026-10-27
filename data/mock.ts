export type Account = {
  id: string;
  name: string;
  balance: number;
  /** posição do cartão dentro da carteira (viewBox) */
  x: number;
  y: number;
  w: number;
  h: number;
  gradient: [string, string];
  wordmark: "inter" | "c6" | "nu";
};

// accounts[0] = mais ao fundo
export const accounts: Account[] = [
  { id: "inter", name: "Inter", balance: 534125.48, x: 78, y: 5, w: 920, h: 395, gradient: ["#F0682A", "#D9501B"], wordmark: "inter" },
  { id: "c6", name: "C6", balance: 1334209.34, x: 78, y: 90, w: 920, h: 310, gradient: ["#232325", "#141415"], wordmark: "c6" },
  { id: "nu", name: "Nubank", balance: 334224.14, x: 72, y: 190, w: 931, h: 210, gradient: ["#8B43EA", "#6428C4"], wordmark: "nu" },
];

export const summary = {
  period: "Esse Mês",
  totalBalance: 1428185.98,
  chipCard: 103523.24,
  chipCash: 1434125.89,
};

export type BankAccount = {
  id: string;
  name: string;
  wordmark: "inter" | "c6" | "nu";
  balance: number;
  /** série para o mini-gráfico (substituir por histórico real depois) */
  trend: number[];
};

export const bankAccounts: BankAccount[] = [
  { id: "c6", name: "C6", wordmark: "c6", balance: 890476.54, trend: [22, 30, 26, 34, 29, 24, 27, 31, 26, 36, 41, 39, 46, 52, 50] },
  { id: "nu", name: "Nubank", wordmark: "nu", balance: 640312.77, trend: [30, 34, 28, 33, 38, 31, 26, 30, 35, 32, 40, 44, 41, 48, 53] },
  { id: "inter", name: "Inter", wordmark: "inter", balance: 534125.48, trend: [40, 36, 39, 33, 35, 30, 34, 38, 36, 42, 39, 45, 43, 49, 51] },
];

// ---- Transações (mock) ----
import type { Transaction } from "@/types/finance";

export const transactions: Transaction[] = [
  { id: "t1", description: "Salário", amount: 5500, type: "receita", category: "Salário", account: "Inter", date: "2026-09-28T08:00:00" },
  { id: "t2", description: "Mercado", amount: 182.4, type: "despesa", category: "Alimentação", account: "Nubank", date: "2026-09-27T19:20:00" },
  { id: "t3", description: "Netflix", amount: 39.9, type: "despesa", category: "Assinaturas", account: "C6", date: "2026-09-27T09:05:00", card: "C6" },
  { id: "t4", description: "Transferência para Nubank", amount: 500, type: "transferencia", category: "Transferência", account: "Inter", date: "2026-09-26T14:42:00" },
  { id: "t5", description: "Uber", amount: 27.5, type: "despesa", category: "Transporte", account: "Nubank", date: "2026-09-26T08:10:00" },
  { id: "t6", description: "Freela — landing page", amount: 900, type: "receita", category: "Outros", account: "Inter", date: "2026-09-25T17:30:00" },
  { id: "t7", description: "Academia", amount: 99.9, type: "despesa", category: "Saúde", account: "C6", date: "2026-09-24T07:00:00" },
  { id: "t8", description: "Farmácia", amount: 54.2, type: "despesa", category: "Saúde", account: "Nubank", date: "2026-09-23T18:15:00" },
];

// ---- Contas (página Contas) ----
import type { FullAccount } from "@/types/finance";

export const accountTypeLabel: Record<FullAccount["type"], string> = {
  corrente: "Conta corrente",
  poupanca: "Conta poupança",
  carteira: "Carteira",
  dinheiro: "Dinheiro",
  digital: "Conta digital",
  investimento: "Investimento",
  outra: "Outra",
};

export const fullAccounts: FullAccount[] = [
  { id: "c6", name: "C6", institution: "C6 Bank", type: "digital", balance: 890476.54, tone: ["#232325", "#151516"], glyph: "C6" },
  { id: "nu", name: "Nubank", institution: "Nu Pagamentos", type: "digital", balance: 640312.77, tone: ["#8B43EA", "#6A16C9"], glyph: "Nu" },
  { id: "inter", name: "Inter", institution: "Banco Inter", type: "corrente", balance: 534125.48, tone: ["#F0682A", "#D9501B"], glyph: "In" },
  { id: "carteira", name: "Carteira", institution: "Dinheiro físico", type: "carteira", balance: 320.0, tone: ["#1E7F69", "#155F50"], glyph: "$" },
];

export const totalAccountsBalance = fullAccounts.reduce((s, a) => s + a.balance, 0);

// ---- Cartões ----
import type { CreditCard } from "@/types/finance";

export const creditCards: CreditCard[] = [
  { id: "nu-card", name: "Nubank", bank: "Nu Pagamentos", brand: "mastercard", last4: "4482", limitTotal: 5000, limitUsed: 1760, closingDay: 12, dueDay: 19, tone: ["#8B43EA", "#5B1FB0"], wordmark: "nu" },
  { id: "inter-card", name: "Inter", bank: "Banco Inter", brand: "visa", last4: "1190", limitTotal: 8000, limitUsed: 3200, closingDay: 5, dueDay: 12, tone: ["#F0682A", "#B84A18"], wordmark: "inter" },
  { id: "c6-card", name: "C6 Carbon", bank: "C6 Bank", brand: "mastercard", last4: "7731", limitTotal: 12000, limitUsed: 4100, closingDay: 20, dueDay: 27, tone: ["#2B2B2E", "#121213"], wordmark: "c6" },
];

// ---- Orçamentos ----
import type { Budget } from "@/types/finance";

export const budgets: Budget[] = [
  { id: "b1", category: "Alimentação", limit: 800, spent: 620, period: "Setembro" },
  { id: "b2", category: "Transporte", limit: 400, spent: 310, period: "Setembro" },
  { id: "b3", category: "Lazer", limit: 300, spent: 295, period: "Setembro" },
  { id: "b4", category: "Assinaturas", limit: 150, spent: 39.9, period: "Setembro" },
  { id: "b5", category: "Saúde", limit: 250, spent: 280, period: "Setembro" },
];

// ---- Metas ----
import type { Goal } from "@/types/finance";

export const goals: Goal[] = [
  { id: "g1", name: "Reserva de emergência", target: 10000, current: 3500, deadline: "Dez/2026", tone: ["#1E7F69", "#155F50"], glyph: "R" },
  { id: "g2", name: "Viagem", target: 6000, current: 4200, deadline: "Jan/2027", tone: ["#F0682A", "#D9501B"], glyph: "V" },
  { id: "g3", name: "Notebook novo", target: 8000, current: 8000, deadline: "Concluída", tone: ["#8B43EA", "#6A16C9"], glyph: "N" },
  { id: "g4", name: "Moto", target: 15000, current: 2100, deadline: "Jun/2027", tone: ["#2AA9F0", "#1B7FC4"], glyph: "M" },
];

// ---- Relatórios ----
export const categoryBreakdown = [
  { category: "Alimentação", pct: 32 },
  { category: "Transporte", pct: 21 },
  { category: "Moradia", pct: 18 },
  { category: "Lazer", pct: 12 },
  { category: "Outros", pct: 17 },
];

export const monthComparison = {
  previous: { label: "Agosto", amount: 2400 },
  current: { label: "Setembro", amount: 2100 },
};
