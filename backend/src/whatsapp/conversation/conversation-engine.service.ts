import { Injectable, Logger } from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientsService } from '../../clients/clients.service';
import { CatalogService } from '../../catalog/catalog.service';
import { AppointmentsService } from '../../appointments/appointments.service';
import { UsersService } from '../../users/users.service';
import { WhatsappOutboundService } from '../whatsapp-outbound.service';
import {
  ConversationState,
  ConversationStep,
  freshState,
} from './conversation.types';

interface IncomingMessage {
  phoneE164: string;
  profileName?: string;
  providerMessageId: string;
  text?: string;
  mediaSavedUrl?: string; // já baixada e salva em disco pelo controller, se houver
}

// Lista de opções do menu, reaproveitada nos três textos abaixo — a saudação
// completa (WELCOME_MENU_TEXT) só deve ser usada no primeiro contato ou no
// retorno após >24h de inatividade (ver regra em isStale/handleIncoming).
// Fora isso, uma escolha não reconhecida NUNCA deve reenviar a saudação —
// só a lista de opções, com um pedido de esclarecimento (MENU_CLARIFICATION_TEXT)
// ou, quando pedido explicitamente ("menu"/"voltar"/"início"), o BACK_TO_MENU_TEXT.
const MENU_OPTIONS_TEXT = `1️⃣ Falar com a Luana
Atendimento, suporte e dúvidas.

2️⃣ Conhecer o Método Look Pronto
Descubra como a mentoria pode transformar a forma como você se veste e se posiciona.

3️⃣ Conhecer a Comunidade Look Pronto
Veja como funciona e faça parte dela gratuitamente.

4️⃣ Outro assunto
Escreva sua mensagem e retornaremos o mais breve possível.

5️⃣ Voltar ao menu inicial
Digite a qualquer momento para reiniciar o atendimento.`;

const WELCOME_MENU_TEXT = `Olá! Seja muito bem-vinda ao canal oficial da Luana, Consultora de Imagem e Estilo. 🤎

Para direcionar você da melhor forma, responda com o número da opção desejada:

${MENU_OPTIONS_TEXT}`;

const MENU_CLARIFICATION_TEXT = `Não entendi muito bem 🤔 Pode responder só com o número de uma das opções abaixo?

${MENU_OPTIONS_TEXT}`;

const BACK_TO_MENU_TEXT = `Claro! Voltando ao menu principal:

${MENU_OPTIONS_TEXT}`;

const TALK_TO_LUANA_TEXT = `Que bom ter você por aqui!

Para que eu possa entender melhor como te ajudar, me conte brevemente qual é o motivo do seu contato. Assim que eu estiver disponível, responderei você com toda atenção.`;

const TALK_TO_LUANA_ACK_TEXT = `Recebido! A Luana já foi avisada e vai te responder por aqui assim que possível. 🤎`;

const METHOD_TEXT = `Fico muito feliz pelo seu interesse no Método Look Pronto!

Antes de te explicar como funciona, quero entender um pouquinho sobre você. Me responda:

* Qual é a sua maior dificuldade hoje em relação à sua imagem?
* Qual a sua profissão?`;

const METHOD_FOLLOWUP_TEXT = `Perfeito, obrigada por compartilhar! 🤎
O Método Look Pronto foi criado exatamente pra ajudar mulheres como você a construir um estilo prático, autêntico e alinhado com quem você é — sem complicação no dia a dia.

A Luana vai entrar em contato em breve pra te contar todos os detalhes e ver o melhor caminho pra você.`;

const COMMUNITY_TEXT = `*Conhecer a Comunidade Look Pronto*
Veja como funciona e faça parte dela gratuitamente.

A comunidade é totalmente gratuita e foi criada para mulheres que desejam aprender a se vestir com mais estratégia, praticidade e confiança. Lá você recebe conteúdos exclusivos, dicas, desafios, materiais e fica por dentro de todas as novidades.

Entre agora pelo link: https://chat.whatsapp.com/GnQ20LTjh1iC6yF0z9HCZO?mode=gi_t

Seja muito bem-vinda, espero você por lá.`;

const OTHER_SUBJECT_TEXT = `Perfeito! Escreva sua mensagem e, assim que possível, retornaremos para ajudar você da melhor forma.`;

