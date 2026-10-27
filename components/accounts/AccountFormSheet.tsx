"use client";

import { useState } from "react";
import { DangerButton, Field, MoneyInput, PrimaryButton, SecondaryButton, Select, inputClass } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { ACCOUNT_TYPES, lookFor, matchBank } from "@/features/accounts/banks";
import { CARD_MODELS } from "@/features/cards/models";
import { InUseError, ValidationError } from "@/lib/errors";
import { getServices } from "@/services";
import type { AccountWithBalance } from "@/services/accounts";
import type { AccountType } from "@/types/domain";

interface Props {
  account?: AccountWithBalance;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Criar e editar conta. Em edição: ajustar o saldo atual, arquivar e excluir (só sem movimentações). */
export default function AccountFormSheet({ account, onClose, onDone }: Props) {
  const editing = !!account;
  const [bankId, setBankId] = useState(account ? matchBank(account.name, account.institution) : "outro");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "corrente");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [balance, setBalance] = useState(account ? Math.abs(account.balanceCents) : 0);
  const [negative, setNegative] = useState(account ? account.balanceCents < 0 : false);
  const [nameTouched, setNameTouched] = useState(editing);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const errors = { name: name.trim() === "" ? "Dê um nome à conta." : "" };
  const look = lookFor({ name: name || "Conta", institution, type });
  const signed = negative ? -Math.abs(balance) : Math.abs(balance);

  const pickBank = (id: string) => {
    const m = CARD_MODELS.find((x) => x.id === id)!;
    setBankId(id);
    if (id !== "outro") setInstitution(m.institution);
    if (!nameTouched && id !== "outro") setName(m.label);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (errors.name || busy) return;
    setBusy(true);
    const s = getServices();
    try {
      const base = { name: name.trim(), type, institution: institution.trim() || undefined };
      if (account) {
        await s.accounts.update(account.id, base);
        if (signed !== account.balanceCents) await s.accounts.setCurrentBalance(account.id, signed);
      } else {
        await s.accounts.create({ ...base, initialBalanceCents: signed });
      }
      onDone(editing ? "Conta atualizada." : "Conta adicionada.");
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!account) return;
    setBusy(true);
    try { await getServices().accounts.archive(account.id); onDone("Conta arquivada."); onClose(); }
    catch { setError("Não foi possível arquivar agora."); setBusy(false); }
  };
  const remove = async () => {
    if (!account) return;
    setBusy(true);
    try { await getServices().accounts.remove(account.id); onDone("Conta excluída."); onClose(); }
    catch (err) {
      setError(err instanceof InUseError ? err.message : "Não foi possível excluir agora.");
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={editing ? "Editar conta" : "Nova conta"} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-[15px] font-black tracking-tighter text-white" style={{ background: `linear-gradient(180deg, ${look.tone[0]}, ${look.tone[1]})` }}>{look.glyph}</span>
          <span className="min-w-0 truncate text-[15px] font-semibold text-white">{name.trim() || "Sua conta"}</span>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-white/60">Banco</p>
          <div role="radiogroup" aria-label="Banco da conta" className="grid grid-cols-3 gap-2">
            {CARD_MODELS.map((m) => (
              <button
                key={m.id} type="button" role="radio" aria-checked={m.id === bankId} onClick={() => pickBank(m.id)}
                className={`flex h-12 items-end overflow-hidden rounded-lg border p-2 text-left text-[11px] font-bold leading-tight transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 ${m.id === bankId ? "border-white/70" : "border-white/10"}`}
                style={{ background: `linear-gradient(155deg, ${m.tone[0]}, ${m.tone[1]})`, color: m.ink }}
              >
                <span className="w-full truncate">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Nome da conta" error={tried ? errors.name : ""}>
          <input value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} maxLength={60} aria-invalid={tried && !!errors.name} placeholder="Ex.: Nubank, Carteira" className={inputClass} />
        </Field>

        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>

        <Field label="Instituição (opcional)">
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={60} placeholder="Ex.: Banco Inter" className={inputClass} />
        </Field>

        <Field label={editing ? "Saldo atual" : "Saldo inicial"} hint={editing ? "Ajusta o saldo para esse valor, sem apagar nenhuma transação." : "Quanto você tem nessa conta hoje."}>
          <MoneyInput value={balance} onChange={setBalance} />
        </Field>
        <label className="-mt-2 flex items-center gap-2 text-[13px] text-white/60">
          <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} className="h-4 w-4 accent-violet-500" />
          Saldo negativo (conta no vermelho)
        </label>

        {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar conta"}</PrimaryButton>

        {editing && (confirmDelete ? (
          <div role="alertdialog" aria-label="Confirmar exclusão" className="flex flex-col gap-2.5 rounded-xl border border-bad/30 bg-bad/[0.06] p-4">
            <p className="text-[14px] leading-relaxed text-white/80">Excluir “{account.name}”? Só é possível se a conta não tiver movimentações. Senão, arquive.</p>
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
