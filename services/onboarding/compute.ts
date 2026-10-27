import type { FinancialGoalId, IncomeMode, OnboardingDraft } from "@/types/domain";

export const FINANCIAL_GOALS: { id: FinancialGoalId; label: string }[] = [
  { id: "controlar_gastos", label: "Controlar gastos" },
  { id: "economizar", label: "Economizar dinheiro" },
  { id: "quitar_dividas", label: "Quitar dívidas" },
  { id: "organizar_contas", label: "Organizar contas" },
  { id: "juntar_dinheiro", label: "Juntar dinheiro para um objetivo" },
  { id: "investir", label: "Investir" },
  { id: "acompanhar", label: "Apenas acompanhar minhas finanças" },
];

export const INCOME_MODES: { id: IncomeMode; label: string }[] = [
  { id: "fixa", label: "Salário fixo" },
  { id: "variavel", label: "Renda variável" },
  { id: "varias", label: "Mais de uma fonte de renda" },
  { id: "depois", label: "Prefiro informar depois" },
];

export const MAX_INCOMES = 5;
export const MAX_FIXED_EXPENSES = 10;
export const LAST_STEP = 5; // 0 boas-vindas · 1 nome · 2 renda · 3 objetivo · 4 configuração opcional · 5 conclusão

export const emptyDraft = (): OnboardingDraft => ({
  step: 0, name: "", nickname: "", incomeMode: "fixa", incomes: [{ name: "Salário", amountCents: 0 }], payDay: 5,
  goals: [], accountName: "", accountBalanceCents: 0, fixedExpenses: [], monthlyLimitCents: 0,
});

export type OnboardingField = "name" | "nickname" | "income" | "payDay" | "account" | "fixed" | "limit";
export type OnboardingErrors = Partial<Record<OnboardingField, string>>;

const isInt = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n);

/** Primeiro nome: usado quando a pessoa não escolhe um apelido. */
export const displayName = (d: Pick<OnboardingDraft, "name" | "nickname">) => (d.nickname.trim() || d.name.trim().split(/\s+/)[0] || "").slice(0, 30);

/** Fontes de renda que de fato foram preenchidas (valor > 0). `depois` = nenhuma. */
export function activeIncomes(d: OnboardingDraft): { name: string; amountCents: number }[] {
  if (d.incomeMode === "depois") return [];
  const rows = d.incomeMode === "varias" ? d.incomes : d.incomes.slice(0, 1);
  return rows.filter((r) => r.amountCents > 0).map((r, i) => ({ name: r.name.trim() || (d.incomeMode === "variavel" ? "Renda variável" : i === 0 ? "Salário" : `Renda ${i + 1}`), amountCents: r.amountCents }));
}

/** Gastos fixos preenchidos (linha em branco é ignorada). */
export const activeFixedExpenses = (d: OnboardingDraft) => d.fixedExpenses.filter((e) => e.name.trim() !== "" || e.amountCents > 0);

/** Regras de cada etapa. Só o nome é obrigatório; o resto pode ser pulado, mas o que for preenchido precisa ser válido. */
export function validateStep(step: number, d: OnboardingDraft): OnboardingErrors {
  const e: OnboardingErrors = {};
  if (step === 1) {
    if (d.name.trim() === "") e.name = "Conte como você se chama.";
    else if (d.name.trim().length > 60) e.name = "Use até 60 caracteres.";
    if (d.nickname.trim().length > 30) e.nickname = "Use até 30 caracteres.";
  }
  if (step === 2 && d.incomeMode !== "depois") {
    const rows = d.incomeMode === "varias" ? d.incomes : d.incomes.slice(0, 1);
    if (rows.some((r) => !isInt(r.amountCents) || r.amountCents < 0)) e.income = "Informe valores válidos.";
    else if (d.incomeMode !== "varias" && (rows[0]?.amountCents ?? 0) <= 0) e.income = "Informe o valor ou escolha “Prefiro informar depois”.";
    else if (d.incomeMode === "varias" && rows.every((r) => r.amountCents <= 0)) e.income = "Informe ao menos uma renda ou escolha “Prefiro informar depois”.";
    if (!Number.isInteger(d.payDay) || d.payDay < 1 || d.payDay > 31) e.payDay = "Escolha um dia entre 1 e 31.";
  }
  if (step === 4) {
    if (d.accountName.trim() === "" && d.accountBalanceCents > 0) e.account = "Dê um nome à conta para guardar o saldo inicial.";
    else if (d.accountName.trim().length > 60) e.account = "Use até 60 caracteres.";
    if (d.accountBalanceCents < 0 || !isInt(d.accountBalanceCents)) e.account = "Informe um saldo válido.";
    const bad = activeFixedExpenses(d).find((x) => x.name.trim() === "" || x.amountCents <= 0 || !Number.isInteger(x.day) || x.day < 1 || x.day > 31);
    if (bad) e.fixed = "Cada gasto fixo precisa de nome, valor e dia (1 a 31).";
    if (d.monthlyLimitCents < 0 || !isInt(d.monthlyLimitCents)) e.limit = "Informe um limite válido.";
  }
  return e;
}

/** Tudo que precisa estar válido para concluir. */
export function validateAll(d: OnboardingDraft): OnboardingErrors {
  return { ...validateStep(1, d), ...validateStep(2, d), ...validateStep(4, d) };
}

export const hasErrors = (e: OnboardingErrors) => Object.keys(e).length > 0;

/** Greeting por hora: "Bom dia", "Boa tarde", "Boa noite". */
export function greetingFor(hour: number): string {
  return hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
}
