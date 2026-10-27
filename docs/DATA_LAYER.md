# Camada de dados (fase funcional)

Estado: **ETAPAS 1 a 13 concluídas** (storage + services + onboarding + contas + transações + cartões e faturas + categorias).
**Início, Contas, Transações, Cartões, Faturas e Categorias já leem e gravam no IndexedDB.** As demais páginas ainda leem
`data/mock.ts` e migram uma a uma nas próximas etapas.

## Camadas

```
UI (components, app/)
  ↓ usa
Features / hooks          (chegam com o Onboarding e as páginas)
  ↓ chama
Services      services/<domínio>/   regras de negócio, validação, exclusão protegida
  ↓ depende só de
Storage       storage/types.ts      contrato: Repository, batch(), subscribe()
  ↓ implementado por
IndexedDB     storage/indexeddb.ts  FinFinanceDB v1  (futuro: adaptador Supabase)
```

- A UI **nunca** importa `storage/` nem fala com IndexedDB. Ela usa `getServices()`.
- `getServices()` só no **cliente** (efeitos/handlers). Importar o módulo é seguro
  no servidor do Next; o IndexedDB só abre no primeiro uso.
- Trocar para Supabase = escrever outra implementação de `Storage`
  (`storage/types.ts`) e devolvê-la em `storage/index.ts`. Services e UI não mudam.

```ts
import { getServices } from "@/services";

const { accounts, transactions } = getServices();
const list = await accounts.listWithBalances();
const unsub = getServices().subscribe(() => reload()); // reage a qualquer gravação
```

## Decisões que valem para o resto do projeto

| Tema | Decisão | Por quê |
|---|---|---|
| Dinheiro | **centavos inteiros** (`amountCents`) | evita `0,1+0,2≠0,3`; parcelas somam exatamente o total (`splitCents`) |
| Exibição | `formatCents(c)` → `formatBRL` | regra do design system: nunca `"R$ " + valor` |
| Datas de calendário | `"YYYY-MM-DD"` sem fuso | `new Date("2026-09-28")` é UTC e vira dia 27 no Brasil |
| Instantes | ISO UTC (`createdAt`, `paidAt`) | |
| Saldo da conta | **derivado**: saldo inicial + transações | editar/excluir nunca deixa saldo torto |
| Status da fatura | **derivado** de datas + `paidAt` | não fica velho |
| Total da fatura / limite usado | derivados das transações com `invoiceId` (Etapa 5) | |
| Compra no cartão | `despesa` com `cardId` (sem `accountId`) | entra na fatura; não mexe no saldo |
| Pagamento de fatura | tipo `pagamento_fatura` | sai da conta, **não** é despesa (já contada nas compras) |
| Transferência | `accountId → toAccountId` | não é receita nem despesa; patrimônio inalterado |
| Gravação em várias coleções | `storage.batch()` (uma transação, tudo ou nada) | ex.: reatribuir categoria |
| Exclusão | bloqueada se em uso (`InUseError`); contas/cartões têm `archive` | |
| Segredos | tokens do Google **nunca** entram no IndexedDB | só o estado (`settings.backup`) |

## Stores do IndexedDB (`FinFinanceDB`, v1)

`users`, `settings`, `accounts`, `transactions`, `cards`, `invoices`, `categories`,
`budgets`, `goals`, **`incomeSources`**, **`recurrences`**, **`investments`**
(as três em negrito foram acrescentadas: onboarding e investimentos precisam delas).
Índices: ver `storage/schema.ts`. Mudança de schema = subir `DB_VERSION` e
acrescentar um passo em `migrations`.

## Testes

```bash
npm i -D vitest fake-indexeddb     # uma vez
npm test                           # "test": "vitest run" no package.json
```

`vitest.config.mts` já configura o alias `@`, o `fake-indexeddb` e `TZ=America/Sao_Paulo`.
Atenção: os `*.test.ts` entram no type-check do `next build`; sem `vitest`
instalado o build reclama.

Cobertura atual (310 testes, incluindo cartões, faturas, categorias, orçamentos, metas, relatórios, configurações e backup): datas, dinheiro/parcelas, storage (persistência,
atomicidade, eventos), saldo, receita, despesa, transferência, cartão, pagamento
de fatura, validações, filtros, exclusões protegidas, categorias, orçamento,
configurações, perfil, renda, onboarding, contas (saldo, ajuste, visão geral, série), view-models
consulta reativa, calendário de repetições, parcelamento e transações. Checado com mutações: quebrar cada regra crítica
faz pelo menos um teste falhar.

