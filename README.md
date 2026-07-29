# CRM de Agenda — Consultoria de Imagem e Styling

CRM completo de agendamento com WhatsApp e Google Calendar nativos, feito
para uma consultoria de moda/imagem (1 profissional principal, ~60
atendimentos/mês). Este README é o guia prático de "como rodar"; o
raciocínio de arquitetura, modelo de dados, fluxos de WhatsApp, plano de
fases e riscos está em [`docs/`](./docs).

## Stack

- **Backend**: NestJS + TypeScript, Prisma (PostgreSQL), BullMQ (Redis).
- **Frontend**: React + TypeScript + Vite, FullCalendar, Recharts.
- **Integrações**: Google Calendar API (OAuth2), WhatsApp Meta Cloud API
  (com um `MockWhatsappProvider` para testar tudo sem conta Meta aprovada).

## Estrutura

```
backend/     API NestJS (auth, clientes, catálogo, agenda, WhatsApp, Google Calendar, notificações, dashboard)
frontend/    SPA React (agenda visual, ficha de clientes, dashboard, configurações)
docs/        Arquitetura, modelo de dados, fluxos de WhatsApp, plano de fases, riscos
docker-compose.yml
```

## Rodando com Docker (recomendado)

Pré-requisito: Docker Desktop instalado (não estava disponível na máquina
usada para gerar este código — o build foi validado via `npm run build` em
ambos os projetos, mas o `docker-compose up` ainda não foi executado de
ponta a ponta; se algo precisar de ajuste fino no Dockerfile, é o primeiro
lugar a olhar).

1. Copie o arquivo de variáveis de ambiente do backend:
   ```
   cp backend/.env.example backend/.env
   ```
   Edite `backend/.env` com os secrets de JWT/criptografia (veja os
   comandos sugeridos nos comentários do próprio arquivo) e, quando tiver,
   as credenciais do Google/Meta (ver seção abaixo — não são obrigatórias
   para rodar o MVP localmente).

2. Suba tudo:
   ```
   docker-compose up --build
   ```
   Isso levanta Postgres, Redis, backend (`localhost:3000`) e frontend
   (`localhost:5173`).

3. Rode a migração inicial do banco e o seed (usuário admin + catálogo de
   exemplo):
   ```
   docker-compose exec backend npx prisma migrate dev --name init
   docker-compose exec backend npm run seed
   ```
   Depois da migração inicial, aplique a constraint de não-sobreposição de
   horários (não expressável no `schema.prisma`, ver
   `docs/02-modelo-de-dados.md` §2):
   ```
   docker-compose exec backend npx prisma db execute --file prisma/manual/appointment_no_overlap.sql --schema prisma/schema.prisma
   ```

4. Acesse `http://localhost:5173` e entre com:
   - **e-mail**: `consultora@example.com`
   - **senha**: `trocar123`
   (troque a senha assim que possível — é só o valor do seed).

## Rodando sem Docker (Postgres/Redis locais)

```bash
# Backend
cd backend
cp .env.example .env   # edite DATABASE_URL/REDIS_HOST se necessário
npm install
npx prisma migrate dev --name init
npx prisma db execute --file prisma/manual/appointment_no_overlap.sql --schema prisma/schema.prisma
npm run seed
npm run start:dev       # http://localhost:3000

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173 (proxy para o backend já configurado em vite.config.ts)
```

## Testando o agendamento por WhatsApp sem conta Meta

Por padrão `WHATSAPP_PROVIDER=mock` no `.env` — nenhuma credencial da Meta é
necessária para testar o fluxo completo (agendar/remarcar/cancelar/confirmar,
ver `docs/03-fluxos-whatsapp.md`). Duas formas de testar:

- **Pela UI**: faça login, vá em **Configurações → WhatsApp — simulador de
  conversa**, informe um telefone fictício (formato `+55...`) e vá mandando
  mensagens (`1` para agendar, etc.) — as respostas do bot aparecem na tela.
- **Via curl** (após logar e copiar o cookie de sessão, ou usando um cliente
  HTTP que mantenha cookies):
  ```
  curl -X POST http://localhost:3000/whatsapp/simulate/inbound \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -d '{"phoneE164": "+5511999990000", "text": "1"}'
  ```

Quando a conta Meta Business estiver aprovada (ver
`docs/04-plano-implementacao.md`, Fase 0), basta preencher
`WHATSAPP_META_*` no `.env` e mudar `WHATSAPP_PROVIDER=meta` — nenhum outro
código muda (provider pattern, ver `docs/01-arquitetura.md` §1.3).

