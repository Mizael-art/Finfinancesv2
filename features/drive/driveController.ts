"use client";

import { getServices } from "@/services";
import { createBackupScheduler, type RunOutcome } from "@/services/drive/scheduler";
import { createDriveSync, type DriveSync, type RemoteState } from "@/services/drive/sync";
import { DriveError } from "@/services/drive/types";
import type { BackupFile } from "@/services/backup";
import { googleAuth, isGoogleConfigured } from "./googleAuth";
import { createRestDriveClient } from "./restClient";

export type DriveBusy = "idle" | "backup" | "checking" | "restoring";
export interface DriveUiState {
  configured: boolean;
  busy: DriveBusy;
  /** Conectado, mas sem token válido neste momento (ex.: página recarregada). Precisa de um toque em "Reconectar". */
  needsReconnect: boolean;
  /** Mensagem curta e genérica do último problema (nunca com dados financeiros). */
  message: string;
}

/** Texto para o usuário de cada tipo de falha. */
export function describeDriveError(e: unknown): string {
  const kind = e instanceof DriveError ? e.kind : "unknown";
  switch (kind) {
    case "offline": return "Sem conexão. O backup será feito quando a internet voltar.";
    case "auth": return "É preciso reconectar ao Google Drive.";
    case "forbidden": return "O Google não permitiu acessar o Drive. Reconecte e aceite a permissão.";
    case "quota": return "O Google limitou as requisições ou o espaço. Tente de novo mais tarde.";
    case "server": return "O Google Drive está instável agora. Tentaremos de novo.";
    default: return "Não foi possível falar com o Google Drive. Tente novamente.";
  }
}

/**
 * Orquestra o Google Drive no navegador: login, backup manual, backup automático (agrupado),
 * pendência offline, restauração e desconexão. O token fica só em memória (googleAuth).
 */
function createController() {
  const listeners = new Set<() => void>();
  let state: DriveUiState = { configured: isGoogleConfigured(), busy: "idle", needsReconnect: false, message: "" };
  const set = (p: Partial<DriveUiState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };

  let sync: DriveSync | null = null;
  const getSync = (): DriveSync => {
    if (!sync) {
      const s = getServices();
      sync = createDriveSync({ client: createRestDriveClient(() => googleAuth.getToken()), backup: s.backup, settings: s.settings });
    }
    return sync;
  };
  const settings = () => getServices().settings;
  const writeBackup = (patch: Parameters<ReturnType<typeof settings>["update"]>[0]["backup"]) => settings().update({ backup: patch }).catch(() => undefined);

  let restoring = false;
  let started = false;
  let connectedNow = false;

  const scheduler = createBackupScheduler({
    run: async (): Promise<RunOutcome> => {
      try {
        await getSync().backupNow();
        set({ message: "", needsReconnect: false });
        return "ok";
      } catch (e) {
        const kind = e instanceof DriveError ? e.kind : "unknown";
        set({ message: describeDriveError(e), needsReconnect: kind === "auth" || kind === "forbidden" });
        if (kind === "offline") return "offline";
        if (kind === "auth" || kind === "forbidden") return "blocked";
        return "error";
      }
    },
    onPending: (p) => void writeBackup({ pending: p }),
  });

  async function refreshFromSettings() {
    const b = (await settings().get()).backup;
    connectedNow = b.googleConnected;
    scheduler.setEnabled(b.googleConnected && b.autoBackup);
    if (b.googleConnected && b.autoBackup && b.pending) scheduler.markPending();
    set({ needsReconnect: b.googleConnected && !googleAuth.hasValidToken() && b.pending });
  }

  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => void listeners.delete(fn); },
    getSnapshot: () => state,

    /** Liga o acompanhamento (uma vez): alterações → backup agrupado; internet voltou → tenta o pendente. */
    start() {
      if (started || typeof window === "undefined") return;
      started = true;
      void refreshFromSettings().catch(() => undefined);
      getServices().subscribe((ev) => {
        if (restoring || !connectedNow) return;
        // Só mudanças nas configurações (como anotar o último backup) não contam: evita loop e requisições à toa.
        if (ev.stores.every((s) => s === "settings")) return;
        scheduler.notify();
      });
      window.addEventListener("online", () => scheduler.resume());
    },

    /** Login (precisa vir de um toque). Devolve o que existe no Drive para a tela decidir; não altera dados. */
    async connect(): Promise<RemoteState> {
      set({ busy: "checking", message: "" });
      try {
        await googleAuth.connect();
        await writeBackup({ googleConnected: true });
        connectedNow = true;
        set({ needsReconnect: false });
        return await getSync().inspectRemote();
      } catch (e) {
        set({ message: describeDriveError(e) });
        throw e;
      } finally {
        set({ busy: "idle" });
      }
    },

    /** Reconectar depois de recarregar/expirar. */
    async reconnect(): Promise<void> {
      set({ busy: "checking", message: "" });
      try {
        await googleAuth.connect();
        set({ needsReconnect: false });
        scheduler.resume();
      } catch (e) {
        set({ message: describeDriveError(e), needsReconnect: true });
      } finally {
        set({ busy: "idle" });
      }
    },

    inspectRemote: () => getSync().inspectRemote(),

    /** Backup manual (também usado no primeiro backup e em "Usar dados deste dispositivo"). */
    async backupNow(): Promise<boolean> {
      set({ busy: "backup", message: "" });
      try {
        await getSync().backupNow();
        scheduler.clear();
        set({ needsReconnect: false });
        return true;
      } catch (e) {
        const kind = e instanceof DriveError ? e.kind : "unknown";
        set({ message: describeDriveError(e), needsReconnect: kind === "auth" || kind === "forbidden" });
        // Sem internet/sem sessão não é erro destrutivo: fica "Backup pendente" e tenta depois.
        if (kind === "offline" || kind === "auth") { scheduler.markPending(); await writeBackup({ pending: true }); }
        return false;
      } finally {
        set({ busy: "idle" });
      }
    },

    /** Só depois da confirmação do usuário na tela. */
    async restore(file: BackupFile): Promise<boolean> {
      set({ busy: "restoring", message: "" });
      restoring = true;
      try {
        await getSync().restoreRemote(file);
        scheduler.clear();
        return true;
      } catch (e) {
        set({ message: e instanceof DriveError ? describeDriveError(e) : "Não foi possível restaurar. Seus dados atuais não foram alterados." });
        return false;
      } finally {
        restoring = false;
        set({ busy: "idle" });
      }
    },

    async setAutoBackup(on: boolean): Promise<void> {
      await writeBackup({ autoBackup: on });
      scheduler.setEnabled(on && connectedNow);
      if (on) {
        const b = (await settings().get()).backup;
        if (b.pending) { scheduler.markPending(); scheduler.resume(); }
      }
    },

    /** Revoga o acesso no Google, apaga o token e desliga tudo. O arquivo no Drive não é apagado. */
    async disconnect(): Promise<void> {
      await googleAuth.revoke();
      scheduler.setEnabled(false);
      connectedNow = false;
      await writeBackup({ googleConnected: false, autoBackup: false, pending: false });
      set({ needsReconnect: false, message: "" });
    },

    /** Marca como sincronizado quando o Drive já tem o mesmo conteúdo daqui. */
    async markSynced(modifiedTime?: string): Promise<void> {
      await writeBackup({ lastBackupAt: modifiedTime ?? new Date().toISOString(), pending: false });
      scheduler.clear();
    },
  };
}

let controller: ReturnType<typeof createController> | null = null;
export const getDriveController = () => (controller ??= createController());
