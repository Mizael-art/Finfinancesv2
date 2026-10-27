"use client";

import { useEffect, useMemo, useState } from "react";
import { DangerButton, Field, PrimaryButton, SecondaryButton, Select } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { STATUS_LABEL, STATUS_TONE, referenceLabel } from "@/features/invoices/viewModels";
import { transactionNote } from "@/features/transactions/viewModels";
import { formatDayMonth, formatLongDate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { InvoiceView } from "@/services/invoices/compute";
import type { Account, Transaction } from "@/types/domain";

interface Props {
  view: InvoiceView;
  accounts: (Account & { balanceCents: number })[];
  /** Conta sugerida para pagar (a padrão do cartão). */
  defaultAccountId?: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-[13px] text-white/45">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[14px] tabular-nums text-white/90">{children}</dd>
    </div>
  );
}

/** Detalhe da fatura: totais, compras e (quando cabe) pagar ou desfazer o pagamento. */
export default function InvoiceDetailSheet({ view, accounts, defaultAccountId, onClose, onDone }: Props) {
  const { invoice, status, totalCents } = view;
  const tone = STATUS_TONE[status];
  const [purchases, setPurchases] = useState<Transaction[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<"view" | "pay" | "undo">("view");
  const firstWithMoney = accounts.find((a) => a.balanceCents >= totalCents);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.id === defaultAccountId)?.id ?? firstWithMoney?.id ?? accounts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    getServices().invoices.purchases(invoice.id).then((p) => live && setPurchases(p)).catch(() => live && setLoadError(true));
    return () => { live = false; };
  }, [invoice.id]);

  const account = accounts.find((a) => a.id === accountId);
  const afterPay = account ? account.balanceCents - totalCents : 0;
  const payable = (status === "fechada" || status === "atrasada") && totalCents > 0;
  const payerName = useMemo(() => accounts.find((a) => a.id === view.paymentAccountId)?.name, [accounts, view.paymentAccountId]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    try { await action(); onDone(message); onClose(); }
    catch (e) { setError(e instanceof ValidationError ? e.message : "Não foi possível concluir agora. Tente novamente."); setBusy(false); }
  };

  return (
    <Sheet open onClose={onClose} title={`Fatura de ${referenceLabel(view)}`} dismissible={!busy}>
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="text-[13px] text-white/50">{view.cardName}</p>
          <p className="mt-1 break-words text-[34px] font-semibold tabular-nums tracking-tight text-white">{formatCents(totalCents)}</p>
          <span className="mt-2 inline-block rounded-full px-3 py-1 text-[12px] font-semibold" style={{ color: tone.text, background: tone.bg }}>{STATUS_LABEL[status]}</span>
        </div>

        <dl className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Row label="Fechamento">{formatLongDate(invoice.closingDate)}</Row>
          <Row label="Vencimento">{formatLongDate(invoice.dueDate)}</Row>
          {status === "paga" && <Row label="Pagamento">{formatLongDate(view.paidDate ?? invoice.dueDate)}{payerName ? ` · ${payerName}` : ""}</Row>}
          <Row label="Compras">{view.purchaseCount}</Row>
        </dl>

        <section aria-label="Compras da fatura">
          <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">Compras</p>
          {loadError ? (
            <p role="alert" className="rounded-lg border border-bad/25 bg-bad/[0.06] px-4 py-3 text-[13px] text-bad-soft">Não foi possível carregar as compras.</p>
          ) : purchases === null ? (
            <div aria-busy="true" className="h-16 animate-pulse rounded-lg bg-white/[0.04] motion-reduce:animate-none" />
          ) : purchases.length === 0 ? (
            <p className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-center text-[14px] text-white/50">Nenhuma compra nessa fatura.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
              {purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-white">{p.description}</p>
                    <p className="truncate text-[12px] text-white/40">{formatDayMonth(p.date)}{transactionNote(p) ? ` · ${transactionNote(p)}` : ""}</p>
                  </div>
                  <p className="shrink-0 text-[14px] font-semibold tabular-nums text-white">{formatCents(p.amountCents)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        {mode === "pay" ? (
          <div role="group" aria-label="Pagar fatura" className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <Field label="Pagar com a conta">
              <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setError(""); }}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatCents(a.balanceCents)}</option>)}
              </Select>
            </Field>
            {account && (
              <p className={`text-[13px] tabular-nums ${afterPay < 0 ? "text-bad-soft" : "text-white/50"}`}>
                {afterPay < 0 ? `Faltam ${formatCents(-afterPay)} nessa conta.` : `Saldo depois do pagamento: ${formatCents(afterPay)}`}
              </p>
            )}
            <PrimaryButton disabled={busy || !account || afterPay < 0} onClick={() => run(() => getServices().invoices.pay(invoice.id, { accountId }), "Fatura paga.")}>{busy ? "Pagando…" : `Pagar ${formatCents(totalCents)}`}</PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => { setMode("view"); setError(""); }}>Cancelar</SecondaryButton>
          </div>
        ) : mode === "undo" ? (
          <div role="alertdialog" aria-label="Desfazer pagamento" className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            <p className="text-[14px] leading-relaxed text-white/80">Desfazer o pagamento de {formatCents(totalCents)}? O valor volta para a conta e a fatura é reaberta.</p>
            <DangerButton disabled={busy} onClick={() => run(() => getServices().invoices.undoPayment(invoice.id), "Pagamento desfeito.")}>Desfazer pagamento</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => setMode("view")}>Cancelar</SecondaryButton>
          </div>
        ) : status === "paga" ? (
          <SecondaryButton onClick={() => setMode("undo")}>Desfazer pagamento</SecondaryButton>
        ) : payable ? (
          accounts.length === 0 ? (
            <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white/55">Adicione uma conta para poder pagar a fatura.</p>
          ) : (
            <PrimaryButton onClick={() => setMode("pay")}>Pagar fatura</PrimaryButton>
          )
        ) : status === "aberta" ? (
          <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-center text-[13px] leading-relaxed text-white/55">
            Fatura aberta: ainda recebe compras. Dá para pagar depois do fechamento, em {formatLongDate(invoice.closingDate)}.
          </p>
        ) : (
          <p className="text-center text-[13px] text-white/40">Sem valor a pagar.</p>
        )}
      </div>
    </Sheet>
  );
}
