import { toneFor } from "@/lib/category";
import { nowISO } from "@/lib/date";
import { newId } from "@/lib/id";
import type { Category, CategoryKind } from "@/types/domain";

export interface DefaultCategory {
  name: string;
  kind: CategoryKind;
}

/** Criadas na primeira configuração. "Outros" existe nos dois tipos, como nos apps de mercado. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Alimentação", kind: "despesa" },
  { name: "Transporte", kind: "despesa" },
  { name: "Moradia", kind: "despesa" },
  { name: "Saúde", kind: "despesa" },
  { name: "Educação", kind: "despesa" },
  { name: "Lazer", kind: "despesa" },
  { name: "Compras", kind: "despesa" },
  { name: "Assinaturas", kind: "despesa" },
  { name: "Outros", kind: "despesa" },
  { name: "Salário", kind: "receita" },
  { name: "Renda extra", kind: "receita" },
  { name: "Investimentos", kind: "receita" },
  { name: "Outros", kind: "receita" },
];

/** Cores das categorias padrão que não estavam em lib/category (que fica como fallback por nome). */
const EXTRA_COLORS: Record<string, string> = { Educação: "#5B8DEF", Compras: "#E0668F", "Renda extra": "#2DD4BF", Investimentos: "#A3E635" };
export const defaultColorFor = (name: string) => EXTRA_COLORS[name] ?? toneFor(name);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Categorias padrão que ainda não existem (puro; não grava). */
export function buildMissingDefaultCategories(existing: Category[]): Category[] {
  // Um carimbo por categoria (nowISO nunca repete): a ordem de criação é a ordem da lista padrão.
  return DEFAULT_CATEGORIES.filter((d) => !existing.some((c) => c.kind === d.kind && sameName(c.name, d.name))).map((d) => {
    const now = nowISO();
    return { id: newId(), name: d.name, kind: d.kind, color: defaultColorFor(d.name), isDefault: true, createdAt: now, updatedAt: now };
  });
}
