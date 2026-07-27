import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ClientMediaType } from '@prisma/client';

export class AddMediaDto {
  @IsOptional()
  @IsEnum(ClientMediaType)
  type?: ClientMediaType;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;
}
