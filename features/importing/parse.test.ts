import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, parseStatement, splitCsv } from "./parse";

describe("parseAmount", () => {
  it.each([
    ["1.234,56", 123456], ["-1.234,56", -123456], ["R$ 12,30", 1230], ["1234.56", 123456], ["-50.00", -5000],
    ["(45,00)", -4500], ["1.234.567,89", 123456789], ["0,5", 50], ["1,234.50", 123450], ["100", 10000],
  ])("%s → %i", (raw, cents) => expect(parseAmount(raw)).toBe(cents));
  it("não-número vira null", () => { expect(parseAmount("abc")).toBeNull(); expect(parseAmount("")).toBeNull(); });
});

describe("parseDate", () => {
  it.each([["27/10/2026", "2026-10-27"], ["27-10-26", "2026-10-27"], ["2026-10-27T10:00:00", "2026-10-27"], ["20261027120000[-3:BRT]", "2026-10-27"], ["27.10.2026", "2026-10-27"]])("%s", (raw, iso) => expect(parseDate(raw)).toBe(iso));
  it("rejeita data impossível", () => { expect(parseDate("31/02/2026")).toBeNull(); expect(parseDate("hoje")).toBeNull(); });
});

describe("splitCsv", () => {
  it("respeita aspas, separador e quebra de linha dentro do campo", () => {
    expect(splitCsv('a;"b;c";"d\ne"\r\n1;2;3', ";")).toEqual([["a", "b;c", "d\ne"], ["1", "2", "3"]]);
  });
});

describe("parseStatement — OFX", () => {
  const ofx = `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005120000[-3:BRT]<TRNAMT>-45.90<FITID>abc1<MEMO>Compra no mercado</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261006<TRNAMT>3500.00<NAME>Salário
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>xx<TRNAMT>-1.00<MEMO>Quebrada</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  it("lê lançamentos com e sem tag de fechamento e ignora o inválido", () => {
    const r = parseStatement(ofx);
    expect(r.format).toBe("ofx");
    expect(r.rows).toEqual([
      { date: "2026-10-05", cents: -4590, description: "Compra no mercado" },
      { date: "2026-10-06", cents: 350000, description: "Salário" },
    ]);
    expect(r.ignored).toBe(1);
  });
});

describe("parseStatement — CSV", () => {
  it("extrato Nubank (vírgula, data BR, valor com ponto)", () => {
    const r = parseStatement("Data,Valor,Identificador,Descrição\n01/10/2026,-50.00,abc,Transferência enviada pelo Pix - Fulano\n02/10/2026,1500.00,def,Salário\n");
    expect(r.rows).toEqual([
      { date: "2026-10-01", cents: -5000, description: "Transferência enviada pelo Pix - Fulano" },
      { date: "2026-10-02", cents: 150000, description: "Salário" },
    ]);
  });
  it("fatura do cartão Nubank (date,category,title,amount)", () => {
    const r = parseStatement("date,category,title,amount\n2026-10-03,restaurante,Ifood,42.90\n2026-10-04,transporte,Uber,18.50\n");
    expect(r.rows.map((x) => [x.date, x.cents, x.description])).toEqual([["2026-10-03", 4290, "Ifood"], ["2026-10-04", 1850, "Uber"]]);
  });
  it("ponto e vírgula, valor com vírgula e histórico + descrição juntos (estilo Inter)", () => {
    const r = parseStatement("Extrato\n\nData Lançamento;Histórico;Descrição;Valor;Saldo\n05/10/2026;Pix enviado;Maria;-120,50;900,00\n06/10/2026;Pix recebido;João;1.000,00;1.900,00\n");
    expect(r.rows).toEqual([
      { date: "2026-10-05", cents: -12050, description: "Pix enviado - Maria" },
      { date: "2026-10-06", cents: 100000, description: "Pix recebido - João" },
    ]);
  });
  it("colunas separadas de débito e crédito", () => {
    const r = parseStatement("Data;Descrição;Débito;Crédito\n05/10/2026;Luz;180,00;\n06/10/2026;Salário;;3.000,00\n");
    expect(r.rows.map((x) => x.cents)).toEqual([-18000, 300000]);
  });
  it("sem cabeçalho: descobre as colunas pelo conteúdo", () => {
    const r = parseStatement("05/10/2026;Padaria do Zé;-12,00\n06/10/2026;Farmácia;-35,90\n");
    expect(r.rows.map((x) => [x.date, x.description, x.cents])).toEqual([["2026-10-05", "Padaria do Zé", -1200], ["2026-10-06", "Farmácia", -3590]]);
  });
  it("arquivo sem nada reconhecível dá erro claro", () => {
    expect(parseStatement("foo,bar\nbaz,qux").error).toBeTruthy();
    expect(parseStatement("").error).toBeTruthy();
  });
  it("lê de volta o CSV que o próprio app exporta", async () => {
    const { transactionsToCsv } = await import("./exportCsv");
    const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    const csv = transactionsToCsv(
      [{ id: "1", ...stamp, type: "despesa", amountCents: 12345, description: 'Mercado "Bom"; centro', date: "2026-10-05", categoryId: "c1", accountId: "a1" }],
      { categories: [{ id: "c1", ...stamp, name: "Alimentação", kind: "despesa" } as never], accounts: [{ id: "a1", ...stamp, name: "Nubank" } as never], cards: [] },
    );
    expect(csv.startsWith("\uFEFFData;Tipo;Descrição;Valor;Categoria;Conta;Cartão;Parcela;Observação")).toBe(true);
    expect(csv).toContain("05/10/2026;Despesa;\"Mercado \"\"Bom\"\"; centro\";-123,45;Alimentação;Nubank");
    expect(parseStatement(csv).rows).toEqual([{ date: "2026-10-05", cents: -12345, description: 'Mercado "Bom"; centro' }]);
  });
});
