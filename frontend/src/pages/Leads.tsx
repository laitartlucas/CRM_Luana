import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LeadsApi } from '../api/endpoints';
import type { Client, LeadSource } from '../api/types';
import { LEAD_SOURCE_LABELS } from '../constants/pipelineLabels';
import { LeadFormModal } from '../components/LeadFormModal';
import { Pagination } from '../components/Pagination';
import { SendMessageModal } from '../components/SendMessageModal';
import { usePagedList } from '../hooks/usePagedList';
import type { ListConfig } from '../utils/listParams';

// Definido fora do componente: o hook compara a configuração por identidade.
const LIST_CONFIG: ListConfig = { defaultSort: 'leadScore:desc', filterKeys: ['source', 'stage'] };

const SORT_OPTIONS = [
  { value: 'leadScore:desc', label: 'Maior score primeiro' },
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'createdAt:asc', label: 'Mais antigas' },
  { value: 'name:asc', label: 'Nome (A–Z)' },
  { value: 'name:desc', label: 'Nome (Z–A)' },
];

const STAGE_OPTIONS = [
  { value: 'LEAD', label: 'Lead nova' },
  { value: 'PIPELINE', label: 'No Pipeline' },
];

export default function Leads() {
  const [creating, setCreating] = useState(false);
  const [messagingLead, setMessagingLead] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = usePagedList<Client>(LIST_CONFIG, (q) =>
    LeadsApi.list({
      page: q.page,
      search: q.search || undefined,
      sort: q.sort,
      order: q.order,
      source: (q.filters.source || undefined) as LeadSource | undefined,
      stage: (q.filters.stage || undefined) as 'LEAD' | 'PIPELINE' | undefined,
    }).then((res) => res.data),
  );
  const leads = list.data?.items ?? [];

  async function handleDelete(lead: Client) {
    if (!window.confirm(`Excluir ${lead.name || 'esta lead'} definitivamente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeletingId(lead.id);
    setActionError(null);
    try {
      await LeadsApi.remove(lead.id);
      list.reload();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Não foi possível excluir esta lead.');
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
        <div className="list-filters">
          <input
            placeholder="Buscar por nome, telefone ou Instagram..."
            aria-label="Buscar leads"
            value={list.searchInput}
            onChange={(e) => list.setSearchInput(e.target.value)}
          />
          <select aria-label="Filtrar por origem" value={list.params.filters.source} onChange={(e) => list.setFilter('source', e.target.value)}>
            <option value="">Todas as origens</option>
            {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
          <select aria-label="Filtrar por situação" value={list.params.filters.stage} onChange={(e) => list.setFilter('stage', e.target.value)}>
            <option value="">Todas as situações</option>
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Ordenar por" value={list.params.sort} onChange={(e) => list.setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {list.filtersActive && (
            <button className="btn-link" onClick={list.clearAll}>
              Limpar filtros
            </button>
          )}
        </div>

        {actionError && (
          <p className="error-text" role="alert">
            {actionError}
          </p>
        )}
        {list.error && (
          <p className="error-text" role="alert">
            Não foi possível carregar as leads.{' '}
            <button className="btn-link" onClick={list.reload}>
              Tentar de novo
            </button>
          </p>
        )}

        <div className="table-scroll" style={{ opacity: list.loading && list.data ? 0.6 : 1 }} aria-busy={list.loading}>
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
              {list.loading && !list.data && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!list.loading && !list.error && leads.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>
                    {list.filtersActive ? 'Nenhuma lead encontrada com esses filtros.' : 'Nenhuma lead cadastrada ainda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {list.data && (
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize}
            total={list.data.total}
            totalPages={list.data.totalPages}
            disabled={list.loading}
            onChange={list.setPage}
          />
        )}
      </div>

      {creating && (
        <LeadFormModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            list.reload();
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
