export type MessageTemplateKey =
  | 'newLeadOutreach'
  | 'reminder24h'
  | 'reminder3h'
  | 'reminder1h'
  | 'postServiceFollowUp'
  | 'noShowReengagement'
  | 'renewalReminder';

export type MessageTemplates = Partial<Record<MessageTemplateKey, string>>;

interface MessageTemplateMeta {
  label: string;
  description: string;
  variables: string[];
  default: string;
}

export const MESSAGE_TEMPLATE_META: Record<MessageTemplateKey, MessageTemplateMeta> = {
  newLeadOutreach: {
    label: 'Abordagem — cliente nova',
    description: 'Primeira mensagem para abordar uma lead/cliente nova, use ao enviar manualmente pela ficha dela.',
    variables: ['cliente'],
    default:
      'Oi {{cliente}}! Aqui é a Luana, consultora de imagem. Vi seu interesse e fiquei muito feliz! Quero te conhecer melhor e entender como posso te ajudar a montar looks com mais confiança. Topa bater um papo rapidinho?',
  },
  reminder24h: {
    label: 'Lembrete — 24h antes',
    description: 'Enviado um dia antes da consultoria agendada.',
    variables: ['cliente', 'servico', 'data', 'hora'],
    default: 'Lembrete: você tem "{{servico}}" amanhã, {{data}} às {{hora}}. Confirma?\n1) Confirmar\n2) Remarcar',
  },
  reminder3h: {
    label: 'Lembrete — 3h antes',
    description: 'Enviado poucas horas antes, para clientes com maior risco de falta.',
    variables: ['cliente', 'servico', 'data', 'hora'],
    default: 'Não esqueça: "{{servico}}" hoje às {{hora}}. Confirma sua presença?\n1) Confirmar\n2) Remarcar',
  },
  reminder1h: {
    label: 'Lembrete — 1h antes',
    description: 'Último lembrete, enviado uma hora antes do horário.',
    variables: ['cliente', 'servico', 'data', 'hora'],
    default: 'Falta 1h para "{{servico}}" ({{data}} às {{hora}}). Te espero! Se precisar, digite "2" para remarcar.',
  },
  postServiceFollowUp: {
    label: 'Pós-atendimento',
    description: 'Enviado depois que a consultoria é marcada como concluída.',
    variables: ['cliente', 'servico'],
    default: 'Oi {{cliente}}! Como foi sua experiência com os looks de "{{servico}}"? Conta pra gente.',
  },
  noShowReengagement: {
    label: 'Reengajamento — falta (no-show)',
    description: 'Enviado quando a cliente falta a uma consultoria agendada.',
    variables: ['cliente', 'servico'],
    default: 'Oi {{cliente}}, sentimos sua falta no horário de "{{servico}}". Quer remarcar? Digite "2" para ver novos horários.',
  },
  renewalReminder: {
    label: 'Renovação (Sucesso do Cliente)',
    description: 'Enviado quando uma cliente fica um tempo sem contato após o encerramento.',
    variables: ['cliente'],
    default:
      'Oi {{cliente}}! Faz um tempinho desde nossa última consultoria — como estão os looks? Topa revisar seu guarda-roupa ou já pensou em indicar alguém pra gente?',
  },
};

export const MESSAGE_TEMPLATE_KEYS = Object.keys(MESSAGE_TEMPLATE_META) as MessageTemplateKey[];

export function defaultMessageTemplates(): Required<MessageTemplates> {
  return Object.fromEntries(
    MESSAGE_TEMPLATE_KEYS.map((key) => [key, MESSAGE_TEMPLATE_META[key].default]),
  ) as Required<MessageTemplates>;
}

/** Substitui variáveis {{nome}} pelo valor correspondente; variáveis sem valor viram string vazia. */
export function renderMessageTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, name) => vars[name] ?? '');
}

export function resolveMessageTemplate(
  key: MessageTemplateKey,
  templates: MessageTemplates | null | undefined,
  vars: Record<string, string>,
): string {
  const raw = templates?.[key]?.trim() || MESSAGE_TEMPLATE_META[key].default;
  return renderMessageTemplate(raw, vars);
}

/** Mensagens extras que a própria usuária cria, sem chave fixa — quantas ela quiser. */
export interface CustomMessageTemplate {
  id: string;
  label: string;
  text: string;
}
