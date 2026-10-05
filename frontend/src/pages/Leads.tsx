import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LeadsApi } from '../api/endpoints';
import type { Client, LeadSource } from '../api/types';
import { LEAD_SOURCE_LABELS } from '../constants/pipelineLabels';
import { useAuth } from '../auth/AuthContext';
import { ExportButton } from '../components/ExportButton';
import { LeadFormModal } from '../components/LeadFormModal';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState, TableState } from '../components/ui/StateViews';
import { errorMessage, useToast } from '../components/ui/Toast';
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
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  // Planilha com dados pessoais: só ADMIN/MANAGER (o backend também recusa os demais).
  const canExport = user?.role === 'ADMIN' || user?.role === 'MANAGER';

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
    const ok = await confirm({
      title: `Excluir ${lead.name || 'esta lead'}?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(lead.id);
    try {
      await LeadsApi.remove(lead.id);
      toast.success('Lead excluída.');
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir esta lead.'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Leads</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canExport && (
            <ExportButton
              label="Exportar CSV"
              path="/reports/leads.csv"
              params={{ search: list.params.search.trim(), source: list.params.filters.source, stage: list.params.filters.stage }}
              fallbackName="leads.csv"
            />
          )}
          <button className="btn" onClick={() => setCreating(true)}>
            + Nova lead
          </button>
        </div>
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

        {list.error && <ErrorState message="Não foi possível carregar as leads." onRetry={list.reload} />}

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
                <TableState colSpan={6}>
                  <LoadingState />
                </TableState>
              )}
              {!list.loading && !list.error && leads.length === 0 && (
                <TableState colSpan={6}>
                  <EmptyState>{list.filtersActive ? 'Nenhuma lead encontrada com esses filtros.' : 'Nenhuma lead cadastrada ainda.'}</EmptyState>
                </TableState>
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