## Onboarding (Etapa 2)

```
app/layout → AppShell → OnboardingGate → (sidebar + página)
app/onboarding → components/onboarding/OnboardingFlow → services.onboarding.complete(draft)
```

- **Porteiro** (`components/ui/OnboardingGate.tsx`): consulta `settings.onboardingCompleted`.
  Primeira abertura → `/onboarding`; depois de concluído, `/onboarding` volta para a Home.
  Se o navegador não liberar o IndexedDB (aba privativa etc.) mostra uma tela de erro com
  "Tentar novamente", em vez de ficar em "Carregando…".
- **Fluxo**: boas-vindas → básico (nome, renda, dia) → renda extra → contas → cartões →
  gastos fixos → "Tudo pronto". Tudo opcional, exceto o nome. Renda 0 = nenhuma fonte criada.
- **Rascunho só em memória**: dados financeiros não vão para localStorage/sessionStorage.
  Recarregar a página no meio do fluxo recomeça (nada foi gravado até "Concluir").
- **Gravação única e atômica** (`services/onboarding`): valida tudo em memória e grava
  perfil, rendas, contas, cartões, gastos fixos, categorias padrão e o marcador numa só
  transação. Se algo for inválido ou falhar, **nada** é gravado e o usuário pode tentar de novo.
- Gastos fixos viram `recurrences` (modelos); gerar as transações do mês é da Etapa 4.
- Cada `services/<x>` expõe `normalize<X>Shape` (formato, sem banco); o CRUD acrescenta as
  checagens de vínculo. O onboarding usa só a parte de formato porque os vínculos ainda não existem.

## Contas reais (Etapa 3)

```
Início / Contas (client)  →  useAccountsOverview()  →  useLiveQuery  →  getServices().accounts.overview()
                                   ↑ refaz a leitura a cada gravação (storage.subscribe)
features/accounts/viewModels.ts   traduz dados reais → props dos componentes do design aprovado
```

- **`useLiveQuery(query, deps)`** (`hooks/`): lê dos services e se atualiza sozinho. A lógica é
  pura (`hooks/liveQuery.ts`, testada): agrupa mudanças seguidas numa leitura, ignora resposta
  velha, mantém os últimos dados se uma releitura falhar. Só reage a gravações **na mesma aba**.
- **`accounts.overview()`**: uma leitura entrega contas com saldo e mini-série, arquivadas,
  patrimônio, dinheiro em mãos e cartão usado.
- **`accounts.setCurrentBalance(id, valor)`**: "meu saldo hoje é X". Ajusta o saldo *inicial*
  para o saldo atual virar X, sem tocar nas transações.
- **Os dois números do painel da carteira** (decisão de produto, fácil de trocar em
  `services/accounts/balance.ts`):
  - ícone de cartão = compras no cartão ainda não pagas (compras − pagamentos de fatura;
    a Etapa 5 passa a calcular por cartão);
  - ícone de cédula = dinheiro em mãos (contas dos tipos *carteira* e *dinheiro*).
- **Carteira da Home**: até 3 contas de maior saldo, a maior na frente; com menos de 3
  ocupam os lugares da frente. Nubank/Inter/C6 mantêm os degradês e logotipos aprovados;
  qualquer outro banco mostra o nome (cor pelo banco reconhecido ou pelo tipo da conta).
- **Estados**: toda tela de dados tem carregando, vazio, erro (com "Tentar novamente") e
  sucesso (`Toast`). Erro nunca vira "R$0,00": o painel mostra "—".
- **Ordem estável**: `nowISO()` nunca repete um instante; sem isso, contas criadas no mesmo
  milissegundo (onboarding) apareciam em ordem aleatória.
- Exclusão de conta com movimentações é bloqueada e a tela oferece **arquivar** (sai da lista e
  do total, mantém o histórico; dá para restaurar).

## Transações reais (Etapa 4)

- **Lançar** receita, despesa e transferência (`/transacoes/nova`), **visualizar**, **editar**
  (`/transacoes/[id]/editar`), **excluir**, **pesquisar** (sem acento/maiúsculas), **filtrar** por tipo
  e **escolher o período** (mês, mês passado, 3 meses, ano, tudo). Busca e filtro rodam em memória
  sobre o período carregado, então digitar não consulta o banco.
- **Saldos são derivados**: editar ou excluir recalcula Home e Contas sozinho; transferência não muda
  o patrimônio; compra no cartão não mexe no saldo bancário.
