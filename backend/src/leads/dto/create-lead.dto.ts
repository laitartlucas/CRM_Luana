import { IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, ValidateIf } from 'class-validator';
import { LeadSource } from '@prisma/client';

const CONTENT_SOURCES: LeadSource[] = [LeadSource.REEL, LeadSource.CAROUSEL, LeadSource.STORY];

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  name!: string;

  @IsPhoneNumber(undefined, { message: 'WhatsApp deve estar em formato internacional, ex.: +5511999999999' })
  phoneE164!: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  profession?: string;

  @IsEnum(LeadSource, { message: 'Origem da lead é obrigatória.' })
  leadSource!: LeadSource;

  // Obrigatório só quando a origem é um conteúdo específico (Reel/Carrossel/
  // Story), para depois cruzar performance de conteúdo com conversão em venda.
  @ValidateIf((dto: CreateLeadDto) => CONTENT_SOURCES.includes(dto.leadSource))
  @IsString()
  @IsNotEmpty({ message: 'Informe o link/descrição do conteúdo (Reel, Carrossel ou Story) que gerou a lead.' })
  leadSourceContentRef?: string;

  @IsOptional()
  @IsString()
  painPoints?: string;

  @IsOptional()
  @IsString()
  desires?: string;

  @IsOptional()
  @IsString()
  objections?: string;

  @IsOptional()
  @IsString()
  leadNotes?: string;
}
