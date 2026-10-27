"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import { Field, MoneyInput, PrimaryButton, SecondaryButton, Select, inputClass } from "@/components/ui/FormControls";
import { getServices } from "@/services";
import {
  FINANCIAL_GOALS, INCOME_MODES, MAX_FIXED_EXPENSES, MAX_INCOMES, displayName, emptyDraft, hasErrors, validateStep,
  type OnboardingErrors,
} from "@/services/onboarding/compute";
import type { FinancialGoalId, IncomeMode, OnboardingDraft } from "@/types/domain";
import Logo from "./Logo";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const SECTION = "rounded-xl border border-white/[0.08] bg-white/[0.03] p-4";

function Dots({ step, last }: { step: number; last: number }) {
  return (
    <div role="progressbar" aria-label="Progresso" aria-valuemin={1} aria-valuemax={last} aria-valuenow={Math.max(1, step)} className="flex gap-1.5">
      {Array.from({ length: last }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-violet-500" : "bg-white/[0.12]"}`} />)}
    </div>
  );
}

/** Onboarding: primeiro acesso (6 etapas) ou edição posterior (nome, renda e objetivos). */
export default function OnboardingFlow() {
  const router = useRouter();
  const [state, setState] = useState<{ draft: OnboardingDraft; completed: boolean } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const headRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    setLoadError(false);
    getServices().onboarding.load().then((s) => { setState(s); setDraft(s.draft); }).catch(() => setLoadError(true));
  }, []);
  useEffect(load, [load]);

  const edit = state?.completed ?? false;
  const last = edit ? 3 : 5;
  const step = draft.step;
  const errors: OnboardingErrors = tried ? validateStep(step, draft) : {};
  const set = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => { headRef.current?.focus(); }, [step]);

  const go = (to: number) => {
    const next = { ...draft, step: to };
    setDraft(next);
    setTried(false);
    setError("");
    if (!edit) void getServices().onboarding.saveDraft(next).catch(() => undefined); // retomar depois
  };

  const next = () => {
    setTried(true);
    if (hasErrors(validateStep(step, draft))) return;
    go(step + 1);
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await getServices().onboarding.complete(draft, edit ? "edit" : "first");
      router.replace(edit ? "/configuracoes" : "/");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Não foi possível salvar agora. Seus dados continuam aqui; tente de novo.");
      setBusy(false);
    }
  };

  if (loadError) return <main className="mx-auto min-h-dvh w-full max-w-[460px] px-4 pt-10"><ErrorState onRetry={load} /></main>;
  if (!state) return <main aria-busy="true" aria-label="Carregando" className="mx-auto min-h-dvh w-full max-w-[460px] px-4 pt-10"><div className="h-64 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" /></main>;

  const name = displayName(draft);
  const title = "text-[26px] font-semibold leading-tight tracking-tight text-white outline-none";
  const lead = "mt-2 text-[15px] leading-relaxed text-white/55";

  const setIncome = (i: number, patch: Partial<{ name: string; amountCents: number }>) => set({ incomes: draft.incomes.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const pickMode = (m: IncomeMode) => set({ incomeMode: m, incomes: m === "variavel" ? [{ name: "Renda variável", amountCents: draft.incomes[0]?.amountCents ?? 0 }] : m === "fixa" ? [{ name: "Salário", amountCents: draft.incomes[0]?.amountCents ?? 0 }] : draft.incomes.length ? draft.incomes : [{ name: "", amountCents: 0 }] });
  const toggleGoal = (g: FinancialGoalId) => set({ goals: draft.goals.includes(g) ? draft.goals.filter((x) => x !== g) : [...draft.goals, g] });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-4 pb-6 pt-6">
      {step > 0 && step < 5 && (
        <header className="mb-6 flex items-center gap-3">
          {step > 1 && (
            <button type="button" onClick={() => go(step - 1)} aria-label="Voltar" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
            </button>
          )}
          <Dots step={step} last={edit ? 3 : 4} />
        </header>
      )}

      <div className="flex-1">
        {step === 0 && (
          <section aria-label="Boas-vindas" className="flex min-h-[70dvh] flex-col justify-center">
            <Logo size={56} />
            <h1 ref={headRef} tabIndex={-1} className={`${title} mt-8 text-[30px]`}>Vamos organizar sua vida financeira?</h1>
            <p className={lead}>Personalize seu FinFinance em poucos passos e comece a acompanhar seu dinheiro.</p>
          </section>
        )}

        {step === 1 && (
          <section aria-label="Informações pessoais" className="flex flex-col gap-5">
            <div><h1 ref={headRef} tabIndex={-1} className={title}>Como podemos te chamar?</h1><p className={lead}>Usamos seu nome para personalizar o app. Não pedimos nada além disso.</p></div>
            <Field label="Qual é o seu nome?" error={errors.name}>
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" maxLength={60} placeholder="Ex.: João da Silva" aria-invalid={!!errors.name} className={inputClass} />
            </Field>
            <Field label="Como você gostaria de ser chamado? (opcional)" error={errors.nickname} hint={draft.name.trim() ? `Se deixar em branco, usamos “${displayName({ name: draft.name, nickname: "" })}”.` : undefined}>
              <input value={draft.nickname} onChange={(e) => set({ nickname: e.target.value })} maxLength={30} placeholder="Ex.: João" aria-invalid={!!errors.nickname} className={inputClass} />
            </Field>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Renda mensal" className="flex flex-col gap-5">
            <div><h1 ref={headRef} tabIndex={-1} className={title}>Qual é a sua renda mensal?</h1><p className={lead}>Um valor aproximado já ajuda. Usamos só para personalizar seu planejamento: não é lançado como receita e não muda o seu saldo.</p></div>
            <div role="radiogroup" aria-label="Tipo de renda" className="flex flex-col gap-2">
              {INCOME_MODES.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={draft.incomeMode === m.id} onClick={() => pickMode(m.id)}
                  className={`flex h-12 items-center justify-between rounded-lg border px-4 text-left text-[15px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${draft.incomeMode === m.id ? "border-violet-400 bg-white/[0.06] text-white" : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"}`}>
                  {m.label}
                  <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full border ${draft.incomeMode === m.id ? "border-violet-400 bg-violet-500" : "border-white/25"}`}>
                    {draft.incomeMode === m.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </button>
              ))}
            </div>

            {(draft.incomeMode === "fixa" || draft.incomeMode === "variavel") && (
              <Field label={draft.incomeMode === "fixa" ? "Salário mensal" : "Média mensal aproximada"} error={errors.income}>
                <MoneyInput value={draft.incomes[0]?.amountCents ?? 0} onChange={(c) => setIncome(0, { amountCents: c })} invalid={!!errors.income} />
              </Field>
            )}
            {draft.incomeMode === "varias" && (
              <div className="flex flex-col gap-3">
                {draft.incomes.map((r, i) => (
                  <div key={i} className={SECTION}>
                    <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                      <Field label={`Fonte ${i + 1}`}><input value={r.name} onChange={(e) => setIncome(i, { name: e.target.value })} maxLength={60} placeholder="Ex.: Salário, Freelance" className={inputClass} /></Field>
                      {draft.incomes.length > 1 && <button type="button" aria-label={`Remover fonte ${i + 1}`} onClick={() => set({ incomes: draft.incomes.filter((_, k) => k !== i) })} className="mb-1 grid h-10 w-10 place-items-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white">×</button>}
                    </div>
                    <div className="mt-3"><Field label="Valor mensal"><MoneyInput value={r.amountCents} onChange={(c) => setIncome(i, { amountCents: c })} invalid={!!errors.income} ariaLabel={`Valor da fonte ${i + 1}`} /></Field></div>
                  </div>
                ))}
                {errors.income && <p role="alert" className="text-[12px] text-bad-soft">{errors.income}</p>}
                {draft.incomes.length < MAX_INCOMES && <SecondaryButton onClick={() => set({ incomes: [...draft.incomes, { name: "", amountCents: 0 }] })}>+ Adicionar outra fonte</SecondaryButton>}
              </div>
            )}
            {draft.incomeMode !== "depois" && (
              <Field label="Dia em que costuma receber" error={errors.payDay}>
                <Select value={draft.payDay} onChange={(e) => set({ payDay: Number(e.target.value) })}>{DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}</Select>
              </Field>
            )}
            {draft.incomeMode === "depois" && <p className="text-[13px] text-white/45">Tudo bem. Você pode informar depois em Configurações.</p>}
          </section>
        )}

        {step === 3 && (
          <section aria-label="Objetivo financeiro" className="flex flex-col gap-5">
            <div><h1 ref={headRef} tabIndex={-1} className={title}>Qual é o seu objetivo?</h1><p className={lead}>Escolha quantos quiser. Isso ajuda a personalizar o app (e você pode mudar depois).</p></div>
            <div role="group" aria-label="Objetivos" className="flex flex-col gap-2">
              {FINANCIAL_GOALS.map((g) => {
                const on = draft.goals.includes(g.id);
                return (
                  <button key={g.id} type="button" aria-pressed={on} onClick={() => toggleGoal(g.id)}
                    className={`flex h-12 items-center justify-between rounded-lg border px-4 text-left text-[15px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${on ? "border-violet-400 bg-white/[0.06] text-white" : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"}`}>
                    {g.label}
                    <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-md border ${on ? "border-violet-400 bg-violet-500" : "border-white/25"}`}>
                      {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 4 && (
          <section aria-label="Configuração opcional" className="flex flex-col gap-5">
            <div><h1 ref={headRef} tabIndex={-1} className={title}>Quer já deixar algo pronto?</h1><p className={lead}>Tudo aqui é opcional. Você pode pular e configurar depois.</p></div>

            <div className={SECTION}>
              <p className="mb-3 text-[15px] font-semibold text-white">Primeira conta bancária</p>
              <div className="flex flex-col gap-3">
                <Field label="Nome da conta" error={errors.account}><input value={draft.accountName} onChange={(e) => set({ accountName: e.target.value })} maxLength={60} placeholder="Ex.: Nubank" className={inputClass} /></Field>
                <Field label="Saldo inicial" hint="É o saldo de abertura da conta, não um salário nem uma receita."><MoneyInput value={draft.accountBalanceCents} onChange={(c) => set({ accountBalanceCents: c })} ariaLabel="Saldo inicial" /></Field>
              </div>
            </div>

            <div className={SECTION}>
              <p className="mb-3 text-[15px] font-semibold text-white">Despesas fixas</p>
              <div className="flex flex-col gap-3">
                {draft.fixedExpenses.map((e, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border border-white/[0.06] p-3">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <input aria-label={`Nome da despesa fixa ${i + 1}`} value={e.name} onChange={(ev) => set({ fixedExpenses: draft.fixedExpenses.map((x, k) => (k === i ? { ...x, name: ev.target.value } : x)) })} maxLength={120} placeholder="Ex.: Aluguel" className={inputClass} />
                      <button type="button" aria-label={`Remover despesa fixa ${i + 1}`} onClick={() => set({ fixedExpenses: draft.fixedExpenses.filter((_, k) => k !== i) })} className="grid h-10 w-10 place-items-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white">×</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MoneyInput value={e.amountCents} onChange={(c) => set({ fixedExpenses: draft.fixedExpenses.map((x, k) => (k === i ? { ...x, amountCents: c } : x)) })} ariaLabel={`Valor da despesa fixa ${i + 1}`} />
                      <Select aria-label={`Dia de vencimento da despesa fixa ${i + 1}`} value={e.day} onChange={(ev) => set({ fixedExpenses: draft.fixedExpenses.map((x, k) => (k === i ? { ...x, day: Number(ev.target.value) } : x)) })}>{DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}</Select>
                    </div>
                  </div>
                ))}
                {errors.fixed && <p role="alert" className="text-[12px] text-bad-soft">{errors.fixed}</p>}
                {draft.fixedExpenses.length < MAX_FIXED_EXPENSES && <SecondaryButton onClick={() => set({ fixedExpenses: [...draft.fixedExpenses, { name: "", amountCents: 0, day: 5 }] })}>+ Adicionar despesa fixa</SecondaryButton>}
              </div>
            </div>

            <div className={SECTION}>
              <Field label="Limite mensal de gastos" error={errors.limit} hint="Opcional. Serve como referência de planejamento."><MoneyInput value={draft.monthlyLimitCents} onChange={(c) => set({ monthlyLimitCents: c })} ariaLabel="Limite mensal de gastos" /></Field>
            </div>
          </section>
        )}

        {step === 5 && (
          <section aria-label="Conclusão" className="flex min-h-[70dvh] flex-col justify-center">
            <span className="mb-6 grid h-14 w-14 place-items-center rounded-xl bg-ok/15 text-ok" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
            </span>
            <h1 ref={headRef} tabIndex={-1} className={`${title} text-[30px]`}>Tudo pronto, {name}!</h1>
            <p className={lead}>Seu espaço financeiro está preparado. Agora você pode acompanhar suas contas, organizar seus gastos e planejar seus objetivos.</p>
          </section>
        )}
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

      <footer className="flex flex-col gap-2.5 pt-4">
        {step === 0 && <PrimaryButton onClick={() => go(1)}>Começar</PrimaryButton>}
        {step >= 1 && step < 3 && <PrimaryButton onClick={next}>Continuar</PrimaryButton>}
        {step === 3 && !edit && <PrimaryButton onClick={next}>Continuar</PrimaryButton>}
        {step === 3 && !edit && <SecondaryButton onClick={() => go(4)}>Pular</SecondaryButton>}
        {step === 3 && edit && <PrimaryButton onClick={finish} disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</PrimaryButton>}
        {step === 4 && <PrimaryButton onClick={next}>Continuar</PrimaryButton>}
        {step === 4 && <SecondaryButton onClick={() => go(5)}>Pular e configurar depois</SecondaryButton>}
        {step === 5 && <PrimaryButton onClick={finish} disabled={busy}>{busy ? "Preparando…" : "Entrar no FinFinance"}</PrimaryButton>}
      </footer>
    </main>
  );
}
