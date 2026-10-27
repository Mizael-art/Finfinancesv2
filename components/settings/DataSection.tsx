"use client";

import { useRef, useState } from "react";
import { DangerButton, PrimaryButton, SecondaryButton } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import CountsTable from "./CountsTable";
import { BACKUP_FILENAME } from "@/features/backup/download";
import { exportBackupFile } from "@/features/backup/exportFile";
import { hasLocalData } from "@/features/backup/viewModels";
import { formatDateTime } from "@/lib/date";
import { getServices } from "@/services";
import { inspectBackup, MAX_BACKUP_BYTES, type BackupFile } from "@/services/backup";
import type { StoreName } from "@/storage/types";

type Pending = { file: BackupFile; current: Record<StoreName, number>; warnings: string[] };

/** Exportar e importar backup (JSON). Importar valida, mostra o que muda e só substitui após confirmação. */
export default function DataSection({ lastExportAt, onMessage }: { lastExportAt?: string; onMessage: (m: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoreError, setRestoreError] = useState("");

  const exportNow = async (silent = false): Promise<boolean> => {
    const ok = await exportBackupFile();
    if (!silent) onMessage(ok ? "Backup exportado." : "Não foi possível exportar agora. Tente novamente.");
    return ok;
  };

  const onExport = async () => { setBusy(true); await exportNow(); setBusy(false); };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!f) return;
    setBusy(true);
    try {
      if (f.size > MAX_BACKUP_BYTES) { setProblem("O arquivo é grande demais para ser um backup do FinFinance."); return; }
      const result = inspectBackup(await f.text(), { bytes: f.size });
      if (!result.ok) { setProblem(result.error); return; }
      setRestoreError("");
      setPending({ file: result.file, warnings: result.warnings, current: await getServices().backup.currentCounts() });
    } catch {
      setProblem("Não foi possível ler o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setRestoreError("");
    try {
      await getServices().backup.restore(pending.file);
      setPending(null);
      onMessage("Backup restaurado.");
    } catch {
      setRestoreError("Não foi possível restaurar. Seus dados atuais não foram alterados.");
    }
    setBusy(false);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onExport} disabled={busy}
          className="h-12 rounded-lg border border-white/[0.08] bg-white/[0.04] text-[14px] font-semibold text-white transition active:scale-95 hover:bg-white/[0.08] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">Exportar backup</button>
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          className="h-12 rounded-lg border border-white/[0.08] bg-white/[0.04] text-[14px] font-semibold text-white transition active:scale-95 hover:bg-white/[0.08] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">Importar backup</button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" onChange={onPick} className="hidden" aria-label="Arquivo de backup" data-testid="backup-file" />
      <p className="text-[12px] text-white/40">
        {lastExportAt ? `Última exportação: ${formatDateTime(lastExportAt)}. ` : "Você ainda não exportou um backup. "}
        O arquivo {BACKUP_FILENAME} guarda todos os seus dados e fica só com você.
      </p>

      {problem && (
        <Sheet open onClose={() => setProblem("")} title="Não foi possível importar">
          <div className="flex flex-col gap-4">
            <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[14px] leading-relaxed text-bad-soft">{problem}</p>
            <p className="text-[13px] text-white/50">Nada foi alterado. Escolha um arquivo gerado por “Exportar backup”.</p>
            <PrimaryButton onClick={() => setProblem("")}>Entendi</PrimaryButton>
          </div>
        </Sheet>
      )}

      {pending && (
        <Sheet open onClose={() => !busy && setPending(null)} title="Importar este backup?" dismissible={!busy}>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-white/70">
              {pending.file.exportedAt ? `Backup de ${formatDateTime(pending.file.exportedAt)}. ` : ""}Veja o que muda neste aparelho:
            </p>
            <CountsTable current={pending.current} incoming={pending.file.counts} />
            {pending.warnings.map((w) => <p key={w} className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-3 text-[13px] text-warn">{w}</p>)}
            <p role="alert" className="rounded-lg border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[13px] leading-relaxed text-white/80">
              {hasLocalData(pending.current) ? "Todos os dados atuais deste aparelho serão substituídos pelos do backup. " : ""}Esta ação não pode ser desfeita.
            </p>
            {restoreError && <p role="alert" className="text-[13px] text-bad-soft">{restoreError}</p>}
            {hasLocalData(pending.current) && <SecondaryButton disabled={busy} onClick={() => exportNow()}>Baixar cópia dos dados atuais antes</SecondaryButton>}
            <DangerButton disabled={busy} onClick={confirm}>{busy ? "Restaurando…" : "Substituir dados deste aparelho"}</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => setPending(null)}>Cancelar</SecondaryButton>
          </div>
        </Sheet>
      )}
    </>
  );
}