- **Repetição** (diária, semanal, mensal, anual): lançar com "Mensal" cria o lançamento **e** um modelo
  (`recurrences`) que começa na data seguinte. `recurrences.generateDue()` lança o que venceu:
  roda ao abrir o app (`RecurrenceRunner`), quando a aba volta a ficar visível e logo após salvar.
  - idempotente (id determinístico `rec:<id>:<data>` + `lastGeneratedDate`) e atômico (um `batch`);
  - nunca gera antes de `startDate` (gasto fixo cadastrado dia 29 com vencimento dia 5 só começa em 5/out);
  - recupera meses em que o app ficou fechado (até 500 por execução);
  - dia 31 cai no último dia dos meses curtos; 29/02 anual vira 28/02 nos anos comuns;
  - gasto fixo **sem conta** usa a conta ativa **mais antiga**; sem nenhuma conta, espera sem perder meses;
  - uma repetição inválida não trava as outras; apagar uma ocorrência não a recria.
  - excluir uma ocorrência oferece "só esta" ou "excluir e parar de repetir".
- **Parcelamento no cartão** (`createInstallments`): N lançamentos mensais cuja soma é exatamente o
  total (resto de centavos nas primeiras), mesmo `installmentGroupId`, numerados. Editar uma parcela
  muda só descrição/categoria/observação; excluir oferece "só esta" ou "todas". **A ligação com a fatura
  e o limite são da Etapa 5.**
- **Datas**: `date` é calendário sem fuso; os rótulos da lista (Hoje/Ontem/data, com ano quando não é o
  atual) nunca passam por UTC. O horário não é guardado, então a linha não mostra hora.
- **Início** ganhou "Resumo do mês" e "Transações recentes" (sem as futuras), com os mesmos componentes
  da página Transações; "Transferir dinheiro" (Contas) abre a transferência.
- **Limites conhecidos**: a tela só atualiza sozinha por gravações da *mesma aba*; a lista mostra um
  período por vez; repetições só são gerenciadas pelas próprias transações (não há tela de "gastos fixos").

## Cartões e faturas (Etapa 5)

```
Cartões / Faturas (client) → useCardsOverview() → useLiveQuery → cards.overview() + invoices.views() + accounts.listWithBalances()
Compra no cartão → transactions.create/createInstallments → invoiceCycle() → fatura (criada junto, no mesmo batch)
```

- **Ciclo** (`services/invoices/cycle.ts`): compra **até o dia do fechamento (inclusive)** entra na fatura que fecha neste mês;
  depois, na seguinte. Se o vencimento cai antes do fechamento no calendário (fecha 20, vence 5) ele é do mês seguinte.
  Dia 31 de fechamento vira o último dia dos meses curtos. Id da fatura: `inv:<cardId>:<YYYY-MM do vencimento>` (determinístico: nunca duplica).
- **Compra → fatura**: `transactions.create` descobre a fatura pela data e pelo cartão e a grava **junto** (um `batch`). O `invoiceId` que a tela
  mandar é ignorado. Editar data/cartão recalcula; fatura que ficar vazia é removida; mudar de cartão para conta tira da fatura.
- **Parcelas**: a n-ésima parcela cai na n-ésima fatura a partir da data da compra (offset aplicado uma vez só). O limite usado conta o **total**.
- **Limite**: `usado = compras no cartão − pagamentos de fatura daquele cartão` (derivado; nunca negativo). `disponível = limite − usado` (mínimo 0, com `overLimit`).
- **Pagar** (`invoices.pay`): só fatura **fechada ou atrasada**; valida conta ativa e **saldo ≥ total**; grava o `pagamento_fatura` e marca `paidAt` **numa só gravação**.
  Não é despesa (a compra já foi contada). `invoices.undoPayment` reabre a fatura e devolve o dinheiro.
- **Fatura paga é histórico**: não aceita compra nova no ciclo, e as compras dela não mudam valor/data/cartão nem são excluídas sem desfazer o pagamento
  (descrição, categoria e observação podem mudar). `transactions.create` **não aceita** `pagamento_fatura` (só a fatura cria).