const OTHER_SUBJECT_ACK_TEXT = `Recebido! Nossa equipe já foi avisada e vai te responder por aqui assim que possível. 🤎`;

@Injectable()
export class ConversationEngineService {
  private readonly logger = new Logger(ConversationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly catalogService: CatalogService,
    private readonly appointmentsService: AppointmentsService,
    private readonly usersService: UsersService,
    private readonly outbound: WhatsappOutboundService,
  ) {}

  private getDefaultProfessional() {
    return this.usersService.getDefaultProfessional();
  }

  async handleIncoming(msg: IncomingMessage): Promise<void> {
    const alreadyProcessed = await this.prisma.message.findUnique({
      where: { providerMessageId: msg.providerMessageId },
    });
    if (alreadyProcessed) return; // idempotência: Meta pode reentregar o mesmo evento

    const client = await this.clientsService.findOrCreateByPhone(msg.phoneE164, msg.profileName);

    const conversation = await this.prisma.conversation.upsert({
      where: { channel_externalId: { channel: 'WHATSAPP', externalId: msg.phoneE164 } },
      create: { clientId: client.id, channel: 'WHATSAPP', externalId: msg.phoneE164 },
      update: { lastMessageAt: new Date() },
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'IN',
        type: msg.mediaSavedUrl ? 'IMAGE' : 'TEXT',
        content: msg.text,
        mediaUrl: msg.mediaSavedUrl,
        providerMessageId: msg.providerMessageId,
        status: 'DELIVERED',
      },
    });

    if (msg.mediaSavedUrl) {
      await this.clientsService.addMediaFromWhatsapp({
        clientId: client.id,
        storageUrl: msg.mediaSavedUrl,
        caption: msg.text,
      });
      await this.reply(conversation.id, 'Recebi sua imagem e já salvei na sua ficha.');
      if (!msg.text) return; // só a foto, sem instrução de texto — não avança o fluxo
    }

    const text = (msg.text ?? '').trim();
    const { state: parsedState, isNew } = this.parseState(conversation.state as any);
    let state = parsedState;

