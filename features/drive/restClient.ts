import { DriveError, type DriveClient, type DriveErrorKind, type DriveFileMeta } from "@/services/drive/types";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FIELDS = "id,name,modifiedTime";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Erro HTTP do Google → motivo em português (sem nada do conteúdo da resposta). */
export function kindForStatus(status: number, reason = ""): DriveErrorKind {
  if (status === 401) return "auth";
  if (status === 403 || status === 429) return /rate|quota|limit/i.test(reason) || status === 429 ? "quota" : "forbidden";
  if (status >= 500) return "server";
  return "unknown";
}

/**
 * Cliente REST do Google Drive v3. O token é pedido a cada chamada (vive só em memória, em outro módulo).
 * Nunca registra tokens nem conteúdo em console.
 */
export function createRestDriveClient(getToken: () => Promise<string>, fetchImpl: FetchLike = (u, i) => fetch(u, i)): DriveClient {
  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken();
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
    } catch {
      throw new DriveError("offline"); // fetch só lança sem rede/bloqueio
    }
    if (!res.ok) {
      let reason = "";
      try { reason = JSON.stringify((await res.clone().json())?.error?.errors?.[0]?.reason ?? ""); } catch { /* corpo ilegível */ }
      throw new DriveError(kindForStatus(res.status, reason), res.status);
    }
    return res;
  }

  const meta = (j: { id: string; name: string; modifiedTime?: string }): DriveFileMeta => ({ id: j.id, name: j.name, modifiedTime: j.modifiedTime });
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  async function list(q: string): Promise<DriveFileMeta | null> {
    const params = new URLSearchParams({ q, fields: `files(${FIELDS})`, orderBy: "createdTime", pageSize: "10", spaces: "drive" });
    const res = await call(`${API}/files?${params}`);
    const body = (await res.json()) as { files?: { id: string; name: string; modifiedTime?: string }[] };
    return body.files?.[0] ? meta(body.files[0]) : null;
  }

  return {
    findFolder: (name) => list(`name='${esc(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`),
    async createFolder(name) {
      const res = await call(`${API}/files?fields=${FIELDS}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER_MIME }) });
      return meta(await res.json());
    },
    findFile: (folderId, name) => list(`name='${esc(name)}' and '${esc(folderId)}' in parents and mimeType!='${FOLDER_MIME}' and trashed=false`),
    async createFile(folderId, name, content) {
      const boundary = `ff${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId], mimeType: "application/json" })}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
      const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
      return meta(await res.json());
    },
    async updateFile(fileId, content) {
      const res = await call(`${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=${FIELDS}`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: content });
      return meta(await res.json());
    },
    async download(fileId) {
      const res = await call(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
      return res.text();
    },
  };
}
