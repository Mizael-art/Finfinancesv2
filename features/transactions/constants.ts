import type { RecurrenceFrequency, TransactionType } from "@/types/domain";

/** Tipos que o usuário lança à mão (pagamento de fatura nasce da própria fatura). */
export type FormKind = Exclude<TransactionType, "pagamento_fatura">;

export const KIND_LABEL: Record<TransactionType, string> = {
  receita: "Receita",
  despesa: "Despesa",
  transferencia: "Transferência",
  pagamento_fatura: "Pagamento de fatura",
};

export const FREQUENCY_ADVERB: Record<RecurrenceFrequency, string> = {
  diaria: "diariamente",
  semanal: "semanalmente",
  mensal: "mensalmente",
  anual: "anualmente",
};

export const FREQUENCY_NAME: Record<RecurrenceFrequency, string> = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal", anual: "Anual" };

export const REPEAT_OPTIONS: { value: "" | RecurrenceFrequency; label: string }[] = [
  { value: "", label: "Não se repete" },
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
];
