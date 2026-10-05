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
