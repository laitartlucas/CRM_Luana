/** Emitido pelo LeadsService depois de criar uma lead nova (cadastro manual, Respondi, etc.). */
export const LEAD_EVENTS = {
  CREATED: 'lead.created',
} as const;

export interface LeadCreatedPayload {
  leadId: string;
  name: string | null;
}
