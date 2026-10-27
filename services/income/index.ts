import { nowISO } from "@/lib/date";
import type { IncomeSource, NewEntity } from "@/types/domain";
import type { BatchOp, Storage } from "@/storage/types";
import { buildEntity, createCrud } from "../shared/crud";
import { requireCents, requireIntInRange, requireOneOf, requireText } from "../shared/validation";

export function createIncomeService(storage: Storage) {
  const crud = createCrud(storage, "incomeSources", {
    label: "Fonte de renda",
    normalize: (data) => ({
      ...data,
      name: requireText(data.name, "name", "o nome da renda", 60),
      amountCents: requireCents(data.amountCents, "amountCents", "valor", 1),
      payDay: requireIntInRange(data.payDay, "payDay", "o dia do recebimento", 1, 31),
      kind: requireOneOf(data.kind, "kind", "o tipo", ["fixa", "variavel"] as const),
      isPrimary: data.isPrimary === true,
    }),
  });

  /** Só uma fonte pode ser a principal: a última marcada vence. */
  async function demoteOthers(except: string): Promise<BatchOp[]> {
    const stamp = nowISO();
    return (await crud.list()).filter((s) => s.isPrimary && s.id !== except).map((s): BatchOp => ({ store: "incomeSources", type: "put", value: { ...s, isPrimary: false, updatedAt: stamp } }));
  }

  return {
    list: async () => (await crud.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    get: crud.get,
    remove: crud.remove,
    async create(input: NewEntity<IncomeSource>) {
      const created = await crud.create(input);
      if (created.isPrimary) await storage.batch(await demoteOthers(created.id));
      return created;
    },
    async update(id: string, patch: Partial<NewEntity<IncomeSource>>) {
      const updated = await crud.update(id, patch);
      if (updated.isPrimary) await storage.batch(await demoteOthers(updated.id));
      return updated;
    },
  };
}
void buildEntity;
