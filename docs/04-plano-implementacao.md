# Plano de Implementação — MVP → Avançado

Contexto assumido (confirmado com o cliente do projeto): 1 consultora
principal + eventual equipe de apoio, ~60 atendimentos/mês, sem conta Meta
WhatsApp Cloud API nem projeto Google Cloud ainda configurados. Por isso o
plano é desenhado para que **o Fase 1 rode e seja testável de ponta a ponta
sem depender de aprovação do Meta Business Manager**, usando um
`MockWhatsappProvider` que se comporta como o real (mesma interface, mesmo
fluxo de conversa, só troca o transporte).

## Fase 0 — Pré-requisitos externos (não é código, é conta/cadastro)

Isso não bloqueia o desenvolvimento, mas bloqueia o "ao vivo com clientes
reais". Pode rodar em paralelo à Fase 1:

1. Criar projeto no Google Cloud Console, ativar Google Calendar API, criar
   credenciais OAuth2 (client id/secret), configurar tela de consentimento.
   Leva minutos, sem verificação necessária para uso com contas de teste.
2. Criar conta Meta Business, verificar o negócio, registrar número de
   telefone no WhatsApp Cloud API, criar templates de mensagem (lembrete,
   confirmação) para aprovação da Meta — **isso costuma levar de alguns dias
   a 1-2 semanas** pela revisão de templates, então deve ser iniciado o
   quanto antes. Importante: a Cloud API exige migrar o número pra fora do
   WhatsApp normal/Business App do celular — não dá pra usar o mesmo número
   nos dois ao mesmo tempo.
   - **Alternativa adotada neste projeto**: `WHATSAPP_PROVIDER=evolution`
     (Evolution API, self-hosted, protocolo WhatsApp Web/Baileys, conexão por
     QR Code) permite manter o número já usado no celular, sem esperar
     aprovação da Meta. Não é o transporte oficial — fora dos Termos de Uso
     do WhatsApp, risco baixo mas real de banimento do número; decisão
     consciente do negócio, documentada em `README.md`. `MetaWhatsappProvider`
     continua implementado e pronto caso decidam migrar para o caminho
     oficial no futuro (provider pattern, ver `docs/01-arquitetura.md` §1.3).

## Fase 1 — MVP (entregue nesta etapa)

Objetivo: sistema utilizável no dia a dia da consultora, rodando localmente
via Docker, com WhatsApp em modo mock (pronto para trocar para o real assim
que a Fase 0.2 for aprovada) e Google Calendar real (só precisa das
credenciais da Fase 0.1).

- [x] Autenticação (e-mail/senha + login Google), papéis admin/gestor/atendente.
- [x] Cadastro de clientes com ficha de estilo completa + consentimento LGPD.
- [x] Catálogo de serviços (duração/preço).
- [x] Agenda: CRUD de agendamentos, bloqueios de horário, detecção de
      conflito, visão dia/semana/mês (FullCalendar).
- [x] Sincronização bidirecional com Google Calendar (OAuth por profissional,
      criação/edição/exclusão espelhada, webhook de push notification,
      lógica anti-duplicação).
- [x] Agendamento via WhatsApp: fluxo determinístico completo (agendar,
      remarcar, cancelar, confirmar), motor de conversa + provider Meta Cloud
      API real e `MockWhatsappProvider` para desenvolvimento/demo.
- [x] Lembretes automáticos 24h/1h antes via fila BullMQ.
- [x] Mídia recebida por WhatsApp (fotos/looks) salva automaticamente na
      ficha do cliente.
- [x] Dashboard: agendamentos do dia, taxa de confirmação, taxa de no-show,
      ocupação por profissional.
- [x] Log de auditoria de alterações de agenda/clientes.
- [x] Isolamento de falha: WhatsApp/Google rodam atrás de provider pattern +
      fila; indisponibilidade de qualquer um dos dois não derruba login,
      agenda nem ficha de clientes.

Critério de pronto da Fase 1: a consultora consegue, sozinha, cadastrar
clientes, configurar o catálogo, ver sua agenda, e simular (via
`MockWhatsappProvider`, com uma tela de "simulador de conversa" no admin ou
via `curl`/Postman documentado no README) o fluxo completo de agendamento
por WhatsApp de ponta a ponta.

## Fase 2 — Diferenciais de retenção e inteligência (próxima etapa sugerida)

Pré-requisito: Fase 1 estável em produção com dados reais de pelo menos
4-6 semanas (o score de no-show e a otimização de agenda precisam de
histórico para não serem só ruído).

1. **Assistente de agendamento por IA no WhatsApp**: camada de NLU (LLM) na
   frente do motor de conversa da Fase 1 (linguagem natural → intenção +
   slots), mantendo o motor de estados como está.
2. **Score de previsão de no-show**: job periódico calculando
   `noShowScore` por cliente a partir de: % de no-show histórico, atraso
   médio para confirmar lembrete, cancelamentos em cima da hora (<12h). Usado
   para: priorizar lembrete extra (ex.: ligação em vez de só mensagem) para
   clientes de score alto, e para overbooking controlado em horários de
   risco (opcional, configurável).
3. **Reengajamento automático de no-show**: fluxo disparado quando
   `status=NO_SHOW`, com mensagem + sugestão de novo horário, medindo taxa
   de recuperação.
4. **Follow-up de estilo pós-atendimento**: N dias após `COMPLETED`
   (configurável por serviço), pergunta como foi a experiência com os looks
   sugeridos; resposta vira nota na ficha do cliente.
5. **Otimização automática de agenda**: sugestão (não aplicação automática)
   de reorganização de horários vagos, oferecida à consultora no dashboard.
6. **Relatórios preditivos**: projeção de faturamento com base em agenda +
   ticket médio por serviço + taxa histórica de confirmação/no-show.

## Fase 3 — Escala e configurabilidade

1. **Fluxos de automação configuráveis sem código**: construtor visual
   (trigger → condição → ação) sobre uma nova tabela `AutomationRule`,
   reaproveitando os mesmos jobs de fila já existentes como "ações"
   disponíveis.
2. **Multicanal unificado** (Instagram Direct/SMS) na mesma central de
   conversas — o modelo de dados (`Conversation.channel`) já foi desenhado
   para isso desde a Fase 1; falta implementar os providers.
3. **Sugestão de reagendamento sazonal**: identifica clientes "no tempo" de
   nova sessão (virada de estação, aniversário de atendimento recorrente).
4. **Multi-tenant**: caso o negócio cresça para múltiplas unidades/marcas
   usando o mesmo sistema, introduzir `Organization` como escopo de todas as
   entidades (hoje o schema já isola tudo por `professionalId`/`userId`, o
   que facilita essa migração).

## Estimativa de esforço (ordem de grandeza, não é orçamento fechado)

| Fase | Esforço aproximado |
|---|---|
| Fase 1 (MVP) | 4–6 semanas de 1 desenvolvedor full-stack em ritmo normal (esta etapa entrega o código; falta testes de carga/produção e ajuste fino com uso real) |
| Fase 2 | 3–4 semanas |
| Fase 3 | 4–6 semanas, dependendo do escopo do construtor de automações |
