import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientsApi } from '../api/endpoints';
import type { Client } from '../api/types';
import { ClientFormModal } from '../components/ClientFormModal';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    ClientsApi.list(search || undefined).then((res) => setClients(res.data));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--color-text-muted)' }}>
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
    </div>
  );
}
