import { describe, expect, it } from "vitest";
import { createLiveQuery, type LiveState } from "./liveQuery";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("createLiveQuery", () => {
  it("carrega e entrega os dados", async () => {
    const states: LiveState<number>[] = [];
    const q = createLiveQuery({ query: async () => 1, onState: (s) => states.push(s) });
    q.start();
    await wait(5);
    expect(states.at(-1)).toEqual({ data: 1, loading: false });
  });

  it("agrupa mudanças seguidas numa leitura só", async () => {
    let calls = 0;
    const q = createLiveQuery({ query: async () => ++calls, onState: () => undefined, debounceMs: 10 });
    q.start();
    await wait(5);
    q.invalidate(); q.invalidate(); q.invalidate();
    await wait(40);
    expect(calls).toBe(2);
  });

  it("ignora resposta velha", async () => {
    const delays = [30, 1];
    let i = 0;
    const states: LiveState<number>[] = [];
    const q = createLiveQuery({ query: async () => { const n = i++; await wait(delays[n]); return n; }, onState: (s) => states.push(s) });
    q.start();
    q.reload();
    await wait(60);
    expect(states.at(-1)?.data).toBe(1);
  });

  it("mantém os últimos dados se a releitura falhar", async () => {
    let fail = false;
    const states: LiveState<string>[] = [];
    const q = createLiveQuery({ query: async () => { if (fail) throw new Error("x"); return "ok"; }, onState: (s) => states.push(s) });
    q.start();
    await wait(5);
    fail = true;
    q.reload();
    await wait(5);
    expect(states.at(-1)?.data).toBe("ok");
    expect(states.at(-1)?.error).toBeInstanceOf(Error);
  });
});
