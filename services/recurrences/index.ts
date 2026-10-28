import { nowISO, todayISODate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import type { NewEntity, Recurrence, Transaction } from "@/types/domain";
import type { BatchOp, Storage } from "@/storage/types";
import { buildEntity, createCrud } from "../shared/crud";
import { createInvoiceResolver } from "../invoices/assign";
import { normalizeTransaction } from "../transactions/rules";
import { occurrencesUpTo } from "./schedule";
import { optionalDate, requireCents, requireDate, requireIntInRange, requireOneOf, requireText } from "../shared/validation";

/** Modelos de gastos/rendas fixos (aluguel, Netflix...). Gerar as transações do mês fica para a ETAPA 4. */
/** Regras de formato (não consultam o banco). */
export function normalizeRecurrenceShape(data: NewEntity<Recurrence>): NewEntity<Recurrence> {
  const type = requireOneOf(data.type, "type", "tipo", ["receita", "despesa"] as const);
  if (data.accountId && data.cardId) throw new ValidationError("Informe a conta OU o cartão (apenas um).", "cardId");
  const startDate = requireDate(data.startDate, "startDate", "data de início");
  const endDate = optionalDate(data.endDate, "endDate", "data final");
  if (endDate && endDate < startDate) throw new ValidationError("A data final não pode ser antes do início.", "endDate");
  return {
    ...data,
    type,
    description: requireText(data.description, "description", "a descrição", 120),
    amountCents: requireCents(data.amountCents, "amountCents", "valor", 1),
    frequency: requireOneOf(data.frequency, "frequency", "frequência", ["diaria", "semanal", "mensal", "anual"] as const),
    dayOfMonth: requireIntInRange(data.dayOfMonth, "dayOfMonth", "dia de vencimento", 1, 31),
    active: data.active !== false,
    startDate,
    endDate,
  };
}

export function createRecurrencesService(storage: Storage) {
  const crud = createCrud(storage, "recurrences", {
    label: "Recorrência",
    normalize: async (data) => {
      const normalized = normalizeRecurrenceShape(data);
      if (data.categoryId) {
        const cat = await storage.repo("categories").get(data.categoryId);
        if (!cat || cat.kind !== normalized.type) throw new ValidationError("Categoria inválida para esse tipo.", "categoryId");
      }
      if (data.accountId && !(await storage.repo("accounts").get(data.accountId))) throw new ValidationError("A conta não existe.", "accountId");
      if (data.cardId && !(await storage.repo("cards").get(data.cardId))) throw new ValidationError("O cartão não existe.", "cardId");
      return normalized;
    },
  });
  /** Id determinístico: gerar a mesma ocorrência duas vezes (duas abas) só sobrescreve a si mesma. */
  const occurrenceId = (recId: string, date: string) => `rec:${recId}:${date}`;

  /**
   * Lança as transações das repetições que já venceram (até `today`, inclusive).
   * Idempotente e atômico: roda quantas vezes quiser; recupera meses em que o app ficou fechado;
   * nunca gera antes de `startDate`; uma repetição com problema não trava as outras.
   *
   * Se a repetição não tem conta nem cartão (gasto fixo do onboarding "sem conta específica"),
   * usa a conta ativa mais antiga. Sem nenhuma conta, nada é gerado e a repetição espera.
   */
  async function generateDue(opts: { today?: string } = {}): Promise<{ created: number; skipped: number }> {
    const today = opts.today ?? todayISODate();
    const [recurrences, accounts, categories] = await Promise.all([
      crud.list(),
      storage.repo("accounts").list(),
      storage.repo("categories").list(),
    ]);
    const activeAccounts = accounts.filter((a) => !a.archivedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const ops: BatchOp[] = [];
    const resolver = createInvoiceResolver(storage); // faturas novas das compras de cartão
    let created = 0;
    let skipped = 0;

    for (const rec of recurrences) {
      if (!rec.active) continue;
      const dates = occurrencesUpTo(rec, today);
      if (dates.length === 0) continue;

      // Sem categoria (ex.: despesas fixas do onboarding): usa "Outros" para não deixar de lançar. Dá para escolher outra depois.
      const category = rec.categoryId ? categories.find((c) => c.id === rec.categoryId) : categories.find((c) => c.name === "Outros" && c.kind === rec.type);
      const account = rec.cardId ? undefined : activeAccounts.find((a) => a.id === rec.accountId) ?? activeAccounts[0];
      if (!category || category.kind !== rec.type || (!rec.cardId && !account)) {
        skipped += dates.length; // não dá para lançar ainda; mantém a repetição como está
        continue;
      }
      if (rec.cardId) {
        const card = await storage.repo("cards").get(rec.cardId);
        if (!card || card.archivedAt) { skipped += dates.length; continue; }
      }

      const existing = new Set((await storage.repo("transactions").listBy("recurrenceId", rec.id)).map((t) => t.id));
      const recOps: BatchOp[] = [];
      let recCreated = 0;
      try {
        const card = rec.cardId ? await storage.repo("cards").get(rec.cardId) : undefined;
        for (const date of dates) {
          const id = occurrenceId(rec.id, date);
          if (existing.has(id)) continue;
          const base = normalizeTransaction({
            type: rec.type, amountCents: rec.amountCents, description: rec.description, date,
            categoryId: category.id, accountId: account?.id, cardId: rec.cardId, recurrenceId: rec.id,
          } as NewEntity<Transaction>);
          const invoice = card ? await resolver.resolve(card, date) : undefined;
          recOps.push({ store: "transactions", type: "put", value: buildEntity<Transaction>({ ...base, invoiceId: invoice?.id }, id) });
          recCreated++;
        }
      } catch {
        skipped += dates.length; // dados inválidos (ou fatura já paga) nessa repetição: segue para as outras
        continue;
      }
      ops.push(...recOps);
      created += recCreated;
      ops.push({ store: "recurrences", type: "put", value: { ...rec, lastGeneratedDate: dates[dates.length - 1], updatedAt: nowISO() } });
    }

    await storage.batch([...resolver.ops, ...ops]);
    return { created, skipped };
  }

  return {
    list: crud.list,
    get: crud.get,
    create: (input: NewEntity<Recurrence>) => crud.create(input),
    update: crud.update,
    remove: crud.remove,
    generateDue,
    /** Para de repetir daqui para frente (as transações já lançadas ficam). */
    stop: (id: string) => crud.update(id, { active: false }),
    /** Marca (ou desmarca) o vencimento `dueDate` como pago. Guarda só os últimos 24 vencimentos. */
    async setPaid(id: string, dueDate: string, paid: boolean) {
      const rec = await crud.get(id);
      if (!rec) throw new ValidationError("Despesa fixa não encontrada.", "id");
      const set = new Set(rec.paidDates ?? []);
      if (paid) set.add(dueDate); else set.delete(dueDate);
      return crud.update(id, { paidDates: [...set].sort().slice(-24) });
    },
  };
}
export type RecurrencesService = ReturnType<typeof createRecurrencesService>;
