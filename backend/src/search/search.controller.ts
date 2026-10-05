import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Busca global (leads, clientes, agendamentos e tarefas) usada pela paleta Ctrl+K. */
  @Get()
  find(@Query() query: SearchQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.search.search(query.q ?? '', user);
  }
}
