import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentLocation, AppointmentSource } from '@prisma/client';

export class CreateAppointmentDto {
  @IsString()
  professionalId!: string;

  @IsString()
  clientId!: string;

  @IsString()
  serviceId!: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsEnum(AppointmentLocation)
  location?: AppointmentLocation;

  @IsOptional()
  @IsEnum(AppointmentSource)
  source?: AppointmentSource;

  @IsOptional()
  @IsString()
  notes?: string;
}
