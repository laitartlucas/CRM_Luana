import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LeadsApi } from '../api/endpoints';
import type { Appointment, Client, FunnelStageEvent, WhatsappMessage } from '../api/types';
import { LEAD_SOURCE_LABELS, PIPELINE_STAGE_LABELS } from '../constants/pipelineLabels';
import { SendMessageModal } from '../components/SendMessageModal';

const REPORT_FIELDS: Array<{ key: keyof Client; label: string }> = [
  { key: 'painPoints', label: 'Principais dores' },
  { key: 'desires', label: 'Desejos' },
  { key: 'objections', label: 'Objeções' },
  { key: 'leadNotes', label: 'Observações gerais' },
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Client | null>(null);
  const [stageEvents, setStageEvents] = useState<FunnelStageEvent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    if (!id) return;
    LeadsApi.profile(id).then((res) => {
      setLead(res.data.lead);
      setStageEvents(res.data.stageEvents);
      setAppointments(res.data.appointments);
      setMessages(res.data.messages);
    });
  }

  useEffect(load, [id]);

  function updateField(key: keyof Client, value: string) {
    setLead((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!lead || !id) return;
    setSaving(true);
    try {
      await LeadsApi.update(id, {
        name: lead.name,
        instagram: lead.instagram,
        city: lead.city,
        profession: lead.profession,
        painPoints: lead.painPoints,
        desires: lead.desires,
        objections: lead.objections,
        leadNotes: lead.leadNotes,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvance() {
    if (!id) return;
    setAdvancing(true);
    try {
      await LeadsApi.advanceToPipeline(id);
      navigate('/pipeline');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleDelete() {
    if (!id || !lead) return;
    if (!window.confirm(`Excluir ${lead.name || 'esta lead'} definitivamente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeleting(true);
    try {
      await LeadsApi.remove(id);
      navigate('/leads');
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? 'Não foi possível excluir esta lead.');
      setDeleting(false);
    }
  }

  if (!lead) return <p>Carregando...</p>;

  return (
    <div>
      <button className="btn-link" onClick={() => navigate('/leads')}>
        ← Voltar
      </button>
      <div className="toolbar" style={{ marginBottom: '-0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, overflowWrap: 'break-word' }}>{lead.name || '(sem nome)'}</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, overflowWrap: 'break-word' }}>
            {lead.phoneE164} {lead.leadSource ? `· ${LEAD_SOURCE_LABELS[lead.leadSource]}` : ''}
            {lead.leadSourceContentRef ? ` (${lead.leadSourceContentRef})` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', flexShrink: 0 }}>
          <button className="btn secondary" onClick={() => setMessaging(true)}>
            Enviar mensagem
          </button>
          <button className="btn danger" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Excluindo...' : 'Excluir lead'}
          </button>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Cadastro</h3>
          <div className="form-grid">
            <label className="field">
              Nome
              <input value={lead.name} onChange={(e) => updateField('name', e.target.value)} />
            </label>
            <label className="field">
              Instagram
              <input value={lead.instagram ?? ''} onChange={(e) => updateField('instagram', e.target.value)} />
            </label>
            <label className="field">
              Cidade
              <input value={lead.city ?? ''} onChange={(e) => updateField('city', e.target.value)} />
            </label>
            <label className="field">
              Profissão
              <input value={lead.profession ?? ''} onChange={(e) => updateField('profession', e.target.value)} />
            </label>
          </div>

          <h3>Relatório da lead</h3>
          <div className="form-grid">
            {REPORT_FIELDS.map((f) => (
              <label className="field" key={f.key}>
                {f.label}
                <textarea
                  rows={2}
                  value={(lead[f.key] as string) ?? ''}
                  onChange={(e) => updateField(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="modal-actions">
            <button className="btn secondary" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvando...' : 'Salvar relatório'}
            </button>
            {lead.funnelStage === 'LEAD' && (
              <button className="btn" disabled={advancing} onClick={handleAdvance}>
                {advancing ? 'Avançando...' : 'Avançar para Pipeline →'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Histórico de etapas</h3>
            {stageEvents.map((ev) => (
              <div className="appointment-row" key={ev.id}>
                <div>
                  {new Date(ev.enteredAt).toLocaleString('pt-BR')} —{' '}
                  {PIPELINE_STAGE_LABELS[ev.toStage as keyof typeof PIPELINE_STAGE_LABELS] ?? ev.toStage}
                  {ev.changedByUser ? ` (${ev.changedByUser.name})` : ''}
                </div>
              </div>
            ))}
            {stageEvents.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)' }}>Ainda não avançou para o Pipeline Comercial.</p>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Conversa no WhatsApp</h3>
            {messages.map((m) => (
              <div className="appointment-row" key={m.id}>
                <div>
                  <strong>{m.direction === 'IN' ? 'Lead' : 'Consultora'}:</strong> {m.content ?? '(mídia)'}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {new Date(m.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
            {messages.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Sem mensagens ainda.</p>}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Agenda</h3>
            {appointments.map((a) => (
              <div className="appointment-row" key={a.id}>
                <div>
                  {new Date(a.startAt).toLocaleString('pt-BR')} — {a.service?.name}
                </div>
                <span className={`badge ${a.status}`}>{a.status}</span>
              </div>
            ))}
            {appointments.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum agendamento ainda.</p>}
          </div>
        </div>
      </div>

      {messaging && (
        <SendMessageModal
          clientId={lead.id}
          clientName={lead.name}
          onClose={() => setMessaging(false)}
          onSent={() => setMessaging(false)}
        />
      )}
    </div>
  );
}
