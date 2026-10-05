import { useCallback, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { AppointmentsApi, ScheduleBlocksApi } from '../api/endpoints';
import type { Appointment } from '../api/types';
import { useProfessional } from '../hooks/useProfessional';
import { AppointmentFormModal } from '../components/AppointmentFormModal';
import { useToast } from '../components/ui/Toast';
import { AppointmentDetailModal } from '../components/AppointmentDetailModal';
import { BlockFormModal } from '../components/BlockFormModal';

// As cores de cada situação ficam no CSS (.fc .ev-STATUS), com os mesmos tons dos selos do resto do sistema.
const LEGEND = [
  { label: 'Confirmado', bg: 'var(--success-bg)', border: 'var(--success-fg)' },
  { label: 'Aguardando', bg: 'var(--warning-bg)', border: 'var(--warning-fg)' },
  { label: 'No-show', bg: 'var(--danger-bg)', border: 'var(--danger-fg)' },
  { label: 'Concluído', bg: 'var(--neutral-200)', border: 'var(--neutral-500)' },
  { label: 'Bloqueado', bg: 'var(--neutral-300)', border: 'var(--neutral-500)' },
];

const NARROW_QUERY = '(max-width: 760px)';

/** No celular a semana inteira não cabe: a agenda abre no dia, com navegação compacta. */
function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW_QUERY);
    if (!mq) return;
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

export default function Agenda() {
  const { professional, loading } = useProfessional();
  const toast = useToast();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [creatingAt, setCreatingAt] = useState<Date | null>(null);
  const [blockingAt, setBlockingAt] = useState<Date | null>(null);
  const appointmentsCache = useRef<Map<string, Appointment>>(new Map());
  const narrow = useNarrowScreen();

  // Ao cruzar o limite (girar o celular, redimensionar a janela) troca entre semana e dia.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const target = narrow ? 'timeGridDay' : 'timeGridWeek';
    if (api.view.type !== 'dayGridMonth' && api.view.type !== target) api.changeView(target);
  }, [narrow]);

  const loadRange = useCallback(
    async (start: Date, end: Date) => {
      if (!professional) return;
      const [appointments, blocks] = await Promise.all([
        AppointmentsApi.list({ professionalId: professional.id, from: start.toISOString(), to: end.toISOString() }),
        ScheduleBlocksApi.list(professional.id, start.toISOString(), end.toISOString()),
      ]);

      appointmentsCache.current = new Map(appointments.data.map((a) => [a.id, a]));

      const appointmentEvents = appointments.data
        .filter((a) => a.status !== 'CANCELLED')
        .map((a) => ({
          id: a.id,
          title: `${a.client?.name} — ${a.service?.name}`,
          start: a.startAt,
          end: a.endAt,
          classNames: [`ev-${a.status}`],
        }));

      const blockEvents = blocks.data.map((b) => ({
        id: `block-${b.id}`,
        title: b.reason ?? b.type,
        start: b.startAt,
        end: b.endAt,
        display: 'background',
      }));

      setEvents([...appointmentEvents, ...blockEvents]);
    },
    [professional],
  );

  function refresh() {
    const api = calendarRef.current?.getApi();
    if (api) loadRange(api.view.activeStart, api.view.activeEnd);
    setSelectedAppointment(null);
    setCreatingAt(null);
    setBlockingAt(null);
  }

  function handleEventClick(arg: EventClickArg) {
    if (arg.event.id.startsWith('block-')) return;
    const appointment = appointmentsCache.current.get(arg.event.id);
    if (appointment) setSelectedAppointment(appointment);
  }

  async function handleEventDrop(arg: EventDropArg) {
    try {
      await AppointmentsApi.reschedule(arg.event.id, arg.event.start!.toISOString());
      refresh();
    } catch {
      arg.revert();
      toast.error('Não foi possível remarcar: horário indisponível.');
    }
  }

  function handleSelect(arg: DateSelectArg) {
    setCreatingAt(arg.start);
  }

  if (loading) return <p>Carregando agenda...</p>;
  if (!professional) return <p>Cadastre um profissional em Configurações antes de usar a agenda.</p>;

  return (
    <div>
      <div className="toolbar">
        <h1>Agenda</h1>
        <div className="toolbar-actions">
          <button className="btn secondary" onClick={() => setBlockingAt(new Date())}>
            Bloquear horário
          </button>
          <button className="btn" onClick={() => setCreatingAt(new Date())}>
            + Novo agendamento
          </button>
        </div>
      </div>

      <div className="card">
        <ul className="calendar-legend" aria-label="Legenda das cores">
          {LEGEND.map((item) => (
            <li key={item.label}>
              <i style={{ background: item.bg, borderColor: item.border }} />
              {item.label}
            </li>
          ))}
        </ul>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={narrow ? 'timeGridDay' : 'timeGridWeek'}
          headerToolbar={
            narrow
              ? { left: 'title', center: '', right: 'prev,today,next' }
              : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
          }
          footerToolbar={narrow ? { center: 'dayGridMonth,timeGridWeek,timeGridDay' } : undefined}
          nowIndicator
          dayHeaderFormat={narrow ? { weekday: 'long', day: '2-digit', month: '2-digit' } : { weekday: 'short', day: '2-digit', month: '2-digit' }}
          locale={ptBrLocale}
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          height="auto"
          selectable
          editable
          events={events}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          select={handleSelect}
          datesSet={(arg) => {
            loadRange(arg.start, arg.end);
            // O FullCalendar marca os ícones das setas como role="img" sem texto; os botões já têm nome próprio.
            document.querySelectorAll('.fc .fc-icon').forEach((icon) => {
              icon.removeAttribute('role');
              icon.setAttribute('aria-hidden', 'true');
            });
          }}
        />
      </div>

      {creatingAt && (
        <AppointmentFormModal
          professionalId={professional.id}
          initialDate={creatingAt}
          onClose={() => setCreatingAt(null)}
          onCreated={refresh}
        />
      )}
      {blockingAt && (
        <BlockFormModal
          professionalId={professional.id}
          initialDate={blockingAt}
          onClose={() => setBlockingAt(null)}
          onCreated={refresh}
        />
      )}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
