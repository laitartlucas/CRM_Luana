import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeadSource, SuccessStage } from '@prisma/client';
import { PeriodQueryDto } from '../../common/dto/period-query.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Filtros iguais aos da lista de leads; o período filtra pela data de cadastro. */
export class ExportLeadsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  search?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsIn(['LEAD', 'PIPELINE'])
  stage?: 'LEAD' | 'PIPELINE';
}

/** Filtros iguais aos da lista de clientes; o período filtra pela data de cadastro. */
export class ExportClientsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  search?: string;

  @IsOptional()
  @IsEnum(SuccessStage)
  successStage?: SuccessStage;
}
