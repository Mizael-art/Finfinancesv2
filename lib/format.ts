const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$1.428.185,98" (sem espaço, como na referência) */
export const formatBRL = (v: number) => brl.format(v).replace(/\s|\u00a0/g, "");

/** Separa símbolo e valor para dar hierarquia tipográfica ao saldo. */
export const splitBRL = (v: number) => {
  const full = formatBRL(v);
  return { symbol: "R$", value: full.replace("R$", "") };
};
