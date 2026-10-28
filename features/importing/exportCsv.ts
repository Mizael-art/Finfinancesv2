import type { Account, Card, Category, Transaction } from "@/types/domain";

const TYPE_LABEL: Record<Transaction["type"], string> = {
  receita: "Receita", despesa: "Despesa", transferencia: "Transferência", pagamento_fatura: "Pagamento de fatura",
};

const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const brMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const esc = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * CSV para planilha (Excel/Sheets em português): separador `;`, decimal com vírgula, acentos preservados (BOM).
 * "Valor" tem sinal: despesas e pagamentos de fatura saem negativos. O próprio app consegue importar esse arquivo de volta.
 */
export function transactionsToCsv(txs: Transaction[], lookups: { categories: Category[]; accounts: Account[]; cards: Card[] }): string {
  const cat = new Map(lookups.categories.map((c) => [c.id, c.name]));
  const acc = new Map(lookups.accounts.map((a) => [a.id, a.name]));
  const card = new Map(lookups.cards.map((c) => [c.id, c.name]));
  const header = ["Data", "Tipo", "Descrição", "Valor", "Categoria", "Conta", "Cartão", "Parcela", "Observação"];
  const lines = [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
    const signed = t.type === "receita" ? t.amountCents : t.type === "transferencia" ? t.amountCents : -t.amountCents;
    return [
      brDate(t.date), TYPE_LABEL[t.type], t.description, brMoney(signed),
      t.categoryId ? cat.get(t.categoryId) ?? "" : "",
      t.accountId ? acc.get(t.accountId) ?? "" : "",
      t.cardId ? card.get(t.cardId) ?? "" : "",
      t.installmentTotal ? `${t.installmentNumber}/${t.installmentTotal}` : "",
      t.notes ?? "",
    ].map(esc).join(";");
  });
  return `\uFEFF${[header.join(";"), ...lines].join("\r\n")}\r\n`;
}