### Alternativa: WhatsApp real sem Meta Business (Evolution API / QR Code)

A Meta Cloud API exige migrar o número pra fora do WhatsApp normal/Business
App do celular. Se isso não é viável (quer manter o número que já usa), o
sistema também suporta `WHATSAPP_PROVIDER=evolution`, que conecta via
[Evolution API](https://github.com/EvolutionAPI/evolution-api) (self-hosted,
protocolo WhatsApp Web/Baileys, conexão por QR Code — **não é o transporte
oficial da Meta**, fica fora dos Termos de Uso do WhatsApp, com risco baixo
mas real de banimento do número).

1. `docker-compose up` já sobe o serviço `evolution-api` (+ seu próprio
   Postgres) junto com o resto do sistema.
2. Preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
   e `EVOLUTION_WEBHOOK_SECRET` no `.env` do backend (ver `.env.example`) e
   mude `WHATSAPP_PROVIDER=evolution`.
3. Na UI, vá em **Configurações → WhatsApp — conectar por QR Code**, clique em
   "Conectar", e escaneie o QR Code pelo celular (WhatsApp → Aparelhos
   conectados → Conectar um aparelho).

## Conectando o Google Calendar

1. Crie um projeto em https://console.cloud.google.com, ative a **Google
   Calendar API**, crie uma credencial OAuth2 do tipo "Web application" com
   redirect URI `http://localhost:3000/calendar-sync/oauth/callback`.
2. Preencha `GOOGLE_CALENDAR_CLIENT_ID`/`GOOGLE_CALENDAR_CLIENT_SECRET` no
   `.env` do backend e reinicie o backend.
3. Na UI, vá em **Configurações → Google Calendar → Conectar**.
4. Push notifications em tempo real (webhook) só funcionam com uma URL
   pública HTTPS (`GOOGLE_CALENDAR_WEBHOOK_URL`) — em desenvolvimento local
   isso fica desativado automaticamente (log de aviso, sem quebrar nada); a
   sincronização CRM → Google continua funcionando normalmente, só a via
   Google → CRM em tempo real depende dessa URL pública (use `ngrok` ou
   similar para testar isso localmente, ou configure ao fazer deploy).

## Login social com Google

Distinto da conexão de agenda acima. Preencha
`GOOGLE_LOGIN_CLIENT_ID`/`GOOGLE_LOGIN_CLIENT_SECRET` (outra credencial
OAuth2, escopo só `email`/`profile`) para habilitar o botão "Entrar com
Google" na tela de login.

## Comandos úteis

| Comando | O quê |
|---|---|
| `cd backend && npm run prisma:studio` | Explorador visual do banco |
| `cd backend && npm run lint` | Lint do backend |
| `cd frontend && npm run lint` | Lint do frontend |
| `cd backend && npx tsc --noEmit` | Type-check sem build completo |

## Documentação de arquitetura

- [`docs/01-arquitetura.md`](./docs/01-arquitetura.md) — visão geral, componentes, decisões técnicas.
- [`docs/02-modelo-de-dados.md`](./docs/02-modelo-de-dados.md) — entidades e relacionamentos.
- [`docs/03-fluxos-whatsapp.md`](./docs/03-fluxos-whatsapp.md) — máquina de estados da conversa.
- [`docs/04-plano-implementacao.md`](./docs/04-plano-implementacao.md) — MVP → avançado.
- [`docs/05-riscos-mitigacao.md`](./docs/05-riscos-mitigacao.md) — riscos técnicos e como são mitigados.

## O que é real vs. o que é simplificado no MVP atual

- ✅ **Real**: autenticação, CRUD completo de clientes/serviços/agendamentos,
  detecção de conflito de horário, bloqueios de agenda, motor de conversa de
  WhatsApp (determinístico), lembretes agendados via BullMQ, sincronização
  Google Calendar (OAuth2 real, só precisa das credenciais), auditoria, LGPD
  (consentimento + anonimização), dashboard com KPIs reais.
- 🧪 **Mockável/pendente de credencial externa**: envio real de WhatsApp
  (`MockWhatsappProvider` até a conta Meta ser aprovada — troca de 1 variável
  de ambiente para ativar o real).
- 🗺️ **Fase 2/3 (não implementado ainda, ver plano)**: assistente por IA no
  WhatsApp (NLU), score preditivo de no-show, otimização automática de
  agenda, multicanal (Instagram/SMS), relatórios preditivos avançados,
  construtor de automações sem código.
