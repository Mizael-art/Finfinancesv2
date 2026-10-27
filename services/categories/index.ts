import { nowISO } from "@/lib/date";
import { InUseError, ValidationError } from "@/lib/errors";
import type { Category, CategoryKind, NewEntity } from "@/types/domain";
import type { BatchOp, Storage } from "@/storage/types";
import { createCrud } from "../shared/crud";
import { compact, optionalText, requireOneOf, requireText } from "../shared/validation";
import { filterTransactions, summarizeTransactions } from "../transactions/rules";
import { buildMissingDefaultCategories, defaultColorFor } from "./defaults";

/** Cor no formato #RRGGBB (a paleta do app e qualquer outra cor "hex" completa). */
export function requireColor(value: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new ValidationError("Escolha uma cor válida.", "color");
  return value.toUpperCase();
}

export function normalizeCategoryShape(data: NewEntity<Category>): NewEntity<Category> {
  const name = requireText(data.name, "name", "o nome da categoria", 40);
  return compact({
    ...data,
    name,
    kind: requireOneOf(data.kind, "kind", "o tipo da categoria", ["despesa", "receita"] as const),
    color: data.color ? requireColor(data.color) : defaultColorFor(name),
    icon: optionalText(data.icon, "icon", "o ícone", 40),
    isDefault: data.isDefault === true,
  });
}

export function createCategoriesService(storage: Storage) {
  const crud = createCrud(storage, "categories", {
    label: "Categoria",
    normalize: async (data, current) => {
      const normalized = normalizeCategoryShape(data);
      if (current?.isDefault && !normalized.isDefault) throw new ValidationError("Categorias padrão continuam sendo padrão.", "isDefault");
      const clash = (await crud.list()).find((c) => c.id !== current?.id && c.kind === normalized.kind && c.name.toLowerCase() === normalized.name.toLowerCase());
      if (clash) throw new ValidationError("Já existe uma categoria com esse nome.", "name");
      return normalized;
    },
  });

  async function usage(id: string) {
    const [transactions, budgets, recurrences] = await Promise.all([
      storage.repo("transactions").listBy("categoryId", id),
      storage.repo("budgets").listBy("categoryId", id),
      storage.repo("recurrences").list(),
    ]);
    const rec = recurrences.filter((r) => r.categoryId === id).length;
  return { transactions: transactions.length, budgets: budgets.length, recurrences: rec, total: transactions.length + budgets.length + rec };
  }

  let seeding: Promise<number> | null = null;

  /** Duas categorias padrão com o mesmo tipo e nome: mantém a mais antiga (ou a que já tem uso) e apaga as cópias sem uso. */
  async function removeEmptyDuplicates() {
    const groups = new Map<string, Category[]>();
    for (const c of await crud.list()) {
      if (!c.isDefault) continue;
      const key = `${c.kind}:${c.name.trim().toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const usages = await Promise.all(sorted.map((c) => usage(c.id)));
      const keep = usages.findIndex((u) => u.total > 0);
      const keeper = keep === -1 ? 0 : keep;
      for (const [i, c] of sorted.entries()) if (i !== keeper && usages[i].total === 0) await crud.remove(c.id);
    }
  }

  return {
    get: crud.get,
    async list(kind?: CategoryKind): Promise<Category[]> {
      const all = (await crud.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return kind ? all.filter((c) => c.kind === kind) : all;
    },
    create: (input: Omit<NewEntity<Category>, "isDefault"> & { isDefault?: boolean }) => crud.create({ isDefault: false, ...input }),
    update: crud.update,
    usage,

    /**
     * Categorias com quanto cada uma movimentou no período (receita/despesa) e quantos registros a usam.
     * Compra no cartão conta como despesa na categoria; transferência e pagamento de fatura não entram.
     */
    async overview(range: { from?: string; to?: string } = {}) {
      const [categories, txs, budgets, recurrences] = await Promise.all([
        this.list(), storage.repo("transactions").list(), storage.repo("budgets").list(), storage.repo("recurrences").list(),
      ]);
      const inRange = filterTransactions(txs, range);
      return categories.map((category) => {
        const mine = inRange.filter((t) => t.categoryId === category.id);
        const sum = summarizeTransactions(mine);
        return {
          category,
          periodCents: category.kind === "despesa" ? sum.expenseCents : sum.incomeCents,
          periodCount: mine.filter((t) => t.type === category.kind).length,
          usage: {
            transactions: txs.filter((t) => t.categoryId === category.id).length,
            budgets: budgets.filter((b) => b.categoryId === category.id).length,
            recurrences: recurrences.filter((r) => r.categoryId === category.id).length,
          },
        };
      });
    },

    /**
     * Cria as categorias padrão que faltam e remove cópias vazias de padrões (sobra de duas telas semeando ao mesmo tempo).
     * Idempotente, e chamadas simultâneas viram uma só (nada de Alimentação duas vezes).
     */
    seedDefaults(): Promise<number> {
      seeding ??= (async () => {
        const missing = buildMissingDefaultCategories(await crud.list());
        await storage.batch(missing.map((value): BatchOp => ({ store: "categories", type: "put", value })));
        await removeEmptyDuplicates();
        return missing.length;
      })().finally(() => { seeding = null; });
      return seeding;
    },

    /** Limpa cópias vazias de categorias padrão (sobra de versões antigas). Não cria nada. */
    repairDefaults: removeEmptyDuplicates,

    /** Excluir categoria em uso exige reatribuir; tudo numa única gravação. */
    async remove(id: string, opts: { reassignToCategoryId?: string } = {}) {
      const cat = await crud.require(id);
      if (cat.isDefault) throw new ValidationError("Categorias padrão não podem ser excluídas.");
      const u = await usage(id);
      if (u.total === 0) return crud.remove(id);
      if (!opts.reassignToCategoryId) throw new InUseError("Essa categoria está em uso. Escolha para qual outra mover os registros.", u.total);

      if (opts.reassignToCategoryId === id) throw new ValidationError("Escolha outra categoria para receber os registros.", "reassignToCategoryId");
      const target = await crud.require(opts.reassignToCategoryId);
      if (target.kind !== cat.kind) throw new ValidationError(`Escolha uma categoria de ${cat.kind}.`, "reassignToCategoryId");
      const [txs, budgets, recurrences] = await Promise.all([
        storage.repo("transactions").listBy("categoryId", id),
        storage.repo("budgets").list(),
        storage.repo("recurrences").list(),
      ]);
      const stamp = nowISO();
      const ops: BatchOp[] = [];
      for (const t of txs) ops.push({ store: "transactions", type: "put", value: { ...t, categoryId: target.id, updatedAt: stamp } });
      for (const r of recurrences.filter((x) => x.categoryId === id)) ops.push({ store: "recurrences", type: "put", value: { ...r, categoryId: target.id, updatedAt: stamp } });
      const targetHasBudget = budgets.some((b) => b.categoryId === target.id);
      for (const b of budgets.filter((x) => x.categoryId === id)) {
        if (targetHasBudget) ops.push({ store: "budgets", type: "delete", id: b.id });
        else ops.push({ store: "budgets", type: "put", value: { ...b, categoryId: target.id, updatedAt: stamp } });
      }
      ops.push({ store: "categories", type: "delete", id });
      await storage.batch(ops);
    },
  };
}
export type CategoriesService = ReturnType<typeof createCategoriesService>;
