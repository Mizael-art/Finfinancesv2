"use client";

import { useEffect } from "react";
import { getServices } from "@/services";

/**
 * Ao abrir o app: garante as categorias padrão num banco ainda sem uso e lança as repetições
 * que já venceram (aluguel, assinaturas...). Repete ao voltar para a aba (ex.: o dia virou).
 * Não renderiza nada; falhas não atrapalham o uso.
 */
export default function RecurrenceRunner() {
  useEffect(() => {
    const s = getServices();
    const run = () => void s.recurrences.generateDue().catch(() => undefined);
    // Sem nenhuma categoria: já vem com Alimentação, Transporte, Moradia etc.
    void s.categories.list()
      .then(async (cats) => { if (cats.length === 0) await s.categories.seedDefaults(); else await s.categories.repairDefaults(); })
      .catch(() => undefined)
      .finally(run);
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
