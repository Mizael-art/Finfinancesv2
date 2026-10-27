import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";
import { fingerprint } from "./fingerprint";
import { createBackupScheduler, type RunOutcome } from "./scheduler";
import { createDriveSync } from "./sync";
import { DRIVE_FILE, DRIVE_FOLDER, DriveError, type DriveClient, type DriveFileMeta } from "./types";

/** Drive de mentira, em memória, com o mesmo contrato do real. */
function fakeDrive(opts: { dupFolders?: boolean; latencyMs?: number } = {}) {
  type Node = DriveFileMeta & { parent?: string; content?: string; created: number; folder?: boolean };
  const nodes: Node[] = [];
  let clock = 1;
  const calls: string[] = [];
  const mk = (n: Omit<Node, "id" | "created" | "modifiedTime">): Node => { const node = { ...n, id: `id${nodes.length + 1}`, created: clock++, modifiedTime: new Date(clock * 1000).toISOString() }; nodes.push(node); return node; };
  const meta = (n: Node): DriveFileMeta => ({ id: n.id, name: n.name, modifiedTime: n.modifiedTime });
  if (opts.dupFolders) { mk({ name: DRIVE_FOLDER, folder: true }); mk({ name: DRIVE_FOLDER, folder: true }); }
  const wait = () => (opts.latencyMs ? new Promise((r) => setTimeout(r, opts.latencyMs)) : Promise.resolve());
  const raw: DriveClient = {
    async findFolder(name) { calls.push("findFolder"); await wait(); const f = nodes.filter((n) => n.folder && n.name === name).sort((a, b) => a.created - b.created)[0]; return f ? meta(f) : null; },
    async createFolder(name) { calls.push("createFolder"); return meta(mk({ name, folder: true })); },
    async findFile(folderId, name) { calls.push("findFile"); await wait(); const f = nodes.filter((n) => !n.folder && n.parent === folderId && n.name === name).sort((a, b) => a.created - b.created)[0]; return f ? meta(f) : null; },
    async createFile(folderId, name, content) { calls.push("createFile"); return meta(mk({ name, parent: folderId, content })); },
    async updateFile(id, content) { calls.push("updateFile"); const n = nodes.find((x) => x.id === id)!; n.content = content; n.modifiedTime = new Date(++clock * 1000).toISOString(); return meta(n); },
    async download(id) { calls.push("download"); return nodes.find((x) => x.id === id)!.content!; },
  };
  // Mede quantas chamadas ao Drive estão em andamento ao mesmo tempo.
  let inFlight = 0;
  const stats = { maxInFlight: 0 };
  const client = Object.fromEntries(
    (Object.keys(raw) as (keyof DriveClient)[]).map((k) => [
      k,
      async (...args: unknown[]) => {
        inFlight++;
        stats.maxInFlight = Math.max(stats.maxInFlight, inFlight);
        try { await new Promise((r) => setTimeout(r, 1)); return await (raw[k] as (...a: unknown[]) => unknown)(...args); } finally { inFlight--; }
      },
    ]),
  ) as unknown as DriveClient;
  return { client, stats, nodes, calls, files: () => nodes.filter((n) => !n.folder), folders: () => nodes.filter((n) => n.folder) };
}

let storage: Storage;
let svc: Services;
const open = () => { storage = createIndexedDbStorage(`drv-${newId()}`); svc = createServices(storage); };
beforeEach(open);
afterEach(() => storage.close());
const reais = (n: number) => Math.round(n * 100);
const sync = (drive: ReturnType<typeof fakeDrive>) => createDriveSync({ client: drive.client, backup: svc.backup, settings: svc.settings });

async function populate(s: Services, name = "Nubank") {
  await s.settings.update({ onboardingCompleted: true });
  await s.categories.seedDefaults();
  const food = (await s.categories.list()).find((c) => c.name === "Alimentação")!;
  const a = await s.accounts.create({ name, type: "digital", initialBalanceCents: reais(1000) });
  await s.transactions.create({ type: "despesa", amountCents: reais(50), description: "Mercado", date: "2026-10-05", accountId: a.id, categoryId: food.id });
}

