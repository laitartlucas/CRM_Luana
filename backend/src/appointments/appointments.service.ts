import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentStatus, ScheduleBlockType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { APPOINTMENT_EVENTS } from './appointment.events';
import { BUSINESS_HOURS } from './business-hours.const';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
];

const SLOT_STEP_MINUTES = 30;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(params: { professionalId?: string; from?: Date; to?: Date; clientId?: string }) {
    return this.prisma.appointment.findMany({
      where: {
        professionalId: params.professionalId,
        clientId: params.clientId,
        startAt: params.from || params.to ? { gte: params.from, lte: params.to } : undefined,
      },
      include: {
        client: { select: { id: true, name: true, phoneE164: true, noShowScore: true } },
        service: true,
        professional: { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findById(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { client: true, service: true, professional: true },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');
    return appointment;
  }

  /** Checa conflito contra outros agendamentos ativos e bloqueios do profissional. */
  private async assertNoConflict(params: {
    professionalId: string;
    startAt: Date;
    endAt: Date;
    excludeAppointmentId?: string;
  }) {
    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        professionalId: params.professionalId,
        status: { in: ACTIVE_STATUSES },
        id: params.excludeAppointmentId ? { not: params.excludeAppointmentId } : undefined,
        startAt: { lt: params.endAt },
        endAt: { gt: params.startAt },
      },
    });
    if (overlappingAppointment) {
      throw new ConflictException('Já existe um agendamento nesse horário.');
    }

    const overlappingBlock = await this.prisma.scheduleBlock.findFirst({
      where: {
        professionalId: params.professionalId,
        startAt: { lt: params.endAt },
        endAt: { gt: params.startAt },
      },
    });
    if (overlappingBlock) {
      throw new ConflictException('Esse horário está bloqueado na agenda do profissional.');
    }
  }

  async create(dto: CreateAppointmentDto) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('Serviço não encontrado.');

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

    await this.assertNoConflict({ professionalId: dto.professionalId, startAt, endAt });

    const appointment = await this.prisma.appointment.create({
      data: {
        professionalId: dto.professionalId,
        clientId: dto.clientId,
        serviceId: dto.serviceId,
        startAt,
        endAt,
        location: dto.location,
        source: dto.source ?? 'WEB',
        notes: dto.notes,
      },
      include: { client: true, service: true, professional: true },
    });

    this.events.emit(APPOINTMENT_EVENTS.CREATED, { appointment });
    return appointment;
  }

  async reschedule(id: string, newStartAt: Date) {
    const previous = await this.findById(id);
    const durationMs = previous.endAt.getTime() - previous.startAt.getTime();
    const endAt = new Date(newStartAt.getTime() + durationMs);

    await this.assertNoConflict({
      professionalId: previous.professionalId,
      startAt: newStartAt,
      endAt,
      excludeAppointmentId: id,
    });

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { startAt: newStartAt, endAt, status: AppointmentStatus.SCHEDULED, confirmedAt: null },
      include: { client: true, service: true, professional: true },
    });

    this.events.emit(APPOINTMENT_EVENTS.RESCHEDULED, { appointment, previous });
    return appointment;
  }

  async cancel(id: string, reason?: string) {
    const previous = await this.findById(id);
    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
      include: { client: true, service: true, professional: true },
    });
    this.events.emit(APPOINTMENT_EVENTS.CANCELLED, { appointment, previous, reason });
    return appointment;
  }

  async confirm(id: string) {
    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED, confirmedAt: new Date() },
      include: { client: true, service: true, professional: true },
    });
    this.events.emit(APPOINTMENT_EVENTS.CONFIRMED, { appointment });
    return appointment;
  }

  async complete(id: string) {
    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.COMPLETED },
      include: { client: true, service: true, professional: true },
    });
    this.events.emit(APPOINTMENT_EVENTS.COMPLETED, { appointment });
    return appointment;
  }

  async markNoShow(id: string) {
    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.NO_SHOW },
      include: { client: true, service: true, professional: true },
    });
    this.events.emit(APPOINTMENT_EVENTS.NO_SHOW, { appointment });
    return appointment;
  }

  // ---------------------------------------------------------------------
  // Bloqueios de horário
  // ---------------------------------------------------------------------

  async listBlocks(professionalId: string, from?: Date, to?: Date) {
    return this.prisma.scheduleBlock.findMany({
      where: {
        professionalId,
        startAt: from || to ? { gte: from, lte: to } : undefined,
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async createBlock(dto: CreateBlockDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) {
      throw new BadRequestException('Horário final do bloqueio deve ser depois do inicial.');
    }
    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        professionalId: dto.professionalId,
        status: { in: ACTIVE_STATUSES },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlapping) {
      throw new ConflictException('Já existe um agendamento ativo nesse intervalo — cancele ou remarque antes de bloquear.');
    }
    return this.prisma.scheduleBlock.create({
      data: { ...dto, startAt, endAt },
    });
  }

  async deleteBlock(id: string) {
    const block = await this.prisma.scheduleBlock.findUnique({ where: { id } });
    if (!block) throw new NotFoundException('Bloqueio não encontrado.');
    await this.prisma.scheduleBlock.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Disponibilidade — usado pela UI web e pelo motor de conversa do WhatsApp
  // ---------------------------------------------------------------------

  /**
   * Retorna até `limit` horários livres para o serviço/profissional dados,
   * a partir de `from`, respeitando horário comercial, bloqueios e
   * agendamentos já existentes. Algoritmo: para cada dia no intervalo,
   * calcula os "buracos" livres dentro do horário comercial e desliza uma
   * janela do tamanho da duração do serviço a cada 30 minutos.
   */
  async findAvailableSlots(params: {
    professionalId: string;
    serviceId: string;
    from: Date;
    daysAhead?: number;
    limit?: number;
  }) {
    const service = await this.prisma.service.findUnique({ where: { id: params.serviceId } });
    if (!service) throw new NotFoundException('Serviço não encontrado.');

    const daysAhead = params.daysAhead ?? 14;
    const limit = params.limit ?? 5;
    const rangeStart = new Date(params.from);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + daysAhead);

    const [appointments, blocks] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          professionalId: params.professionalId,
          status: { in: ACTIVE_STATUSES },
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
        },
        select: { startAt: true, endAt: true },
      }),
      this.prisma.scheduleBlock.findMany({
        where: {
          professionalId: params.professionalId,
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
        },
        select: { startAt: true, endAt: true, type: true },
      }),
    ]);

    const busy = [...appointments, ...blocks].map((b) => ({
      start: b.startAt.getTime(),
      end: b.endAt.getTime(),
    }));

    const slots: Date[] = [];
    const durationMs = service.durationMinutes * 60_000;
    const stepMs = SLOT_STEP_MINUTES * 60_000;

    for (let day = 0; day < daysAhead && slots.length < limit; day++) {
      const dayStart = new Date(rangeStart);
      dayStart.setDate(dayStart.getDate() + day);
      dayStart.setHours(BUSINESS_HOURS.startHour, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(BUSINESS_HOURS.endHour, 0, 0, 0);

      const isFullDayBlocked = blocks.some(
        (b) =>
          (b.type === ScheduleBlockType.DAY_OFF || b.type === ScheduleBlockType.HOLIDAY) &&
          b.startAt <= dayStart &&
          b.endAt >= dayEnd,
      );
      if (isFullDayBlocked) continue;

      for (
        let candidate = dayStart.getTime();
        candidate + durationMs <= dayEnd.getTime() && slots.length < limit;
        candidate += stepMs
      ) {
        if (candidate < Math.max(rangeStart.getTime(), Date.now())) continue;
        const candidateEnd = candidate + durationMs;
        const conflicts = busy.some((b) => candidate < b.end && candidateEnd > b.start);
        if (!conflicts) {
          slots.push(new Date(candidate));
        }
      }
    }

    return slots;
  }
}
