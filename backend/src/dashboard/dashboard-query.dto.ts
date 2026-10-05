import { IsOptional, IsUUID } from 'class-validator';
import { PeriodQueryDto } from '../common/dto/period-query.dto';

export class DashboardQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsUUID()
  professionalId?: string;
}
