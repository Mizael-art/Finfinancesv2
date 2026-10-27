import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRAND_BARS } from "../brand";
import { DEFAULT_THEME, THEME_IDS, THEMES, normalizeTheme, themeById } from "./themes";

describe("temas", () => {
  it("o padrão é o preto e branco da logo e ele é o primeiro da lista", () => {
    expect(DEFAULT_THEME).toBe("preto");
    expect(THEMES[0].id).toBe("preto");
    expect(themeById(undefined).id).toBe("preto");
    expect(themeById("inexistente").id).toBe("preto");
  });
  it("são dez, cinco escuros e cinco claros, sem repetição", () => {
    expect(THEME_IDS).toHaveLength(10);
    expect(new Set(THEME_IDS).size).toBe(10);
    expect(THEMES.filter((t) => t.mode === "escuro")).toHaveLength(5);
    expect(THEMES.filter((t) => t.mode === "claro")).toHaveLength(5);
  });
  it("valores antigos viram temas válidos; quem já escolheu um tema o mantém", () => {
    expect(normalizeTheme("escuro")).toBe("preto");
    expect(normalizeTheme("claro")).toBe("preto-claro");
    expect(normalizeTheme("sistema", false)).toBe("preto-claro");
    expect(normalizeTheme("sistema", true)).toBe("preto");
    expect(normalizeTheme("padrao")).toBe("padrao");
    expect(normalizeTheme(undefined)).toBe("preto");
  });
});

describe("logo", () => {
  it("as camadas usadas na entrada animada existem em public/brand", () => {
    for (const f of ["mark-body", "mark", "wordmark"]) expect(existsSync(`public/brand/${f}.webp`)).toBe(true);
    expect(BRAND_BARS).toHaveLength(3);
    for (const b of BRAND_BARS) expect(existsSync(`public${b.src}`)).toBe(true);
  });
});
