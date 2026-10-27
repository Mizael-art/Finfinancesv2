/** Destinos do menu "Mais" (e da Sidebar). `icon` é o conteúdo de um <svg viewBox="0 0 24 24">. */
export interface MoreLink {
  href: string;
  label: string;
  description: string;
  icon: string[];
}

export const MORE_LINKS: MoreLink[] = [
  { href: "/faturas", label: "Faturas", description: "Faturas dos cartões e pagamentos", icon: ["M6 3h12v18l-3-2-3 2-3-2-3 2z", "M9 8h6M9 12h6"] },
  { href: "/categorias", label: "Categorias", description: "Organize receitas e despesas", icon: ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"] },
  { href: "/orcamentos", label: "Orçamentos", description: "Limites de gasto por categoria", icon: ["M12 3a9 9 0 1 0 9 9h-9z", "M15 3.5A9 9 0 0 1 20.5 9H15z"] },
  { href: "/metas", label: "Metas", description: "Juntar dinheiro para seus objetivos", icon: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M12 12h.01"] },
  { href: "/relatorios", label: "Relatórios", description: "Para onde seu dinheiro foi", icon: ["M5 20V10M12 20V4M19 20v-7"] },
  { href: "/temas", label: "Temas", description: "Dez temas, claros e escuros", icon: ["M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A3.6 3.6 0 0 0 21 11c0-4.4-4-8-9-8z", "M7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01"] },
  { href: "/configuracoes", label: "Configurações", description: "Perfil, dados e backup", icon: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"] },
];

/** Rotas que pertencem à aba "Mais" na navegação inferior. */
export const MORE_PATHS = ["/mais", ...MORE_LINKS.map((l) => l.href)];
