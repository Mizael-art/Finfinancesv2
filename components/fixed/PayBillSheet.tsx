"use client";

import { useState } from "react";
import { DateInput, Field, MoneyInput, PrimaryButton } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import type { Bill } from "@/features/bills/bills";
import { formatDayMonth, todayISODate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { AccountWithBalance } from "@/services/accounts";

interface Props {
  bill: Bill;
  accounts: AccountWithBalance[];
  onClose: () => void;
  onDone: (message: string) => void;
}

/** "Paguei": escolhe de qual conta saiu o dinheiro. O saldo dela é descontado na hora. */
export default function PayBillSheet({ bill, accounts, onClose, onDone }: Props) {
  const r = bill.recurrence;
  const [accountId, setAccountId] = useState(() => (accounts.some((a) => a.id === r.accountId) ? r.accountId! : accounts[0]?.id ?? ""));
  const today = todayISODate();
  const [amount, setAmount] = useState(r.amountCents);
  const [date, setDate] = useState(today);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amountError = amount < 1 ? "Informe o valor pago." : "";
  const dateError = !date ? "Informe a data do pagamento." : date > today ? "A data não pode ser no futuro." : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!accountId || busy || amountError || dateError) return;
    setBusy(true);
    setError("");
    try {
      await getServices().recurrences.setPaid(r.id, bill.dueDate, true, { accountId, amountCents: amount, date });
      const name = accounts.find((a) => a.id === accountId)?.name ?? "conta";
      onDone(`Paga com ${name}. Saldo atualizado.`);
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Marcar como paga" dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <p className="truncate text-[15px] font-semibold text-white">{r.description}</p>
          <p className="text-[13px] text-white/50">Vencimento {formatDayMonth(bill.dueDate)} · previsto <span className="tabular-nums text-white">{formatCents(r.amountCents)}</span></p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor pago" error={tried ? amountError : ""}>
            <MoneyInput value={amount} onChange={setAmount} invalid={tried && !!amountError} ariaLabel="Valor pago" />
          </Field>
          <Field label="Pago em" error={tried ? dateError : ""}>
            <DateInput value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-invalid={tried && !!dateError} />
          </Field>
        </div>

        {accounts.length === 0 ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-[13px] text-amber-200">Cadastre uma conta para registrar de onde saiu o pagamento.</p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13px] font-medium text-white/60">Qual conta foi usada para pagar?</legend>
            {accounts.map((a) => {
              const selected = a.id === accountId;
              const after = a.balanceCents - amount;
              return (
                <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition ${selected ? "border-violet-400/60 bg-violet-500/10" : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]"}`}>
                  <input type="radio" name="account" value={a.id} checked={selected} onChange={() => setAccountId(a.id)} className="h-4 w-4 accent-violet-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-white">{a.name}</span>
                    {selected
                      ? <span className={`block text-[12.5px] ${after < 0 ? "text-bad-soft" : "text-white/50"}`}>Saldo fica <span className="tabular-nums">{formatCents(after)}</span></span>
                      : a.institution && <span className="block truncate text-[12.5px] text-white/40">{a.institution}</span>}
                  </span>
                  <span className="shrink-0 text-[14px] font-medium tabular-nums text-white/70">{formatCents(a.balanceCents)}</span>
                </label>
              );
            })}
          </fieldset>
        )}

        <p className="text-[12px] leading-relaxed text-white/40">O valor sai do saldo da conta escolhida na data informada. Se desmarcar depois, o pagamento é desfeito.</p>
        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}
        <PrimaryButton type="submit" disabled={busy || !accountId}>{busy ? "Salvando…" : "Confirmar pagamento"}</PrimaryButton>
      </form>
    </Sheet>
  );
}
