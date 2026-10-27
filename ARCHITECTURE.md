# FinFinance — Arquitetura e roadmap de páginas

Registrado a partir da visão completa do produto. Nada aqui foi
implementado além da Home — serve para as próximas páginas não entrarem
em conflito com decisões futuras.

## Pastas (alvo, criar conforme necessário)

```
app/                 rotas (uma pasta por página do app)
components/          componentes de design system + feature (ex.: finance/)
features/            lógica por domínio (transactions, accounts, cards, ...)
hooks/               hooks compartilhados
lib/                 utilitários (format, wallet, etc.)
types/               tipos de domínio (Account, Transaction, Card, ...)
data/                mocks atuais (trocar por services/ quando vier o Supabase)
services/            camada de dados futura (accounts, transactions, cards,
                     budgets, goals, reports) — 1 pasta por domínio
```

## Páginas do app (status)

| # | Página        | Status |
|---|---------------|--------|
| 1 | Início        | Em andamento — hero + contas bancárias prontos |
| 2 | Transações    | Planejada |
| 3 | Contas        | Planejada |
| 4 | Cartões       | Planejada |
| 5 | Faturas       | Planejada (parte de Cartões) |
| 6 | Orçamentos    | Planejada |
| 7 | Metas         | Planejada |
| 8 | Relatórios    | Planejada |
| 9 | Investimentos | Planejada (sem integração de corretora nesta fase) |
| 10| Categorias    | Planejada |
| 11| Configurações | Planejada |

## Navegação

- **Mobile:** bottom nav com Início, Transações, Contas, Cartões, Mais.
  "Mais" abre um sheet/menu com Orçamentos, Metas, Relatórios,
  Investimentos, Categorias, Configurações.
- **Desktop:** sidebar fixa com todos os itens + Configurações separada
  por um divisor, mesmo estilo visual da Home.
- Nenhuma das duas foi implementada ainda (aguardando instrução).

## Nova transação

Fluxo único (Receita / Despesa / Transferência) acessível de vários
pontos do app; campos: valor, descrição, categoria, conta, data,
observação, recorrência, e campos extras de cartão/parcelamento quando
aplicável. Ainda não implementado.

## Dados e backend

- Hoje: tudo mockado em `data/mock.ts`.
- Futuro: Supabase + PostgreSQL + Auth, acessados via `services/`,
  mantendo os mesmos tipos de `types/` para a UI não precisar mudar.
- Não implementar Supabase/autenticação até pedido explícito.

## Regra de consistência

Toda nova página deve: reutilizar tokens de `DESIGN_SYSTEM.md`,
reutilizar componentes existentes antes de criar um novo, seguir mobile
primeiro, e só depois adaptar para desktop (sidebar + melhor uso de
espaço, sem virar um sistema de tabelas empresarial).
