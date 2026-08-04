import { ChangeEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClientsApi, ClientSuccessApi } from '../api/endpoints';
import type { Appointment, Client, ClientMedia, SuccessStage } from '../api/types';
import { SUCCESS_STAGE_LABELS, SUCCESS_STAGE_ORDER } from '../constants/pipelineLabels';
import { SendMessageModal } from '../components/SendMessageModal';

const STYLE_FIELDS: Array<{ key: keyof Client; label: string }> = [
  { key: 'bodyType', label: 'Tipo de corpo' },
  { key: 'colorPalette', label: 'Paleta de cores' },
  { key: 'predominantStyle', label: 'Estilo predominante' },
  { key: 'restrictions', label: 'Restrições' },
  { key: 'notes', label: 'Observações' },
];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [media, setMedia] = useState<ClientMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [changingStage, setChangingStage] = useState(false);
  const [intakeLink, setIntakeLink] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    if (!id) return;
    ClientsApi.profile(id).then((res) => {
      setClient(res.data.client);
      setAppointments(res.data.appointments);
      setMedia(res.data.media);
    });
  }

  useEffect(load, [id]);

  function updateField(key: keyof Client, value: string) {
    setClient((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!client || !id) return;
    setSaving(true);
    try {
      await ClientsApi.update(id, {
        bodyType: client.bodyType,
        colorPalette: client.colorPalette,
        predominantStyle: client.predominantStyle,
        restrictions: client.restrictions,
        notes: client.notes,
        name: client.name,
        email: client.email,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    await ClientsApi.uploadMedia(id, file);
    load();
    e.target.value = '';
  }

  async function handleSuccessStage(toStage: SuccessStage) {
    if (!id) return;
    setChangingStage(true);
    try {
      await ClientSuccessApi.changeStage(id, { toStage });
      load();
    } finally {
      setChangingStage(false);
    }
  }

  async function handleGetIntakeLink() {
    if (!id) return;
    const res = await ClientSuccessApi.intakeLink(id);
    setIntakeLink(res.data.url);
  }

  async function handleDelete() {
    if (!id || !client) return;
    if (!window.confirm(`Excluir ${client.name || 'esta cliente'} definitivamente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeleting(true);
    try {
      await ClientsApi.remove(id);
      navigate('/clientes');
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? 'Não foi possível excluir esta cliente.');
      setDeleting(false);
    }
  }

  if (!client) return <p>Carregando...</p>;

  return (
    <div>
      <button className="btn-link" onClick={() => navigate('/clientes')}>
        ← Voltar
      </button>
      <div className="toolbar" style={{ marginBottom: '-0.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{client.name || '(sem nome)'}</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{client.phoneE164}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn secondary" onClick={() => setMessaging(true)}>
            Enviar mensagem
          </button>
          <button className="btn danger" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Excluindo...' : 'Excluir cliente'}
          </button>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Ficha de estilo</h3>
          <div className="form-grid">
            <label className="field">
              Nome
              <input value={client.name} onChange={(e) => updateField('name', e.target.value)} />
            </label>
            <label className="field">
              E-mail
              <input value={client.email ?? ''} onChange={(e) => updateField('email', e.target.value)} />
            </label>
            {STYLE_FIELDS.map((f) => (
              <label className="field" key={f.key}>
                {f.label}
                <input value={(client[f.key] as string) ?? ''} onChange={(e) => updateField(f.key, e.target.value)} />
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvando...' : 'Salvar ficha'}
            </button>
          </div>

          <h3>Sucesso do Cliente</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {SUCCESS_STAGE_ORDER.map((stage) => (
              <button
                key={stage}
                className={`btn ${client.successStage === stage ? '' : 'secondary'}`}
                disabled={changingStage}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => handleSuccessStage(stage)}
              >
                {SUCCESS_STAGE_LABELS[stage]}
              </button>
            ))}
          </div>
          <button className="btn secondary" onClick={handleGetIntakeLink} style={{ marginBottom: '0.5rem' }}>
            Gerar link do formulário de intake
          </button>
          {intakeLink && (
            <input readOnly value={intakeLink} onFocus={(e) => e.target.select()} style={{ width: '100%' }} />
          )}

          <h3>LGPD</h3>
          <p style={{ fontSize: '0.85rem' }}>
            Consentimento WhatsApp: <strong>{client.whatsappConsent ? 'Sim' : 'Não'}</strong>
          </p>
          <p style={{ fontSize: '0.85rem' }}>
            Consentimento marketing: <strong>{client.marketingConsent ? 'Sim' : 'Não'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Fotos e mood boards</h3>
            <label className="btn secondary" style={{ display: 'inline-block', marginBottom: '0.85rem' }}>
              + Enviar foto
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
            <div className="media-grid">
              {media.map((m) => (
                <img key={m.id} src={m.storageUrl} alt={m.caption ?? 'foto'} title={m.caption ?? undefined} />
              ))}
              {media.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhuma mídia ainda.</p>}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Histórico de atendimentos</h3>
            {appointments.map((a) => (
              <div className="appointment-row" key={a.id}>
                <div>
                  {new Date(a.startAt).toLocaleDateString('pt-BR')} — {a.service?.name}
                </div>
                <span className={`badge ${a.status}`}>{a.status}</span>
              </div>
            ))}
            {appointments.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Sem atendimentos ainda.</p>}
          </div>
        </div>
      </div>

      {messaging && (
        <SendMessageModal
          clientId={client.id}
          clientName={client.name}
          onClose={() => setMessaging(false)}
          onSent={() => setMessaging(false)}
        />
      )}
    </div>
  );
}
