import { useEffect, useState } from 'react';
import { CatalogApi } from '../api/endpoints';
import type { Service } from '../api/types';

const EMPTY = { name: '', description: '', durationMinutes: 60, price: 0 };

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    CatalogApi.list(true).then((res) => setServices(res.data));
  }

  useEffect(load, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description ?? '',
      durationMinutes: service.durationMinutes,
      price: Number(service.price),
    });
    setError(null);
  }

  async function handleSubmit() {
    if (!form) return;
    try {
      if (editingId) {
        await CatalogApi.update(editingId, form);
      } else {
        await CatalogApi.create(form);
      }
      setForm(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível salvar o serviço.');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Catálogo de serviços</h1>
        <button className="btn" onClick={startCreate}>
          + Novo serviço
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Duração</th>
              <th>Preço</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.durationMinutes} min</td>
                <td>{Number(s.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td>{s.active ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <button className="btn-link" onClick={() => startEdit(s)}>
                    editar
                  </button>
                  {s.active && (
                    <button className="btn-link" style={{ marginLeft: '0.75rem' }} onClick={() => CatalogApi.deactivate(s.id).then(load)}>
                      desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="card" style={{ marginTop: '1rem', maxWidth: 420 }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar serviço' : 'Novo serviço'}</h3>
          <div className="form-grid">
            <label className="field">
              Nome
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              Duração (min)
              <input
                type="number"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              Preço (R$)
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </label>
            <label className="field">
              Descrição
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </div>
          {error && <span className="error-text">{error}</span>}
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="btn" onClick={handleSubmit}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
