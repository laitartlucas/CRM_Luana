import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LeadsApi } from '../api/endpoints';
import type { Client } from '../api/types';
import { LEAD_SOURCE_LABELS } from '../constants/pipelineLabels';
import { LeadFormModal } from '../components/LeadFormModal';
import { SendMessageModal } from '../components/SendMessageModal';

export default function Leads() {
  const [leads, setLeads] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [messagingLead, setMessagingLead] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    LeadsApi.list({ search: search || undefined }).then((res) => setLeads(res.data));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(lead: Client) {
    if (!window.confirm(`Excluir ${lead.name || 'esta lead'} definitivamente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeletingId(lead.id);
    try {
      await LeadsApi.remove(lead.id);
      load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? 'Não foi possível excluir esta lead.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Leads</h1>
        <button className="btn" onClick={() => setCreating(true)}>
          + Nova lead
        </button>
      </div>

      <div className="card">
        <input
          placeholder="Buscar por nome, telefone ou Instagram..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: '1rem', width: '100%', maxWidth: 320 }}
        />
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>WhatsApp</th>
              <th>Origem</th>
              <th>Score</th>
              <th>Situação</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link to={`/leads/${l.id}`}>{l.name || '(sem nome)'}</Link>
                </td>
                <td>{l.phoneE164}</td>
                <td>{l.leadSource ? LEAD_SOURCE_LABELS[l.leadSource] : '—'}</td>
                <td>{l.leadScore ?? 0}</td>
                <td>{l.funnelStage === 'PIPELINE' ? 'No Pipeline' : 'Lead nova'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn-link" onClick={() => setMessagingLead(l)}>
                    Mensagem
                  </button>{' '}
                  <button
                    className="btn-link"
                    style={{ color: 'var(--color-danger)', marginLeft: '0.75rem' }}
                    disabled={deletingId === l.id}
                    onClick={() => handleDelete(l)}
                  >
                    {deletingId === l.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>
                  Nenhuma lead encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <LeadFormModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {messagingLead && (
        <SendMessageModal
          clientId={messagingLead.id}
          clientName={messagingLead.name}
          onClose={() => setMessagingLead(null)}
          onSent={() => setMessagingLead(null)}
        />
      )}
    </div>
  );
}
