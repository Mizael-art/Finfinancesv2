"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PayBillSheet from "@/components/fixed/PayBillSheet";
import Toast from "@/components/ui/Toast";
import type { Bill } from "@/features/bills/bills";
import { useToast } from "@/hooks/useToast";
import { buildAlerts } from "@/features/alerts/alerts";
import { buildPlan, estimateVariable } from "@/features/planning/projection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { addMonths, monthKey, startOfMonth, todayISODate } from "@/lib/date";
import { getServices } from "@/services";

const MAX = 4;

/** "Atenção": o que precisa de você agora (contas, faturas, orçamentos, limite e previsão). Some quando está tudo em dia. */
export default function AlertsSection() {
  const [paying, setPaying] = useState<Bill | null>(null);
  const toast = useToast();
  const { data } = useLiveQuery(async () => {
    const s = getServices();
    const today = todayISODate();
    const [recurrences, budgetOverview, cards, invoices, transactions, incomes, accounts] = await Promise.all([
      s.recurrences.list(), s.budgets.overview(), s.cards.overview({ today }), s.invoices.views({ today }),
      s.transactions.list({ from: addMonths(startOfMonth(today), -3) }), s.income.list(), s.accounts.listWithBalances(),
    ]);
    const est = estimateVariable(transactions, today);
    const currentKey = monthKey(today);
    const plan = buildPlan({ today, months: 3, transactions, recurrences, incomes, variableMonthlyCents: est.monthlyCents, variableSoFarCents: est.soFarCents })
      .filter((m) => !(m.key === currentKey && m.items.length === 0));
    return { ...buildAlerts({ today, recurrences, budgets: budgetOverview.items, cards, invoices, plan }), accounts };
  }, []);

  // O número no ícone do app (iPhone/Android com o app instalado) só atualiza quando o app é aberto.
  const badge = data?.badge;
  useEffect(() => {
    if (badge === undefined) return;
    try {
      const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (badge > 0) void nav.setAppBadge?.(badge)?.catch(() => undefined);
      else void nav.clearAppBadge?.()?.catch(() => undefined);
    } catch { /* sem suporte: tudo bem */ }
  }, [badge]);

  const toastEl = <Toast message={toast.message} />;
  if (!data || data.alerts.length === 0) return toastEl;
  const shown = data.alerts.slice(0, MAX);
  return (
    <section aria-label="Atenção" className="mx-auto mt-5 w-full max-w-[460px] px-4">
      <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-white/40">Atenção</p>
      <ul className="flex flex-col gap-2">
        {shown.map((a) => (
          <li key={a.id} className={`flex items-center rounded-xl border ${a.severity === "alta" ? "border-bad/35 bg-bad/10" : "border-amber-400/30 bg-amber-400/[0.08]"}`}>
            <Link href={a.href} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-3 transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${a.severity === "alta" ? "hover:bg-bad/[0.06]" : "hover:bg-amber-400/[0.05]"}`}>
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.severity === "alta" ? "bg-bad" : "bg-amber-400"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-snug text-white">{a.title}</span>
                <span className="block text-[12.5px] leading-snug text-white/55">{a.detail}</span>
              </span>
              {!a.payBill && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-white/35"><path d="m9 6 6 6-6 6" /></svg>}
            </Link>
            {a.payBill && (
              <button
                type="button"
                onClick={() => setPaying(a.payBill!)}
                aria-label={`Pagar ${a.payBill.recurrence.description}`}
                className="mr-3 h-9 shrink-0 rounded-full bg-white/[0.1] px-3.5 text-[13px] font-semibold text-white transition hover:bg-white/[0.16] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
              >
                Pagar
              </button>
            )}
          </li>
        ))}
      </ul>
      {data.alerts.length > MAX && <p className="mt-2 px-1 text-[12px] text-white/40">e mais {data.alerts.length - MAX} {data.alerts.length - MAX === 1 ? "aviso" : "avisos"}.</p>}
      {paying && <PayBillSheet key={paying.key} bill={paying} accounts={data.accounts} onClose={() => setPaying(null)} onDone={toast.show} />}
      {toastEl}
    </section>
  );
}
