import type { ThemeId, ThemePreference } from "@/types/domain";

export type { ThemeId };

export interface ThemeDef {
  id: ThemeId;
  name: string;
  mode: "escuro" | "claro";
  description: string;
  /** Amostras para a tela Temas (as cores reais ficam em app/globals.css, uma por tema). */
  swatch: { bg: string; surface: string; accent: string; text: string };
}

/** Preto e branco (a identidade da logo) é o padrão para quem ainda não escolheu. */
export const DEFAULT_THEME: ThemeId = "preto";

export const THEMES: ThemeDef[] = [
  { id: "preto", name: "Preto e branco", mode: "escuro", description: "Padrão do FinFinance: preto profundo com detalhes brancos", swatch: { bg: "#000000", surface: "#0C0C0C", accent: "#F5F5F5", text: "#FFFFFF" } },
  { id: "verde", name: "Verde-escuro", mode: "escuro", description: "Fundo escuro com destaque verde", swatch: { bg: "#03120C", surface: "#091E15", accent: "#10B981", text: "#FFFFFF" } },
  { id: "azul", name: "Azul-escuro", mode: "escuro", description: "Fundo escuro com destaque azul", swatch: { bg: "#060C1A", surface: "#0B1426", accent: "#3B82F6", text: "#FFFFFF" } },
  { id: "vermelho", name: "Vermelho-escuro", mode: "escuro", description: "Fundo escuro com destaque vermelho", swatch: { bg: "#140709", surface: "#200C0F", accent: "#EF4444", text: "#FFFFFF" } },
  { id: "padrao", name: "Roxo-escuro", mode: "escuro", description: "Azul-marinho quase preto com detalhes roxos", swatch: { bg: "#0A0A15", surface: "#12121F", accent: "#7C5CFF", text: "#FFFFFF" } },
  { id: "preto-claro", name: "Branco e preto", mode: "claro", description: "Branco e cinza, detalhes em preto", swatch: { bg: "#FAFAFA", surface: "#FFFFFF", accent: "#18181B", text: "#0A0A0A" } },
  { id: "verde-claro", name: "Verde-claro", mode: "claro", description: "Fundo claro com destaque verde", swatch: { bg: "#F4FBF6", surface: "#FFFFFF", accent: "#059669", text: "#0A1C13" } },
  { id: "azul-claro", name: "Azul-claro", mode: "claro", description: "Fundo claro com destaque azul", swatch: { bg: "#F5F9FF", surface: "#FFFFFF", accent: "#2563EB", text: "#0B1426" } },
  { id: "vermelho-claro", name: "Vermelho-claro", mode: "claro", description: "Fundo claro com destaque vermelho", swatch: { bg: "#FFF6F6", surface: "#FFFFFF", accent: "#DC2626", text: "#200C0F" } },
  { id: "padrao-claro", name: "Roxo-claro", mode: "claro", description: "Fundo claro com detalhes roxos", swatch: { bg: "#F7F7FB", surface: "#FFFFFF", accent: "#7C3AED", text: "#0F0F19" } },
];

export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[];
export const isThemeId = (v: unknown): v is ThemeId => typeof v === "string" && (THEME_IDS as string[]).includes(v);
export const themeById = (id: string | undefined): ThemeDef => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** Valores antigos ("escuro", "claro", "sistema") viram um dos dez temas. */
export function normalizeTheme(pref: ThemePreference | string | undefined, prefersDark = true): ThemeId {
  if (isThemeId(pref)) return pref;
  if (pref === "claro") return "preto-claro";
  if (pref === "sistema") return prefersDark ? DEFAULT_THEME : "preto-claro";
  return DEFAULT_THEME;
}

/** Chave do espelho em localStorage (só o id do tema, sem dados financeiros): evita piscar o tema errado ao abrir. */
export const THEME_STORAGE_KEY = "ff-theme";

/** Script que roda antes da primeira pintura. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t&&/^[a-z-]{3,20}$/.test(t))document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
