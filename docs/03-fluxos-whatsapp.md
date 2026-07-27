# Fluxos de Conversa no WhatsApp

O motor de conversa (`whatsapp/conversation-engine`) é uma máquina de
estados determinística no MVP (Fase 1). Cada `Conversation.state` guarda o
passo atual + dados coletados até ali. Na Fase 2, uma camada de NLU (via LLM)
é adicionada **na frente** dessa mesma máquina: em vez de exigir que o
cliente digite "1", "2", "3", o LLM extrai a intenção e os slots (serviço,
data/hora preferida, se é remarcação de qual agendamento) e alimenta os
mesmos estados — o motor de baixo nível não muda, só ganha um parser melhor
na entrada. Isso é o que torna o "assistente de IA no WhatsApp" seguro de
implementar depois: a lógica de negócio (checar conflito, confirmar,
cancelar) já está testada e estável antes de existir qualquer IA no meio.

Todas as respostas do bot citam handles curtos (`1`, `2`, "sim", "outro
horário") para o MVP funcionar 100% por regras, sem depender de LLM
desde o dia 1.

## 1. Roteamento inicial de qualquer mensagem recebida

```mermaid
flowchart TD
    IN["Mensagem recebida via webhook Meta"] --> LOOKUP{"Telefone já é\num Client cadastrado?"}
    LOOKUP -- não --> ONBOARD["Fluxo de boas-vindas:\npede nome, confirma LGPD\n(consentimento WhatsApp)"]
    ONBOARD --> CREATECLIENT["Cria Client com whatsappConsent=true"]
    CREATECLIENT --> MENU
    LOOKUP -- sim --> STATE{"Conversation.state.step"}
    STATE -- "IDLE / sem contexto" --> MENU["Menu principal:\n1) Agendar\n2) Remarcar\n3) Cancelar\n4) Falar com a consultora"]
    STATE -- "em outro fluxo (agendando etc.)" --> RESUME["Retoma o passo salvo em state"]
```

- Se a mensagem contiver mídia (foto) e não houver comando explícito de
  agendamento em andamento, ela é salva direto em `ClientMedia` associada ao
  cliente (e ao agendamento mais recente, se houver um em andamento) e o bot
  responde confirmando o recebimento — sem precisar de nenhum passo extra.
- Qualquer mensagem fora do fluxo esperado (bot não entendeu) cai em
  `Falar com a consultora`, que marca a conversa como `precisa_humano=true`
  e notifica o profissional — nunca deixa o cliente "preso" num loop de bot.

## 2. Fluxo: Agendar

```mermaid
stateDiagram-v2
    [*] --> EscolherServico: cliente escolhe "1) Agendar"
    EscolherServico --> EscolherModalidade: lista catálogo ativo (nome + duração + preço)
    EscolherModalidade --> SugerirHorarios: presencial ou online
    SugerirHorarios --> AguardandoEscolha: bot consulta AppointmentsService.\nfindAvailableSlots() e mostra 3 opções\nmais próximas + "outro dia"
    AguardandoEscolha --> Confirmando: cliente escolhe um horário
    AguardandoEscolha --> SugerirHorarios: cliente pede "outro dia"
    Confirmando --> Criado: cliente confirma "sim"
    Confirmando --> AguardandoEscolha: cliente diz "não"
    Criado --> [*]: AppointmentsService.create()\n(source=WHATSAPP) dispara:\n- sync Google (fila)\n- agendamento dos lembretes 24h/1h (fila)\n- mensagem de confirmação com resumo
```

Regras de negócio aplicadas nesse fluxo (no `AppointmentsService`, não no
bot — o bot só chama o serviço):

- Horários sugeridos nunca colidem com `ScheduleBlock` (almoço, folga,
  feriado) nem com outro `Appointment` ativo do profissional.
- Se o cliente pedir um horário específico ("amanhã às 15h") e ele estiver
  ocupado, o bot já responde com as alternativas mais próximas em vez de só
  dizer "indisponível".
- Todo agendamento criado por esse fluxo nasce com `status=SCHEDULED` e
  `source=WHATSAPP`.

## 3. Fluxo: Confirmar (lembrete automático)

```mermaid
sequenceDiagram
    participant Q as Fila (BullMQ)
    participant WA as WhatsappProvider
    participant Cliente
    participant API as AppointmentsService

    Note over Q: job disparado 24h antes\n(e outro 1h antes) do startAt
    Q->>WA: enviar template "Lembrete: confirma seu horário de {serviço}\nem {data/hora}?\n1) Confirmar 2) Remarcar"
    WA->>Cliente: mensagem
    Cliente-->>WA: "1" ou "confirmar"
    WA-->>API: webhook inbound
    API->>API: appointment.status = CONFIRMED,\nconfirmedAt = now()
    API-->>Cliente: "Confirmado! Te espero em {endereço/link}."

    Cliente-->>WA: "2" ou "remarcar"
    WA-->>API: webhook inbound
    API->>API: inicia fluxo de Remarcar\n(reaproveita o appointment atual)
```

- Se não houver resposta ao lembrete de 1h, o agendamento segue
  `SCHEDULED` (não vira automaticamente `NO_SHOW` — isso só é decidido após
  o horário passar, ver fluxo de No-show em `04-plano-implementacao.md` /
  Fase 2, "score de no-show").
- Falha de envio do lembrete (Meta API fora do ar) não cancela nem altera o
  agendamento: o job vai para retry com backoff exponencial (BullMQ) e, após
  esgotar as tentativas, gera uma notificação interna para a consultora
  confirmar manualmente.

## 4. Fluxo: Remarcar

```mermaid
stateDiagram-v2
    [*] --> IdentificarAgendamento: cliente escolhe "2) Remarcar"\n(ou vem do fluxo de confirmação)
    IdentificarAgendamento --> ListarProximos: busca Appointments futuros\nstatus IN (SCHEDULED, CONFIRMED)\ndo Client
    ListarProximos --> SemAgendamento: nenhum encontrado
    SemAgendamento --> [*]: oferece iniciar fluxo de Agendar
    ListarProximos --> EscolherQual: 1 ou mais encontrados\n(se só 1, pula direto)
    EscolherQual --> SugerirNovosHorarios: mesmo motor de\ndisponibilidade do fluxo Agendar
    SugerirNovosHorarios --> ConfirmandoRemarcacao: cliente escolhe novo horário
    ConfirmandoRemarcacao --> Remarcado: confirma
    Remarcado --> [*]: AppointmentsService.reschedule()\n- atualiza startAt/endAt (mesmo id)\n- refaz sync Google (update, não create)\n- reagenda lembretes 24h/1h\n- log de auditoria com reason="remarcado via whatsapp"
```

`reschedule()` **não** cria um novo `Appointment` — atualiza o existente, o
que preserva o `googleEventId` (edita o evento no Google em vez de duplicar)
e o histórico de auditoria.

## 5. Fluxo: Cancelar

```mermaid
stateDiagram-v2
    [*] --> IdentificarAgendamento: cliente escolhe "3) Cancelar"
    IdentificarAgendamento --> EscolherQual: mesmo lookup do fluxo Remarcar
    EscolherQual --> PedirMotivo: opcional — "por que está cancelando?"\n(usado depois no reengajamento)
    PedirMotivo --> Cancelado: AppointmentsService.cancel()
    Cancelado --> [*]: - status = CANCELLED, cancelReason salvo\n- remove evento do Google (fila)\n- cancela jobs de lembrete pendentes\n- oferece: "quer já deixar outro horário marcado?"
```

- Cancelamento feito com menos de X horas de antecedência (configurável,
  default 12h) é sinalizado (`lateCancel=true` no log de auditoria) e conta
  para o score de no-show do cliente (Fase 2).

## 6. Robustez do motor de conversa

- **Timeout de contexto**: se o cliente some no meio de um fluxo (ex.: parou
  em "escolha um horário") por mais de 30 minutos, o próximo contato dele
  reinicia no menu principal em vez de tentar retomar um contexto morto.
- **Concorrência**: se a consultora alterar o mesmo agendamento pela web
  exatamente enquanto o cliente está remarcando pelo WhatsApp, o
  `AppointmentsService` é a única porta de escrita (ver `01-arquitetura.md`
  §1.2) e usa a constraint de banco como árbitro final — quem chegar depois
  recebe erro de conflito e o bot informa "esse horário acabou de ser
  ocupado, escolha outro" em vez de sobrescrever silenciosamente.
- **Idempotência de webhook**: a Meta pode reentregar o mesmo evento; cada
  mensagem inbound é deduplicada por `providerMessageId` antes de avançar a
  máquina de estados.
- **Opt-out**: cliente pode digitar "sair"/"parar" a qualquer momento, o que
  marca `marketingConsent=false` (lembretes transacionais de agendamentos
  que ela mesma já marcou continuam, pois são a própria prestação do
  serviço, não marketing — distinção que a LGPD faz).
