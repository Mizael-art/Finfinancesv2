"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";

/** Contas com saldo, patrimônio, dinheiro em mãos e cartão usado. Atualiza sozinho a cada gravação. */
export function useAccountsOverview() {
  return useLiveQuery(() => getServices().accounts.overview(), []);
}
