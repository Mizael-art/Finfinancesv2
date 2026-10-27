import { themeById, THEME_STORAGE_KEY, type ThemeId } from "./themes";

/** Aplica o tema no <html> e guarda só o id em localStorage (para abrir já com o tema certo). */
export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== id) root.setAttribute("data-theme", id);
  try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch { /* modo privado: o banco continua sendo a fonte */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeById(id).swatch.bg);
}
