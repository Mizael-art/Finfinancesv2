/**
 * Modelo de domínio persistido (IndexedDB hoje, Supabase no futuro).
 *
 * Convenções:
 * - Dinheiro SEMPRE em centavos inteiros (`*Cents`). Evita erro de ponto flutuante
 *   (0,1 + 0,2) e permite dividir parcelas sem perder centavo. Para exibir, use
 *   `formatCents` (lib/money.ts), que delega ao `formatBRL` do design system.
 * - Datas de calendário (`date`, `dueDate`...) são "YYYY-MM-DD" sem fuso, para não
 *   voltar um dia ao converter. Instantes (`createdAt`, `paidAt`) são ISO UTC.
 * - Estes tipos são distintos dos tipos de tela em `types/finance.ts`, que
 *   continuam servindo às páginas até cada uma migrar para os services.
 */

export type ID = string;

export interface Entity {
  id: ID;
  createdAt: string; // ISO UTC
  updatedAt: string; // ISO UTC
}

/** Dados que o chamador informa ao criar; id e timestamps são gerados. */
export type NewEntity<T extends Entity> = Omit<T, keyof Entity>;

// ---- Usuário / configurações ---------------------------------------------

export interface User extends Entity {
  name: string;
  /** Como a pessoa quer ser chamada ("Olá, João"). */
  nickname?: string;
  email?: string;
  avatar?: string;
}

export type ThemeId =
  | "padrao" | "preto" | "azul" | "verde" | "vermelho"
  | "padrao-claro" | "preto-claro" | "azul-claro" | "verde-claro" | "vermelho-claro";

/** Os valores antigos ("escuro", "claro", "sistema") continuam aceitos e viram um dos dez temas. */
export type ThemePreference = ThemeId | "escuro" | "claro" | "sistema";

export interface BackupSettings {
  /** Só o estado — tokens do Google NUNCA são guardados aqui. */
  googleConnected: boolean;
  autoBackup: boolean;
  lastBackupAt?: string;
  /** Última vez que o usuário exportou o arquivo JSON neste aparelho. */
  lastExportAt?: string;
  pending: boolean;
}

/** Registro único (id fixo `settings`). */
export interface Settings extends Entity {
  userId?: ID;
  onboardingCompleted: boolean;
  theme: ThemePreference;
  currency: "BRL";
  /** Dia em que o "mês financeiro" começa (1–28). */
  firstDayOfMonth: number;
  backup: BackupSettings;
  /** Objetivos escolhidos no onboarding (personalização futura). */
  financialGoals?: FinancialGoalId[];
  /** Limite mensal de gastos (referência de planejamento, em centavos). */
  monthlyLimitCents?: number;
  /** Rascunho do onboarding, para retomar de onde parou. Some ao concluir e não vai para o backup. */
  onboardingDraft?: OnboardingDraft;
}

export type FinancialGoalId = "controlar_gastos" | "economizar" | "quitar_dividas" | "organizar_contas" | "juntar_dinheiro" | "investir" | "acompanhar";

export type IncomeMode = "fixa" | "variavel" | "varias" | "depois";

/** Valores digitados no onboarding (texto/centavos), guardados para retomar. */
export interface OnboardingDraft {
  step: number;
  name: string;
  nickname: string;
  incomeMode: IncomeMode;
  incomes: { name: string; amountCents: number }[];
  payDay: number;
  goals: FinancialGoalId[];
  accountName: string;
  accountBalanceCents: number;
  fixedExpenses: { name: string; amountCents: number; day: number }[];
  monthlyLimitCents: number;
}

// ---- Contas ---------------------------------------------------------------

export type AccountType = "corrente" | "poupanca" | "digital" | "carteira" | "dinheiro" | "investimento" | "outra";

export interface Account extends Entity {
  name: string;
  institution?: string;
  type: AccountType;
  /** Saldo no momento do cadastro. O saldo atual é DERIVADO das transações. */
  initialBalanceCents: number;
  tone?: [string, string];
  glyph?: string;
  archivedAt?: string;
}

// ---- Categorias -----------------------------------------------------------

