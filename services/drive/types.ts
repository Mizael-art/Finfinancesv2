/** Contrato mínimo do Google Drive que o app usa. A implementação real (REST) fica em features/drive. */
export interface DriveFileMeta { id: string; name: string; modifiedTime?: string }

export interface DriveClient {
  /** Pasta com esse nome criada pelo app; se houver mais de uma, a mais antiga. */
  findFolder(name: string): Promise<DriveFileMeta | null>;
  createFolder(name: string): Promise<DriveFileMeta>;
  /** Arquivo com esse nome dentro da pasta; se houver mais de um, o mais antigo. */
  findFile(folderId: string, name: string): Promise<DriveFileMeta | null>;
  createFile(folderId: string, name: string, content: string): Promise<DriveFileMeta>;
  updateFile(fileId: string, content: string): Promise<DriveFileMeta>;
  download(fileId: string): Promise<string>;
}

export const DRIVE_FOLDER = "FinFinance";
export const DRIVE_FILE = "FinFinance_Backup.json";

/** Por que uma chamada ao Drive falhou (sem dados financeiros na mensagem). */
export type DriveErrorKind = "offline" | "auth" | "forbidden" | "quota" | "server" | "unknown";

export class DriveError extends Error {
  constructor(public kind: DriveErrorKind, public status?: number) {
    super(`Drive: ${kind}${status ? ` (${status})` : ""}`);
    this.name = "DriveError";
  }
}