describe("backupNow", () => {
  it("primeira vez: cria a pasta FinFinance e o arquivo FinFinance_Backup.json", async () => {
    await populate(svc);
    const d = fakeDrive();
    await sync(d).backupNow();
    expect(d.folders().map((f) => f.name)).toEqual([DRIVE_FOLDER]);
    expect(d.files().map((f) => [f.name, f.parent])).toEqual([[DRIVE_FILE, d.folders()[0].id]]);
    expect(JSON.parse(d.files()[0].content!)).toMatchObject({ app: "FinFinance", format: 1 });
  });
  it("backups seguintes ATUALIZAM o mesmo arquivo (nunca criam outro)", async () => {
    await populate(svc);
    const d = fakeDrive();
    const s = sync(d);
    await s.backupNow();
    const id = d.files()[0].id;
    await svc.accounts.create({ name: "Inter", type: "digital", initialBalanceCents: 0 });
    await s.backupNow(); await s.backupNow();
    expect(d.files()).toHaveLength(1);
    expect(d.folders()).toHaveLength(1);
    expect(d.files()[0].id).toBe(id);
    expect(d.calls.filter((c) => c === "createFile")).toHaveLength(1);
    expect(JSON.parse(d.files()[0].content!).counts.accounts).toBe(2);
  });
  it("dois backups simultâneos não criam dois arquivos", async () => {
    await populate(svc);
    const d = fakeDrive({ latencyMs: 15 }); // a latência força as três chamadas a se sobreporem
    const s = sync(d);
    await Promise.all([s.backupNow(), s.backupNow(), s.backupNow()]);
    expect(d.files()).toHaveLength(1);
    expect(d.folders()).toHaveLength(1);
    expect(d.stats.maxInFlight).toBe(1); // nunca duas chamadas ao Drive ao mesmo tempo
  });
  it("com pastas duplicadas usa a mais antiga", async () => {
    await populate(svc);
    const d = fakeDrive({ dupFolders: true });
    await sync(d).backupNow();
    expect(d.files()[0].parent).toBe(d.folders()[0].id);
    expect(d.folders()).toHaveLength(2);
  });
  it("registra o último backup e limpa o pendente; o arquivo não leva o estado do Google", async () => {
    await populate(svc);
    await svc.settings.update({ backup: { googleConnected: true, autoBackup: true, pending: true } });
    const d = fakeDrive();
    await sync(d).backupNow();
    const b = (await svc.settings.get()).backup;
    expect(b.lastBackupAt).toBeTruthy();
    expect(b.pending).toBe(false);
    expect(b.googleConnected).toBe(true);
    expect(d.files()[0].content).not.toContain("googleConnected");
  });
  it("falha do Drive não altera o último backup nem os dados locais", async () => {
    await populate(svc);
    await svc.settings.update({ backup: { lastBackupAt: "2026-10-01T00:00:00.000Z" } });
    const d = fakeDrive();
    d.client.createFolder = async () => { throw new DriveError("offline"); };
    await expect(sync(d).backupNow()).rejects.toBeInstanceOf(DriveError);
    expect((await svc.settings.get()).backup.lastBackupAt).toBe("2026-10-01T00:00:00.000Z");
    expect(await svc.accounts.list()).toHaveLength(1);
  });
});