export type CategoryKind = "despesa" | "receita";

export interface Category extends Entity {
  name: string;
  kind: CategoryKind;
  color?: string;
  icon?: string;
  isDefault: boolean;
}

// ---- Cartões e faturas ----------------------------------------------------

export type CardBrand = "mastercard" | "visa" | "elo" | "amex" | "outra";

export interface Card extends Entity {
  name: string;
  institution: string;
  /** Id do modelo visual em lib/cardIssuers (ex.: "nu", "santander"). */
  issuer?: string;
  brand?: CardBrand;
  last4?: string;
  limitCents: number;
  closingDay: number; // 1–31
  dueDay: number; // 1–31
  defaultPaymentAccountId?: ID;
  archivedAt?: string;
}

export type InvoiceStatus = "aberta" | "fechada" | "paga" | "atrasada";

/**
 * Fatura de um cartão em um mês. O total e o status são DERIVADOS
 * (transações com `invoiceId` + datas + `paidAt`), nunca gravados,
 * para não ficarem desatualizados.
 */
export interface Invoice extends Entity {
  cardId: ID;
  referenceKey: string; // "YYYY-MM" do vencimento
  closingDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  paidAt?: string;
  paidFromAccountId?: ID;
  paymentTransactionId?: ID;
}

// ---- Transações -----------------------------------------------------------

/**
 * - receita:        entra na `accountId`.
 * - despesa:        sai da `accountId`; OU, se tiver `cardId`, é compra no cartão
 *                   (entra na fatura e NÃO mexe no saldo da conta).
 * - transferencia:  `accountId` -> `toAccountId`; não é receita nem despesa.
 * - pagamento_fatura: saída da `accountId` que quita `invoiceId`; não é despesa
 *                   (as compras já foram contadas como despesa).
 */
export type TransactionType = "receita" | "despesa" | "transferencia" | "pagamento_fatura";

export type RecurrenceFrequency = "diaria" | "semanal" | "mensal" | "anual";

export interface Transaction extends Entity {
  type: TransactionType;
  amountCents: number; // sempre positivo; o sinal vem de `type`
  description: string;
  date: string; // YYYY-MM-DD
  categoryId?: ID;
  accountId?: ID;
  toAccountId?: ID;
  cardId?: ID;
  invoiceId?: ID;
  notes?: string;
  recurrenceId?: ID;
  installmentGroupId?: ID;
  installmentNumber?: number;
  installmentTotal?: number;
}

/** Modelo de gasto/renda que se repete (ex.: aluguel, Netflix). */
export interface Recurrence extends Entity {
  type: "receita" | "despesa";
  description: string;
  amountCents: number;
  categoryId?: ID;
  accountId?: ID;
  cardId?: ID;
  frequency: RecurrenceFrequency;
  dayOfMonth: number; // vencimento
  active: boolean;
  startDate: string;
  endDate?: string;
  /** "YYYY-MM-DD" da última ocorrência já gerada (ou lançada à mão). Nada antes dela é gerado de novo. */
  lastGeneratedDate?: string;
}

export interface IncomeSource extends Entity {
  name: string;
  amountCents: number;
  payDay: number; // 1–31
  kind: "fixa" | "variavel";
  isPrimary: boolean;
  accountId?: ID;
}

// ---- Planejamento ---------------------------------------------------------

export interface Budget extends Entity {
  categoryId: ID;
  limitCents: number;
  period: "monthly";
}

export interface Goal extends Entity {
  name: string;
  targetCents: number;
  currentCents: number;
  deadline?: string; // YYYY-MM-DD
  description?: string;
  icon?: string;
  color?: string;
}

// ---- Investimentos --------------------------------------------------------

export type InvestmentType = "renda_fixa" | "acoes" | "fiis" | "etfs" | "cripto" | "outros";

export interface Investment extends Entity {
  name: string;
  type: InvestmentType;
  institution?: string;
  investedCents: number;
  currentCents: number;
  quantity?: number;
  avgPriceCents?: number;
  date: string; // YYYY-MM-DD
}
