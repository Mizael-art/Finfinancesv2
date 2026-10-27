import { STORE_LABELS } from "@/services/backup";
import type { StoreName } from "@/storage/types";

export interface CountRow { store: StoreName; label: string; current: number; incoming: number }

/** Linhas "atual → do backup" para a confirmação. Ignora o que está zerado nos dois lados e os registros únicos (perfil/configurações). */
export function compareCounts(current: Record<StoreName, number>, incoming: Record<StoreName, number>): CountRow[] {
  const order: StoreName[] = ["accounts", "cards", "transactions", "invoices", "categories", "budgets", "goals", "recurrences", "incomeSources", "investments"];
  return order
    .filter((s) => current[s] > 0 || incoming[s] > 0)
    .map((s) => ({ store: s, label: STORE_LABELS[s], current: current[s], incoming: incoming[s] }));
}

export { hasUserData as hasLocalData } from "@/services/backup/validate";
