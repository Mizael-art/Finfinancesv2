"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { DangerButton, SecondaryButton } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { FREQUENCY_ADVERB, KIND_LABEL } from "@/features/transactions/constants";
import { makeNamers, transactionNote, type Lookups } from "@/features/transactions/viewModels";
import { formatLongDate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { Recurrence, Transaction } from "@/types/domain";

interface Props {
  tx: Transaction;
  lookups: Lookups;
  onClose: () => void;
  /** Frase de sucesso para o aviso (depois de excluir). */
  onDone: (message: string) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-[13px] text-white/45">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[14px] text-white/90">{children}</dd>
    </div>
  );
}

/** Visualizar uma transação, com atalhos para editar e excluir (cada caso com suas opções). */
export default function TransactionDetailSheet({ tx, lookups, onClose, onDone }: Props) {
  const names = makeNamers(lookups);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    if (tx.recurrenceId) void getServices().recurrences.get(tx.recurrenceId).then((r) => live && setRecurrence(r));
    return () => { live = false; };
  }, [tx.recurrenceId]);

  const locked = tx.type === "pagamento_fatura"; // só a própria fatura desfaz
  const sign = tx.type === "receita" ? "+ " : tx.type === "transferencia" ? "" : "- ";
  const amountColor = tx.type === "receita" ? "text-ok" : tx.type === "transferencia" ? "text-white/80" : "text-white";
  const note = transactionNote(tx);

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onDone(message);
      onClose();
    } catch {
      setError("Não foi possível excluir agora. Tente novamente.");
      setBusy(false);
    }
  };
  const svc = () => getServices().transactions;

  return (
    <Sheet open onClose={onClose} title="Detalhes da transação" dismissible={!busy}>
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className={`text-[34px] font-semibold tabular-nums tracking-tight ${amountColor}`}>{sign}{formatCents(tx.amountCents)}</p>
          <p className="mt-1 break-words text-[16px] font-medium text-white">{tx.description}</p>
        </div>

        <dl className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Row label="Tipo">{KIND_LABEL[tx.type]}</Row>
          {tx.categoryId && <Row label="Categoria">{names.category(tx.categoryId)}</Row>}
          {tx.cardId ? <Row label="Cartão">{names.card(tx.cardId)}</Row> : tx.type === "transferencia" ? (
            <>
              <Row label="De">{names.account(tx.accountId)}</Row>
              <Row label="Para">{names.account(tx.toAccountId)}</Row>
            </>
          ) : <Row label="Conta">{names.account(tx.accountId)}</Row>}
          <Row label="Data">{formatLongDate(tx.date)}</Row>
          {tx.installmentNumber && <Row label="Parcela">{tx.installmentNumber} de {tx.installmentTotal}</Row>}
          {tx.recurrenceId && <Row label="Repetição">{recurrence ? `Se repete ${FREQUENCY_ADVERB[recurrence.frequency]}${recurrence.active ? "" : " (encerrada)"}` : "Recorrente"}</Row>}
          {tx.notes && <Row label="Observação">{tx.notes}</Row>}
        </dl>

        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        {locked ? (
          <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-white/55">
            Este lançamento veio do pagamento de uma fatura e é desfeito pela própria fatura.
          </p>
        ) : confirming ? (
          <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            <p className="text-[14px] leading-relaxed text-white/80">
              Excluir “{tx.description}” ({formatCents(tx.amountCents)})? O saldo da conta será recalculado e a ação não pode ser desfeita.
            </p>
            {tx.installmentGroupId ? (
              <>
                <DangerButton disabled={busy} onClick={() => run(() => svc().remove(tx.id), "Parcela excluída")}>Excluir só esta parcela</DangerButton>
                <DangerButton disabled={busy} onClick={() => run(() => svc().removeInstallmentGroup(tx.installmentGroupId!), "Compra excluída")}>Excluir todas as {tx.installmentTotal} parcelas</DangerButton>
              </>
            ) : recurrence?.active ? (
              <>
                <DangerButton disabled={busy} onClick={() => run(() => svc().remove(tx.id), "Transação excluída")}>Excluir só esta</DangerButton>
                <DangerButton disabled={busy} onClick={() => run(() => svc().removeAndStopRecurrence(tx.id), "Excluída e repetição encerrada")}>Excluir e parar de repetir</DangerButton>
              </>
            ) : (
              <DangerButton disabled={busy} onClick={() => run(() => svc().remove(tx.id), "Transação excluída")}>Excluir definitivamente</DangerButton>
            )}
            <SecondaryButton disabled={busy} onClick={() => setConfirming(false)}>Cancelar</SecondaryButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Link href={`/transacoes/${tx.id}/editar`} className="flex h-12 w-full items-center justify-center rounded-lg bg-violet-500 hover:bg-violet-600 text-[15px] font-semibold text-white transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
              Editar
            </Link>
            {(tx.type === "despesa" || tx.type === "receita" || tx.type === "transferencia") && !tx.installmentGroupId && (
              <Link href={`/transacoes/nova?repetir=${tx.id}`} className="flex h-12 w-full items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[15px] font-semibold text-white transition active:scale-[0.98] hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">
                Repetir lançamento
              </Link>
            )}
            <DangerButton onClick={() => setConfirming(true)}>Excluir</DangerButton>
          </div>
        )}
        {note && !confirming && !locked && <p className="text-center text-[12px] text-white/35">{note}</p>}
      </div>
    </Sheet>
  );
}
