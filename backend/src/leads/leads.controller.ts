import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { LeadSource, Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeadsService } from './leads.service';
import { ClientsService } from '../clients/clients.service';
import { RespondiImportService } from './respondi-import.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AdvanceToPipelineDto } from './dto/advance-to-pipeline.dto';
import { ImportRespondiDto } from './dto/import-respondi.dto';

@UseGuards(RolesGuard)
@Controller('leads')
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(
    private readonly leadsService: LeadsService,
    private readonly clientsService: ClientsService,
    private readonly respondiImportService: RespondiImportService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@Query('search') search?: string, @Query('source') source?: LeadSource) {
    return this.leadsService.list({ search, source });
  }

  @Post('import/respondi')
  importRespondi(@Body() dto: ImportRespondiDto) {
    return this.respondiImportService.importFromUrl(dto.url);
  }

  /**
   * Chamado pelo próprio Respondi a cada resposta concluída (configurar em
   * Notificações > Webhook nas configurações do formulário, ver
   * docs/03-fluxos-whatsapp.md). Sem HMAC — o segredo no path da URL é o que
   * protege a rota (mesmo padrão do webhook da Evolution API).
   */
  @Public()
  @Post('webhooks/respondi/:secret')
  @HttpCode(HttpStatus.OK)
  async respondiWebhook(@Param('secret') secret: string, @Body() body: any) {
    const expected = this.config.get<string>('RESPONDI_WEBHOOK_SECRET');
    if (!expected || !this.safeCompare(secret, expected)) {
      this.logger.warn('Segredo do webhook do Respondi inválido — ignorando payload.');
      return { ok: true };
    }
    try {
      await this.respondiImportService.handleWebhook(body);
    } catch (err) {
      // Nunca deixa uma falha de parsing/processamento derrubar o webhook.
      this.logger.error(`Erro ao processar webhook do Respondi: ${(err as Error).message}`);
    }
    return { ok: true };
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.leadsService.findById(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.leadsService.getProfile(id);
  }

  @Audit('client')
  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Audit('client')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  // Leads e clientes vivem na mesma tabela (ver funnelStage) — reaproveita
  // ClientsService.remove, que já cuida da exclusão em cascata correta.
  @Roles(Role.ADMIN, Role.MANAGER)
  @Audit('client')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Audit('client')
  @Post(':id/advance-to-pipeline')
  advanceToPipeline(
    @Param('id') id: string,
    @Body() dto: AdvanceToPipelineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.advanceToPipeline(id, user?.id, dto.reason);
  }
}
