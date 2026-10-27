import { describe, expect, it } from "vitest";
import { DriveError } from "@/services/drive/types";
import { createRestDriveClient, kindForStatus } from "./restClient";

type Call = { url: string; init?: RequestInit };
function setup(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = queue.shift()!;
    if (r instanceof Error) throw r;
    return r;
  };
  const client = createRestDriveClient(async () => "TOKEN-123", fetchImpl);
  return { client, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const auth = (c: Call) => (c.init?.headers as Record<string, string>).Authorization;

describe("cliente REST do Drive", () => {
  it("findFolder: consulta pela pasta do app, mais antiga primeiro, só não-lixeira", async () => {
    const { client, calls } = setup([json({ files: [{ id: "f1", name: "FinFinance", modifiedTime: "t" }] })]);
    expect(await client.findFolder("FinFinance")).toEqual({ id: "f1", name: "FinFinance", modifiedTime: "t" });
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe("https://www.googleapis.com/drive/v3/files");
    expect(u.searchParams.get("q")).toBe("name='FinFinance' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    expect(u.searchParams.get("orderBy")).toBe("createdTime");
    expect(auth(calls[0])).toBe("Bearer TOKEN-123");
  });
  it("devolve null quando não há resultado", async () => {
    const { client } = setup([json({ files: [] }), json({})]);
    expect(await client.findFolder("x")).toBeNull();
    expect(await client.findFile("f", "x")).toBeNull();
  });
  it("findFile procura dentro da pasta e ignora pastas", async () => {
    const { client, calls } = setup([json({ files: [{ id: "a", name: "FinFinance_Backup.json" }] })]);
    await client.findFile("folder1", "FinFinance_Backup.json");
    expect(new URL(calls[0].url).searchParams.get("q")).toBe("name='FinFinance_Backup.json' and 'folder1' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false");
  });
  it("escapa aspas e barras nas consultas", async () => {
    const { client, calls } = setup([json({ files: [] })]);
    await client.findFolder("a'b\\c");
    expect(new URL(calls[0].url).searchParams.get("q")).toContain("name='a\\'b\\\\c'");
  });
  it("createFolder: POST com o tipo de pasta", async () => {
    const { client, calls } = setup([json({ id: "n1", name: "FinFinance" })]);
    await client.createFolder("FinFinance");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ name: "FinFinance", mimeType: "application/vnd.google-apps.folder" });
  });
  it("createFile: upload multipart com nome, pasta e conteúdo", async () => {
    const { client, calls } = setup([json({ id: "n2", name: "FinFinance_Backup.json" })]);
    await client.createFile("folder1", "FinFinance_Backup.json", '{"x":1}');
    const c = calls[0];
    expect(c.url).toContain("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
    expect(c.init?.method).toBe("POST");
    expect((c.init?.headers as Record<string, string>)["Content-Type"]).toMatch(/^multipart\/related; boundary=/);
    const body = c.init!.body as string;
    expect(body).toContain('"parents":["folder1"]');
    expect(body).toContain('"name":"FinFinance_Backup.json"');
    expect(body).toContain('{"x":1}');
    expect(body.trim().endsWith("--")).toBe(true);
  });
  it("updateFile: PATCH no MESMO arquivo (não cria outro)", async () => {
    const { client, calls } = setup([json({ id: "abc", name: "n" })]);
    await client.updateFile("abc", "CONTEUDO");
    expect(calls[0].url).toContain("/upload/drive/v3/files/abc?uploadType=media");
    expect(calls[0].init?.method).toBe("PATCH");
    expect(calls[0].init?.body).toBe("CONTEUDO");
  });
  it("download: alt=media", async () => {
    const { client, calls } = setup([new Response("TEXTO")]);
    expect(await client.download("abc")).toBe("TEXTO");
    expect(calls[0].url).toBe("https://www.googleapis.com/drive/v3/files/abc?alt=media");
  });
  it("sem rede (fetch lança) vira 'offline'", async () => {
    const { client } = setup([new TypeError("Failed to fetch")]);
    await expect(client.findFolder("x")).rejects.toMatchObject({ kind: "offline" });
  });
  it.each([[401, "auth"], [403, "forbidden"], [429, "quota"], [500, "server"], [503, "server"], [404, "unknown"]])("HTTP %i vira %s", async (status, kind) => {
    const { client } = setup([json({ error: { errors: [{ reason: "x" }] } }, status)]);
    const err = await client.findFolder("x").catch((e) => e);
    expect(err).toBeInstanceOf(DriveError);
    expect(err).toMatchObject({ kind, status });
  });
  it("403 por cota/limite vira 'quota'; a mensagem do erro não contém o token nem o corpo", async () => {
    expect(kindForStatus(403, '"userRateLimitExceeded"')).toBe("quota");
    expect(kindForStatus(403, '"storageQuotaExceeded"')).toBe("quota");
    expect(kindForStatus(403, '"insufficientPermissions"')).toBe("forbidden");
    const { client } = setup([json({ error: { message: "segredo TOKEN-123" } }, 401)]);
    const err = (await client.findFolder("x").catch((e) => e)) as Error;
    expect(err.message).not.toContain("TOKEN-123");
    expect(err.message).not.toContain("segredo");
  });
});
