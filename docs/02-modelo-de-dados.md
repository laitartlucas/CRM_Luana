# Modelo de Dados

Este documento descreve as entidades do domínio e como elas se relacionam.
Ele espelha `backend/prisma/schema.prisma` — em caso de dúvida, o schema é a
fonte da verdade; este arquivo é o mapa de leitura.

## 1. Diagrama de entidades

```mermaid
erDiagram
    USER ||--o{ APPOINTMENT : "atende"
    USER ||--o{ SCHEDULE_BLOCK : "bloqueia horário"
    USER ||--o| GOOGLE_CALENDAR_CONNECTION : "conecta"
    CLIENT ||--o{ APPOINTMENT : "agenda"
    CLIENT ||--o{ CLIENT_MEDIA : "envia mídia"
    CLIENT ||--o| CONVERSATION : "conversa"
    SERVICE ||--o{ APPOINTMENT : "é o tipo de"
    CONVERSATION ||--o{ MESSAGE : "contém"
    APPOINTMENT ||--o{ CLIENT_MEDIA : "referenciada em"
    USER ||--o{ AUDIT_LOG : "gera"

    USER {
        uuid id PK
        string name
        string email UK
        string passwordHash
        enum role "ADMIN | MANAGER | ATTENDANT"
        string timezone
        string googleId "opcional, login social"
        boolean active
    }
    GOOGLE_CALENDAR_CONNECTION {
        uuid id PK
        uuid userId FK
        string googleCalendarId
        string accessToken "criptografado"
        string refreshToken "criptografado"
        datetime expiresAt
        string syncToken "para sync incremental"
        string channelId "push notification"
    }
    CLIENT {
        uuid id PK
        string name
        string phoneE164 UK
        string email
        date birthday
        string bodyType
        string colorPalette
        string predominantStyle
        decimal averageBudget
        string[] preferredBrands
        text restrictions
        text notes
        boolean whatsappConsent
        datetime whatsappConsentAt
        boolean marketingConsent
        float noShowScore
        datetime anonymizedAt "LGPD"
    }
    CLIENT_MEDIA {
        uuid id PK
        uuid clientId FK
        uuid appointmentId FK "opcional"
        enum type "PHOTO | MOODBOARD | OTHER"
        enum source "WHATSAPP | UPLOAD"
        string storageUrl
        string caption
    }
    SERVICE {
        uuid id PK
        string name
        text description
        int durationMinutes
        decimal price
        boolean active
    }
    APPOINTMENT {
        uuid id PK
        uuid professionalId FK
        uuid clientId FK
        uuid serviceId FK
        datetime startAt "UTC"
        datetime endAt "UTC"
        enum status "SCHEDULED|CONFIRMED|COMPLETED|CANCELLED|NO_SHOW"
        enum location "PRESENCIAL|ONLINE"
        enum source "WEB|WHATSAPP|GOOGLE"
        string googleEventId "dedupe de sync"
        string cancelReason
        datetime confirmedAt
        datetime reminded24hAt
        datetime reminded1hAt
    }
    SCHEDULE_BLOCK {
        uuid id PK
        uuid professionalId FK
        datetime startAt
        datetime endAt
        enum type "LUNCH|DAYOFF|HOLIDAY|OTHER"
        string recurrenceRule "RFC5545 RRULE, opcional"
        string reason
    }
    CONVERSATION {
        uuid id PK
        uuid clientId FK
        enum channel "WHATSAPP|INSTAGRAM|SMS"
        string externalId "telefone E.164 ou handle"
        jsonb state "passo atual da máquina de estados"
        datetime lastMessageAt
    }
    MESSAGE {
        uuid id PK
        uuid conversationId FK
        enum direction "IN|OUT"
        enum type "TEXT|IMAGE|TEMPLATE|SYSTEM"
        text content
        string mediaUrl
        string providerMessageId
        enum status "QUEUED|SENT|DELIVERED|READ|FAILED"
    }
    AUDIT_LOG {
        uuid id PK
        uuid userId FK "nulo se automação/sistema"
        string entity
        uuid entityId
        enum action "CREATE|UPDATE|DELETE"
        jsonb before
        jsonb after
        string reason "ex.: 'via whatsapp', 'sync google'"
    }
```

## 2. Decisões de modelagem que importam

- **`Appointment.source`** guarda a origem da escrita (`WEB`, `WHATSAPP`,
  `GOOGLE`). É o que permite ao `CalendarSyncService` saber "esse evento eu
  mesmo criei ao sincronizar do Google, não preciso reenviar pro Google" —
  a peça central que evita o loop de duplicação bidirecional.
- **`Appointment.googleEventId`** é único e indexado; é a chave de
  deduplicação entre CRM e Google Calendar nos dois sentidos.
- **Constraint de não-sobreposição**: além da checagem em `AppointmentsService`,
  o banco tem uma `EXCLUDE USING gist` sobre
  `(professionalId, tsrange(startAt, endAt))` para `status NOT IN
  ('CANCELLED')`, garantindo no nível de dados que dois agendamentos ativos
  do mesmo profissional nunca se sobrepõem, mesmo sob concorrência.
- **`Client.noShowScore`** é um `float` recalculado por um job (não uma
  coluna computada), alimentado por: nº de no-shows / nº total de
  agendamentos, atraso médio de confirmação, cancelamentos em cima da hora.
  Ver `04-plano-implementacao.md` (Fase 2) para a fórmula completa.
- **`Conversation.state`** é `jsonb` livre porque a máquina de estados da
  conversa de WhatsApp (Fase 1: regras determinísticas; Fase 2: IA) muda de
  forma mais rápida que o schema relacional deveria mudar — o "formato" do
  estado é responsabilidade do `whatsapp` module, não do banco.
- **`ClientMedia.appointmentId`** é opcional: uma foto pode ter sido enviada
  fora de um atendimento específico (ex.: cliente manda referência de look
  fora de horário marcado) e ainda assim cair na ficha dela.
- **Tokens do Google (`accessToken`/`refreshToken`) são armazenados
  criptografados em repouso** (AES-256-GCM, chave fora do banco, em variável
  de ambiente/secret manager) — nunca em texto puro, mesmo dentro do próprio
  Postgres.
- **`AuditLog` é append-only** (sem update/delete permitidos pela aplicação),
  cobrindo todas as mutações de `Appointment`, `Client`, `User`.

## 3. O que fica para fases futuras (não está no schema do MVP)

- `AutomationRule` (trigger → condições → ações, no-code): tabela dedicada
  quando o construtor visual de automações for implementado (Fase 3).
- `RevenueForecast`/materialized views para relatórios preditivos mais
  sofisticados (Fase 3) — o MVP calcula projeção simples on-the-fly a partir
  de `Appointment` + `Service.price`.
- Suporte a múltiplos canais (`Conversation.channel` já prevê `INSTAGRAM` e
  `SMS`, mas só `WHATSAPP` tem provider implementado no MVP).
