import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export type NluIntent = 'SCHEDULE' | 'RESCHEDULE' | 'CANCEL' | 'HUMAN' | 'UNKNOWN';

export interface NluResult {
  intent: NluIntent;
  confidence: number;
  slots: {
    serviceHint?: string;
    dateHint?: string;
    timeHint?: string;
  };
}

// claude-haiku-4-5: modelo mais rápido/barato da Anthropic (~$1/$5 por
// milhão de tokens input/output), adequado para uma classificação de
// intenção de texto curto — não precisamos do Opus aqui. Ver
// docs/03-fluxos-whatsapp.md: essa é a camada de NLU da Fase 2, na frente
// do motor de estados determinístico, nunca substituindo-o.
const NLU_MODEL = 'claude-haiku-4-5';
const NLU_TIMEOUT_MS = 3000;
const CONFIDENCE_THRESHOLD = 0.6;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['SCHEDULE', 'RESCHEDULE', 'CANCEL', 'HUMAN', 'UNKNOWN'] },
    confidence: { type: 'number' },
    slots: {
      type: 'object',
      properties: {
        serviceHint: { type: 'string' },
        dateHint: { type: 'string' },
        timeHint: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['intent', 'confidence', 'slots'],
  additionalProperties: false,
} as const;

/**
 * Assistente de IA no WhatsApp (diferencial do prompt). Interpreta
 * linguagem natural em uma das intenções que o ConversationEngineService já
 * sabe tratar — nunca decide sozinho, só evita exigir "1"/"2"/"3" do menu
 * numérico. Atrás de WHATSAPP_NLU_ENABLED (default false): timeout curto +
 * try/catch garantem que uma falha ou lentidão da IA cai automaticamente no
 * menu determinístico existente, nunca trava o atendimento (ver risco #8 em
 * docs/05-riscos-mitigacao.md).
 */
@Injectable()
export class NluService {
  private readonly logger = new Logger(NluService.name);
  private readonly client: Anthropic | null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('WHATSAPP_NLU_ENABLED') === 'true';
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = this.enabled && apiKey ? new Anthropic({ apiKey }) : null;
    if (this.enabled && !apiKey) {
      this.logger.warn('WHATSAPP_NLU_ENABLED=true mas ANTHROPIC_API_KEY não configurado — NLU desativado.');
    }
  }

  async classify(text: string): Promise<NluResult | null> {
    if (!this.enabled || !this.client || !text.trim()) return null;

    try {
      const response = await this.client.messages.create(
        {
          model: NLU_MODEL,
          max_tokens: 256,
          system:
            'Você classifica mensagens de WhatsApp recebidas por uma consultoria de moda/styling em ' +
            'uma intenção fixa (agendar, remarcar, cancelar, falar com atendente humano, ou desconhecida). ' +
            'Extraia também pistas de serviço/data/hora mencionadas no texto, sem inventar nada que não esteja escrito.',
          messages: [{ role: 'user', content: text }],
          output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
        },
        { timeout: NLU_TIMEOUT_MS },
      );

      if (response.stop_reason === 'refusal') return null;
      const block = response.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') return null;
      return JSON.parse(block.text) as NluResult;
    } catch (err) {
      this.logger.warn(`NLU indisponível, caindo para o menu determinístico: ${(err as Error).message}`);
      return null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
