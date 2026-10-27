"use client";

import { useState } from "react";
import { Field, MoneyInput, PrimaryButton } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { ValidationError } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { Goal } from "@/types/domain";

interface Props {
  goal: Goal;
  mode: "deposit" | "withdraw";
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Guardar (aporte) ou retirar dinheiro de uma meta. Não mexe em contas nem transações. */
export default function GoalMoveSheet({ goal, mode, onClose, onDone }: Props) {
  const deposit = mode === "deposit";
  const [amount, setAmount] = useState(0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fieldError = amount < 1 ? "Informe um valor maior que zero." : !deposit && amount > goal.currentCents ? `Você só tem ${formatCents(goal.currentCents)} guardados.` : "";
  const after = goal.currentCents + (deposit ? amount : -amount);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (fieldError || busy) return;
    setBusy(true);
    try {
      const s = getServices().goals;
      const updated = deposit ? await s.deposit(goal.id, amount) : await s.withdraw(goal.id, amount);
      onDone(deposit ? (updated.currentCents >= updated.targetCents ? "Meta concluída! 🎉" : "Valor adicionado à meta.") : "Valor retirado da meta.");
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={deposit ? "Adicionar à meta" : "Retirar da meta"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="truncate text-[14px] text-white/60">{goal.name} · guardado <span className="tabular-nums text-white">{formatCents(goal.currentCents)}</span></p>
        <Field label="Valor" error={tried ? fieldError : ""}>
          <MoneyInput value={amount} onChange={setAmount} invalid={tried && !!fieldError} />
        </Field>
        {amount > 0 && !fieldError && (
          <p className="text-[13px] text-white/50" role="status">Ficará com <span className="font-semibold tabular-nums text-white">{formatCents(after)}</span> de {formatCents(goal.targetCents)}.</p>
        )}
        <p className="text-[12px] leading-relaxed text-white/40">Isso só atualiza a meta. O saldo das suas contas não muda.</p>
        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}
        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : deposit ? "Adicionar" : "Retirar"}</PrimaryButton>
      </form>
    </Sheet>
  );
}
