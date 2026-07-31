import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SendResult, WhatsappProvider } from './whatsapp-provider.interface';

type ConnectionState = 'open' | 'connecting' | 'close';

/**
 * Implementação contra a Evolution API (open source, protocolo WhatsApp
 * Web/Baileys) — conecta por QR Code com um número já existente, sem exigir
 * a migração para a Meta Cloud API. Não é o transporte oficial da Meta; ver
 * docs/03-fluxos-whatsapp.md para o motor de conversa, que não muda com a
 * troca de provider (ver docs/01-arquitetura.md §1.3 — provider pattern).
 */
@Injectable()
export class EvolutionWhatsappProvider implements WhatsappProvider {
  private readonly logger = new Logger('WhatsApp[evolution]');

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (this.config.get<string>('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
  }

  private get apiKey(): string {
    return this.config.get<string>('EVOLUTION_API_KEY') ?? '';
  }

  private get instanceName(): string {
    return this.config.get<string>('EVOLUTION_INSTANCE_NAME') ?? '';
  }

  private headers() {
    return { 'Content-Type': 'application/json', apikey: this.apiKey };
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    const number = to.replace(/^\+/, '');
    const response = await fetch(`${this.baseUrl}/message/sendText/${this.instanceName}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ number, text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logger.error(`Falha ao enviar mensagem: ${JSON.stringify(data)}`);
      throw new Error(data?.message ?? 'Falha ao enviar mensagem via Evolution API.');
    }
    return { providerMessageId: data?.key?.id ?? randomUUID() };
  }

  /**
   * Não usado no caminho da Evolution: o payload do webhook já traz a mídia
   * embutida em base64 (ver WhatsappController#processEvolutionWebhookPayload),
   * diferente da Meta que só manda um mediaId pra buscar depois. Existe só
   * pra satisfazer a interface WhatsappProvider.
   */
  async downloadMedia(): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    throw new Error('EvolutionWhatsappProvider.downloadMedia não é usado — mídia tratada direto no webhook.');
  }

  /** Cria a instância na Evolution API se ainda não existir e (re)configura o webhook. Idempotente. */
  async ensureInstance(webhookUrl: string): Promise<void> {
    const webhookConfig = {
      webhook: { url: webhookUrl, byEvents: false, base64: true, events: ['MESSAGES_UPSERT'] },
    };

    const exists = (await this.fetchConnectionStateSafe()) !== null;
    if (!exists) {
      const response = await fetch(`${this.baseUrl}/instance/create`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          instanceName: this.instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          ...webhookConfig,
        }),
      });
      if (response.ok) return;
      const data = await response.json().catch(() => ({}));
      const alreadyExists = /already|em uso|exist/i.test(JSON.stringify(data));
      if (!alreadyExists) {
        throw new Error(data?.message ?? 'Falha ao criar instância na Evolution API.');
      }
    }

    // Instância já existia (ou acabou de ser criada por outra chamada concorrente) —
    // garante que o webhook está configurado corretamente mesmo assim.
    await fetch(`${this.baseUrl}/webhook/set/${this.instanceName}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(webhookConfig),
    }).catch((err) => this.logger.warn(`Falha ao (re)configurar webhook: ${(err as Error).message}`));
  }

  async getQrCode(): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/instance/connect/${this.instanceName}`, {
      headers: this.headers(),
    });
    const data = await response.json().catch(() => ({}));
    return data?.base64 ?? data?.qrcode?.base64 ?? null;
  }

  async getConnectionState(): Promise<ConnectionState> {
    return (await this.fetchConnectionStateSafe()) ?? 'close';
  }

  private async fetchConnectionStateSafe(): Promise<ConnectionState | null> {
    if (!this.baseUrl || !this.instanceName) return 'close';
    try {
      const response = await fetch(`${this.baseUrl}/instance/connectionState/${this.instanceName}`, {
        headers: this.headers(),
      });
      if (response.status === 404) return null; // instância ainda não existe na Evolution API
      if (!response.ok) return 'close';
      const data = await response.json().catch(() => ({}));
      return data?.instance?.state ?? 'close';
    } catch (err) {
      // Evolution API fora do ar/não configurada — não deixa o polling de
      // status (Settings.tsx) quebrar com erro 500, só reporta "close".
      this.logger.warn(`Falha ao consultar status da Evolution API: ${(err as Error).message}`);
      return 'close';
    }
  }
}
