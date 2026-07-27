import { useCallback, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import { AppointmentsApi, ScheduleBlocksApi } from '../api/endpoints';
import type { Appointment } from '../api/types';
import { useProfessional } from '../hooks/useProfessional';
import { AppointmentFormModal } from '../components/AppointmentFormModal';
import { AppointmentDetailModal } from '../components/AppointmentDetailModal';
import { BlockFormModal } from '../components/BlockFormModal';

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: '#4a5590',
  CONFIRMED: '#4c7a52',
  COMPLETED: '#7a7a7a',
  CANCELLED: '#b3423a',
  NO_SHOW: '#a65221',
};

export default function Agenda() {
  const { professional, loading } = useProfessional();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [creatingAt, setCreatingAt] = useState<Date | null>(null);
  const [blockingAt, setBlockingAt] = useState<Date | null>(null);
  const appointmentsCache = useRef<Map<string, Appointment>>(new Map());

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
          backgroundColor: STATUS_COLOR[a.status],
          borderColor: STATUS_COLOR[a.status],
        }));

      const blockEvents = blocks.data.map((b) => ({
        id: `block-${b.id}`,
        title: b.reason ?? b.type,
        start: b.startAt,
        end: b.endAt,
        display: 'background',
        backgroundColor: '#e6e1db',
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
      alert('Não foi possível remarcar: horário indisponível.');
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
        <h1 style={{ margin: 0 }}>Agenda</h1>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn secondary" onClick={() => setBlockingAt(new Date())}>
            Bloquear horário
          </button>
          <button className="btn" onClick={() => setCreatingAt(new Date())}>
            + Novo agendamento
          </button>
        </div>
      </div>

      <div className="card">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          locale="pt-br"
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
          datesSet={(arg) => loadRange(arg.start, arg.end)}
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
