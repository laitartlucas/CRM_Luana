import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientsApi } from '../api/endpoints';
import type { Client, SuccessStage } from '../api/types';
import { ClientFormModal } from '../components/ClientFormModal';
import { Pagination } from '../components/Pagination';
import { SendMessageModal } from '../components/SendMessageModal';
import { usePagedList } from '../hooks/usePagedList';
import type { ListConfig } from '../utils/listParams';

// Definido fora do componente: o hook compara a configuração por identidade.
const LIST_CONFIG: ListConfig = { defaultSort: 'name:asc', filterKeys: ['successStage'] };

const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Nome (A–Z)' },
  { value: 'name:desc', label: 'Nome (Z–A)' },
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'createdAt:asc', label: 'Mais antigas' },
];

const SUCCESS_STAGE_OPTIONS: Array<{ value: SuccessStage; label: string }> = [
  { value: 'NEW_CLIENT', label: 'Nova cliente' },
  { value: 'INTAKE_FORM_SENT', label: 'Ficha enviada' },
  { value: 'FIRST_SESSION', label: 'Primeira sessão' },
  { value: 'ONGOING', label: 'Em acompanhamento' },
  { value: 'CLOSED', label: 'Encerrado' },
  { value: 'TESTIMONIAL', label: 'Depoimento' },
  { value: 'RENEWAL', label: 'Renovação' },
  { value: 'REFERRAL', label: 'Indicação' },
];

export default function Clients() {
  const [creating, setCreating] = useState(false);
  const [messagingClient, setMessagingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = usePagedList<Client>(LIST_CONFIG, (q) =>
    ClientsApi.list({
      page: q.page,
      search: q.search || undefined,
      sort: q.sort,
      order: q.order,
      successStage: (q.filters.successStage || undefined) as SuccessStage | undefined,
    }).then((res) => res.data),
  );
  const clients = list.data?.items ?? [];

  async function handleDelete(client: Client) {
    if (!window.confirm(`Excluir ${client.name || 'esta cliente'} definitivamente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeletingId(client.id);
    setActionError(null);
    try {
      await ClientsApi.remove(client.id);
      list.reload();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Não foi possível excluir esta cliente.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Clientes</h1>
        <button className="btn" onClick={() => setCreating(true)}>
          + Nova cliente
        </button>
      </div>

      <div className="card">
        <div className="list-filters">
          <input
            placeholder="Buscar por nome ou telefone..."
            aria-label="Buscar clientes"
            value={list.searchInput}
            onChange={(e) => list.setSearchInput(e.target.value)}
          />
          <select
            aria-label="Filtrar por etapa"
            value={list.params.filters.successStage}
            onChange={(e) => list.setFilter('successStage', e.target.value)}
          >
            <option value="">Todas as etapas</option>
            {SUCCESS_STAGE_OPTIONS.map((o) => (
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
            Não foi possível carregar as clientes.{' '}
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
                <th>Estilo predominante</th>
                <th>Score no-show</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/clientes/${c.id}`}>{c.name || '(sem nome)'}</Link>
                  </td>
                  <td>{c.phoneE164}</td>
                  <td>{c.predominantStyle ?? '—'}</td>
                  <td>{Math.round(c.noShowScore * 100)}%</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-link" onClick={() => setMessagingClient(c)}>
                      Mensagem
                    </button>{' '}
                    <button
                      className="btn-link"
                      style={{ color: 'var(--color-danger)', marginLeft: '0.75rem' }}
                      disabled={deletingId === c.id}
                      onClick={() => handleDelete(c)}
                    >
                      {deletingId === c.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </td>
                </tr>
              ))}
              {list.loading && !list.data && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!list.loading && !list.error && clients.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>
                    {list.filtersActive ? 'Nenhuma cliente encontrada com esses filtros.' : 'Nenhuma cliente cadastrada ainda.'}
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
        <ClientFormModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}

      {messagingClient && (
        <SendMessageModal
          clientId={messagingClient.id}
          clientName={messagingClient.name}
          onClose={() => setMessagingClient(null)}
          onSent={() => setMessagingClient(null)}
        />
      )}
    </div>
  );
}
