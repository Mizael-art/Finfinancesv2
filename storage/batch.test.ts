import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "./indexeddb";
import type { Storage } from "./types";

let storage: Storage;
beforeEach(() => { storage = createIndexedDbStorage(`batch-${newId()}`); });
afterEach(() => storage.close());

const cat = (id: string, extra = {}) => ({ id, name: id, kind: "despesa", createdAt: "x", updatedAt: "x", ...extra }) as never;

describe("storage.batch é atômico", () => {
  it("grava tudo quando todas as operações são válidas", async () => {
    await storage.batch([{ store: "categories", type: "put", value: cat("a") }, { store: "categories", type: "put", value: cat("b") }]);
    expect(await storage.repo("categories").count()).toBe(2);
  });
  it("registro que o IndexedDB não consegue gravar no meio do lote desfaz o lote inteiro", async () => {
    await storage.repo("categories").put(cat("antiga"));
    await expect(storage.batch([
      { store: "categories", type: "delete", id: "antiga" },
      { store: "categories", type: "put", value: cat("nova1") },
      { store: "categories", type: "put", value: cat("quebrada", { fn: () => 1 }) },
      { store: "categories", type: "put", value: cat("nova2") },
    ])).rejects.toBeTruthy();
    expect((await storage.repo("categories").list()).map((c) => c.id)).toEqual(["antiga"]);
  });
  it("não emite evento de mudança quando o lote falha", async () => {
    let events = 0;
    storage.subscribe(() => { events++; });
    await expect(storage.batch([{ store: "categories", type: "put", value: cat("x", { fn: () => 1 }) }])).rejects.toBeTruthy();
    expect(events).toBe(0);
  });
});
