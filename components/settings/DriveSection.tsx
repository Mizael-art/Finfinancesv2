"use client";

import { useState, useSyncExternalStore } from "react";
import { DangerButton, PrimaryButton, SecondaryButton } from "@/components/ui/FormControls";
import Sheet from "@/components/ui/Sheet";
import { exportBackupFile } from "@/features/backup/exportFile";
import { describeDriveError, getDriveController } from "@/features/drive/driveController";
import { backupStatus } from "@/features/settings/viewModels";
import { formatDateTime } from "@/lib/date";
import type { RemoteState } from "@/services/drive/sync";
import type { BackupSettings } from "@/types/domain";
import CountsTable from "./CountsTable";

type Found = Extract<RemoteState, { status: "found" }>;
type Flow =
  | { kind: "found-empty"; r: Found }
  | { kind: "conflict"; r: Found }
  | { kind: "invalid"; error: string }
  | { kind: "confirm-restore"; r: Found; back: "found-empty" | "conflict" | "manual" }
  | { kind: "confirm-local"; back: "conflict" | "invalid"; r?: Found; error?: string }
  | { kind: "confirm-fresh"; r: Found };

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[14px] text-white/60">{label}</span>
    <span className="min-w-0 truncate text-right text-[14px] font-medium text-white">{value}</span>
  </div>
);

const ghost = "h-12 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] text-[14px] font-semibold text-white transition active:scale-[0.98] hover:bg-white/[0.08] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400";

