import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BUSINESS_HOURS } from '../appointments/business-hours.const';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getToday(professionalId?: string) {
    const from = startOfDay(new Date());
    const to = endOfDay(new Date());
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

  async getKpis(params: { professionalId?: string; from: Date; to: Date }) {
    const { professionalId, from, to } = params;

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
