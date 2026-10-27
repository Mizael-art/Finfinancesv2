import { formatDateTime } from "@/lib/date";
import type { BackupSettings } from "@/types/domain";

export const FIRST_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Explica em português o que o "primeiro dia do mês" faz. */
export function monthRuleSentence(firstDay: number): string {
  if (firstDay <= 1) return "Cada mês vai do dia 1 ao último dia, como no calendário.";
  return `Cada mês vai do dia ${firstDay} até o dia ${firstDay - 1} do mês seguinte. Vale para períodos, relatórios e orçamentos.`;
}

export function backupStatus(b: BackupSettings): { connected: string; last: string; pending: boolean } {
  const last = b.lastBackupAt ? formatDateTime(b.lastBackupAt) : "";
  return {
    connected: b.googleConnected ? "Google Drive conectado" : "Google Drive não conectado",
    last: last || "Nenhum backup ainda",
    pending: b.googleConnected && b.pending,
  };
}
