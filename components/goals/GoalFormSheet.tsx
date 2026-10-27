"use client";

import { useState } from "react";
import { DangerButton, DateInput, Field, MoneyInput, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { GOAL_COLORS } from "@/features/goals/constants";
import { ValidationError } from "@/lib/errors";
import { getServices } from "@/services";
import type { Goal } from "@/types/domain";

interface Props {
  goal?: Goal;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Criar, editar e excluir meta. O valor guardado só muda por "Adicionar"/"Retirar" (na criação dá para informar o que já existe). */
export default function GoalFormSheet({ goal, onClose, onDone }: Props) {
  const editing = !!goal;
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal?.targetCents ?? 0);
  const [saved, setSaved] = useState(0);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [color, setColor] = useState<string>(goal?.color ?? GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const errors = {
    name: name.trim() === "" ? "Dê um nome à meta." : "",
    target: target < 1 ? "Informe o valor da meta." : "",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (errors.name || errors.target || busy) return;
    setBusy(true);
    try {
      const s = getServices().goals;
      if (goal) await s.update(goal.id, { name: name.trim(), targetCents: target, deadline: deadline || undefined, color });
      else await s.create({ name: name.trim(), targetCents: target, currentCents: saved, deadline: deadline || undefined, color });
      onDone(editing ? "Meta atualizada." : "Meta criada.");
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!goal) return;
    setBusy(true);
    setError("");
    try {
      await getServices().goals.remove(goal.id);
      onDone("Meta excluída.");
      onClose();
    } catch {
      setError("Não foi possível excluir agora. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar meta" : "Nova meta"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" error={tried ? errors.name : ""}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Viagem" aria-invalid={tried && !!errors.name} className={inputClass} />
        </Field>
        <Field label="Valor da meta" error={tried ? errors.target : ""}>
          <MoneyInput value={target} onChange={setTarget} invalid={tried && !!errors.target} />
        </Field>
        {!editing && (
          <Field label="Já guardado (opcional)">
            <MoneyInput value={saved} onChange={setSaved} ariaLabel="Já guardado" />
          </Field>
        )}
        <Field label="Prazo (opcional)">
          <DateInput value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-white/60">Cor</p>
          <div role="radiogroup" aria-label="Cor da meta" className="grid grid-cols-6 gap-2.5">
            {GOAL_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={c === color.toUpperCase()} aria-label={`Cor ${c}`} onClick={() => setColor(c)}
                className={`grid h-11 w-11 place-items-center justify-self-center rounded-full border-2 transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${c === color.toUpperCase() ? "border-white" : "border-transparent"}`}
                style={{ background: c }}>
                {c === color.toUpperCase() && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A15" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}
        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar meta"}</PrimaryButton>

        {editing && (deleting ? (
          <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            <p className="text-[14px] leading-relaxed text-white/80">Excluir a meta “{goal.name}”? O valor guardado nela deixa de ser acompanhado. Esta ação não pode ser desfeita.</p>
            <DangerButton disabled={busy} onClick={remove}>Excluir meta</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => setDeleting(false)}>Cancelar</SecondaryButton>
          </div>
        ) : (
          <DangerButton disabled={busy} onClick={() => setDeleting(true)}>Excluir meta</DangerButton>
        ))}
      </form>
    </Sheet>
  );
}