/** Backup no Google Drive: conectar, backup manual/automático, restaurar e desconectar. */
export default function DriveSection({ backup, onMessage }: { backup: BackupSettings; onMessage: (m: string) => void }) {
  const ctl = getDriveController();
  const ui = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getSnapshot);
  const [flow, setFlow] = useState<Flow | null>(null);
  const status = backupStatus(backup);
  const busy = ui.busy !== "idle";

  const decide = (r: RemoteState) => {
    if (r.status === "invalid") return setFlow({ kind: "invalid", error: r.error });
    if (r.status === "found") return setFlow({ kind: r.localHasData ? "conflict" : "found-empty", r });
  };

  const connect = async () => {
    try {
      const r = await ctl.connect();
      if (r.status === "none") { onMessage((await ctl.backupNow()) ? "Conectado. Primeiro backup feito." : "Conectado. O primeiro backup ficou pendente."); return; }
      if (r.status === "found" && r.sameAsLocal) { await ctl.markSynced(r.meta.modifiedTime); onMessage("Conectado. Seus dados já estão no Drive."); return; }
      decide(r);
    } catch { /* o controlador já deixou a mensagem de erro na tela */ }
  };

  const manualRestore = async () => {
    try {
      const r = await ctl.inspectRemote();
      if (r.status === "none") return onMessage("Nenhum backup encontrado no Google Drive.");
      if (r.status === "invalid") return setFlow({ kind: "invalid", error: r.error });
      if (r.sameAsLocal) return onMessage("Seus dados já são iguais ao backup do Drive.");
      setFlow({ kind: "confirm-restore", r, back: "manual" });
    } catch (e) { onMessage(describeDriveError(e)); }
  };

  const disconnect = async () => { setFlow(null); await ctl.disconnect(); onMessage("Google Drive desconectado."); };
  const goBack = (f: Flow) => {
    if (f.kind === "confirm-restore") setFlow(f.back === "manual" ? null : { kind: f.back, r: f.r });
    else if (f.kind === "confirm-local") setFlow(f.back === "conflict" && f.r ? { kind: "conflict", r: f.r } : { kind: "invalid", error: f.error ?? "" });
    else if (f.kind === "confirm-fresh") setFlow({ kind: "found-empty", r: f.r });
  };

  const doRestore = async (r: Found) => { if (await ctl.restore(r.file)) { setFlow(null); onMessage("Backup restaurado do Google Drive."); } };
  const doUseLocal = async () => { if (await ctl.backupNow()) { setFlow(null); onMessage("Backup do Drive atualizado com os dados deste aparelho."); } };
  const doFresh = () => { setFlow(null); onMessage("Conectado. O backup antigo só será substituído quando você fizer um novo backup."); };

  const connected = backup.googleConnected;

  return (
    <>
      <Row label="Status" value={!ui.configured ? "Google Drive não configurado" : status.connected} />
      <Row label="Último backup" value={status.last} />
      {connected && backup.pending && (ui.message !== "" || ui.needsReconnect) && <p role="status" className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-2.5 text-[13px] text-warn">Backup pendente: será enviado assim que possível.</p>}
      {ui.message && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-[13px] text-bad-soft">{ui.message}</p>}

      {!ui.configured ? (
        <>
          <button type="button" disabled className={ghost}>Conectar ao Google Drive</button>
          <p className="text-[12px] text-white/40">O backup no Google Drive precisa do Client ID do Google (variável NEXT_PUBLIC_GOOGLE_CLIENT_ID). Enquanto isso, use Exportar backup.</p>
        </>
      ) : !connected ? (
        <>
          <PrimaryButton onClick={connect} disabled={busy}>{ui.busy === "checking" ? "Conectando…" : "Conectar ao Google Drive"}</PrimaryButton>
          <p className="text-[12px] text-white/40">O app só acessa a pasta FinFinance que ele mesmo cria. O banco principal continua neste aparelho.</p>
        </>
      ) : (
        <>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-white">Backup automático</span>
              <span className="block text-[12px] text-white/45">Agrupa as alterações e envia em segundo plano.</span>
            </span>
            <input type="checkbox" role="switch" checked={backup.autoBackup} onChange={(e) => void ctl.setAutoBackup(e.target.checked)} aria-label="Backup automático" className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/15 transition checked:bg-violet-500 relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" />
          </label>
          {ui.needsReconnect && <PrimaryButton onClick={() => void ctl.reconnect()} disabled={busy}>Reconectar ao Google</PrimaryButton>}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" className={ghost} disabled={busy} onClick={async () => onMessage((await ctl.backupNow()) ? "Backup enviado ao Google Drive." : "O backup não foi enviado.")}>{ui.busy === "backup" ? "Enviando…" : "Fazer backup agora"}</button>
            <button type="button" className={ghost} disabled={busy} onClick={manualRestore}>Restaurar do Drive</button>
          </div>
          <button type="button" className="h-11 w-full rounded-lg text-[14px] font-semibold text-bad-soft transition hover:bg-bad/10 disabled:opacity-50" disabled={busy} onClick={disconnect}>Desconectar do Google Drive</button>
        </>
      )}

      {flow?.kind === "found-empty" && (
        <Sheet open onClose={() => undefined} title="Encontramos um backup do FinFinance." dismissible={false}>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-white/70">Há um backup no seu Google Drive{flow.r.meta.modifiedTime ? ` (atualizado em ${formatDateTime(flow.r.meta.modifiedTime)})` : ""}. Este aparelho ainda não tem dados.</p>
            <CountsTable current={flow.r.localCounts} incoming={flow.r.counts} />
            <PrimaryButton onClick={() => setFlow({ kind: "confirm-restore", r: flow.r, back: "found-empty" })}>Restaurar backup</PrimaryButton>
            <SecondaryButton onClick={() => setFlow({ kind: "confirm-fresh", r: flow.r })}>Começar do zero</SecondaryButton>
          </div>
        </Sheet>
      )}

      {flow?.kind === "conflict" && (
        <Sheet open onClose={() => undefined} title="Os dados são diferentes" dismissible={false}>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-white/70">Este aparelho já tem dados e o backup do Google Drive é diferente. Escolha qual manter; nada muda até você confirmar.</p>
            <CountsTable current={flow.r.localCounts} incoming={flow.r.counts} heading="Este aparelho → Drive" />
            <PrimaryButton onClick={() => setFlow({ kind: "confirm-local", back: "conflict", r: flow.r })}>Usar dados deste dispositivo</PrimaryButton>
            <SecondaryButton onClick={() => setFlow({ kind: "confirm-restore", r: flow.r, back: "conflict" })}>Restaurar backup do Google Drive</SecondaryButton>
            <button type="button" onClick={disconnect} className="h-11 text-[14px] font-semibold text-white/50 hover:text-white/80">Cancelar e desconectar</button>
          </div>
        </Sheet>
      )}

      {flow?.kind === "invalid" && (
        <Sheet open onClose={() => undefined} title="Backup do Drive ilegível" dismissible={false}>
          <div className="flex flex-col gap-4">
            <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[14px] leading-relaxed text-bad-soft">{flow.error}</p>
            <p className="text-[13px] text-white/50">Seus dados deste aparelho não foram alterados. Você pode substituir o backup do Drive pelos dados daqui.</p>
            <PrimaryButton onClick={() => setFlow({ kind: "confirm-local", back: "invalid", error: flow.error })}>Usar dados deste dispositivo</PrimaryButton>
            <button type="button" onClick={disconnect} className="h-11 text-[14px] font-semibold text-white/50 hover:text-white/80">Cancelar e desconectar</button>
          </div>
        </Sheet>
      )}

      {flow?.kind === "confirm-restore" && (
        <Sheet open onClose={() => undefined} title="Substituir os dados deste aparelho?" dismissible={false}>
          <div className="flex flex-col gap-4">
            <CountsTable current={flow.r.localCounts} incoming={flow.r.counts} />
            <p role="alert" className="rounded-lg border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[13px] leading-relaxed text-white/80">
              {flow.r.localHasData ? "Todos os dados atuais deste aparelho serão substituídos pelos do Google Drive. " : ""}Esta ação não pode ser desfeita.
            </p>
            {ui.message && <p role="alert" className="text-[13px] text-bad-soft">{ui.message}</p>}
            {flow.r.localHasData && <SecondaryButton disabled={busy} onClick={async () => onMessage((await exportBackupFile()) ? "Cópia dos dados atuais baixada." : "Não foi possível baixar a cópia.")}>Baixar cópia dos dados atuais antes</SecondaryButton>}
            <DangerButton disabled={busy} onClick={() => doRestore(flow.r)}>{ui.busy === "restoring" ? "Restaurando…" : "Substituir dados deste aparelho"}</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => goBack(flow)}>Voltar</SecondaryButton>
          </div>
        </Sheet>
      )}

      {flow?.kind === "confirm-local" && (
        <Sheet open onClose={() => undefined} title="Substituir o backup do Drive?" dismissible={false}>
          <div className="flex flex-col gap-4">
            <p role="alert" className="rounded-lg border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[13px] leading-relaxed text-white/80">O backup que está no Google Drive será substituído pelos dados deste aparelho. Esta ação não pode ser desfeita.</p>
            {ui.message && <p role="alert" className="text-[13px] text-bad-soft">{ui.message}</p>}
            <DangerButton disabled={busy} onClick={doUseLocal}>{ui.busy === "backup" ? "Enviando…" : "Substituir backup do Drive"}</DangerButton>
            <SecondaryButton disabled={busy} onClick={() => goBack(flow)}>Voltar</SecondaryButton>
          </div>
        </Sheet>
      )}

      {flow?.kind === "confirm-fresh" && (
        <Sheet open onClose={() => undefined} title="Começar do zero?" dismissible={false}>
          <div className="flex flex-col gap-4">
            <p role="alert" className="rounded-lg border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[13px] leading-relaxed text-white/80">Você não vai restaurar o backup existente. Ele continua no Drive, mas será substituído quando o app fizer o próximo backup dos seus novos dados.</p>
            <DangerButton onClick={doFresh}>Começar do zero</DangerButton>
            <SecondaryButton onClick={() => goBack(flow)}>Voltar</SecondaryButton>
          </div>
        </Sheet>
      )}
    </>
  );
}
