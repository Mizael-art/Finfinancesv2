"use client";

import { useEffect, useState } from "react";
import { DangerButton, Field, MoneyInput, PrimaryButton, SecondaryButton, Select } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { ValidationError } from "@/lib/errors";
import type { MonthKey } from "@/lib/financialMonth";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { Budget, Category } from "@/types/domain";

interface Props {
  budget?: Budget;
  /** Categorias de despesa que ainda não têm orçamento (na edição, a própria categoria é fixa). */
  available: Category[];
  category?: Category;
  month: MonthKey;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Criar, editar e excluir orçamento mensal de uma categoria de despesa. */
export default function BudgetFormSheet({ budget, available, category, month, onClose, onDone }: Props) {
  const editing = !!budget;
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? available[0]?.id ?? "");
  const [limit, setLimit] = useState(budget?.limitCents ?? 0);
  const [suggestion, setSuggestion] = useState(0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!categoryId || editing) { setSuggestion(0); return; }
    getServices().budgets.suggestLimit(categoryId, month).then((v) => alive && setSuggestion(v)).catch(() => alive && setSuggestion(0));
    return () => { alive = false; };
  }, [categoryId, month, editing]);

  const errors = {
    category: !categoryId ? "Escolha uma categoria." : "",
    limit: limit < 1 ? "Informe um limite maior que zero." : "",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (errors.category || errors.limit || busy) return;
    setBusy(true);
    try {
      const s = getServices().budgets;
      if (budget) await s.update(budget.id, { limitCents: limit });
      else await s.create({ categoryId, limitCents: limit, period: "monthly" });
      onDone(editing ? "Orçamento atualizado." : "Orçamento criado.");
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!budget) return;
    setBusy(true);
    setError("");
    try {
      await getServices().budgets.remove(budget.id);
      onDone("Orçamento excluído.");
      onClose();
    } catch {
      setError("Não foi possível excluir agora. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar orçamento" : "Novo orçamento"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {editing ? (
          <Field label="Categoria">
            <p className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[15px] text-white/80">{category?.name ?? "Categoria"}</p>
          </Field>
        ) : (
          <Field label="Categoria" error={tried ? errors.category : ""}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-invalid={tried && !!errors.category}>
              {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}

        <Field label="Limite mensal" error={tried ? errors.limit : ""}>
          <MoneyInput value={limit} onChange={setLimit} invalid={tried && !!errors.limit} />
        </Field>

        {!editing && suggestion > 0 && limit !== suggestion && (
          <button type="button" onClick={() => setLimit(suggestion)} className="rounded-lg border border-violet-400/25 bg-violet-400/[0.08] px-4 py-3 text-left text-[13px] text-violet-200 transition active:scale-[0.99]">
            Média dos últimos 3 meses: <span className="font-semibold tabular-nums">{formatCents(suggestion)}</span>. Toque para usar.
          </button>
        )}

        <p className="text-[12px] leading-relaxed text-white/40">O gasto é calculado a partir das suas despesas na categoria, inclusive compras no cartão. Transferências e pagamentos de fatura não contam.</p>
        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar orçamento"}</PrimaryButton>

        {editing && (deleting ? (
          <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            <p className="text-[14px] leading-relaxed text-white/80">Excluir o orçamento de “{category?.name}”? Suas transações continuam intactas.</p>
            <DangerButton disabled={busy} onClick={remove}>Excluir orçamento</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => setDeleting(false)}>Cancelar</SecondaryButton>
          </div>
        ) : (
          <DangerButton disabled={busy} onClick={() => setDeleting(true)}>Excluir orçamento</DangerButton>
        ))}
      </form>
    </Sheet>
  );
}
