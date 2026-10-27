/**
 * Entrada animada do app: toca TODA VEZ que o app é aberto (abertura nova do app/página), ~2,3 s:
 * logo (o F), barras subindo, anel de pulso, nome, frase e uma barra de carregamento, depois sai suave.
 * Com "reduzir movimento" ativado no sistema, não há animação.
 * Este script roda antes da primeira pintura, para a tela do app não aparecer e sumir.
 * Para mudar a duração: ajuste SPLASH_MS aqui e os tempos (ms) do bloco "Entrada do app" em app/globals.css.
 */
export const SPLASH_MS = 2300;

export const SPLASH_BOOT_SCRIPT = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.setAttribute("data-splash","1")}}catch(e){}`;
