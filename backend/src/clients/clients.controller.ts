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
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Audit } from '../common/decorators/audit.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddMediaDto } from './dto/add-media.dto';

@UseGuards(RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.clientsService.list(search);
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
}
