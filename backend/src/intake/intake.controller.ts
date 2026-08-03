import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { IntakeService } from './intake.service';
import { SubmitIntakeDto } from './dto/submit-intake.dto';

// Rota pública (sem sessão) — a cliente preenche pelo link recebido no WhatsApp.
@Public()
@Controller('intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Get(':clientId/:token')
  getForm(@Param('clientId') clientId: string, @Param('token') token: string) {
    return this.intakeService.getForm(clientId, token);
  }

  @Post(':clientId/:token')
  submit(
    @Param('clientId') clientId: string,
    @Param('token') token: string,
    @Body() dto: SubmitIntakeDto,
  ) {
    return this.intakeService.submit(clientId, token, dto);
  }
}
