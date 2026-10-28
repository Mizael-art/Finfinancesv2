"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { DateInput, Field, Select, inputClass as field } from "@/components/ui/FormControls";
import { FREQUENCY_ADVERB, REPEAT_OPTIONS, type FormKind } from "@/features/transactions/constants";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { formatMonthLabel, todayISODate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { formatBRL } from "@/lib/format";
import { getServices } from "@/services";
import { invoiceCycle } from "@/services/invoices/cycle";
import type { Account, Card, Category, NewEntity, Recurrence, RecurrenceFrequency, Transaction } from "@/types/domain";

const kinds: { id: FormKind; label: string; tone: string }[] = [
  { id: "receita", label: "Receita", tone: "rgb(var(--ok))" },
  { id: "despesa", label: "Despesa", tone: "rgb(var(--bad))" },
  { id: "transferencia", label: "Transferência", tone: "#2AA9F0" },
];

interface Loaded {
  accounts: Account[];
  categories: Category[];
  cards: Card[];
  existing?: Transaction;
  recurrence?: Recurrence;
}

/** Carrega o que o formulário precisa e decide o que mostrar: carregando, erro, pré-requisitos ou o formulário. */
export default function NewTransactionForm({ transactionId }: { transactionId?: string }) {
  const { data, error, reload } = useLiveQuery<Loaded>(async () => {
    const s = getServices();
    // Garante Alimentação, Transporte etc. mesmo se o app foi aberto antes de existir qualquer categoria.
    if ((await s.categories.list()).length === 0) await s.categories.seedDefaults();
    const [accounts, categories, cards, existing] = await Promise.all([
      s.accounts.list(), s.categories.list(), s.cards.list(), transactionId ? s.transactions.get(transactionId) : Promise.resolve(undefined),
    ]);
    const recurrence = existing?.recurrenceId ? await s.recurrences.get(existing.recurrenceId) : undefined;
    return { accounts, categories, cards, existing, recurrence };
  }, [transactionId]);

  if (!data && error) return <ErrorState onRetry={reload} />;
  if (!data) return <div aria-busy="true" aria-label="Carregando" className="h-64 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />;

  if (transactionId && !data.existing) {
    return (
      <EmptyState
        icon={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>}
        title="Transação não encontrada."
        description="Ela pode ter sido excluída."
        action={<Link href="/transacoes" className="inline-grid h-11 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-5 text-[14px] font-semibold text-white">Ver transações</Link>}
      />
    );
  }
  if (data.existing?.type === "pagamento_fatura") {
    return (
      <EmptyState
        icon={<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /></>}
        title="Pagamento de fatura"
        description="Esta transação nasceu do pagamento de uma fatura e é alterada pela própria fatura."
        action={<Link href="/transacoes" className="inline-grid h-11 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-5 text-[14px] font-semibold text-white">Voltar</Link>}
      />
    );
  }
  if (data.accounts.length === 0) {
    return (
      <EmptyState
        icon={<><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M3 10h18" /></>}
        title="Adicione uma conta antes de lançar."
        description="Receitas e despesas precisam saber de qual conta o dinheiro sai ou entra."
        action={<Link href="/contas" className="inline-grid h-11 place-items-center rounded-lg bg-violet-500 hover:bg-violet-600 px-5 text-[14px] font-semibold text-white">Ir para Contas</Link>}
      />
    );
  }
  return <TransactionFormBody key={data.existing?.id ?? "new"} {...data} />;
}

function TransactionFormBody({ accounts, categories, cards, existing, recurrence }: Loaded) {
  const params = useSearchParams();
  const editing = !!existing;
  const isInstallment = !!existing?.installmentGroupId;

  const [kind, setKind] = useState<FormKind>((existing?.type as FormKind | undefined) ?? (params.get("tipo") === "transferencia" ? "transferencia" : "despesa"));
  const [cents, setCents] = useState(existing?.amountCents ?? 0);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0].id);
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId ?? accounts[1]?.id ?? accounts[0].id);
  const [date, setDate] = useState(existing?.date ?? todayISODate());
  const [payWith, setPayWith] = useState<"conta" | "cartao">(existing?.cardId ? "cartao" : "conta");
  const [cardId, setCardId] = useState(existing?.cardId ?? cards[0]?.id ?? "");
  const [installments, setInstallments] = useState(existing?.installmentTotal ?? 1);
  const [repeat, setRepeat] = useState<"" | RecurrenceFrequency>("");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const kindInfo = kinds.find((k) => k.id === kind)!;
  const isTransfer = kind === "transferencia";
  const useCard = kind === "despesa" && payWith === "cartao";
  const categoryOptions = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind]);
  const selectedCategory = categoryOptions.find((c) => c.id === categoryId) ?? categoryOptions[0];
  const amount = cents / 100;
  const canTransfer = accounts.length >= 2;
  /** O valor é montado da direita para a esquerda; o cursor fica sempre no fim (tocar no meio não embaralha os dígitos). */
  const amountRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { const el = amountRef.current; if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length); }, [cents]);
  /** Em qual fatura a compra vai cair (e a última, se parcelada). */
  const chosenCard = cards.find((c) => c.id === cardId);
  const invoiceHint = (() => {
    if (!useCard || !chosenCard || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    try {
      const first = invoiceCycle(chosenCard, date).referenceKey;
      if (installments <= 1) return `Cai na fatura de ${formatMonthLabel(first)}.`;
      return `Parcelas de ${formatMonthLabel(first)} até ${formatMonthLabel(invoiceCycle(chosenCard, date, installments - 1).referenceKey)}.`;
    } catch { return undefined; }
  })();

  const errors = {
    amount: cents <= 0 ? "Informe um valor maior que zero." : "",
    description: !isTransfer && description.trim() === "" ? "Descreva a transação." : "",
    transfer: isTransfer && accountId === toAccountId ? "Escolha contas diferentes." : "",
    date: date === "" ? "Informe a data." : "",
    card: useCard && !cardId ? "Escolha um cartão." : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const switchKind = (k: FormKind) => {
    setKind(k);
    setCategoryId("");
    if (k !== "despesa") setPayWith("conta");
    if (k === "transferencia") setRepeat("");
  };

  const reset = () => {
    setCents(0); setDescription(""); setNotes(""); setInstallments(1); setRepeat("");
    setTried(false); setSaved(null); setFormError("");
  };

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "conta";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFormError("");
    if (!valid || saving) return;
    setSaving(true);
    const s = getServices().transactions;
    try {
      if (existing && isInstallment) {
        // Parcela: só o que não afeta o parcelamento (valor/cartão/datas são da compra toda).
        await s.update(existing.id, { description: description.trim(), categoryId: selectedCategory?.id, notes: notes.trim() || undefined });
      } else {
        const input: NewEntity<Transaction> = {
          type: kind, amountCents: cents, description: description.trim(), date,
          categoryId: isTransfer ? undefined : selectedCategory?.id,
          accountId: useCard ? undefined : accountId,
          toAccountId: isTransfer ? toAccountId : undefined,
          cardId: useCard ? cardId : undefined,
          notes: notes.trim() || undefined,
        };
        if (existing) await s.update(existing.id, input);
        else if (useCard && installments > 1) await s.createInstallments(input, installments);
        else if (repeat) {
          await s.createRecurring(input, repeat);
          // data no passado: as ocorrências que já venceram aparecem agora, não só na próxima abertura do app
          await getServices().recurrences.generateDue().catch(() => undefined);
        }
        else await s.create(input);
      }
      setSaved(existing ? "Transação atualizada" : "Transação registrada");
    } catch (err) {
      setFormError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Seus dados continuam aqui — tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/15 text-ok" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </span>
        <h2 className="mt-4 text-[20px] font-semibold text-white">{saved}</h2>
        <p className="mt-1 text-[14px] text-white/50">
          {kindInfo.label} de <span className="font-semibold text-white">{formatBRL(amount)}</span>
          {isTransfer ? ` de ${accountName(accountId)} para ${accountName(toAccountId)}` : useCard ? ` no cartão ${cards.find((c) => c.id === cardId)?.name ?? ""}` : ` em ${accountName(accountId)}`}
          {useCard && installments > 1 ? `, em ${installments}x` : ""}
          {repeat && !editing ? `, repetindo ${FREQUENCY_ADVERB[repeat]}` : ""}.
        </p>
        <div className="mt-6 grid gap-2.5">
          {!editing && (
            <button type="button" onClick={reset} className="h-12 rounded-lg bg-violet-500 hover:bg-violet-600 text-[15px] font-semibold text-white transition active:scale-[0.98]">
              Registrar outra
            </button>
          )}
          <Link href="/transacoes" className="grid h-12 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[15px] font-semibold text-white transition active:scale-[0.98]">
            Ver transações
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {isInstallment && (
        <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-white/60">
          Parcela {existing!.installmentNumber}/{existing!.installmentTotal}. Aqui você muda descrição, categoria e observação. Para mudar valor ou parcelas, exclua a compra e lance de novo.
        </p>
      )}
      {recurrence && (
        <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-white/60">
          Esta transação se repete {FREQUENCY_ADVERB[recurrence.frequency]}{recurrence.active ? "" : " (repetição encerrada)"}. Alterar aqui muda só esta ocorrência.
        </p>
      )}

      <div role="group" aria-label="Tipo de transação" className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
        {kinds.map((k) => {
          const active = k.id === kind;
          const disabled = isInstallment || (k.id === "transferencia" && !canTransfer);
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={active}
              disabled={disabled && !active}
              title={k.id === "transferencia" && !canTransfer ? "Cadastre uma segunda conta para transferir" : undefined}
              onClick={() => switchKind(k.id)}
              className={`h-10 rounded-xl text-[13px] font-semibold transition disabled:opacity-35 ${active ? "text-white" : "text-white/45 hover:text-white/70"}`}
              style={active ? { background: `${k.tone}30`, color: k.tone } : undefined}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-6 text-center">
        <label htmlFor="valor" className="text-[13px] text-white/50">Valor</label>
        <input
          id="valor"
          ref={amountRef}
          onClick={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          inputMode="numeric"
          autoComplete="off"
          data-keep-size
          readOnly={isInstallment}
          value={formatBRL(amount)}
          onChange={(e) => setCents(Number(e.target.value.replace(/\D/g, "").slice(0, 11)))}
          aria-invalid={tried && !!errors.amount}
          className="mt-1 w-full bg-transparent text-center text-[40px] font-semibold tabular-nums tracking-tight focus:outline-none"
          style={{ color: kindInfo.tone }}
        />
        {tried && errors.amount && <p role="alert" className="mt-1 text-[12px] text-bad">{errors.amount}</p>}
      </div>

      <Field label={isTransfer ? "Descrição (opcional)" : "Descrição"} error={tried ? errors.description : ""}>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={isTransfer ? "Ex.: Reserva do mês" : "Ex.: Mercado"} aria-invalid={tried && !!errors.description} className={field} />
      </Field>

      {!isTransfer && (
        <Field label="Categoria">
          <Select value={selectedCategory?.id ?? ""} onChange={(e) => setCategoryId(e.target.value)}>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}

      {kind === "despesa" && (
        <div role="group" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
          {(["conta", "cartao"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={payWith === p} disabled={isInstallment || (p === "cartao" && cards.length === 0)} onClick={() => setPayWith(p)}
              title={p === "cartao" && cards.length === 0 ? "Você ainda não cadastrou um cartão" : undefined}
              className={`h-10 rounded-xl text-[13px] font-semibold transition disabled:opacity-35 ${payWith === p ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white/70"}`}>
              {p === "conta" ? "Conta" : "Cartão de crédito"}
            </button>
          ))}
        </div>
      )}

      {useCard ? (
        <>
          <Field label="Cartão" error={tried ? errors.card : ""} hint={invoiceHint}>
            <Select value={cardId} disabled={isInstallment} onChange={(e) => setCardId(e.target.value)}>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` · final ${c.last4}` : ""}</option>)}
            </Select>
          </Field>
          <Field label="Parcelas">
            <Select value={installments} disabled={editing} onChange={(e) => { setInstallments(Number(e.target.value)); if (Number(e.target.value) > 1) setRepeat(""); }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x de ${formatBRL(amount / n)}`}</option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <Field label={isTransfer ? "De" : "Conta"}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      )}

      {isTransfer && (
        <Field label="Para" error={tried ? errors.transfer : ""}>
          <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} aria-invalid={tried && !!errors.transfer}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      )}

      <div className={`grid gap-3 ${isTransfer || editing ? "grid-cols-1" : "grid-cols-2"}`}>
        <Field label="Data" error={tried ? errors.date : ""}>
          <DateInput value={date} disabled={isInstallment} onChange={(e) => setDate(e.target.value)} aria-invalid={tried && !!errors.date} />
        </Field>
        {!isTransfer && !editing && (
          <Field label="Repetição" hint={installments > 1 ? "Compras parceladas não se repetem." : undefined}>
            <Select value={repeat} disabled={installments > 1} onChange={(e) => setRepeat(e.target.value as "" | RecurrenceFrequency)}>
              {REPEAT_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <Field label="Observação (opcional)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="Algum detalhe a lembrar" className={`${field} h-auto resize-none py-3`} />
      </Field>

      {formError && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{formError}</p>}

      <button type="submit" disabled={saving} className="mt-2 h-12 rounded-lg bg-violet-500 hover:bg-violet-600 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
        {saving ? "Salvando…" : editing ? "Salvar alterações" : "Salvar transação"}
      </button>
    </form>
  );
}
