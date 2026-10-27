"use client";

import { useState } from "react";
import { DangerButton, Field, MoneyInput, PrimaryButton, SecondaryButton, Select, inputClass } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { BRAND_OPTIONS, CARD_MODELS, modelById } from "@/features/cards/models";
import { resolveModel } from "@/features/cards/viewModels";
import { InUseError, ValidationError } from "@/lib/errors";
import { getServices } from "@/services";
import type { Account, Card, CardBrand } from "@/types/domain";
import CardFace from "./CardFace";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface Props {
  card?: Card;
  accounts: Account[];
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Criar e editar cartão. Em edição também arquiva/exclui (com a regra de histórico). */
export default function CardFormSheet({ card, accounts, onClose, onDone }: Props) {
  const editing = !!card;
  const [modelId, setModelId] = useState(card ? resolveModel(card).id : "nu");
  const model = modelById(modelId);
  const [name, setName] = useState(card?.name ?? model.label);
  const [institution, setInstitution] = useState(card?.institution ?? model.institution);
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [brand, setBrand] = useState<CardBrand>(card?.brand ?? model.brand);
  const [limit, setLimit] = useState(card?.limitCents ?? 0);
  const [closingDay, setClosingDay] = useState(card?.closingDay ?? 12);
  const [dueDay, setDueDay] = useState(card?.dueDay ?? 19);
  const [payAccount, setPayAccount] = useState(card?.defaultPaymentAccountId ?? "");
  const [nameTouched, setNameTouched] = useState(editing);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const errors = {
    name: name.trim() === "" ? "Dê um nome ao cartão." : "",
    institution: institution.trim() === "" ? "Informe o banco." : "",
    last4: last4 !== "" && !/^\d{4}$/.test(last4) ? "Use os 4 últimos dígitos." : "",
    limit: limit <= 0 ? "Informe o limite do cartão." : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const pickModel = (id: string) => {
    const m = modelById(id);
    setModelId(id);
    setBrand(m.brand);
    if (id !== "outro") setInstitution(m.institution);
    else if (!editing) setInstitution("");
    if (!nameTouched) setName(m.label);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (!valid || busy) return;
    setBusy(true);
    const input = {
      name: name.trim(), institution: institution.trim(), issuer: modelId, brand, last4: last4 || undefined,
      limitCents: limit, closingDay, dueDay, defaultPaymentAccountId: payAccount || undefined,
    };
    try {
      if (card) await getServices().cards.update(card.id, { ...input, last4: input.last4, defaultPaymentAccountId: input.defaultPaymentAccountId });
      else await getServices().cards.create(input);
      onDone(editing ? "Cartão atualizado." : "Cartão adicionado.");
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!card) return;
    setBusy(true);
    try { await getServices().cards.archive(card.id); onDone("Cartão arquivado."); onClose(); }
    catch { setError("Não foi possível arquivar agora."); setBusy(false); }
  };
  const remove = async () => {
    if (!card) return;
    setBusy(true);
    try { await getServices().cards.remove(card.id); onDone("Cartão excluído."); onClose(); }
    catch (err) {
      setError(err instanceof InUseError ? err.message : "Não foi possível excluir agora.");
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar cartão" : "Novo cartão"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <CardFace card={{ issuer: modelId, name: name || model.label, institution, last4: last4.length === 4 ? last4 : undefined, brand }} />

        <div>
          <p className="mb-2 text-[13px] font-medium text-white/60">Modelo</p>
          <div role="radiogroup" aria-label="Modelo do cartão" className="grid grid-cols-3 gap-2">
            {CARD_MODELS.map((m) => (
              <button
                key={m.id} type="button" role="radio" aria-checked={m.id === modelId} onClick={() => pickModel(m.id)}
                className={`flex h-14 flex-col items-start justify-end overflow-hidden rounded-lg border p-2 text-left text-[11px] font-bold leading-tight transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 ${m.id === modelId ? "border-white/70" : "border-white/10"}`}
                style={{ background: `linear-gradient(155deg, ${m.tone[0]}, ${m.tone[1]})`, color: m.ink }}
              >
                <span className="w-full truncate">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Nome do cartão" error={tried ? errors.name : ""}>
          <input value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} maxLength={40} aria-invalid={tried && !!errors.name} placeholder="Ex.: Nubank Roxinho" className={inputClass} />
        </Field>
        <Field label={modelId === "outro" ? "Nome do banco" : "Banco"} error={tried ? errors.institution : ""}>
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={60} aria-invalid={tried && !!errors.institution} placeholder="Ex.: Banco Pan" className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Final do cartão" error={tried ? errors.last4 : ""}>
            <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="0000" aria-invalid={tried && !!errors.last4} className={`${inputClass} tabular-nums`} />
          </Field>
          <Field label="Bandeira">
            <Select value={brand} onChange={(e) => setBrand(e.target.value as CardBrand)}>
              {BRAND_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Limite" error={tried ? errors.limit : ""}>
          <MoneyInput value={limit} onChange={setLimit} invalid={tried && !!errors.limit} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia do fechamento">
            <Select value={closingDay} onChange={(e) => setClosingDay(Number(e.target.value))}>{DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}</Select>
          </Field>
          <Field label="Dia do vencimento">
            <Select value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>{DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}</Select>
          </Field>
        </div>
        {editing && <p className="-mt-2 text-[12px] leading-relaxed text-white/40">Mudar fechamento ou vencimento vale para as próximas faturas. As que já existem não mudam.</p>}

        {accounts.length > 0 && (
          <Field label="Conta para pagar a fatura (opcional)">
            <Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
              <option value="">Escolher na hora de pagar</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}

        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar cartão"}</PrimaryButton>

        {editing && (confirmDelete ? (
          <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-2.5 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            <p className="text-[14px] leading-relaxed text-white/80">Excluir “{card.name}”? Só é possível se o cartão não tiver compras nem faturas.</p>
            <DangerButton disabled={busy} onClick={remove}>Excluir definitivamente</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</SecondaryButton>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <SecondaryButton disabled={busy} onClick={archive}>Arquivar</SecondaryButton>
            <DangerButton disabled={busy} onClick={() => setConfirmDelete(true)}>Excluir</DangerButton>
          </div>
        ))}
      </form>
    </Sheet>
  );
}