- **Status** continua derivado das datas: aberta → fechada → atrasada; `paga` por `paidAt`.
- **Mudar fechamento/vencimento do cartão** vale para as **próximas** faturas; as existentes não mudam. Editar só o texto de uma compra não a move de fatura.
- **Excluir cartão**: bloqueado com compras/faturas/recorrências (`InUseError`) → **arquivar** (sai da lista, mantém histórico, tem "Restaurar").
- **Modelo do cartão**: guarda `issuer` (inclusive `"outro"`); só dados antigos sem `issuer` são reconhecidos pelo nome.
- **Dados antigos/importados**: `invoices.assignMissing()` liga compras sem fatura ao ciclo certo (roda no `RecurrenceRunner`, idempotente; pula faturas já pagas).
- **Recorrência no cartão** (assinatura) também cai na fatura de cada mês (`generateDue` usa o mesmo resolvedor).
- **Telas**: Cartões (resumo, carrossel, limite, fatura atual, editar/arquivar/excluir) e Faturas (A pagar, Atrasadas, Para pagar, Em aberto,
  Próximas faturas e Pagas recolhidas; filtro por cartão; detalhe com compras, pagar e desfazer). Estados: carregando, vazio, erro e sucesso.
- **Limites conhecidos**: pagamento sempre da fatura inteira (sem pagamento parcial); a tela só atualiza sozinha por gravações da mesma aba.

## Categorias (Etapa 6)

```
Categorias (client) → useCategoriesData(range) → useLiveQuery → categories.overview({from,to})
features/categories/viewModels.ts   ordena, calcula a fatia (%) e os textos de uso
```

- **`categories.overview(range)`**: cada categoria com `periodCents` (despesa ou receita do período), `periodCount` e `usage`
  (transações, orçamentos, repetições). Compra no cartão conta como despesa na categoria; **transferência e pagamento de fatura não entram**;
  uma transação de tipo diferente do da categoria (dado importado inconsistente) não é somada.
- **Tela**: abas Despesas/Receitas, total do período (mesmo seletor de período das Transações), lista por valor (maior primeiro; sem
  movimento por ordem alfabética), fatia em %, selo "Padrão", criar/editar/excluir. Estados: carregando, vazio ("Criar categorias padrão"), erro, sucesso.
- **Editar**: nome e cor (paleta de 12, `#RRGGBB` validado). Categorias padrão podem ser renomeadas/recoloridas, **não excluídas** e continuam padrão.
  O **tipo não muda pela tela**; no service a regra não é imposta de propósito (um teste de repetições depende de poder trocar o tipo).
- **Excluir**: sem uso, direto. Em uso, a tela mostra o que usa a categoria ("3 transações, 1 orçamento e 2 repetições") e pede **para onde mover**;
  tudo (transações, repetições, orçamentos, exclusão) numa só gravação. Mover para ela mesma é recusado (antes apagava a categoria e deixava as transações órfãs).
  Orçamento da categoria excluída é descartado se o destino já tem o dele.
- **Nome**: único por tipo, sem diferenciar maiúsculas; renomear não mexe nas transações (guardam o `id`).
- **Cor nas Transações**: a lista usa a cor escolhida (`categoryColor`); sem ela, a cor por nome (`lib/category`).
- **Limite conhecido**: o período usa as datas das transações; a tela só atualiza sozinha por gravações da mesma aba.

## Orçamentos (Etapa 7)

```
BudgetsView (client) → useBudgetsData(month) → useLiveQuery → budgets.overview(month)
features/budgets/viewModels.ts   centavos → reais (props do BudgetCard), frases de atenção
services/budgets/compute.ts      funções puras: gasto por categoria, status, média, overview
lib/financialMonth.ts            mês financeiro ("YYYY-MM" + dia inicial) → intervalo de datas
```

- **Mês financeiro**: respeita `settings.firstDayOfMonth` (1–28). Com dia 10, "2026-10" = 10/10 a 09/11. Meses seguidos não deixam buraco nem se sobrepõem.
- **Gasto** = despesas da categoria no intervalo, **inclusive compras no cartão** (pela data da compra). Receita, transferência e pagamento de fatura nunca contam.
- **Status**: `ok` (<80%), `atencao` (≥80%), `estourado` (≥100%) — mesma escala de `progressColor`. O restante pode ficar negativo; a barra trava em 100%, o % mostra o real.
- **`budgets.overview(month?)`**: itens ordenados do mais consumido ao menos, totais (limite/gasto) e `unbudgeted` (categorias com gasto e sem orçamento). Orçamento órfão (categoria inexistente, ex.: backup importado) é ignorado.
- **`budgets.suggestLimit`**: média dos 3 meses anteriores (mês sem gasto conta zero); a tela oferece "Toque para usar" só se houver histórico.
- **Regras do CRUD** (já existentes): categoria de despesa, uma por categoria, limite inteiro ≥ 1 centavo, período mensal. Excluir orçamento não mexe nas transações.
- **Tela**: navegação mês a mês, resumo (orçado/gasto/disponível ou "Acima do orçado"), cartões por categoria com a cor dela, seção "Sem orçamento neste mês",
  criar (só categorias sem orçamento), editar limite, excluir com confirmação. Estados: carregando, vazio, erro, sucesso.
