import { useEffect, useMemo, useState } from 'react';
import { CatalogApi } from '../api/endpoints';
import type { Service } from '../api/types';

const EMPTY = { name: '', description: '', durationMinutes: 60, price: 0 };

type Filter = 'active' | 'inactive' | 'all';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
  { value: 'all', label: 'Todos' },
];

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');

  const counts = useMemo(
    () => ({ active: services.filter((s) => s.active).length, inactive: services.filter((s) => !s.active).length, all: services.length }),
    [services],
  );
  const visible = services.filter((s) => (filter === 'all' ? true : filter === 'active' ? s.active : !s.active));

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
        <div>
          <h1>Catálogo de serviços</h1>
          <p className="page-subtitle">Os serviços ativos aparecem no agendamento e nas mensagens do WhatsApp.</p>
        </div>
        <div className="toolbar-actions">
          <button className="btn" onClick={startCreate}>
            + Novo serviço
          </button>
        </div>
      </div>

      {form && (
        <div className="card" style={{ marginBottom: 'var(--space-5)', maxWidth: 720 }}>
          <h2 className="section-title">{editingId ? 'Editar serviço' : 'Novo serviço'}</h2>
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
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
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

      <div className="card">
        <div className="tabs" role="tablist" aria-label="Filtrar serviços">
          {FILTERS.map((f) => (
            <button key={f.value} role="tab" aria-selected={filter === f.value} className={`tab${filter === f.value ? ' active' : ''}`} onClick={() => setFilter(f.value)}>
              {f.label}
              <span className="tab-count">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <div className="table-scroll" style={{ marginTop: 'var(--space-4)' }}>
          <table className="rtable">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Duração</th>
                <th>Preço</th>
                <th>Status</th>
                <th className="actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id}>
                  <td className="cell-primary">
                    <strong>{s.name}</strong>
                    {s.description && <div className="help-text">{s.description}</div>}
                  </td>
                  <td data-label="Duração" className="num">{s.durationMinutes} min</td>
                  <td data-label="Preço" className="num" style={{ fontWeight: 600 }}>
                    {Number(s.price) === 0 ? 'Gratuito' : Number(s.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${s.active ? 'tone-success' : 'tone-neutral'}`}>{s.active ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="actions">
                    <button className="btn-link" onClick={() => startEdit(s)}>
                      Editar
                    </button>
                    {s.active && (
                      <button className="btn-link destructive" onClick={() => CatalogApi.deactivate(s.id).then(load)}>
                        Desativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <p className="state-view">Nenhum serviço nesta lista.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
