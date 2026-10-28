import type { Transaction } from "@/types/domain";

/** Minúsculas, sem acento e sem espaços repetidos: "  Supermercado Zaffari " ≈ "supermercado zaffari". */
export const normalizeText = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface CategorySuggestion {
  categoryId: string;
  /** true = já lancei exatamente essa descrição antes. */
  exact: boolean;
  /** Em quantos lançamentos do histórico a sugestão se baseia. */
  count: number;
}

function winner(list: Transaction[]): { categoryId: string; count: number } | undefined {
  const tally = new Map<string, { count: number; last: string }>();
  for (const t of list) {
    if (!t.categoryId) continue;
    const cur = tally.get(t.categoryId);
    tally.set(t.categoryId, { count: (cur?.count ?? 0) + 1, last: cur && cur.last > t.date ? cur.last : t.date });
  }
  const best = [...tally.entries()].sort(([, a], [, b]) => b.count - a.count || b.last.localeCompare(a.last))[0];
  return best ? { categoryId: best[0], count: best[1].count } : undefined;
}

/**
 * Sugere a categoria pelo que o usuário já lançou: descrição idêntica (mais forte) ou parecida
 * (começa igual). Considera só lançamentos do mesmo tipo (receita/despesa) e exige 3+ letras.
 */
export function suggestCategory(history: Transaction[], text: string, kind: "receita" | "despesa"): CategorySuggestion | undefined {
  const q = normalizeText(text);
  if (q.length < 3) return undefined;
  const same = history.filter((t) => t.type === kind && t.categoryId);
  const exact = winner(same.filter((t) => normalizeText(t.description) === q));
  if (exact) return { ...exact, exact: true };
  const partial = winner(same.filter((t) => { const h = normalizeText(t.description); return h.startsWith(q) || (h.length >= 4 && q.startsWith(h)); }));
  return partial ? { ...partial, exact: false } : undefined;
}
