import { nowISO } from "@/lib/date";
import type { BackupService } from "../backup";
import { hasUserData, inspectBackup, type BackupFile } from "../backup";
import type { SettingsService } from "../settings";
import { fingerprint } from "./fingerprint";
import { DRIVE_FILE, DRIVE_FOLDER, type DriveClient, type DriveFileMeta } from "./types";
import type { StoreName } from "@/storage/types";

export type RemoteState =
  | { status: "none" }
  | { status: "invalid"; error: string }
  | {
      status: "found";
      file: BackupFile;
      meta: DriveFileMeta;
      counts: Record<StoreName, number>;
      warnings: string[];
      /** O conteúdo do Drive é igual ao deste aparelho. */
      sameAsLocal: boolean;
      localCounts: Record<StoreName, number>;
      localHasData: boolean;
    };

/**
 * Backup no Google Drive: o IndexedDB continua sendo o banco; o Drive guarda uma cópia (pasta FinFinance,
 * arquivo FinFinance_Backup.json, sempre o MESMO arquivo). Nunca apaga nem sobrescreve dados locais sozinho.
 */
export function createDriveSync(deps: { client: DriveClient; backup: BackupService; settings: SettingsService }) {
  const { client, backup, settings } = deps;
  // Uma operação por vez: evita criar dois arquivos se dois backups começarem juntos.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };

  async function locate(create: boolean): Promise<{ folder: DriveFileMeta; file: DriveFileMeta | null } | null> {
    let folder = await client.findFolder(DRIVE_FOLDER);
    if (!folder) {
      if (!create) return null;
      folder = await client.createFolder(DRIVE_FOLDER);
    }
    return { folder, file: await client.findFile(folder.id, DRIVE_FILE) };
  }

  return {
    /** Envia uma foto dos dados locais, atualizando o arquivo existente (cria só na primeira vez). */
    backupNow: () => serial(async () => {
      const snap = await backup.snapshot();
      const found = (await locate(true))!;
      const meta = found.file ? await client.updateFile(found.file.id, JSON.stringify(snap)) : await client.createFile(found.folder.id, DRIVE_FILE, JSON.stringify(snap));
      await settings.update({ backup: { lastBackupAt: nowISO(), pending: false } });
      return { meta, counts: snap.counts };
    }),

    /** Olha o que existe no Drive e compara com os dados daqui. Não altera nada. */
    inspectRemote: () => serial(async (): Promise<RemoteState> => {
      const found = await locate(false);
      if (!found?.file) return { status: "none" };
      const text = await client.download(found.file.id);
      const r = inspectBackup(text);
      if (!r.ok) return { status: "invalid", error: r.error };
      const local = await backup.snapshot();
      const [a, b] = await Promise.all([fingerprint(local.data), fingerprint(r.file.data)]);
      return { status: "found", file: r.file, meta: found.file, counts: r.counts, warnings: r.warnings, sameAsLocal: a === b, localCounts: local.counts, localHasData: hasUserData(local.counts) };
    }),

    /** Substitui os dados locais pelos do Drive (a UI só chama depois da confirmação do usuário). */
    restoreRemote: (file: BackupFile) => serial(async () => {
      const counts = await backup.restore(file);
      await settings.update({ backup: { lastBackupAt: nowISO(), pending: false } });
      return counts;
    }),
  };
}
export type DriveSync = ReturnType<typeof createDriveSync>;
