import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Audit } from '../common/decorators/audit.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateBlockDto } from './dto/create-block.dto';

@UseGuards(RolesGuard)
@Controller()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('appointments')
  list(
    @Query('professionalId') professionalId?: string,
    @Query('clientId') clientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointmentsService.list({
      professionalId,
      clientId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('appointments/available-slots')
  availableSlots(
    @Query('professionalId') professionalId: string,
    @Query('serviceId') serviceId: string,
    @Query('from') from?: string,
    @Query('daysAhead') daysAhead?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appointmentsService.findAvailableSlots({
      professionalId,
      serviceId,
      from: from ? new Date(from) : new Date(),
      daysAhead: daysAhead ? Number(daysAhead) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('appointments/:id')
  findById(@Param('id') id: string) {
    return this.appointmentsService.findById(id);
  }

  @Audit('appointment')
  @Post('appointments')
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }

  @Audit('appointment')
  @Patch('appointments/:id/reschedule')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(id, new Date(dto.startAt));
  }

  @Audit('appointment')
  @Patch('appointments/:id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    return this.appointmentsService.cancel(id, dto.reason);
  }

  @Audit('appointment')
  @Patch('appointments/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.appointmentsService.confirm(id);
  }

  @Audit('appointment')
  @Patch('appointments/:id/complete')
  complete(@Param('id') id: string) {
    return this.appointmentsService.complete(id);
  }

  @Audit('appointment')
  @Patch('appointments/:id/no-show')
  markNoShow(@Param('id') id: string) {
    return this.appointmentsService.markNoShow(id);
  }

  @Get('schedule-blocks')
  listBlocks(
    @Query('professionalId') professionalId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointmentsService.listBlocks(
      professionalId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Audit('scheduleBlock')
  @Post('schedule-blocks')
  createBlock(@Body() dto: CreateBlockDto) {
    return this.appointmentsService.createBlock(dto);
  }

  @Audit('scheduleBlock')
  @Delete('schedule-blocks/:id')
  deleteBlock(@Param('id') id: string) {
    return this.appointmentsService.deleteBlock(id);
  }
}
