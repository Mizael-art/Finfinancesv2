import type { BackupData } from "../backup/validate";

/** JSON canônico: chaves em ordem alfabética e registros por id, para comparar conteúdo e não a ordem. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Impressão digital do CONTEÚDO do backup (ignora `exportedAt`). Duas fotos iguais dão o mesmo valor. */
export async function fingerprint(data: BackupData): Promise<string> {
  // O carimbo da configuração muda a cada anotação de "último backup"; não é conteúdo do usuário.
  data = { ...data, settings: data.settings.map(({ updatedAt: _u, ...rest }) => rest as BackupData["settings"][number]) };
  const sorted = Object.fromEntries(Object.entries(data).map(([k, list]) => [k, [...(list as { id: string }[])].sort((a, b) => a.id.localeCompare(b.id))]));
  const bytes = new TextEncoder().encode(canonical(sorted));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
