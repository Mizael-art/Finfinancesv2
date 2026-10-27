import { DriveError } from "@/services/drive/types";

/** Só o necessário: arquivos criados por este app (não enxerga o resto do Drive). */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_URL = "https://accounts.google.com/gsi/client";
const TOKEN_TIMEOUT_MS = 20_000;

interface TokenResponse { access_token?: string; expires_in?: number | string; error?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
interface GoogleGlobal {
  accounts: { oauth2: {
    initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void }): TokenClient;
    revoke(token: string, done?: () => void): void;
  } };
}
declare global { interface Window { google?: GoogleGlobal } }

export const googleClientId = (): string => (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
export const isGoogleConfigured = (): boolean => googleClientId() !== "";

// O token de acesso fica SÓ aqui, em memória: não vai para IndexedDB, localStorage, URL nem log. Recarregar a página o descarta.
let token: { value: string; expiresAt: number } | null = null;
let scriptPromise: Promise<void> | null = null;
let client: TokenClient | null = null;
let pending: { resolve: (t: string) => void; reject: (e: DriveError) => void } | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_URL; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; s.remove(); reject(new DriveError("offline")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function ensureClient(): Promise<TokenClient> {
  if (!isGoogleConfigured()) throw new DriveError("auth");
  await loadScript();
  if (!window.google?.accounts?.oauth2) throw new DriveError("offline");
  client ??= window.google.accounts.oauth2.initTokenClient({
    client_id: googleClientId(),
    scope: DRIVE_SCOPE,
    callback: (r) => {
      const p = pending; pending = null;
      if (!p) return;
      if (r.error || !r.access_token) { p.reject(new DriveError("auth")); return; }
      token = { value: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
      p.resolve(r.access_token);
    },
    error_callback: () => { const p = pending; pending = null; p?.reject(new DriveError("auth")); },
  });
  return client;
}

async function request(prompt: "" | "consent"): Promise<string> {
  const c = await ensureClient();
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { if (pending) { pending = null; reject(new DriveError("auth")); } }, TOKEN_TIMEOUT_MS);
    pending = { resolve: (t) => { clearTimeout(timer); resolve(t); }, reject: (e) => { clearTimeout(timer); reject(e); } };
    try { c.requestAccessToken({ prompt }); } catch { clearTimeout(timer); pending = null; reject(new DriveError("auth")); }
  });
}

export const googleAuth = {
  hasValidToken: (): boolean => !!token && token.expiresAt - 60_000 > Date.now(),
  /** Login interativo (precisa de um toque do usuário: abre a janela do Google). */
  connect: (): Promise<string> => request(""),
  /** Token válido; se expirou, tenta renovar sem perguntar. Se o Google exigir interação, falha com "auth". */
  async getToken(): Promise<string> {
    if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
    return request("");
  },
  /** Desconectar: revoga no Google e apaga o token da memória. */
  async revoke(): Promise<void> {
    const t = token?.value;
    token = null;
    pending = null;
    if (!t) return;
    try { await new Promise<void>((done) => { if (!window.google?.accounts?.oauth2) return done(); window.google.accounts.oauth2.revoke(t, () => done()); setTimeout(done, 5000); }); } catch { /* sem rede: o token já saiu da memória */ }
  },
};
