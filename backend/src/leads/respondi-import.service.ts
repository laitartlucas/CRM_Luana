import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadSource } from '@prisma/client';
import { LeadsService } from './leads.service';

// Duas formas de trazer uma resposta do Respondi pra virar lead:
//
// 1) Webhook (recomendado, ver handleWebhook): o próprio Respondi chama
//    RESPONDI_WEBHOOK_SECRET (URL configurada nas notificações do formulário
//    no painel do Respondi) a cada resposta concluída — automático, sem
//    token e sem expiração.
// 2) Link manual (ver importFromUrl): busca uma resposta específica sob
//    demanda na API do Respondi. Como a tela é uma SPA autenticada sem API
//    pública, RESPONDI_API_TOKEN é o Bearer JWT da própria sessão logada
//    (capturado manualmente via DevTools) — expira periodicamente (~7 dias)
//    e precisa ser renovado à mão quando parar de funcionar.
interface RespondiAnswer {
  field_slug: string;
  field_title: string;
  field_type: string;
  value: string;
}

export interface ImportedLeadData {
  name?: string;
  phoneE164?: string;
  instagram?: string;
  city?: string;
  profession?: string;
  painPoints?: string;
  desires?: string;
  objections?: string;
  leadNotes?: string;
}

const NAME_KEYS = ['nome completo', 'nome'];
const PHONE_KEYS = ['telefone', 'whatsapp', 'celular'];
const PROFESSION_KEYS = ['profissao', 'profissao atual', 'qual sua profissao'];
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[:?]/g, '')
    .trim();
}

// Perguntas de múltipla escolha (radio/checkbox) vêm com o `value` como um
// array serializado em string (ex.: '["Insegura e comparando..."]'); telefone
// vem como objeto serializado (ex.: '{"country":"55","phone":"54999..."}')
function extractAnswerText(answer: RespondiAnswer): string {
  const raw = answer.value ?? '';
  if (answer.field_type === 'radio' || answer.field_type === 'checkbox') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.join(', ') : String(parsed);
    } catch {
      return raw;
    }
  }
  if (answer.field_type === 'phone') {
    try {
      const parsed = JSON.parse(raw);
      const digits = `${parsed.country ?? ''}${parsed.phone ?? ''}`.replace(/\D/g, '');
      return digits ? `+${digits}` : raw;
    } catch {
      return raw;
    }
  }
  return raw;
}

@Injectable()
export class RespondiImportService {
  private readonly logger = new Logger(RespondiImportService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly leadsService: LeadsService,
  ) {}

  /**
   * Payload do webhook de "resposta concluída" do Respondi. O formato exato
   * não é documentado publicamente — assume a mesma forma vista na API de
   * consulta (`data.answers`), com fallback pra `answers` na raiz caso o
   * webhook mande o payload sem o envelope `data`. Se um dia o formato real
   * vier diferente, checar os logs de produção (Railway) pra ajustar.
   */
  async handleWebhook(payload: any): Promise<void> {
    const answers: RespondiAnswer[] = payload?.data?.answers ?? payload?.answers ?? [];
    if (answers.length === 0) {
      this.logger.warn('Webhook do Respondi sem respostas no payload — ignorado.');
      return;
    }

    const mapped = this.mapAnswers(answers);
    if (!mapped.name || !mapped.phoneE164) {
      this.logger.warn('Webhook do Respondi sem nome ou telefone — lead não foi criada automaticamente.');
      return;
    }

    await this.leadsService.create({
      name: mapped.name,
      phoneE164: mapped.phoneE164,
      instagram: mapped.instagram,
      city: mapped.city,
      profession: mapped.profession,
      leadSource: LeadSource.OTHER,
      painPoints: mapped.painPoints,
      desires: mapped.desires,
      objections: mapped.objections,
      leadNotes: mapped.leadNotes,
    } as Parameters<LeadsService['create']>[0]);

    this.logger.log(`Lead criada via webhook do Respondi: ${mapped.name} (${mapped.phoneE164})`);
  }

  async importFromUrl(url: string): Promise<ImportedLeadData> {
    const token = this.config.get<string>('RESPONDI_API_TOKEN');
    if (!token) {
      throw new BadGatewayException('Importação do Respondi não está configurada (RESPONDI_API_TOKEN ausente).');
    }

    const match = url.match(UUID_RE);
    if (!match) {
      throw new BadRequestException('Não encontrei o identificador da resposta nesse link do Respondi.');
    }
    const uuid = match[0];

    let response: Response;
    try {
      response = await fetch(`https://api.respondi.app/api/respondents/${uuid}/answers`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
    } catch (err) {
      this.logger.error(`Falha ao chamar API do Respondi: ${(err as Error).message}`);
      throw new BadGatewayException('Não consegui conectar com o Respondi. Tente novamente em instantes.');
    }

    if (response.status === 401 || response.status === 403) {
      this.logger.warn('Token do Respondi expirado ou inválido');
      throw new BadGatewayException('O acesso ao Respondi expirou. É preciso gerar um novo token (RESPONDI_API_TOKEN).');
    }
    if (!response.ok) {
      throw new BadGatewayException(`Respondi retornou erro (${response.status}) ao buscar essa resposta.`);
    }

    const body = await response.json();
    const answers: RespondiAnswer[] = body?.data?.answers ?? [];
    if (answers.length === 0) {
      throw new BadRequestException('Não encontrei perguntas respondidas para esse link no Respondi.');
    }

    return this.mapAnswers(answers);
  }

  private mapAnswers(answers: RespondiAnswer[]): ImportedLeadData {
    const result: ImportedLeadData = {};
    const painPoints: string[] = [];
    const desires: string[] = [];
    const objections: string[] = [];
    const notes: string[] = [];

    for (const answer of answers) {
      const question = answer.field_title?.trim();
      const value = extractAnswerText(answer).trim();
      if (!question || !value) continue;

      const key = normalizeLabel(question);

      if (NAME_KEYS.includes(key)) {
        result.name = value;
      } else if (PHONE_KEYS.includes(key)) {
        result.phoneE164 = value.startsWith('+') ? value : `+${value.replace(/\D/g, '')}`;
      } else if (key === 'instagram') {
        result.instagram = value;
      } else if (key === 'cidade') {
        result.city = value;
      } else if (PROFESSION_KEYS.includes(key)) {
        result.profession = value;
      } else if (/dificuldade|\bdor(es)?\b/.test(key)) {
        painPoints.push(`${question}\n${value}`);
      } else if (/deseja|gostaria/.test(key)) {
        desires.push(`${question}\n${value}`);
      } else if (/custar|medo|receio|objec/.test(key)) {
        objections.push(`${question}\n${value}`);
      } else {
        notes.push(`${question}\n${value}`);
      }
    }

    if (painPoints.length) result.painPoints = painPoints.join('\n\n');
    if (desires.length) result.desires = desires.join('\n\n');
    if (objections.length) result.objections = objections.join('\n\n');
    if (notes.length) result.leadNotes = notes.join('\n\n');

    return result;
  }
}
