import type { Investment, NewEntity } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { createCrud } from "../shared/crud";
import { compact, optionalText, requireCents, requireDate, requireOneOf, requireText } from "../shared/validation";

export function createInvestmentsService(storage: Storage) {
  const crud = createCrud(storage, "investments", {
    label: "Investimento",
    normalize: (data) => compact({
      ...data,
      name: requireText(data.name, "name", "o nome", 60),
      type: requireOneOf(data.type, "type", "o tipo", ["renda_fixa", "acoes", "fiis", "etfs", "cripto", "outros"] as const),
      institution: optionalText(data.institution, "institution", "a instituição", 60),
      investedCents: requireCents(data.investedCents, "investedCents", "valor aplicado", 0),
      currentCents: requireCents(data.currentCents, "currentCents", "valor atual", 0),
      date: requireDate(data.date, "date", "a data"),
    }),
  });
  return { list: crud.list, get: crud.get, create: (i: NewEntity<Investment>) => crud.create(i), update: crud.update, remove: crud.remove };
}