- **Limite conhecido**: orçamento é sempre mensal (`period: "monthly"`), sem rolagem de saldo entre meses; a tela só atualiza sozinha por gravações da mesma aba.

## Metas (Etapa 8)

```
GoalsView (client) → useGoalsData → useLiveQuery → goals.overview(today)
services/goals/compute.ts   funções puras: progresso, situação, meses até o prazo, valor mensal
features/goals/viewModels.ts  centavos → reais, degradê a partir da cor, frase de apoio
```

- **Valor guardado**: `currentCents`. Muda só por `deposit` / `withdraw` (botões Adicionar/Retirar); a edição altera nome, valor da meta, prazo e cor. Na criação dá para informar "já guardado".
- **Retirada** nunca passa do guardado (recusada sem alterar nada). Aporte pode passar da meta (a meta fica concluída).
- **Não mexe em contas nem transações**: a meta é um acompanhamento separado do saldo. A tela avisa isso.
- **Situação**: `concluida` (guardado ≥ meta), `atrasada` (prazo anterior a hoje e não concluída; prazo = hoje ainda é andamento), `andamento`.
- **Valor mensal**: restante ÷ meses até o prazo, arredondado para cima; mês parcial conta como um, mínimo 1. Sem prazo mostra "Faltam R$ …".
- **Ordem**: andamento (prazo mais próximo primeiro, sem prazo no fim), atrasadas, concluídas.
- **Tela**: resumo (guardado total + metas ativas), cartão por meta com a cor escolhida, criar/editar/excluir e Adicionar/Retirar. Estados: carregando, vazio, erro, sucesso.
- **Limites conhecidos**: sem histórico de aportes (só o saldo atual); aporte e retirada não são atômicos entre abas (leitura + gravação); a tela só atualiza sozinha por gravações da mesma aba.

## Relatórios (Etapa 9)

```
ReportsView (client) → useReportsData(range) → useLiveQuery → reports.overview({from,to})
services/reports/compute.ts   funções puras: totais, despesas por categoria, maiores despesas, período anterior
features/reports/viewModels.ts  centavos → reais, rótulos de comparação, frase de variação
```

- **Fonte única**: tudo vem das transações do período (mesmo seletor de período das Transações/Categorias). Nada é guardado; o relatório é sempre recalculado.
- **Receita e despesa**: só os tipos `receita` e `despesa`. **Transferência e pagamento de fatura nunca entram.** Compra no cartão é despesa na data da compra.
- **Gastos por categoria**: maiores primeiro, até 6 fatias (a 6ª vira "Outras categorias" quando há 7+). Despesa sem categoria (ou com categoria inexistente, ex.: backup importado) = "Sem categoria". Os percentuais são inteiros e **somam sempre 100** (método do maior resto).
- **Comparação**: período imediatamente anterior com o mesmo número de meses (mês → mês anterior, 3 meses → 3 meses antes, ano → ano anterior). "Todo o período" não tem comparação. Frase de variação só aparece com base maior que zero; acima de 1000% vira "mais de 10 vezes".
- **Maiores despesas**: as 4 maiores (empate: data mais recente, depois id), cartão incluído, na cor da categoria.
- **Estados**: carregando, vazio ("Sem movimentações neste período." / "Você ainda não possui transações." com "+ Nova transação"), erro com "Tentar novamente", sucesso.
- **Limites conhecidos**: sem período personalizado nem exportação do relatório ainda; o período usa as datas das transações; a tela só atualiza sozinha por gravações da mesma aba.

## Configurações (Etapa 10)

```
SettingsView (client) → useSettingsData → useLiveQuery → settings.get() + users.getCurrent()
useFirstDay()          → settings.firstDayOfMonth (1 enquanto carrega)
```

- **Rota**: `/configuracoes`. **Falta linkar** a partir do menu "Mais" e da sidebar do projeto (não mexi nesses componentes).
- **Perfil**: nome (obrigatório) e e-mail opcional (validado). Salvar de novo atualiza o mesmo registro (`users.save`), nunca duplica.
- **Moeda**: só BRL, exibida como informação.
- **Tema**: dez temas funcionais (ver "Temas, onboarding e entrada animada"); a escolha vale para o app inteiro e persiste.
- **Primeiro dia do mês (1–28)**: grava na hora ("Preferência salva."). Passa a valer em **Início, Transações, Categorias, Relatórios (Esse mês / Mês passado / 3 meses) e Orçamentos**: com dia 10, "Esse mês" = 10/10 a 09/11. O "Esse ano" continua sendo o ano de calendário. Não muda faturas de cartão, recorrências nem datas de transações.
  - `rangeFor(periodo, hoje, primeiroDia)` usa `lib/financialMonth`. O período anterior dos Relatórios (`previousRange`) agora funciona também para meses financeiros; o mês é nomeado pelo mês em que começa.
