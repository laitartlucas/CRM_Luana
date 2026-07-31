import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { BUSINESS_HOURS } from '../appointments/business-hours.const';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** "Hoje"/"este mês" precisam ser calculados na hora de parede do fuso do
   *  profissional — em UTC, o dia viraria horas antes/depois do real. */
  private async resolveTimezone(professionalId?: string): Promise<string> {
    const user = professionalId
      ? await this.prisma.user.findUnique({ where: { id: professionalId }, select: { timezone: true } })
      : await this.prisma.user.findFirst({ select: { timezone: true } });
    return user?.timezone ?? 'America/Sao_Paulo';
  }

  async getToday(professionalId?: string) {
    const tz = await this.resolveTimezone(professionalId);
    const zonedNow = toZonedTime(new Date(), tz);
    const y = zonedNow.getFullYear();
    const m = zonedNow.getMonth();
    const d = zonedNow.getDate();
    const from = fromZonedTime(new Date(y, m, d, 0, 0, 0, 0), tz);
    const to = fromZonedTime(new Date(y, m, d, 23, 59, 59, 999), tz);
    return this.prisma.appointment.findMany({
      where: {
        professionalId,
        startAt: { gte: from, lte: to },
        status: { not: AppointmentStatus.CANCELLED },
      },
      include: { client: true, service: true, professional: { select: { id: true, name: true } } },
      orderBy: { startAt: 'asc' },
    });
  }

  async getKpis(params: { professionalId?: string; from?: Date; to?: Date }) {
    const { professionalId } = params;
    const tz = await this.resolveTimezone(professionalId);

    let { from, to } = params;
    if (!from || !to) {
      const zonedNow = toZonedTime(new Date(), tz);
      const y = zonedNow.getFullYear();
      const m = zonedNow.getMonth();
      from ??= fromZonedTime(new Date(y, m, 1, 0, 0, 0, 0), tz);
      to ??= fromZonedTime(new Date(y, m + 1, 0, 23, 59, 59, 999), tz);
    }

    const appointments = await this.prisma.appointment.findMany({
      where: { professionalId, startAt: { gte: from, lte: to } },
      include: { service: true },
    });

    const nonCancelled = appointments.filter((a) => a.status !== AppointmentStatus.CANCELLED);
    const total = nonCancelled.length;
    const confirmedOrCompleted = nonCancelled.filter((a) =>
      ([AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] as AppointmentStatus[]).includes(a.status),
    ).length;
    const noShows = nonCancelled.filter((a) => a.status === AppointmentStatus.NO_SHOW).length;

    const bookedMinutes = nonCancelled.reduce(
      (sum, a) => sum + (a.endAt.getTime() - a.startAt.getTime()) / 60_000,
      0,
    );

    const blocks = await this.prisma.scheduleBlock.findMany({
      where: { professionalId, startAt: { gte: from, lte: to } },
    });
    const blockedMinutes = blocks.reduce((sum, b) => sum + (b.endAt.getTime() - b.startAt.getTime()) / 60_000, 0);

    const businessMinutesPerDay = (BUSINESS_HOURS.endHour - BUSINESS_HOURS.startHour) * 60;
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    const availableMinutes = Math.max(1, businessMinutesPerDay * days - blockedMinutes);

    const futureAppointments = nonCancelled.filter(
      (a) => a.startAt > new Date() && a.status !== AppointmentStatus.NO_SHOW,
    );
    const revenueProjection = futureAppointments.reduce((sum, a) => sum + Number(a.service.price), 0);
    const revenueRealized = nonCancelled
      .filter((a) => a.status === AppointmentStatus.COMPLETED)
      .reduce((sum, a) => sum + Number(a.service.price), 0);

    return {
      totalAppointments: total,
      confirmationRate: total ? confirmedOrCompleted / total : 0,
      noShowRate: total ? noShows / total : 0,
      occupancyRate: Math.min(1, bookedMinutes / availableMinutes),
      revenueProjection,
      revenueRealized,
    };
  }
}