describe("inspectRemote", () => {
  it("sem pasta ou sem arquivo: none (e não cria nada)", async () => {
    const d = fakeDrive();
    expect(await sync(d).inspectRemote()).toEqual({ status: "none" });
    expect(d.nodes).toHaveLength(0);
    await sync(d).backupNow(); // cria
    d.nodes.splice(1, 1); // some o arquivo, fica a pasta
    expect(await sync(d).inspectRemote()).toEqual({ status: "none" });
  });
  it("arquivo igual ao local: sameAsLocal, mesmo com ordem/exportedAt diferentes", async () => {
    await populate(svc);
    const d = fakeDrive();
    await sync(d).backupNow();
    const r = await sync(d).inspectRemote();
    expect(r).toMatchObject({ status: "found", sameAsLocal: true, localHasData: true });
  });
  it("conteúdo diferente: sameAsLocal false, com as contagens dos dois lados", async () => {
    await populate(svc);
    const d = fakeDrive();
    await sync(d).backupNow();
    await svc.accounts.create({ name: "Só local", type: "carteira", initialBalanceCents: 0 });
    const r = await sync(d).inspectRemote();
    expect(r).toMatchObject({ status: "found", sameAsLocal: false });
    if (r.status === "found") { expect(r.counts.accounts).toBe(1); expect(r.localCounts.accounts).toBe(2); }
  });
  it("aparelho novo (vazio): localHasData false", async () => {
    await populate(svc);
    const d = fakeDrive();
    await sync(d).backupNow();
    storage.close(); open();
    const r = await sync(d).inspectRemote();
    expect(r).toMatchObject({ status: "found", sameAsLocal: false, localHasData: false });
  });
  it("arquivo do Drive corrompido: invalid, sem tocar nos dados locais", async () => {
    await populate(svc);
    const d = fakeDrive();
    const s = sync(d);
    await s.backupNow();
    d.files()[0].content = '{"app":"FinFinance","format":1,"data":{}}';
    expect((await s.inspectRemote()).status).toBe("invalid");
    expect(await svc.accounts.list()).toHaveLength(1);
  });
  it("não altera nada nem no Drive nem localmente", async () => {
    await populate(svc);
    const d = fakeDrive();
    const s = sync(d);
    await s.backupNow();
    const before = d.files()[0].content;
    await s.inspectRemote();
    expect(d.files()[0].content).toBe(before);
  });
});

describe("restoreRemote (aparelho novo)", () => {
  it("traz os dados do Drive e marca como sincronizado", async () => {
    await populate(svc);
    const d = fakeDrive();
    await sync(d).backupNow();
    const original = await svc.accounts.list();
    storage.close(); open();
    await svc.settings.update({ backup: { googleConnected: true } });
    const s = sync(d);
    const r = await s.inspectRemote();
    if (r.status !== "found") throw new Error("esperava backup");
    await s.restoreRemote(r.file);
    expect((await svc.accounts.list()).map((a) => a.id)).toEqual(original.map((a) => a.id));
    expect((await svc.settings.get()).backup).toMatchObject({ googleConnected: true, pending: false });
    expect((await svc.settings.get()).backup.lastBackupAt).toBeTruthy();
    expect((await sync(d).inspectRemote())).toMatchObject({ sameAsLocal: true });
  });
});

describe("fingerprint", () => {
  it("mesmo conteúdo = mesmo valor, independente de ordem; qualquer mudança altera", async () => {
    await populate(svc);
    const a = (await svc.backup.snapshot()).data;
    const b = JSON.parse(JSON.stringify(a));
    b.categories.reverse();
    expect(await fingerprint(b)).toBe(await fingerprint(a));
    b.settings[0].updatedAt = "2030-01-01T00:00:00.000Z"; // carimbo da configuração não conta
    expect(await fingerprint(b)).toBe(await fingerprint(a));
    b.accounts[0].name = "Outro";
    expect(await fingerprint(b)).not.toBe(await fingerprint(a));
    b.accounts[0].name = a.accounts[0].name; b.settings[0].firstDayOfMonth = 9; // mudança real de configuração conta
    expect(await fingerprint(b)).not.toBe(await fingerprint(a));
  });
});

