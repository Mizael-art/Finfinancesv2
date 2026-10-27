"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export const inputClass =
  "h-12 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-violet-400/60 focus:bg-white/[0.06] disabled:opacity-50 aria-[invalid=true]:border-bad/60";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-white/60">{label}</span>
      {children}
      {error ? <span role="alert" className="text-[12px] text-bad-soft">{error}</span> : hint ? <span className="text-[12px] text-white/35">{hint}</span> : null}
    </label>
  );
}

/**
 * Campo de data sem o visual "torto" do iPhone: o Safari dá largura própria ao campo, centraliza o texto e
 * deixa ele vazar para o vizinho. Aqui ele ocupa só a própria coluna, alinhado à esquerda, com a mesma altura dos outros.
 */
export function DateInput({ className = "", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="date"
      {...rest}
      className={`${inputClass} block min-h-[48px] min-w-0 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:opacity-60 ${className}`}
    />
  );
}

/** Como o campo de texto, mas com fundo sólido: a lista aberta do navegador usa essa cor (nada de branco sobre branco). */
const SELECT_BASE = inputClass.replace("bg-white/[0.04]", "bg-panel").replace("focus:bg-white/[0.06]", "focus:bg-panel");

const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A8FA3' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ children, className = "", style, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", backgroundSize: "16px", ...style }}
      className={`${SELECT_BASE} [&>option]:bg-panel [&>option]:text-white [&>optgroup]:bg-panel appearance-none pr-10 ${className}`}
    >
      {children}
    </select>
  );
}

const btn = "flex h-12 w-full items-center justify-center rounded-lg text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";
export function PrimaryButton(p: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...p} className={`${btn} bg-violet-500 hover:bg-violet-600 text-white`} />;
}
export function SecondaryButton(p: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...p} className={`${btn} border border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08]`} />;
}
export function DangerButton(p: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...p} className={`${btn} border border-bad/30 bg-bad/10 text-bad-soft hover:bg-bad/20`} />;
}

/** Campo de dinheiro: o usuário digita só números e o valor é montado em centavos. */
export function MoneyInput({ value, onChange, invalid, id, ariaLabel }: { value: number; onChange: (cents: number) => void; invalid?: boolean; id?: string; ariaLabel?: string }) {
  const [text, setText] = useState(format(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setText(format(value)), [value]);
  /** O cursor fica sempre no fim: o valor é montado da direita para a esquerda, como nos apps de banco. */
  useLayoutEffect(() => { const el = ref.current; if (el && document.activeElement === el) el.setSelectionRange(text.length, text.length); }, [text]);
  return (
    <input
      ref={ref}
      onClick={(e) => { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n); }}
      onFocus={(e) => { const el = e.currentTarget; requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length)); }}
      id={id}
      inputMode="numeric"
      aria-label={ariaLabel}
      aria-invalid={invalid}
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
        const cents = digits ? Number(digits) : 0;
        setText(format(cents));
        onChange(cents);
      }}
      className={`${inputClass} tabular-nums`}
    />
  );
}
function format(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Segmented<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-white/[0.04] p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
          className={`h-10 rounded-xl text-[14px] font-semibold transition ${o.value === value ? "bg-violet-500/30 text-white" : "text-white/50 hover:text-white/80"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
