/**
 * Entrada animada do app: aparece uma vez por sessão do navegador (não a cada página).
 * 1º acesso ao app neste aparelho: ~1,4 s (logo, barras subindo, nome). Depois: ~400 ms, só um fade discreto.
 * Com "reduzir movimento" ativado no sistema, não há animação.
 * Este script roda antes da primeira pintura, para a tela do app não aparecer e sumir.
 */
export const SPLASH_SESSION_KEY = "ff-splash";
export const SPLASH_VISITED_KEY = "ff-visited";
export const SPLASH_LONG_MS = 1420;
export const SPLASH_SHORT_MS = 400;

export const SPLASH_BOOT_SCRIPT = `try{if(!sessionStorage.getItem(${JSON.stringify(SPLASH_SESSION_KEY)})&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.setAttribute("data-splash",localStorage.getItem(${JSON.stringify(SPLASH_VISITED_KEY)})?"short":"long")}}catch(e){}`;
