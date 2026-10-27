/** Cor por categoria, compartilhada entre Transações, Orçamentos e Relatórios. */
export const categoryTone: Record<string, string> = {
  Salário: "#22E070",
  Alimentação: "#F0682A",
  Assinaturas: "#8B43EA",
  Transporte: "#2AA9F0",
  Saúde: "#F0396B",
  Moradia: "#C9A227",
  Lazer: "#E0668F",
  Transferência: "#9AA0A8",
  Outros: "#9AA0A8",
};

export const toneFor = (category: string) => categoryTone[category] ?? "#9AA0A8";
