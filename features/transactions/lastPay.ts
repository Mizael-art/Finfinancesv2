const KEY = "ff:lastPay";

/** Onde foi o último lançamento: a próxima despesa já começa na mesma conta ou cartão. */
export interface LastPay { accountId?: string; cardId?: string; payWith?: "conta" | "cartao" }

export function readLastPay(): LastPay {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function saveLastPay(v: LastPay): void {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* sem armazenamento: tudo bem */ }
}
