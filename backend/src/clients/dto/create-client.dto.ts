import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  name!: string;

  @IsPhoneNumber(undefined, { message: 'Telefone deve estar em formato internacional, ex.: +5511999999999' })
  phoneE164!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsString()
  bodyType?: string;

  @IsOptional()
  @IsString()
  colorPalette?: string;

  @IsOptional()
  @IsString()
  predominantStyle?: string;

  @IsOptional()
  @IsNumber()
  averageBudget?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredBrands?: string[];

  @IsOptional()
  @IsString()
  restrictions?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  whatsappConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
