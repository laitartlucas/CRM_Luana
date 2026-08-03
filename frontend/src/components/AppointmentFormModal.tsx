import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { AppointmentsApi, CatalogApi, ClientsApi } from '../api/endpoints';
import type { Client, Service } from '../api/types';

export function AppointmentFormModal({
  professionalId,
  initialDate,
  onClose,
  onCreated,
}: {
  professionalId: string;
  initialDate?: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [location, setLocation] = useState<'PRESENCIAL' | 'ONLINE'>('PRESENCIAL');

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualEntry, setManualEntry] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');

  useEffect(() => {
    CatalogApi.list().then((res) => setServices(res.data));
  }, []);

  useEffect(() => {
    if (clientSearch.trim().length < 2) {
      setClientResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      ClientsApi.list(clientSearch).then((res) => setClientResults(res.data));
    }, 250);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  useEffect(() => {
    if (!serviceId || manualEntry) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    AppointmentsApi.availableSlots({
      professionalId,
      serviceId,
      from: (initialDate ?? new Date()).toISOString(),
    })
      .then((res) => setSlots(res.data))
      .finally(() => setLoadingSlots(false));
  }, [serviceId, professionalId, initialDate, manualEntry]);

  useEffect(() => {
    if (!manualEntry) return;
    if (!manualDate || !manualTime) {
      setSelectedSlot(null);
      return;
    }
    const parsed = new Date(`${manualDate}T${manualTime}`);
    setSelectedSlot(Number.isNaN(parsed.getTime()) ? null : parsed.toISOString());
  }, [manualEntry, manualDate, manualTime]);

  function toggleManualEntry(next: boolean) {
    setManualEntry(next);
    setSelectedSlot(null);
    if (!next) {
      setManualDate('');
      setManualTime('');
    }
  }

  async function handleSubmit() {
    setError(null);
    let clientId = selectedClient?.id;
    if (!clientId && newClientMode) {
      if (!newClientName || !newClientPhone) {
        setError('Preencha nome e telefone da nova cliente.');
        return;
      }
      try {
        const created = await ClientsApi.create({ name: newClientName, phoneE164: newClientPhone });
        clientId = created.data.id;
      } catch {
        setError('Não foi possível cadastrar a cliente. Verifique o telefone (formato internacional, ex.: +5511999999999).');
        return;
      }
    }
    if (!clientId || !serviceId || !selectedSlot) {
      setError('Selecione cliente, serviço e horário.');
      return;
    }
    setSubmitting(true);
    try {
      await AppointmentsApi.create({ professionalId, clientId, serviceId, startAt: selectedSlot, location });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível criar o agendamento.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Novo agendamento" onClose={onClose}>
      <label className="field">
        Cliente
        {selectedClient ? (
          <div className="appointment-row">
            <span>
              {selectedClient.name} ({selectedClient.phoneE164})
            </span>
            <button className="btn-link" onClick={() => setSelectedClient(null)}>
              trocar
            </button>
          </div>
        ) : (
          <>
            <input
              placeholder="Buscar por nome ou telefone..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            {clientResults.length > 0 && (
              <div className="slot-options">
                {clientResults.map((c) => (
                  <button key={c.id} className="slot-option" onClick={() => setSelectedClient(c)}>
                    {c.name} — {c.phoneE164}
                  </button>
                ))}
              </div>
            )}
            {clientSearch.length >= 2 && clientResults.length === 0 && !newClientMode && (
              <button className="btn-link" onClick={() => setNewClientMode(true)}>
                + cadastrar nova cliente "{clientSearch}"
              </button>
            )}
            {newClientMode && (
              <div className="form-grid">
                <input placeholder="Nome" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                <input
                  placeholder="+5511999999999"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </label>

      <label className="field">
        Serviço
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Selecione...</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMinutes}min)
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Local
        <select value={location} onChange={(e) => setLocation(e.target.value as 'PRESENCIAL' | 'ONLINE')}>
          <option value="PRESENCIAL">Presencial</option>
          <option value="ONLINE">Online</option>
        </select>
      </label>

      {serviceId && (
        <div className="field">
          <div className="appointment-row">
            <span>Horário</span>
            <button className="btn-link" onClick={() => toggleManualEntry(!manualEntry)}>
              {manualEntry ? 'ver horários sugeridos' : 'digitar data e horário manualmente'}
            </button>
          </div>

          {manualEntry ? (
            <div className="form-grid">
              <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
              <input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
            </div>
          ) : (
            <>
              {loadingSlots && <span>Buscando horários...</span>}
              {!loadingSlots && slots.length === 0 && <span>Nenhum horário livre encontrado nos próximos dias.</span>}
              <div className="slot-options">
                {slots.map((iso) => (
                  <button
                    key={iso}
                    className={`slot-option ${selectedSlot === iso ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(iso)}
                  >
                    {new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {error && <span className="error-text">{error}</span>}

      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Salvando...' : 'Agendar'}
        </button>
      </div>
    </Modal>
  );
}
