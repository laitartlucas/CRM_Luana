import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientsApi } from '../api/endpoints';
import type { Client } from '../api/types';
import { ClientFormModal } from '../components/ClientFormModal';
import { SendMessageModal } from '../components/SendMessageModal';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [messagingClient, setMessagingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    ClientsApi.list(search || undefined).then((res) => setClients(res.data));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(client: Client) {
    if (!window.confirm(`Excluir ${client.name || 'esta cliente'} definitivamente? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeletingId(client.id);
    try {
      await ClientsApi.remove(client.id);
      load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message ?? 'Não foi possível excluir esta cliente.');
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
        <input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: '1rem', width: '100%', maxWidth: 320 }}
        />
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
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>
                  Nenhuma cliente encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <ClientFormModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
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
