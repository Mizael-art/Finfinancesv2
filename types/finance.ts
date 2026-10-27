export type TransactionType = "receita" | "despesa" | "transferencia";

export type Transaction = {
  id: string;
  description: string;
  amount: number; // sempre positivo; o sinal vem de `type`
  type: TransactionType;
  category: string;
  account: string;
  date: string; // ISO (data-hora) ou "YYYY-MM-DD"
  card?: string;
  /** cor da categoria escolhida pelo usuário (sem ela, usa a cor por nome) */
  categoryColor?: string;
  /** informação extra na linha: "Parcela 2/6", "Recorrente"... */
  note?: string;
};

export type AccountType =
  | "corrente"
  | "poupanca"
  | "carteira"
  | "dinheiro"
  | "digital"
  | "investimento"
  | "outra";

export type FullAccount = {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  balance: number;
  tone: [string, string];
  glyph: string; // 1-2 letras exibidas no ícone
};

export type CardBrand = "mastercard" | "visa" | "elo";

/** Emissores com visual próprio. Os três primeiros são os da Home. */
export type CardIssuer =
  | "inter" | "c6" | "nu"
  | "santander" | "sicredi" | "bb" | "caixa"
  | "itau" | "bradesco" | "btg" | "xp" | "picpay" | "mercadopago" | "neon";

export type CreditCard = {
  id: string;
  name: string;
  bank: string;
  brand: CardBrand;
  last4: string;
  limitTotal: number;
  limitUsed: number;
  closingDay: number;
  dueDay: number;
  tone: [string, string];
  wordmark: CardIssuer;
  /** legenda do modelo do cartão (ex.: "UNIQUE", "Internacional") */
  tier?: string;
};

export type Budget = {
  id: string;
  category: string;
  limit: number;
  spent: number;
  period: string; // ex.: "Setembro/2026"
  /** Cor da categoria (orçamentos reais). Sem ela, usa a cor derivada do nome. */
  color?: string;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string; // rótulo já formatado, ex.: "Dez/2026"
  tone: [string, string];
  glyph: string;
  /** Linha de apoio (metas reais): quanto guardar por mês, quanto falta, prazo vencido… */
  hint?: string;
  /** Tom da linha de apoio: "late" pinta de vermelho. */
  hintTone?: "late";
};

export type InvestmentType = "renda_fixa" | "acoes" | "fundos" | "fiis" | "cripto" | "etfs" | "outros";

export type Investment = {
  id: string;
  name: string;
  type: InvestmentType;
  institution: string;
  invested: number; // valor aplicado
  current: number; // valor atual de mercado
  quantity?: number; // renda variável
  avgPrice?: number; // preço médio (renda variável)
  date: string; // ISO da primeira aplicação
  tone: [string, string];
  glyph: string;
};

export type CategoryKind = "despesa" | "receita";

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  /** categorias padrão não podem ser excluídas (só editadas) */
  isDefault: boolean;
};

export type UserProfile = {
  name: string;
  email: string;
};

export type InvoiceStatus = "aberta" | "fechada" | "paga" | "atrasada";

export type Invoice = {
  id: string;
  cardId: string;
  reference: string; // ex.: "Outubro/2026"
  total: number;
  closingDate: string; // ISO (só a data importa)
  dueDate: string; // ISO
  status: InvoiceStatus;
  paidAt?: string; // ISO, só quando status = "paga"
};

/** Cartão de conta empilhado na carteira da Home (posição dentro do viewBox da carteira). */
export type WalletCard = {
  id: string;
  name: string;
  /** em reais (o componente formata com formatBRL) */
  balance: number;
  x: number;
  y: number;
  w: number;
  h: number;
  gradient: [string, string];
  wordmark: "inter" | "c6" | "nu" | "generic";
  /** iniciais exibidas quando wordmark = "generic" */
  label?: string;
};

/** Cartão de conta da lista horizontal da Home. */
export type BankAccountCardData = {
  id: string;
  name: string;
  balance: number; // reais
  trend: number[]; // reais, um ponto por dia
  wordmark: "inter" | "c6" | "nu" | "generic";
  /** usados quando wordmark = "generic" */
  tone: [string, string];
  label: string;
};