- **Backup**: mostra status do Google Drive e "Último backup" (`backup.lastBackupAt`, no fuso do aparelho). **Conectar ao Google Drive** fica desabilitado até a Etapa 12.
- **Dados**: Exportar e Importar backup (ver "Backup local", Etapa 11).
- **Estados**: carregando, erro com "Tentar novamente", sucesso (toast).
- **Limite conhecido**: a tela só atualiza sozinha por gravações da mesma aba.

## Backup local — exportar e importar (Etapa 11)

```
DataSection (client) → getServices().backup → storage (batch atômico) → IndexedDB
services/backup/validate.ts   inspectBackup(texto): valida SEM tocar no banco
services/backup/index.ts      snapshot() · restore(file) · currentCounts() · markExported()
features/backup/download.ts   entrega o texto como arquivo (Blob), nome FinFinance_Backup.json
```

- **Arquivo** (`FinFinance_Backup.json`): `{ app: "FinFinance", format: 1, exportedAt, counts, data: { <12 stores>: [...] } }`. Contém todos os dados do app (perfil, configurações, contas, cartões, faturas, transações, categorias, orçamentos, metas, rendas, recorrências, investimentos) e **nada de Google**: o `backup` das configurações (conectado, automático, último backup, tokens) é do aparelho e é removido do arquivo.
- **Validação (antes de qualquer gravação)**: tamanho máx. 25 MB; JSON válido; `app` correto; versão do formato presente e não mais nova que a do app; todas as 12 stores presentes e como listas; cada registro com `id` único, `createdAt`/`updatedAt` e os campos mínimos do tipo (valores inteiros em centavos, datas de calendário reais, enums, dias 1–31…). Campos extras (versões futuras) são preservados. A mensagem de erro cita a store e o item, **nunca o valor**.
- **Avisos (não bloqueiam)**: vínculos que apontam para algo ausente no arquivo (ex.: conta removida). O app já trata órfãos.
- **Importação**: escolher arquivo → validar → tela de confirmação com "Agora → Backup" por tipo de dado, avisos e o alerta de substituição → "Baixar cópia dos dados atuais antes" (opcional) → "Substituir dados deste aparelho". Cancelar não altera nada. Arquivo inválido mostra o motivo e "Nada foi alterado".
- **Restauração = substituição completa e atômica**: uma única transação apaga o que não está no backup e grava tudo do backup; se algo falhar, **nada muda**. Mantém o estado de backup/Google do aparelho (ou o padrão num aparelho novo). Se o arquivo vier sem configurações, mantém as locais. Depois, a UI atualiza sozinha (eventos do storage); saldos, faturas e relatórios são recalculados dos dados restaurados.
- **Correção na camada de storage**: `batch()` não era atômico quando um registro inválido lançava no meio do lote (o que já tinha sido enfileirado era gravado). Agora o lote é abortado e nenhum evento é emitido. Teste em `storage/batch.test.ts`.
- **Privacidade**: o arquivo só é gerado e baixado localmente; nada é enviado, nada vai em URL, sem `console.log` de dados.
- **Para a Etapa 12**: o Drive deve usar `snapshot()`/`inspectBackup()`/`restore()` e gravar em `backup.lastBackupAt`. Mudanças só em `settings.backup` (como `lastExportAt`) **não** devem disparar backup automático.
- **Limites conhecidos**: importar sempre substitui tudo (não há mesclagem); sem criptografia do arquivo (quem tem o arquivo vê os dados); a tela só atualiza sozinha por gravações da mesma aba.

## Regra de estilo (Tailwind)

O Tailwind só varre `app/` e `components/`. **Todo arquivo com `className` deve morar em um
deles.** `features/` guarda só lógica sem CSS (constantes, tipos, hooks).

## Onde os mocks ainda vivem (a migrar)

