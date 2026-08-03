import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitIntakeDto } from './dto/submit-intake.dto';

/**
 * Formulário de intake de estilo nativo do CRM (em vez de Google Forms —
 * evita adicionar uma integração OAuth/Sheets API nova para algo que o
 * próprio CRM já resolve). O link é assinado por HMAC (sem exigir login —
 * a cliente recebe e preenche pelo WhatsApp), mesmo padrão de verificação
 * constant-time já usado no webhook do WhatsApp.
 */
@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  generateToken(clientId: string): string {
    return createHmac('sha256', this.getSecret()).update(clientId).digest('hex');
  }

  private getSecret(): string {
    const secret = this.config.get<string>('INTAKE_FORM_SECRET');
    if (!secret) throw new Error('INTAKE_FORM_SECRET não configurado.');
    return secret;
  }

  private assertValidToken(clientId: string, token: string) {
    const expected = Buffer.from(this.generateToken(clientId));
    const provided = Buffer.from(token ?? '');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new BadRequestException('Link de formulário inválido ou expirado.');
    }
  }

  async getForm(clientId: string, token: string) {
    this.assertValidToken(clientId, token);
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Cliente não encontrada.');
    return {
      name: client.name,
      bodyType: client.bodyType,
      colorPalette: client.colorPalette,
      predominantStyle: client.predominantStyle,
      averageBudget: client.averageBudget,
      preferredBrands: client.preferredBrands,
      restrictions: client.restrictions,
      alreadySubmitted: Boolean(client.intakeFormSubmittedAt),
    };
  }

  async submit(clientId: string, token: string, dto: SubmitIntakeDto) {
    this.assertValidToken(clientId, token);
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Cliente não encontrada.');
    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        bodyType: dto.bodyType,
        colorPalette: dto.colorPalette,
        predominantStyle: dto.predominantStyle,
        averageBudget: dto.averageBudget,
        preferredBrands: dto.preferredBrands,
        restrictions: dto.restrictions,
        intakeFormSubmittedAt: new Date(),
      },
    });
  }
}
