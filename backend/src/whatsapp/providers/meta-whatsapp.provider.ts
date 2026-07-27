import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendResult, WhatsappProvider } from './whatsapp-provider.interface';

const GRAPH_VERSION = 'v20.0';

/** Implementação real contra a Meta WhatsApp Cloud API (oficial). */
@Injectable()
export class MetaWhatsappProvider implements WhatsappProvider {
  private readonly logger = new Logger('WhatsApp[meta]');

  constructor(private readonly config: ConfigService) {}

  private get phoneNumberId() {
    return this.config.get<string>('WHATSAPP_META_PHONE_NUMBER_ID');
  }

  private get accessToken() {
    return this.config.get<string>('WHATSAPP_META_ACCESS_TOKEN');
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Falha ao enviar mensagem: ${JSON.stringify(data)}`);
      throw new Error(data?.error?.message ?? 'Falha ao enviar mensagem via Meta Cloud API.');
    }
    return { providerMessageId: data.messages?.[0]?.id ?? 'unknown' };
  }

  async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const metaResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const meta = await metaResponse.json();
    if (!metaResponse.ok || !meta.url) {
      throw new Error('Não foi possível obter metadados da mídia recebida.');
    }

    const fileResponse = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const arrayBuffer = await fileResponse.arrayBuffer();
    const mimeType: string = meta.mime_type ?? 'application/octet-stream';
    const extension = mimeType.split('/')[1] ?? 'bin';

    return { buffer: Buffer.from(arrayBuffer), filename: `${mediaId}.${extension}`, mimeType };
  }
}
