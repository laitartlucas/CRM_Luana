import { IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class SimulateInboundDto {
  @IsPhoneNumber()
  phoneE164!: string;

  @IsOptional()
  @IsString()
  text?: string;
}
