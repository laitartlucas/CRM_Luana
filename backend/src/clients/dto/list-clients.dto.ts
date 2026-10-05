import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SuccessStage } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination';

export const CLIENT_SORTS = ['name', 'createdAt'] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];

export class ListClientsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SuccessStage)
  successStage?: SuccessStage;

  /** Padrão: nome (A–Z). */
  @IsOptional()
  @IsIn(CLIENT_SORTS)
  sort?: ClientSort;
}
