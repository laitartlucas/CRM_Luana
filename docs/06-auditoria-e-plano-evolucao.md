# 06 — Auditoria e plano de evolução do CRM

Data: 2026-10-05 · Branch: `evolucao-crm` (nada vai para `main` sem revisão).
Fora de escopo por decisão do dono: **multi-tenancy** (fica para uma fase própria, com backup e migração de dados).

## 1. Auditoria (estado atual)

**Stack:** NestJS 10 + Prisma 5 + PostgreSQL + Redis/BullMQ (backend); React 18 + Vite + React Router + dnd-kit + FullCalendar + Recharts (frontend); Evolution API para WhatsApp; deploy no Railway (backend, frontend, postgres, redis, evolution).

**Módulos existentes:** auth (JWT em cookie + refresh, Google), users, leads (+ import Respondi), pipeline (kanban), clients (+ mídia, sucesso do cliente), appointments/agenda (+ sync Google Calendar, bloqueios), catalog (serviços), dashboard, notifications (lembretes), whatsapp (bot conversacional, provedores Evolution/Meta/mock), intake, audit log.

**Pontos fortes:** guard JWT global, `@Roles` em ações sensíveis, helmet, throttler global + específico no login, ValidationPipe com whitelist, trust proxy calibrado, auditoria de ações, CORS restrito a `WEB_APP_URL`, bcrypt custo 12.

### Problemas encontrados

| # | Área | Problema | Impacto |
|---|------|----------|---------|
| 1 | Segurança | Senhas dos admins estavam no `seed.ts` público (corrigido em `2db1179`); hashes ainda nas migrations e senhas no histórico do git | Alto — trocar senhas em produção |
| 2 | Qualidade | **Nenhum teste automatizado** (0 `*.spec.ts`/`*.test.*`) apesar de haver script `jest` | Alto — qualquer mudança é regressão em potencial |
| 3 | Produto | Não existe módulo de **tarefas/follow-ups** (nem tela, nem tabela) | Alto — pedido central |
| 4 | Produto | Não existe **busca global** nem **central de notificações** na interface; busca só por lista (`search` em leads/clientes) | Médio/alto |
| 5 | Dados | Listagens (`leads`, `clients`) sem paginação no backend | Médio — degrada com volume |
| 6 | UX | Sidebar sem versão mobile (único breakpoint em 800px, sem menu recolhível), tabelas sem estado vazio/erro/skeleton padronizados | Médio |
| 7 | UX | Interceptor de 401 redireciona com `window.location` sem preservar a rota de origem; sem toasts de sucesso/erro padronizados | Médio |
| 8 | Permissões | `@Roles` aplicado em poucas rotas; o `ATTENDANT` vê/edita quase tudo (leads, clientes, pipeline) | Médio — definir matriz de permissões |
| 9 | Segurança | Sem bloqueio progressivo de conta após falhas de login (só rate limit por IP); JWT sem revogação (logout não invalida refresh) | Médio |
| 10 | Segurança | Webhook Respondi recebendo tentativas com segredo inválido (5 em 29/09–01/10) — conferir segredo configurado | Baixo/médio |
| 11 | Código | `Settings.tsx` com 566 linhas, páginas misturam fetch, estado e UI; sem camada de dados (React Query ou similar) | Médio |
| 12 | Relatórios | Dashboard e relatórios de funil/origem existem; falta exportação (CSV) e filtro por período | Baixo/médio |
| 13 | Acessibilidade | Modais sem controle de foco/ESC verificado, ícones de navegação só decorativos (`◇`) sem texto alternativo | Médio |
| 14 | Build | `tsc` acusa erro em `clients.service.ts:73` com Prisma Client desatualizado (precisa `prisma generate` depois da migration do telefone opcional) | Baixo |

## 2. O que preservar
Bot de WhatsApp e suas regras de estado, import Respondi, pipeline/kanban, agenda com Google Calendar, auditoria, identidade visual (logo/paleta atuais), migrations existentes (nunca editar as já aplicadas).

## 3. Plano em fatias (cada uma: implementar → testar → commit na branch)

1. **Fundação de qualidade** — testes (Jest backend: auth, leads, clients, pipeline; testes de componente/e2e no front com Playwright), CI simples, `prisma generate` no fluxo. *Sem isso não dá para refatorar com segurança.*
2. **Segurança e permissões** — matriz de papéis (ADMIN/MANAGER/ATTENDANT) aplicada de forma consistente, bloqueio progressivo de login, revogação do refresh token, limpeza dos hashes de senha das migrations para uma nova migration de rotação.
3. **Tarefas e follow-ups** — tabela `Task` (título, prazo, responsável, lead/cliente vinculado, status), CRUD, visão "Hoje/Atrasadas", criação a partir de lead/cliente, lembrete via fila existente.
4. **Busca global e notificações** — endpoint único de busca (leads, clientes, agendamentos), atalho Ctrl+K; central de notificações no topo (tarefas vencendo, leads novos, agendamentos).
5. **Listas escaláveis** — paginação, ordenação e filtros no backend e nas telas de leads/clientes; índices no Postgres para os filtros usados.
6. **UX/UI e responsividade** — layout mobile com menu recolhível, componentes padrão de loading/vazio/erro, toasts, tabelas responsivas, refator de `Settings.tsx`.
7. **Relatórios** — filtro por período no dashboard, exportação CSV de leads/clientes/funil.
8. **Acessibilidade e revisão final** — foco/ESC nos modais, rótulos ARIA, contraste, nova auditoria completa (bugs, regressões, performance).

