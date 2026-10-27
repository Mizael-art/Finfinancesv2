"use client";

import { useState } from "react";
import { DangerButton, Field, PrimaryButton, SecondaryButton, Select, inputClass } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { CATEGORY_COLORS } from "@/features/categories/constants";
import { usageSentence, type CategoryOverviewItem } from "@/features/categories/viewModels";
import { InUseError, ValidationError } from "@/lib/errors";
import { getServices } from "@/services";
import type { Category, CategoryKind } from "@/types/domain";

interface Props {
  /** Em edição, o item com uso; na criação, só o tipo. */
  item?: CategoryOverviewItem;
  kind: CategoryKind;
  /** Todas as categorias, para escolher para onde mover ao excluir. */
  all: Category[];
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Criar, editar e excluir categoria (excluir em uso pede para onde mover os registros). */
export default function CategoryFormSheet({ item, kind, all, onClose, onDone }: Props) {
  const category = item?.category;
  const editing = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState<string>(category?.color ?? CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const targets = all.filter((c) => c.kind === kind && c.id !== category?.id);
  const [target, setTarget] = useState(targets.find((c) => c.name === "Outros")?.id ?? targets[0]?.id ?? "");
  const sentence = item ? usageSentence(item.usage) : "";
  const inUse = !!sentence;

  const nameError = name.trim() === "" ? "Dê um nome à categoria." : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (nameError || busy) return;
    setBusy(true);
    try {
      const s = getServices().categories;
      if (category) await s.update(category.id, { name: name.trim(), color });
      else await s.create({ name: name.trim(), kind, color });
      onDone(editing ? "Categoria atualizada." : "Categoria criada.");
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!category) return;
    setBusy(true);
    setError("");
    try {
      await getServices().categories.remove(category.id, inUse ? { reassignToCategoryId: target } : {});
      onDone(inUse ? "Categoria excluída. Registros movidos." : "Categoria excluída.");
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError || err instanceof InUseError ? err.message : "Não foi possível excluir agora. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar categoria" : kind === "despesa" ? "Nova categoria de despesa" : "Nova categoria de receita"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-[18px] font-bold" style={{ background: `${color}22`, color }} aria-hidden>
            {(name.trim()[0] ?? "?").toUpperCase()}
          </span>
          <p className="min-w-0 truncate text-[16px] font-semibold text-white">{name.trim() || "Nome da categoria"}</p>
        </div>

        <Field label="Nome" error={tried ? nameError : ""}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex.: Pet" aria-invalid={tried && !!nameError} className={inputClass} />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-white/60">Cor</p>
          <div role="radiogroup" aria-label="Cor da categoria" className="grid grid-cols-6 gap-2.5">
            {CATEGORY_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={c === color.toUpperCase()} aria-label={`Cor ${c}`} onClick={() => setColor(c)}
                className={`grid h-11 w-11 place-items-center justify-self-center rounded-full border-2 transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${c === color.toUpperCase() ? "border-white" : "border-transparent"}`}
                style={{ background: c }}>
                {c === color.toUpperCase() && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A15" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>}
              </button>
            ))}
          </div>
        </div>

        {editing && <p className="text-[12px] leading-relaxed text-white/40">O tipo ({kind === "despesa" ? "despesa" : "receita"}) não muda depois de criada. Para outro tipo, crie uma nova categoria.</p>}
        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar categoria"}</PrimaryButton>

        {editing && (category.isDefault ? (
          <p className="text-center text-[12px] text-white/40">Categorias padrão podem ser editadas, mas não excluídas.</p>
        ) : deleting ? (
          <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            {inUse ? (
              <>
                <p className="text-[14px] leading-relaxed text-white/80">“{category.name}” está em uso: {sentence}. Escolha para qual categoria mover esses registros antes de excluir.</p>
                {targets.length === 0 ? (
                  <p role="alert" className="text-[13px] text-bad-soft">Crie outra categoria de {kind === "despesa" ? "despesa" : "receita"} para receber os registros.</p>
                ) : (
                  <Field label="Mover para">
                    <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                      {targets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                )}
                <DangerButton disabled={busy || targets.length === 0} onClick={remove}>Mover e excluir</DangerButton>
              </>
            ) : (
              <>
                <p className="text-[14px] leading-relaxed text-white/80">Excluir “{category.name}”? Ela não está em uso e a ação não pode ser desfeita.</p>
                <DangerButton disabled={busy} onClick={remove}>Excluir definitivamente</DangerButton>
              </>
            )}
            <SecondaryButton disabled={busy} onClick={() => { setDeleting(false); setError(""); }}>Cancelar</SecondaryButton>
          </div>
        ) : (
          <DangerButton disabled={busy} onClick={() => setDeleting(true)}>Excluir categoria</DangerButton>
        ))}
      </form>
    </Sheet>
  );
}
