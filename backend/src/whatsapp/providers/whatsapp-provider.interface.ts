export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';

export interface SendResult {
  providerMessageId: string;
}

/**
 * Interface que qualquer transporte de WhatsApp deve implementar. Todo o
 * resto do sistema (motor de conversa, lembretes) fala só com esta
 * interface — nunca com a Meta Cloud API ou o mock diretamente. Ver
 * `docs/01-arquitetura.md` §1.3 (provider pattern).
 */
export interface WhatsappProvider {
  sendText(to: string, text: string): Promise<SendResult>;
  /** Baixa uma mídia recebida (foto) a partir do id retornado pelo webhook. */
  downloadMedia(mediaId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }>;
}
