import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * ?from=AAAA-MM-DD&to=AAAA-MM-DD. A validação do conteúdo (datas reais, ordem, tamanho do período)
 * fica em resolvePeriod, que devolve mensagens em português.
 */
export class PeriodQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;
}
