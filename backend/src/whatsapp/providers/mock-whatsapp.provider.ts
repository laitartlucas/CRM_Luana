import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SendResult, WhatsappProvider } from './whatsapp-provider.interface';

/**
 * Provider usado enquanto a conta Meta Business não está aprovada (ver
 * docs/04-plano-implementacao.md, Fase 0). Tem exatamente a mesma
 * interface do provider real — troca-se para `MetaWhatsappProvider` só
 * mudando WHATSAPP_PROVIDER=meta no .env, sem tocar em nenhum outro
 * módulo. Mensagens "enviadas" aparecem no log do backend e ficam salvas
 * normalmente na tabela `messages`, permitindo testar o fluxo completo de
 * agendamento via `POST /whatsapp/simulate/inbound` (ver README).
 */
@Injectable()
export class MockWhatsappProvider implements WhatsappProvider {
  private readonly logger = new Logger('WhatsApp[mock]');

  async sendText(to: string, text: string): Promise<SendResult> {
    this.logger.log(`-> ${to}: ${text}`);
    return { providerMessageId: `mock-${randomUUID()}` };
  }

  async downloadMedia(): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    // No modo mock não há mídia real vinda da Meta; simulamos um arquivo vazio.
    return { buffer: Buffer.from(''), filename: 'mock.jpg', mimeType: 'image/jpeg' };
  }
}