| Arquivo | Vem de `data/mock` | Etapa |
|---|---|---|
| ~~`FinanceHero`, `AccountsSection`, `app/contas`~~ | contas, saldos, resumo | ✅ 3 |
| ~~`app/transacoes`, `NewTransactionForm`~~ | transações, categorias, contas | ✅ 4 |
| ~~`app/cartoes`, `app/faturas`~~ | cartões, faturas | ✅ 5 |
| ~~`app/categorias`~~ | categorias | ✅ 6 |
| ~~`app/orcamentos`~~ | orçamentos | ✅ 7 |
| ~~`app/metas`~~ | metas | ✅ 8 |
| ~~`app/relatorios`~~ | transações, resumos | ✅ 9 |
| `app/investimentos` | investimentos | 9/10 |
| `app/configuracoes`, `app/mais` | perfil | 10 |


## Google Drive — backup na nuvem (Etapa 12)

O Drive **não é o banco**: o IndexedDB continua sendo a fonte de verdade. O Drive guarda uma cópia (`FinFinance/FinFinance_Backup.json`, mesmo formato da Etapa 11).

**Camadas**
- `services/drive/` (sem rede nem navegador): `types.ts` (contrato `DriveClient`), `fingerprint.ts` (SHA-256 do JSON canônico, ignora `exportedAt`/`settings.updatedAt`), `sync.ts` (`backupNow`, `inspectRemote`, `restoreRemote`, sempre em série), `scheduler.ts` (debounce 8 s, espera máxima 60 s, nova tentativa em 120 s até 3 vezes; offline/bloqueado ficam pendentes até `resume()`).
- `features/drive/`: `restClient.ts` (Drive REST v3), `googleAuth.ts` (Google Identity Services), `driveController.ts` (singleton que liga tudo à UI e ao `storage.subscribe`).
- UI: `components/settings/DriveSection.tsx` e `components/ui/DriveAutoBackup.tsx` (montar junto do `RecurrenceRunner` no AppShell).

