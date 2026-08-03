import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddMediaDto } from './dto/add-media.dto';
import { ChangeSuccessStageDto } from './dto/change-success-stage.dto';
import { IntakeService } from '../intake/intake.service';

@UseGuards(RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly intakeService: IntakeService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.clientsService.list(search);
  }

  // Precisa vir antes de ":id" — senão "success-board" seria interpretado
  // como um id de cliente.
  @Get('success-board')
  successBoard() {
    return this.clientsService.successBoard();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.clientsService.findById(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.clientsService.getProfile(id);
  }

  @Audit('client')
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Audit('client')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Post(':id/media')
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddMediaDto,
  ) {
    return this.clientsService.addMediaFromUpload(id, file, dto);
  }

  @Patch(':id/consent/whatsapp')
  setWhatsappConsent(@Param('id') id: string, @Body('value') value: boolean) {
    return this.clientsService.setConsent(id, 'whatsappConsent', value);
  }

  @Patch(':id/consent/marketing')
  setMarketingConsent(@Param('id') id: string, @Body('value') value: boolean) {
    return this.clientsService.setConsent(id, 'marketingConsent', value);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Audit('client')
  @Post(':id/anonymize')
  anonymize(@Param('id') id: string) {
    return this.clientsService.anonymize(id);
  }

  @Audit('client')
  @Patch(':id/success-stage')
  changeSuccessStage(
    @Param('id') id: string,
    @Body() dto: ChangeSuccessStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.changeSuccessStage(id, dto.toStage, user?.id, dto.reason);
  }

  /** Link do formulário de intake de estilo, para enviar por WhatsApp. */
  @Get(':id/intake-link')
  getIntakeLink(@Param('id') id: string) {
    const token = this.intakeService.generateToken(id);
    const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:5173');
    return { url: `${webAppUrl}/intake/${id}/${token}` };
  }
}