## 4. Dependências e riscos
- Qualquer migration nova é aditiva (tabelas/colunas novas), para não arriscar os dados reais em produção.
- Cada fatia é entregue na branch; deploy só após revisão e merge.
- Limitação conhecida: o ambiente local não tem banco/Redis levantados, então testes de integração dependem de subir o `docker-compose` (a verificar na fatia 1).


---

## 5. Resultado final (revisão da fatia 8 — 2026-10-05)

Branch `evolucao-crm`, 8 fatias entregues. Verificação final: backend **207 testes**, frontend **107 testes**, type-check e build
limpos nos dois, auditoria de acessibilidade (axe-core, WCAG 2.1 AA) com **zero violações** em todas as telas e camadas.

### Situação de cada problema da auditoria (seção 1)

| # | Problema | Situação |
|---|----------|----------|
| 1 | Senhas no `seed.ts` público | **Parcial.** Seed corrigido (senha por variável de ambiente, nunca sobrescreve) e há tela de troca de senha. As senhas antigas **continuam no histórico do git** e os hashes nas migrations antigas: é preciso **trocar as senhas em produção** (ação do dono). |
| 2 | Nenhum teste | **Resolvido.** 314 testes + CI (`.github/workflows/ci.yml`). |
| 3 | Sem tarefas/follow-ups | **Resolvido** (módulo, tela, painel nas fichas, selo no menu, avisos de prazo). |
| 4 | Sem busca global / notificações | **Resolvido** (Ctrl+K e sino). |
| 5 | Listas sem paginação | **Resolvido para leads e clientes.** O board do Pipeline e a lista de serviços/agenda ainda carregam tudo (volume baixo). |
| 6 | Mobile / estados de tela | **Resolvido** (menu em gaveta, estados padrão, tabelas roláveis). Alvos de toque têm 37–40px (acima do mínimo AA de 24px, abaixo dos 44px recomendados). |
| 7 | 401 sem retorno / sem feedback | **Resolvido** (volta à tela de origem, avisos, confirmações acessíveis). |
| 8 | Permissões inconsistentes | **Resolvido** (guard global, matriz no README, testes de permissão). |
| 9 | Sem bloqueio / sem revogação de sessão | **Resolvido** (`tokenVersion`, bloqueio de 5 tentativas). |
| 10 | Webhook do Respondi com segredo inválido | **Aberto — ação do dono**: conferir se o segredo configurado no Respondi é o mesmo de `RESPONDI_WEBHOOK_SECRET` no Railway. Leads enviadas com segredo errado são descartadas. |
| 11 | `Settings.tsx` gigante | **Resolvido** (569 → 38 linhas). Não foi adotada biblioteca de dados (React Query): há hooks próprios que ignoram respostas atrasadas. |
| 12 | Relatórios sem período/exportação | **Resolvido** (período em todo o painel, 4 exportações CSV auditadas). |
| 13 | Acessibilidade | **Resolvido** (ver README). |
| 14 | Erro de tipo com Prisma desatualizado | **Resolvido** (o CI roda `prisma generate`). |

### Riscos em aberto (por ordem de importância)

1. **As 5 migrations novas nunca rodaram contra um Postgres de verdade.** Todas foram geradas pelo próprio Prisma
   (`migrate diff`) e são aditivas, mas o ambiente de desenvolvimento não tinha banco. O deploy executa `prisma migrate deploy`
   antes de subir a API: se uma migration falhar, a API não sobe. **Antes do merge, rode-as numa cópia do banco** (por exemplo
   um ambiente/branch de teste no Railway). A mais delicada é `20261005160000_add_audit_export_action`
   (`ALTER TYPE ... ADD VALUE`, ok no Postgres 12+; o Railway usa o 18).
2. **`WEB_APP_URL` precisa ser exatamente a origem do frontend.** A defesa de CSRF recusa (403) escritas com cookie cuja origem
   difere dessa variável. Se estiver vazia, a defesa fica desligada; se estiver com outro domínio, **todas as gravações falham**.
   Confira no Railway antes do merge.
3. **Dependências do backend com avisos de segurança** (`npm audit --omit=dev`: 23, sendo 1 crítica e 8 altas). A crítica é do
   `tar` usado só pelo instalador do `bcrypt` (age na instalação, não em execução). As altas vêm do NestJS 10
   (`multer`, `path-to-regexp`, `lodash`/`js-yaml` via swagger) e só se resolvem subindo o framework e o `bcrypt` para versões
   maiores — um projeto separado, com testes de regressão (os 207 testes ajudam). O frontend tem 2 avisos moderados do
   React Router 6 (falha de renderização no servidor, que o app não usa).
4. **Multi-tenancy não existe** (decisão do dono: fica para depois). Tudo assume uma única empresa.
5. **Sem testes de integração com banco/Redis reais.** Os testes de serviço usam o Prisma simulado; consultas SQL reais, a
   fila de varredura de notificações (BullMQ) e o envio do WhatsApp só serão exercitados em ambiente real.
6. **Senhas antigas no histórico do git** (ver item 1 da tabela): trocar as senhas de `Luana` e `Teste` em produção.

### Trade-offs conhecidos (decisões conscientes)

- Logout encerra **todos** os dispositivos da pessoa (revogação por `tokenVersion`, sem lista de sessões).
- Como o login é pelo nome, qualquer um que o saiba pode bloquear a conta por 10 minutos (limitado por IP: 5 tentativas/minuto).
- Cada requisição autenticada consulta o usuário no banco (permite revogação imediata ao custo de uma consulta simples).
- Rótulos em português das planilhas estão duplicados no backend (`reports/labels.ts`) e no front (`pipelineLabels.ts`).
- Exportações cortam em 20.000 linhas (a tela avisa).