describe("scheduler", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const make = (outcomes: RunOutcome[] | (() => Promise<RunOutcome>), o: Partial<Parameters<typeof createBackupScheduler>[0]> = {}) => {
    let runs = 0;
    const seq = Array.isArray(outcomes) ? [...outcomes] : null;
    const pend: boolean[] = [];
    const sch = createBackupScheduler({ run: async () => { runs++; return seq ? (seq.shift() ?? "ok") : (outcomes as () => Promise<RunOutcome>)(); }, delayMs: 1000, maxWaitMs: 5000, retryMs: 10_000, onPending: (p) => pend.push(p), ...o });
    return { sch, runs: () => runs, pend };
  };

  it("5 alterações rápidas viram UM backup depois do tempo de espera", async () => {
    const t = make(["ok"]);
    for (let i = 0; i < 5; i++) { t.sch.notify(); await vi.advanceTimersByTimeAsync(200); }
    expect(t.runs()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.runs()).toBe(1);
    expect(t.sch.pending).toBe(false);
  });
  it("alterações sem parar não adiam para sempre: envia no máximo após maxWait", async () => {
    const t = make(["ok", "ok", "ok"]);
    for (let i = 0; i < 40; i++) { t.sch.notify(); await vi.advanceTimersByTimeAsync(500); }
    expect(t.runs()).toBeGreaterThanOrEqual(3);
    expect(t.runs()).toBeLessThanOrEqual(5);
  });
  it("alteração DURANTE o envio gera exatamente um envio seguinte", async () => {
    let release!: () => void;
    let first = true;
    const t = make(() => (first ? (first = false, new Promise<RunOutcome>((r) => { release = () => r("ok"); })) : Promise.resolve<RunOutcome>("ok")));
    t.sch.notify(); await vi.advanceTimersByTimeAsync(1000);
    expect(t.runs()).toBe(1); expect(t.sch.running).toBe(true);
    t.sch.notify(); t.sch.notify(); await vi.advanceTimersByTimeAsync(5000);
    expect(t.runs()).toBe(1); // ainda enviando: não começa outro em paralelo
    release(); await vi.advanceTimersByTimeAsync(1000);
    expect(t.runs()).toBe(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.runs()).toBe(2);
    expect(t.sch.pending).toBe(false);
  });
  it("offline: fica pendente, não tenta em loop e não lança erro; ao voltar a conexão, envia", async () => {
    const t = make(["offline", "ok"]);
    t.sch.notify(); await vi.advanceTimersByTimeAsync(1000);
    expect(t.runs()).toBe(1);
    expect(t.sch.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(t.runs()).toBe(1);
    t.sch.resume(); await vi.advanceTimersByTimeAsync(10);
    expect(t.runs()).toBe(2);
    expect(t.sch.pending).toBe(false);
    expect(t.pend).toEqual([true, false]);
  });
  it("sem permissão (blocked): fica pendente até reconectar", async () => {
    const t = make(["blocked", "ok"]);
    t.sch.notify(); await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(t.runs()).toBe(1); expect(t.sch.pending).toBe(true);
    t.sch.resume(); await vi.advanceTimersByTimeAsync(10);
    expect(t.runs()).toBe(2);
  });
  it("erro inesperado: tenta de novo depois do intervalo, no máximo maxRetries vezes", async () => {
    const t = make(() => Promise.resolve<RunOutcome>("error"), { maxRetries: 2 });
    t.sch.notify(); await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(10_000); await vi.advanceTimersByTimeAsync(10_000); await vi.advanceTimersByTimeAsync(100_000);
    expect(t.runs()).toBe(3); // 1 + 2 tentativas
    expect(t.sch.pending).toBe(true);
  });
  it("run que lança exceção não derruba o agendador", async () => {
    const t = make(() => Promise.reject(new Error("x")), { maxRetries: 0 });
    t.sch.notify(); await vi.advanceTimersByTimeAsync(1000);
    expect(t.runs()).toBe(1); expect(t.sch.pending).toBe(true);
  });
  it("desligado: ignora alterações e limpa o pendente", async () => {
    const t = make(["ok"]);
    t.sch.notify(); t.sch.setEnabled(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.runs()).toBe(0); expect(t.sch.pending).toBe(false);
    t.sch.notify(); await vi.advanceTimersByTimeAsync(10_000);
    expect(t.runs()).toBe(0); expect(t.sch.pending).toBe(false);
    t.sch.markPending(); t.sch.resume(); await vi.advanceTimersByTimeAsync(10);
    expect(t.runs()).toBe(0);
  });
  it("resume() durante um envio em andamento não inicia outro em paralelo", async () => {
    let release!: () => void; let concurrent = 0; let peak = 0; let calls = 0;
    const t = make(async () => { calls++; concurrent++; peak = Math.max(peak, concurrent); await new Promise<void>((r) => { release = r; }); concurrent--; return "ok"; });
    t.sch.notify(); await vi.advanceTimersByTimeAsync(1000);
    expect(t.sch.running).toBe(true);
    t.sch.resume(); await vi.advanceTimersByTimeAsync(50);
    expect(calls).toBe(1);
    release(); await vi.advanceTimersByTimeAsync(10);
    expect(peak).toBe(1);
  });
  it("clear() (backup manual feito) cancela o envio agendado", async () => {
    const t = make(["ok"]);
    t.sch.notify(); t.sch.clear();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.runs()).toBe(0); expect(t.sch.pending).toBe(false);
  });
});
