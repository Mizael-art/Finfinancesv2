import type { Invoice, InvoiceStatus } from "@/types/domain";

/**
 * Status derivado das datas e do pagamento (nunca gravado, para não ficar velho):
 * paga > aberta (até o dia do fechamento, inclusive) > fechada (até o vencimento) > atrasada.
 */
export function getInvoiceStatus(inv: Pick<Invoice, "closingDate" | "dueDate" | "paidAt">, today: string): InvoiceStatus {
  if (inv.paidAt) return "paga";
  if (today <= inv.closingDate) return "aberta";
  if (today <= inv.dueDate) return "fechada";
  return "atrasada";
}