**Configuração**: crie um OAuth Client ID (Aplicativo da Web, Drive API ativada, sua origem em "Origens JavaScript autorizadas") e defina `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (veja `.env.example`). Sem a variável a tela mostra "Google Drive não configurado".

**Segurança**: escopo único `drive.file`; token só em memória (nunca IndexedDB, localStorage, URL ou log); Desconectar revoga o token e limpa o estado local, sem apagar dados locais nem o arquivo no Drive; o backup não contém o estado do Google.

**Comportamento**
- Arquivo único: procura pasta e arquivo (o mais antigo, se houver duplicados) e atualiza; só cria na primeira vez.
- Várias alterações seguidas viram um backup. Alterações só de configurações não disparam backup (evita laços).
- Offline: "Backup pendente", sem erro destrutivo; envia ao voltar a conexão.
- Novo aparelho com backup: "Encontramos um backup do FinFinance." → Restaurar backup / Começar do zero, com confirmação.
- Conflito (dados locais diferentes do backup): escolha explícita "Usar dados deste dispositivo" ou "Restaurar backup do Google Drive"; restaurar oferece baixar cópia local antes. Nada é sobrescrito sem confirmação.

**Limitações**
- Sem backend não há refresh token: após recarregar a página tenta-se renovação silenciosa e, se falhar, aparece "Reconectar ao Google".
- Os eventos de mudança valem só na mesma aba.
- Testado contra um Google/Drive simulado (GIS + API em memória); o OAuth real depende do seu Client ID.

## Progresso das etapas

1. ✅ Storage + IndexedDB + tipos + services
2. ✅ Onboarding
3. ✅ Contas reais
4. ✅ Transações reais
5. ✅ Cartões + faturas (vincular compra à fatura, parcelas, pagar)
6. ✅ Categorias
7. ✅ Orçamentos
8. ✅ Metas
9. ✅ Relatórios
10. ✅ Configurações
11. ✅ Exportação/importação
12. ✅ Google Drive
13. ✅ Testes e correções finais

## Testes e verificação final (Etapa 13)

- `services/integration.test.ts`: um mês inteiro (salário, mercado, transferência, compra parcelada no cartão, orçamento, meta) conferindo que saldos, patrimônio, relatório e orçamento contam a mesma história; pagar a fatura tira da conta uma vez e não muda a despesa; parcelas somam o valor; backup → banco novo → restaurar devolve os mesmos números.
- Varredura de interface (`e2e/e2e13.py`, Playwright): todas as telas, com banco vazio e com dados, em 390/393/430/1280 px — sem rolagem horizontal, sem erro de console, sem `console.log`, sem "undefined/NaN" na tela, nada escondido atrás da Bottom Navigation e nenhum dado financeiro na URL.
- Comandos: `npx vitest run`, `npx tsc --noEmit`, `npx next build`. ESLint não está configurado no projeto.

## Correção: Início, Contas e Mais com dados reais

- **/mais** (`app/mais`, `features/more/links.ts`): menu com Faturas, Categorias, Orçamentos, Metas, Relatórios e Configurações. A aba "Mais" fica ativa em todas essas rotas; a Sidebar usa a mesma lista.
- **Contas** (`components/accounts/*`, `features/accounts/*`): lista com saldo real, criar, editar (inclui "Saldo atual", que ajusta o saldo inicial sem mexer nas transações), arquivar/restaurar e excluir (só sem movimentações). Bancos conhecidos mantêm cores e logotipos; os demais mostram iniciais.
- **Início** (`components/home/HomeView.tsx`): carteira com até 3 contas (maior saldo na frente), lista de contas (cada cartão abre /contas), botões Transação, Calendário e Ocultar valores funcionando, e transações recentes que abrem os detalhes (`/transacoes?ver=ID`, o id é limpo da URL ao abrir).
- Testes: `features/accounts/viewModels.test.ts` (unidade) e `e2e/e2e14.py` (fluxo completo em 390/430/1280 px).

## Temas, onboarding e entrada animada

- **Temas** (`features/theme/*`, `components/theme/ThemesView.tsx`, `app/temas`, atalho em Mais e em Configurações): dez temas (cinco escuros, cinco claros) definidos só por variáveis CSS em `app/globals.css`; as cores do Tailwind (`white`, `violet`, `canvas`, `panel`, `ok`, `bad`, `warn`) leem essas variáveis. A troca é imediata, sem recarregar, é salva em `settings.theme` e guardada também em `localStorage` (`ff-theme`, só o id do tema) para o app abrir já no tema certo, sem piscar. Receita/despesa (`--ok`/`--bad`) mudam de tom entre escuros e claros, mas nunca de significado. A carteira e os cartões bancários mantêm as cores próprias em todos os temas. Valores antigos (`escuro`, `claro`, `sistema`) viram um dos dez.
- **Onboarding** (`app/onboarding`, `components/onboarding/*`, `services/onboarding`): boas-vindas, nome, renda (referência de planejamento, nunca vira transação), objetivos, configuração opcional (primeira conta com saldo inicial, despesas fixas, limite mensal) e conclusão. Tudo é gravado numa única operação e cria as categorias padrão. Usuários antigos com dados continuam entrando normalmente; o perfil pode ser editado em Configurações.
- **Entrada animada** (`components/ui/Splash.tsx`, `features/splash.ts`): ~850 ms na primeira abertura, ~300 ms nas seguintes, uma vez por sessão, e nenhuma com "reduzir movimento" ativado.
- **Categorias padrão**: já vêm criadas (Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras, Assinaturas, Outros; Salário, Renda extra, Investimentos, Outros). Criar é à prova de duplicação (chamadas simultâneas viram uma só) e `repairDefaults` limpa cópias vazias que versões antigas deixaram. Categorias padrão não contam como "dados do usuário" ao restaurar um backup.
- **Listas de seleção** (parcelas, categoria, conta, repetição): fundo sólido do tema e `color-scheme` por tema, então a lista aberta do navegador fica legível em todos os temas.
- **Verificação**: `e2e/e2e15.py` percorre os dez temas em oito telas (tema aplicado e persistido, sem rolagem horizontal, contraste mínimo de 3:1 em todo texto, carteira inalterada).

## Logo, entrada animada e verde como padrão

- **Logo** (`public/brand/*.webp`, `features/brand.ts`, `components/onboarding/Logo.tsx`): a logo enviada, em preto e branco, separada em camadas no mesmo quadro (o F, as três barras, o nome), mais `app/icon.png` e `app/apple-icon.png`.
- **Entrada animada** (`components/ui/Splash.tsx`, CSS em `app/globals.css`): logo e nome centralizados sobre fundo preto fixo; o F sobe, as três barras crescem uma a uma, um brilho passa pela logo e o nome surge; depois tudo se dissolve para o app. ~1,4 s na 1ª abertura da sessão, ~0,4 s nas seguintes, nenhuma com "reduzir movimento". Só `transform` e `opacity`.
- **Preto e branco é o tema padrão** (`DEFAULT_THEME = "preto"`): vale para quem ainda não escolheu; quem já escolheu outro tema mantém. O botão de destaque é branco com texto preto; nos temas claros a logo do onboarding fica preta. O roxo virou "Roxo-escuro" / "Roxo-claro". A carteira continua igual em todos os temas.
