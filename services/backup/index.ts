import { nowISO } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { STORE_NAMES } from "@/storage/schema";
import type { BatchOp, Storage, StoreName } from "@/storage/types";
import type { Settings } from "@/types/domain";
import { BACKUP_APP, BACKUP_FORMAT, emptyCounts, type BackupData, type BackupFile } from "./validate";

export { inspectBackup, hasUserData, STORE_LABELS, BACKUP_FORMAT, MAX_BACKUP_BYTES, type BackupFile, type InspectResult } from "./validate";

/** Backup local (JSON) de todos os dados. O estado do Google Drive é do aparelho e nunca vai no arquivo. */
export function createBackupService(storage: Storage) {
  async function readAll(): Promise<BackupData> {
    const entries = await Promise.all(STORE_NAMES.map(async (n) => [n, await storage.repo(n).list()] as const));
    return Object.fromEntries(entries) as unknown as BackupData;
  }

  const countsOf = (data: BackupData) => {
    const c = emptyCounts();
    for (const n of STORE_NAMES) c[n] = data[n].length;
    return c;
  };

  return {
    /** Foto de todos os dados, no formato do arquivo de backup. */
    async snapshot(): Promise<BackupFile> {
      const data = await readAll();
      // O estado de conexão/backup pertence a este aparelho: não entra no arquivo.
      data.settings = data.settings.map(({ backup: _backup, onboardingDraft: _draft, ...rest }) => rest as Settings);
      return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: nowISO(), counts: countsOf(data), data };
    },

    async currentCounts() {
      return countsOf(await readAll());
    },

    /** Marca que o usuário exportou o arquivo agora (o backup do Drive tem campo próprio). */
    async markExported(): Promise<void> {
      const cur = await storage.repo("settings").get("settings");
      if (!cur) return; // sem configurações ainda, não há onde marcar
      await storage.repo("settings").put({ ...cur, backup: { ...cur.backup, lastExportAt: nowISO() }, updatedAt: nowISO() });
    },

    /**
     * Substitui TODOS os dados locais pelos do backup, numa única transação: ou tudo, ou nada.
     * O arquivo precisa ter passado por `inspectBackup`. Mantém o estado de backup/Google do aparelho.
     */
    async restore(file: BackupFile): Promise<Record<StoreName, number>> {
      if (file.app !== BACKUP_APP || file.format > BACKUP_FORMAT) throw new ValidationError("Arquivo de backup incompatível.");
      const current = await readAll();
      const localSettings = current.settings[0];
      const ops: BatchOp[] = [];
      for (const store of STORE_NAMES) {
        const incoming = store === "settings" && file.data.settings.length === 0 ? current.settings : file.data[store];
        const keep = new Set(incoming.map((r) => r.id));
        for (const old of current[store]) if (!keep.has(old.id)) ops.push({ store, type: "delete", id: old.id } as BatchOp);
        for (const rec of incoming) {
          // O estado do Google/backup é do aparelho: mantém o daqui (ou o padrão, num aparelho novo).
          const value = store === "settings" ? { ...(rec as Settings), backup: localSettings?.backup ?? { googleConnected: false, autoBackup: false, pending: false } } : rec;
          ops.push({ store, type: "put", value } as BatchOp);
        }
      }
      await storage.batch(ops);
      return countsOf(await readAll());
    },
  };
}
export type BackupService = ReturnType<typeof createBackupService>;
