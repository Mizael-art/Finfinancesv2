"use client";

import { useState } from "react";
import { DangerButton, Field, MoneyInput, PrimaryButton, SecondaryButton, Segmented, Select, inputClass } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { ValidationError } from "@/lib/errors";
import { getServices } from "@/services";
import type { Account, IncomeSource } from "@/types/domain";

interface Props {
  /** Sem `income`: nova renda. */
  income?: IncomeSource;
  accounts: Account[];
  /** Primeira renda cadastrada já nasce como principal. */
  first: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Criar, editar e excluir uma fonte de renda (salário, pró-labore, freela...). */
export default function IncomeFormSheet({ income, accounts, first, onClose, onDone }: Props) {
  const editing = !!income;
  const [name, setName] = useState(income?.name ?? (first ? "Salário" : ""));
  const [amount, setAmount] = useState(income?.amountCents ?? 0);
  const [day, setDay] = useState(income?.payDay ?? 5);
  const [kind, setKind] = useState<IncomeSource["kind"]>(income?.kind ?? "fixa");
  const [accountId, setAccountId] = useState(income?.accountId && accounts.some((a) => a.id === income.accountId) ? income.accountId : "");
  const [isPrimary, setIsPrimary] = useState(income?.isPrimary ?? first);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const errors = {
    name: name.trim() === "" ? "Dê um nome à renda." : "",
    amount: amount < 1 ? "Informe um valor maior que zero." : "",
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError("");
    try { await fn(); onDone(ok); onClose(); }
    catch (err) { setError(err instanceof ValidationError ? err.message : "Não foi possível concluir agora. Tente novamente."); setBusy(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (errors.name || errors.amount || busy) return;
    const s = getServices().income;
    const data = { name: name.trim(), amountCents: amount, payDay: day, kind, isPrimary, accountId: accountId || undefined };
    void run(() => (income ? s.update(income.id, data) : s.create(data)), editing ? "Renda atualizada." : "Renda adicionada.");
  };

  const remove = () => { if (income) void run(() => getServices().income.remove(income.id), "Renda excluída."); };

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar renda" : "Nova renda"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" error={tried ? errors.name : ""}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Salário, Freela, Aluguel recebido" aria-invalid={tried && !!errors.name} className={inputClass} />
        </Field>

        <Field label="Tipo" hint={kind === "fixa" ? "Mesmo valor todo mês: entra no Planejamento." : "Muda todo mês: o valor é só uma média e não entra no Planejamento."}>
          <Segmented ariaLabel="Tipo da renda" value={kind} onChange={setKind} options={[{ value: "fixa", label: "Fixa" }, { value: "variavel", label: "Variável" }]} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === "fixa" ? "Valor" : "Média por mês"} error={tried ? errors.amount : ""}>
            <MoneyInput value={amount} onChange={setAmount} invalid={tried && !!errors.amount} />
          </Field>
          <Field label="Cai todo dia">
            <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Cai na conta">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Não informar</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <span className="min-w-0">
            <span className="block text-[14px] font-medium text-white">Renda principal</span>
            <span className="block text-[12px] text-white/45">Sua renda mais importante (ex.: o salário). Aparece primeiro.</span>
          </span>
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="h-5 w-5 shrink-0 accent-violet-500" />
        </label>

        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar renda"}</PrimaryButton>

        {editing && (deleting ? (
          <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            <p className="text-[14px] leading-relaxed text-white/80">Excluir “{income?.name}”? Ela some do Planejamento. As receitas que você já lançou continuam nas transações.</p>
            <DangerButton disabled={busy} onClick={remove}>Excluir renda</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => setDeleting(false)}>Cancelar</SecondaryButton>
          </div>
        ) : (
          <DangerButton disabled={busy} onClick={() => setDeleting(true)}>Excluir renda</DangerButton>
        ))}
      </form>
    </Sheet>
  );
}
