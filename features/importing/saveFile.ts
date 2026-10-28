import { downloadTextFile } from "@/features/backup/download";

/** No celular abre a folha de compartilhar (Salvar em Arquivos, enviar por e-mail...); no computador baixa o arquivo. */
export async function saveTextFile(filename: string, text: string, mime: string): Promise<void> {
  try {
    const file = new File([text], filename, { type: mime });
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return; // o usuário fechou a folha
  }
  downloadTextFile(filename, text, mime);
}