    // "Saudar" (WELCOME_MENU_TEXT completo) só no primeiro contato ou quando
    // a conversa esfriou (isStale) e a pessoa volta a escrever — regra 1.
    // Se já está no menu por ter concluído um fluxo (ex: Comunidade), uma
    // escolha não reconhecida recebe só um pedido de esclarecimento, nunca
    // a saudação de novo.
    if (isNew || this.isStale(state)) {
      state = await this.stepMenu(client.id, text, conversation.id, true);
    } else if (state.step === ConversationStep.MENU) {
      state = await this.stepMenu(client.id, text, conversation.id, false);
    } else {
      state = await this.routeStep(client.id, state, text);
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: state as any },
    });
  }

  /**
   * "Parada" não é mais medido em minutos de silêncio — é a virada do dia
   * (fuso do negócio). Se a última interação foi num dia anterior, trata
   * como contato novo e manda o menu de novo; dentro do mesmo dia, continua
   * de onde parou, mesmo que tenham passado várias horas.
   */
  private isStale(state: ConversationState): boolean {
    const tz = 'America/Sao_Paulo';
    const lastDay = formatInTimeZone(new Date(state.updatedAt), tz, 'yyyy-MM-dd');
    const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
    return lastDay !== today;
  }

  private parseState(raw: any): { state: ConversationState; isNew: boolean } {
    if (!raw || !raw.step) return { state: freshState(ConversationStep.MENU), isNew: true };
    return { state: raw as ConversationState, isNew: false };
  }

  private async reply(conversationId: string, text: string) {
    await this.outbound.sendToConversation(conversationId, text);
  }

  /** "5" (opção do menu), "menu", "voltar", "início" — pedido explícito pra sair do fluxo atual e voltar ao menu (regra 2b). */
  private isBackToMenuCommand(text: string): boolean {
    return /^(5|menu|voltar|in[ií]cio)$/i.test(text.trim());
  }

  // ---------------------------------------------------------------------
  // Menu principal — canal oficial (ver docs/03-fluxos-whatsapp.md)
  // ---------------------------------------------------------------------

  private async stepMenu(
    clientId: string,
    text: string,
    conversationIdParam?: string,
    greet = false,
  ): Promise<ConversationState> {
    const conversation =
      conversationIdParam ?? (await this.prisma.conversation.findFirst({ where: { clientId } }))?.id;
    if (!conversation) return freshState(ConversationStep.MENU);

    const choice = text.trim();

    if (choice === '1' || /falar com a luana|atendente|consultora/i.test(choice)) {
      await this.reply(conversation, TALK_TO_LUANA_TEXT);
      return freshState(ConversationStep.TALK_TO_LUANA_AWAIT_MESSAGE);
    }
    if (choice === '2' || /m[ée]todo|look pronto/i.test(choice)) {
      await this.reply(conversation, METHOD_TEXT);
      return freshState(ConversationStep.METHOD_AWAIT_ANSWERS);
    }
    if (choice === '3' || /comunidade/i.test(choice)) {
      await this.reply(conversation, COMMUNITY_TEXT);
      return freshState(ConversationStep.MENU);
    }
    if (choice === '4' || /outro assunto/i.test(choice)) {
      await this.reply(conversation, OTHER_SUBJECT_TEXT);
      return freshState(ConversationStep.OTHER_SUBJECT_AWAIT_MESSAGE);
    }

    // Nenhuma opção reconhecida. Só manda a saudação completa em primeiro
    // contato / retorno após inatividade (greet=true) — regra 1. Se a
    // pessoa já está no menu e pediu explicitamente pra voltar, confirma
    // sem soar como se não tivesse entendido; caso contrário, pede
    // esclarecimento gentil (regra 3), nunca repete a saudação.
    if (greet) {
      await this.reply(conversation, WELCOME_MENU_TEXT);
    } else if (this.isBackToMenuCommand(choice)) {
      await this.reply(conversation, BACK_TO_MENU_TEXT);
    } else {
      await this.reply(conversation, MENU_CLARIFICATION_TEXT);
    }
    return freshState(ConversationStep.MENU);
  }

  /** Marca a conversa como aguardando resposta humana e confirma o recebimento antes de silenciar (regra 4/5/7). */
  private async handoffToHuman(conversationId: string, ackText: string): Promise<ConversationState> {
    await this.reply(conversationId, ackText);
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { needsHuman: true } });
    return freshState(ConversationStep.HUMAN_HANDOFF);
  }

  private async routeStep(clientId: string, state: ConversationState, text: string): Promise<ConversationState> {
    const conversation = await this.prisma.conversation.findFirst({ where: { clientId } });
    if (!conversation) return state;

    // Pedido explícito de voltar ao menu vale em qualquer etapa do fluxo,
    // inclusive durante atendimento humano — regra 2b/4/7.
    if (this.isBackToMenuCommand(text)) {
      await this.reply(conversation.id, BACK_TO_MENU_TEXT);
      return freshState(ConversationStep.MENU);
    }

    switch (state.step) {
      case ConversationStep.TALK_TO_LUANA_AWAIT_MESSAGE:
        // A mensagem (motivo do contato) já foi salva pelo handleIncoming —
        // confirma o recebimento e passa pra atendimento humano (regra 4).
        return this.handoffToHuman(conversation.id, TALK_TO_LUANA_ACK_TEXT);
      case ConversationStep.METHOD_AWAIT_ANSWERS:
        // Reforça o valor do método e dá um próximo passo concreto antes de
        // encaminhar pra Luana — nunca termina em silêncio (regra 5).
        return this.handoffToHuman(conversation.id, METHOD_FOLLOWUP_TEXT);
      case ConversationStep.OTHER_SUBJECT_AWAIT_MESSAGE:
        return this.handoffToHuman(conversation.id, OTHER_SUBJECT_ACK_TEXT);
      case ConversationStep.HUMAN_HANDOFF:
        // A confirmação já foi mandada uma vez ao entrar nesse estado (ver
        // handoffToHuman) — mensagens seguintes só ficam salvas (já feito em
        // handleIncoming), sem responder de novo, pra não repetir o mesmo
        // aviso a cada mensagem enquanto a lead espera atendimento humano.
        return state;
      case ConversationStep.SCHEDULE_CHOOSE_SERVICE:
        return this.scheduleChooseService(conversation.id, state, text);
      case ConversationStep.SCHEDULE_CHOOSE_LOCATION:
        return this.scheduleChooseLocation(conversation.id, state, text);
      case ConversationStep.SCHEDULE_CHOOSE_SLOT:
        return this.scheduleChooseSlot(conversation.id, clientId, state, text);
      case ConversationStep.SCHEDULE_CONFIRM:
        return this.scheduleConfirm(conversation.id, clientId, state, text);
      case ConversationStep.RESCHEDULE_CHOOSE_APPOINTMENT:
        return this.rescheduleChooseAppointment(conversation.id, state, text);
      case ConversationStep.RESCHEDULE_CHOOSE_SLOT:
        return this.rescheduleChooseSlot(conversation.id, state, text);
      case ConversationStep.RESCHEDULE_CONFIRM:
        return this.rescheduleConfirm(conversation.id, state, text);
      case ConversationStep.CANCEL_CHOOSE_APPOINTMENT:
        return this.cancelChooseAppointment(conversation.id, state, text);
      case ConversationStep.CANCEL_ASK_REASON:
        return this.cancelAskReason(conversation.id, state, text);
      default:
        return this.stepMenu(clientId, text, conversation.id);
    }
  }

  // ---------------------------------------------------------------------
  // Fluxo: Agendar
  // ---------------------------------------------------------------------

  private async startSchedule(conversationId: string): Promise<ConversationState> {
    const services = await this.catalogService.list();
    if (services.length === 0) {
      await this.reply(conversationId, 'No momento não há serviços disponíveis para agendamento. Fale com a consultora.');
      return freshState(ConversationStep.MENU);
    }
    const list = services
      .map((s, i) => `${i + 1}) ${s.name} — ${s.durationMinutes}min — R$ ${s.price}`)
      .join('\n');
    await this.reply(conversationId, `*Qual serviço você quer agendar?*\n\n${list}`);
    return freshState(ConversationStep.SCHEDULE_CHOOSE_SERVICE, {
      candidateSlots: services.map((s) => s.id), // reaproveita o campo pra guardar os ids na ordem exibida
    });
  }

  private async scheduleChooseService(conversationId: string, state: ConversationState, text: string) {
    const serviceIds = state.data.candidateSlots ?? [];
    const index = Number(text.trim()) - 1;
    const serviceId = serviceIds[index];
    if (!serviceId) {
      await this.reply(conversationId, 'Escolha um número válido da lista de serviços.');
      return state;
    }
    await this.reply(conversationId, '*É presencial ou online?*\n\n1) Presencial\n2) Online');
    return freshState(ConversationStep.SCHEDULE_CHOOSE_LOCATION, { serviceId });
  }

  private async scheduleChooseLocation(conversationId: string, state: ConversationState, text: string) {
    const location = /2|online/i.test(text.trim()) ? 'ONLINE' : 'PRESENCIAL';
    const professional = await this.getDefaultProfessional();
    return this.offerSlots(conversationId, {
      ...state,
      data: { ...state.data, location, professionalId: professional.id },
    });
  }

  private async offerSlots(conversationId: string, state: ConversationState, from = new Date()): Promise<ConversationState> {
    const { serviceId, professionalId } = state.data;
    if (!serviceId || !professionalId) return freshState(ConversationStep.MENU);

    const slots = await this.appointmentsService.findAvailableSlots({
      professionalId,
      serviceId,
      from,
      limit: 3,
    });

    if (slots.length === 0) {
      await this.reply(conversationId, 'Não encontrei horários livres nos próximos dias. Vou avisar a consultora para te ajudar.');
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { needsHuman: true } });
      return freshState(ConversationStep.MENU);
    }

    const professional = await this.prisma.user.findUnique({ where: { id: professionalId } });
    const tz = professional?.timezone ?? 'America/Sao_Paulo';
    const list = slots
      .map((slot, i) => `${i + 1}) ${formatInTimeZone(slot, tz, "EEEE dd/MM 'às' HH:mm", { locale: ptBR })}`)
      .join('\n');

    await this.reply(
      conversationId,
      `*Horários disponíveis:*\n\n${list}\n\nDigite o número da opção, ou "outro dia" para ver mais datas.`,
    );
    return freshState(ConversationStep.SCHEDULE_CHOOSE_SLOT, {
      ...state.data,
      candidateSlots: slots.map((s) => s.toISOString()),
    });
  }

  private async scheduleChooseSlot(conversationId: string, clientId: string, state: ConversationState, text: string) {
    if (/outro dia/i.test(text)) {
      const lastSlot = state.data.candidateSlots?.[state.data.candidateSlots.length - 1];
      const from = lastSlot ? new Date(new Date(lastSlot).getTime() + 24 * 60 * 60 * 1000) : new Date();
      return this.offerSlots(conversationId, state, from);
    }
    const index = Number(text.trim()) - 1;
    const iso = state.data.candidateSlots?.[index];
    if (!iso) {
      await this.reply(conversationId, 'Escolha um número válido, ou "outro dia".');
      return state;
    }
    const service = await this.catalogService.findById(state.data.serviceId!);
    const professional = await this.prisma.user.findUnique({ where: { id: state.data.professionalId! } });
    const tz = professional?.timezone ?? 'America/Sao_Paulo';
    await this.reply(
      conversationId,
      `*Confirma o agendamento?*\n\n${service.name} — ${formatInTimeZone(new Date(iso), tz, "dd/MM 'às' HH:mm")}\n\n1) Sim\n2) Não`,
    );
    return freshState(ConversationStep.SCHEDULE_CONFIRM, { ...state.data, selectedSlotIso: iso });
  }

  private async scheduleConfirm(conversationId: string, clientId: string, state: ConversationState, text: string) {
    if (!/^1|sim/i.test(text.trim())) {
      return this.offerSlots(conversationId, state);
    }
    try {
      const appointment = await this.appointmentsService.create({
        professionalId: state.data.professionalId!,
        clientId,
        serviceId: state.data.serviceId!,
        startAt: state.data.selectedSlotIso!,
        location: state.data.location,
        source: 'WHATSAPP',
      });
      await this.reply(
        conversationId,
        'Agendado! Te espero. Você vai receber um lembrete antes do horário.',
      );
      this.logger.log(`Agendamento ${appointment.id} criado via WhatsApp para cliente ${clientId}`);
    } catch (err) {
      await this.reply(conversationId, 'Esse horário acabou de ser ocupado. Vamos ver outras opções.');
      return this.offerSlots(conversationId, state);
    }
    return freshState(ConversationStep.MENU);
  }

  // ---------------------------------------------------------------------
  // Fluxo: Remarcar
  // ---------------------------------------------------------------------

  private async findUpcomingAppointments(clientId: string) {
    return this.prisma.appointment.findMany({
      where: { clientId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, startAt: { gte: new Date() } },
      include: { service: true, professional: true },
      orderBy: { startAt: 'asc' },
      take: 5,
    });
  }

  private async startReschedule(clientId: string, conversationId: string): Promise<ConversationState> {
    const appointments = await this.findUpcomingAppointments(clientId);
    if (appointments.length === 0) {
      await this.reply(conversationId, 'Você não tem agendamentos futuros. Quer marcar um novo horário?');
      return this.startSchedule(conversationId);
    }
    const list = appointments
      .map(
        (a, i) =>
          `${i + 1}) ${a.service.name} — ${formatInTimeZone(a.startAt, a.professional.timezone, "dd/MM 'às' HH:mm")}`,
      )
      .join('\n');
    await this.reply(conversationId, `*Qual agendamento você quer remarcar?*\n\n${list}`);
    return freshState(ConversationStep.RESCHEDULE_CHOOSE_APPOINTMENT, {
      candidateAppointmentIds: appointments.map((a) => a.id),
    });
  }

  private async rescheduleChooseAppointment(conversationId: string, state: ConversationState, text: string) {
    const index = Number(text.trim()) - 1;
    const appointmentId = state.data.candidateAppointmentIds?.[index];
    if (!appointmentId) {
      await this.reply(conversationId, 'Escolha um número válido da lista.');
      return state;
    }
    const appointment = await this.appointmentsService.findById(appointmentId);
    return this.offerRescheduleSlots(conversationId, {
      ...state,
      data: {
        targetAppointmentId: appointmentId,
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId,
      },
    });
  }

  private async offerRescheduleSlots(conversationId: string, state: ConversationState, from = new Date()): Promise<ConversationState> {
    const slots = await this.appointmentsService.findAvailableSlots({
      professionalId: state.data.professionalId!,
      serviceId: state.data.serviceId!,
      from,
      limit: 3,
    });
    if (slots.length === 0) {
      await this.reply(conversationId, 'Não encontrei outros horários livres em breve. Vou chamar a consultora para te ajudar.');
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { needsHuman: true } });
      return freshState(ConversationStep.MENU);
    }
    const professional = await this.prisma.user.findUnique({ where: { id: state.data.professionalId! } });
    const tz = professional?.timezone ?? 'America/Sao_Paulo';
    const list = slots.map((s, i) => `${i + 1}) ${formatInTimeZone(s, tz, "dd/MM 'às' HH:mm")}`).join('\n');
    await this.reply(conversationId, `*Novos horários disponíveis:*\n\n${list}`);
    return freshState(ConversationStep.RESCHEDULE_CHOOSE_SLOT, {
      ...state.data,
      candidateSlots: slots.map((s) => s.toISOString()),
    });
  }

  private async rescheduleChooseSlot(conversationId: string, state: ConversationState, text: string) {
    const index = Number(text.trim()) - 1;
    const iso = state.data.candidateSlots?.[index];
    if (!iso) {
      await this.reply(conversationId, 'Escolha um número válido.');
      return state;
    }
    const professional = await this.prisma.user.findUnique({ where: { id: state.data.professionalId! } });
    const tz = professional?.timezone ?? 'America/Sao_Paulo';
    await this.reply(
      conversationId,
      `*Remarcar para ${formatInTimeZone(new Date(iso), tz, "dd/MM 'às' HH:mm")}?*\n\n1) Sim\n2) Não`,
    );
    return freshState(ConversationStep.RESCHEDULE_CONFIRM, { ...state.data, selectedSlotIso: iso });
  }

  private async rescheduleConfirm(conversationId: string, state: ConversationState, text: string) {
    if (!/^1|sim/i.test(text.trim())) {
      return this.offerRescheduleSlots(conversationId, state);
    }
    try {
      await this.appointmentsService.reschedule(state.data.targetAppointmentId!, new Date(state.data.selectedSlotIso!));
      await this.reply(conversationId, 'Prontinho, remarcado!');
    } catch {
      await this.reply(conversationId, 'Esse horário acabou de ser ocupado. Vamos ver outras opções.');
      return this.offerRescheduleSlots(conversationId, state);
    }
    return freshState(ConversationStep.MENU);
  }

  // ---------------------------------------------------------------------
  // Fluxo: Cancelar
  // ---------------------------------------------------------------------

  private async startCancel(clientId: string, conversationId: string): Promise<ConversationState> {
    const appointments = await this.findUpcomingAppointments(clientId);
    if (appointments.length === 0) {
      await this.reply(conversationId, 'Você não tem agendamentos futuros para cancelar.');
      return freshState(ConversationStep.MENU);
    }
    const list = appointments
      .map(
        (a, i) =>
          `${i + 1}) ${a.service.name} — ${formatInTimeZone(a.startAt, a.professional.timezone, "dd/MM 'às' HH:mm")}`,
      )
      .join('\n');
    await this.reply(conversationId, `*Qual agendamento você quer cancelar?*\n\n${list}`);
    return freshState(ConversationStep.CANCEL_CHOOSE_APPOINTMENT, {
      candidateAppointmentIds: appointments.map((a) => a.id),
    });
  }

  private async cancelChooseAppointment(conversationId: string, state: ConversationState, text: string) {
    const index = Number(text.trim()) - 1;
    const appointmentId = state.data.candidateAppointmentIds?.[index];
    if (!appointmentId) {
      await this.reply(conversationId, 'Escolha um número válido da lista.');
      return state;
    }
    await this.reply(conversationId, 'Sem problemas. Pode me dizer rapidinho o motivo? (ou digite "pular")');
    return freshState(ConversationStep.CANCEL_ASK_REASON, { targetAppointmentId: appointmentId });
  }

  private async cancelAskReason(conversationId: string, state: ConversationState, text: string) {
    const reason = /pular/i.test(text.trim()) ? undefined : text.trim();
    await this.appointmentsService.cancel(state.data.targetAppointmentId!, reason);
    await this.reply(
      conversationId,
      'Cancelado.\n\n*Quer já deixar outro horário marcado?*\n\n1) Sim, agendar agora\n2) Não, por enquanto não',
    );
    return freshState(ConversationStep.MENU);
  }
}
