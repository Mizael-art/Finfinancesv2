"use client";

import { useState } from "react";
import { DangerButton, Field, MoneyInput, PrimaryButton, SecondaryButton, Select, inputClass } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { todayISODate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { getServices } from "@/services";
import type { Account, Card, Category, Recurrence } from "@/types/domain";

interface Props {
  /** Sem `expense`: nova despesa fixa. */
  expense?: Recurrence;
  categories: Category[];
  accounts: Account[];
  cards: Card[];
  onClose: () => void;
  onDone: (message: string) => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** "" = automático (conta mais antiga), "a:ID" = conta, "c:ID" = cartão. */
const payValue = (r?: Recurrence) => (r?.cardId ? `c:${r.cardId}` : r?.accountId ? `a:${r.accountId}` : "");

/** Criar, editar, pausar e excluir uma despesa fixa mensal (aluguel, internet, assinaturas...). */
export default function FixedExpenseFormSheet({ expense, categories, accounts, cards, onClose, onDone }: Props) {
  const editing = !!expense;
  const monthly = !expense || expense.frequency === "mensal";
  const [name, setName] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense?.amountCents ?? 0);
  const [day, setDay] = useState(expense?.dayOfMonth ?? Math.min(new Date().getDate(), 28));
  const [categoryId, setCategoryId] = useState(expense?.categoryId && categories.some((c) => c.id === expense.categoryId) ? expense.categoryId : "");
  const [pay, setPay] = useState(payValue(expense));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const errors = {
    name: name.trim() === "" ? "Dê um nome à despesa." : "",
    amount: amount < 1 ? "Informe um valor maior que zero." : "",
    category: !categoryId ? "Escolha uma categoria para lançar sozinha todo mês." : "",
  };

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setError("");
    try { await fn(); onDone(ok); onClose(); }
    catch (err) { setError(err instanceof ValidationError ? err.message : "Não foi possível concluir agora. Tente novamente."); setBusy(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (errors.name || errors.amount || errors.category || busy) return;
    const target = pay.startsWith("a:") ? { accountId: pay.slice(2), cardId: undefined } : pay.startsWith("c:") ? { cardId: pay.slice(2), accountId: undefined } : { accountId: undefined, cardId: undefined };
    const s = getServices().recurrences;
    void run(async () => {
      if (expense) await s.update(expense.id, { description: name.trim(), amountCents: amount, categoryId, dayOfMonth: day, ...target });
      else {
        const today = todayISODate();
        // Vale a partir da próxima data de vencimento: nada é lançado para trás.
        await s.create({ type: "despesa", description: name.trim(), amountCents: amount, categoryId, frequency: "mensal", dayOfMonth: day, active: true, startDate: today, lastGeneratedDate: today, ...target });
      }
    }, editing ? "Despesa fixa atualizada." : "Despesa fixa criada.");
  };

  const togglePause = () => {
    if (!expense) return;
    const s = getServices().recurrences;
    // Ao reativar, o que passou enquanto estava pausada não é lançado de uma vez.
    void run(async () => { await (expense.active ? s.stop(expense.id) : s.update(expense.id, { active: true, lastGeneratedDate: todayISODate() })); }, expense.active ? "Despesa pausada." : "Despesa reativada.");
  };

  const remove = () => { if (expense) void run(() => getServices().recurrences.remove(expense.id), "Despesa fixa excluída."); };

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar despesa fixa" : "Nova despesa fixa"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" error={tried ? errors.name : ""}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Aluguel, Internet, Netflix" aria-invalid={tried && !!errors.name} className={inputClass} />
        </Field>

        <div className={`grid gap-3 ${monthly ? "grid-cols-2" : "grid-cols-1"}`}>
          <Field label="Valor" error={tried ? errors.amount : ""}>
            <MoneyInput value={amount} onChange={setAmount} invalid={tried && !!errors.amount} />
          </Field>
          {monthly && (
            <Field label="Vence todo dia">
              <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Categoria" error={tried ? errors.category : ""}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-invalid={tried && !!errors.category}>
            <option value="">Escolha…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>

        <Field label="Pagar com">
          <Select value={pay} onChange={(e) => setPay(e.target.value)}>
            <option value="">Conta principal (automático)</option>
            {accounts.map((a) => <option key={a.id} value={`a:${a.id}`}>Conta · {a.name}</option>)}
            {cards.map((c) => <option key={c.id} value={`c:${c.id}`}>Cartão · {c.name}</option>)}
          </Select>
        </Field>

        <p className="text-[12px] leading-relaxed text-white/40">
          {editing ? "As mudanças valem para os próximos lançamentos; o que já foi lançado não muda." : "O FinFinance lança essa despesa sozinho todo mês, a partir da próxima data de vencimento. Para registrar este mês, crie uma transação normal."}
        </p>
        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar despesa fixa"}</PrimaryButton>

        {editing && (
          <>
            <SecondaryButton disabled={busy} onClick={togglePause}>{expense?.active ? "Pausar lançamentos" : "Reativar lançamentos"}</SecondaryButton>
            {deleting ? (
              <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
                <p className="text-[14px] leading-relaxed text-white/80">Excluir “{expense?.description}”? Os lançamentos que já existem continuam nas suas transações.</p>
                <DangerButton disabled={busy} onClick={remove}>Excluir despesa fixa</DangerButton>
                <SecondaryButton disabled={busy} onClick={() => setDeleting(false)}>Cancelar</SecondaryButton>
              </div>
            ) : (
              <DangerButton disabled={busy} onClick={() => setDeleting(true)}>Excluir despesa fixa</DangerButton>
            )}
          </>
        )}
      </form>
    </Sheet>
  );
}
