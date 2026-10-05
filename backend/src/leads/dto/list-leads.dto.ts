import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { LeadSource } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination';

export const LEAD_SORTS = ['leadScore', 'createdAt', 'name'] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];

export class ListLeadsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  /** LEAD = lead nova (Módulo 1); PIPELINE = já avançou para o Pipeline Comercial. */
  @IsOptional()
  @IsIn(['LEAD', 'PIPELINE'])
  stage?: 'LEAD' | 'PIPELINE';

  /** Padrão: leadScore (maiores primeiro), para priorizar os follow-ups. */
  @IsOptional()
  @IsIn(LEAD_SORTS)
  sort?: LeadSort;
}
