import { todayISODate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { addMonthKey, currentMonthKey, financialMonthRange, type MonthKey } from "@/lib/financialMonth";
import type { Budget, NewEntity } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { createCrud } from "../shared/crud";
import { requireCents, requireOneOf } from "../shared/validation";
import { averageMonthlySpend, buildBudgetOverview } from "./compute";

export function createBudgetsService(storage: Storage) {
  const crud = createCrud(storage, "budgets", {
    label: "Orçamento",
    normalize: async (data, current) => {
      const cat = await storage.repo("categories").get(data.categoryId);
      if (!cat) throw new ValidationError("A categoria não existe.", "categoryId");
      if (cat.kind !== "despesa") throw new ValidationError("Orçamento só vale para categorias de despesa.", "categoryId");
      const dup = (await crud.list()).find((b) => b.id !== current?.id && b.categoryId === data.categoryId);
      if (dup) throw new ValidationError("Essa categoria já tem orçamento.", "categoryId");
      return { ...data, limitCents: requireCents(data.limitCents, "limitCents", "limite", 1), period: requireOneOf(data.period, "period", "o período", ["monthly"] as const) };
    },
  });

  async function firstDay() {
    return (await storage.repo("settings").get("settings"))?.firstDayOfMonth ?? 1;
  }

  return {
    list: crud.list,
    get: crud.get,
    create: (i: NewEntity<Budget>) => crud.create(i),
    update: crud.update,
    remove: crud.remove,

    /** Mês financeiro atual (respeita o "primeiro dia do mês" das configurações). */
    async currentMonth(today = todayISODate()): Promise<MonthKey> {
      return currentMonthKey(today, await firstDay());
    },

    /** Orçamentos do mês com gasto, restante e situação; mais as categorias gastando sem orçamento. */
    async overview(month?: MonthKey) {
      const fd = await firstDay();
      const key = month ?? currentMonthKey(todayISODate(), fd);
      const [budgets, categories, txs] = await Promise.all([crud.list(), storage.repo("categories").list(), storage.repo("transactions").list()]);
      return { month: key, ...buildBudgetOverview(budgets, categories, txs, financialMonthRange(key, fd)) };
    },

    /** Limite sugerido: média de gasto da categoria nos 3 meses anteriores ao mês. 0 = sem histórico. */
    async suggestLimit(categoryId: string, month?: MonthKey): Promise<number> {
      const fd = await firstDay();
      const key = month ?? currentMonthKey(todayISODate(), fd);
      const ranges = [1, 2, 3].map((n) => financialMonthRange(addMonthKey(key, -n), fd));
      return averageMonthlySpend(await storage.repo("transactions").list(), categoryId, ranges);
    },
  };
}
export type BudgetsService = ReturnType<typeof createBudgetsService>;
