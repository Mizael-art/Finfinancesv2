import { todayISODate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import type { Goal, NewEntity } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { requireColor } from "../categories";
import { createCrud } from "../shared/crud";
import { compact, optionalDate, optionalText, requireCents, requireText } from "../shared/validation";
import { buildGoalItems } from "./compute";

export function createGoalsService(storage: Storage) {
  const crud = createCrud(storage, "goals", {
    label: "Meta",
    normalize: (data) => compact({
      ...data,
      name: requireText(data.name, "name", "o nome da meta", 60),
      targetCents: requireCents(data.targetCents, "targetCents", "valor da meta", 1),
      currentCents: requireCents(data.currentCents ?? 0, "currentCents", "valor guardado", 0),
      deadline: optionalDate(data.deadline, "deadline", "o prazo"),
      description: optionalText(data.description, "description", "a descrição", 200),
      color: data.color ? requireColor(data.color) : undefined,
    }),
  });

  /** Aporte (+) ou retirada (−). A retirada nunca passa do que está guardado. */
  async function move(id: string, deltaCents: number): Promise<Goal> {
    const goal = await crud.get(id);
    if (!goal) throw new ValidationError("A meta não existe mais.", "id");
    const amount = requireCents(Math.abs(deltaCents), "amountCents", "valor", 1);
    if (deltaCents < 0 && amount > goal.currentCents) throw new ValidationError("Você não pode retirar mais do que está guardado.", "amountCents");
    return crud.update(id, { currentCents: goal.currentCents + (deltaCents < 0 ? -amount : amount) });
  }

  return {
    list: crud.list,
    get: crud.get,
    create: (i: NewEntity<Goal>) => crud.create(i),
    update: crud.update,
    remove: crud.remove,
    deposit: (id: string, amountCents: number) => move(id, Math.abs(amountCents)),
    withdraw: (id: string, amountCents: number) => move(id, -Math.abs(amountCents)),
    /** Metas com progresso, restante, situação e quanto guardar por mês. */
    async overview(today = todayISODate()) {
      const items = buildGoalItems(await crud.list(), today);
      return {
        items,
        totalSavedCents: items.reduce((s, i) => s + i.goal.currentCents, 0),
        activeCount: items.filter((i) => i.status !== "concluida").length,
        doneCount: items.filter((i) => i.status === "concluida").length,
      };
    },
  };
}
export type GoalsService = ReturnType<typeof createGoalsService>;
