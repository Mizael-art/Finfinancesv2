import { describe, expect, it } from "vitest";
import { rangeFor } from "@/features/transactions/periods";
import { backupStatus, FIRST_DAYS, monthRuleSentence } from "./viewModels";

describe("settings view-models", () => {
  it("explica o mês financeiro", () => {
    expect(monthRuleSentence(1)).toContain("dia 1 ao último dia");
    expect(monthRuleSentence(10)).toContain("do dia 10 até o dia 9 do mês seguinte");
    expect(FIRST_DAYS).toHaveLength(28);
    expect(FIRST_DAYS[0]).toBe(1);
    expect(FIRST_DAYS[27]).toBe(28);
  });
  it("status do backup", () => {
    expect(backupStatus({ googleConnected: false, autoBackup: false, pending: false })).toEqual({ connected: "Google Drive não conectado", last: "Nenhum backup ainda", pending: false });
    const s = backupStatus({ googleConnected: true, autoBackup: true, pending: true, lastBackupAt: "2026-10-21T10:16:00.000Z" });
    expect(s.connected).toBe("Google Drive conectado");
    expect(s.last).toBe("21/10/2026 07:16"); // America/Sao_Paulo (TZ dos testes)
    expect(s.pending).toBe(true);
    const off = backupStatus({ googleConnected: false, autoBackup: false, pending: true, lastBackupAt: "lixo" });
    expect(off.last).toBe("Nenhum backup ainda");
    expect(off.pending).toBe(false); // sem Google conectado não há "pendente"
  });
});

describe("rangeFor com primeiro dia do mês", () => {
  const today = "2026-10-20";
  it("dia 1 = comportamento anterior (calendário)", () => {
    expect(rangeFor("mes", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeFor("mes", today, 1)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeFor("tres_meses", today, 1)).toEqual({ from: "2026-08-01", to: "2026-10-31" });
  });
  it("dia 10: antes do dia 10 ainda estamos no mês que começou no anterior", () => {
    expect(rangeFor("mes", today, 10)).toEqual({ from: "2026-10-10", to: "2026-11-09" });
    expect(rangeFor("mes", "2026-10-09", 10)).toEqual({ from: "2026-09-10", to: "2026-10-09" });
    expect(rangeFor("mes", "2026-10-10", 10)).toEqual({ from: "2026-10-10", to: "2026-11-09" });
    expect(rangeFor("mes_passado", today, 10)).toEqual({ from: "2026-09-10", to: "2026-10-09" });
    expect(rangeFor("tres_meses", today, 10)).toEqual({ from: "2026-08-10", to: "2026-11-09" });
    expect(rangeFor("mes", "2027-01-05", 10)).toEqual({ from: "2026-12-10", to: "2027-01-09" });
  });
  it("ano e tudo não mudam", () => {
    expect(rangeFor("ano", today, 10)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(rangeFor("tudo", today, 10)).toEqual({});
  });
});
