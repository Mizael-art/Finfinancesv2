"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";

/** Categorias com total do período e uso. Atualiza sozinho a cada gravação. */
export function useCategoriesData(range: { from?: string; to?: string }) {
  return useLiveQuery(() => getServices().categories.overview(range), [range.from, range.to]);
}
