import { getServices } from "@/services";
import { BACKUP_FILENAME, downloadTextFile } from "./download";

/** Gera o snapshot, entrega como FinFinance_Backup.json e anota a exportação. Devolve false se falhar. */
export async function exportBackupFile(): Promise<boolean> {
  try {
    const svc = getServices().backup;
    downloadTextFile(BACKUP_FILENAME, JSON.stringify(await svc.snapshot()));
    await svc.markExported();
    return true;
  } catch {
    return false;
  }
}
