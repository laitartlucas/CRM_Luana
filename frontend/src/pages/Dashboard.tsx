import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppointmentsApi, DashboardApi } from '../api/endpoints';
import type { Appointment, DashboardKpis } from '../api/types';
import { useProfessional } from '../hooks/useProfessional';

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const { professional } = useProfessional();
  const [today, setToday] = useState<Appointment[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [weekly, setWeekly] = useState<{ day: string; agendamentos: number }[]>([]);

  useEffect(() => {
    DashboardApi.today(professional?.id).then((res) => setToday(res.data));
    DashboardApi.kpis({ professionalId: professional?.id }).then((res) => setKpis(res.data));
  }, [professional?.id]);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    AppointmentsApi.list({ professionalId: professional?.id, from: from.toISOString(), to: to.toISOString() }).then(
      (res) => {
        const byDay = new Map<string, number>();
        for (let i = 0; i < 7; i++) {
          const d = new Date(from);
          d.setDate(d.getDate() + i);
          byDay.set(d.toLocaleDateString('pt-BR', { weekday: 'short' }), 0);
        }
        res.data
          .filter((a) => a.status !== 'CANCELLED')
          .forEach((a) => {
            const key = new Date(a.startAt).toLocaleDateString('pt-BR', { weekday: 'short' });
            byDay.set(key, (byDay.get(key) ?? 0) + 1);
          });
        setWeekly(Array.from(byDay.entries()).map(([day, agendamentos]) => ({ day, agendamentos })));
      },
    );
  }, [professional?.id]);

  const kpiTiles = useMemo(
    () => [
      { label: 'Agendamentos no mês', value: kpis?.totalAppointments ?? '—' },
      { label: 'Taxa de confirmação', value: kpis ? pct(kpis.confirmationRate) : '—' },
      { label: 'Taxa de no-show', value: kpis ? pct(kpis.noShowRate) : '—' },
      { label: 'Ocupação da agenda', value: kpis ? pct(kpis.occupancyRate) : '—' },
      { label: 'Faturamento projetado', value: kpis ? money(kpis.revenueProjection) : '—' },
      { label: 'Faturamento realizado', value: kpis ? money(kpis.revenueRealized) : '—' },
    ],
    [kpis],
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Painel</h1>

      <div className="kpi-grid">
        {kpiTiles.map((tile) => (
          <div key={tile.label} className="card kpi-tile">
            <span className="value">{tile.value}</span>
            <span className="label">{tile.label}</span>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Agendamentos de hoje</h3>
          {today.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum agendamento para hoje.</p>}
          {today.map((a) => (
            <div className="appointment-row" key={a.id}>
              <div>
                <strong>{formatTime(a.startAt)}</strong> — {a.client?.name}
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{a.service?.name}</div>
              </div>
              <span className={`badge ${a.status}`}>{a.status}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Agendamentos — últimos 7 dias</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#e6e1db" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#75695f' }} axisLine={{ stroke: '#e6e1db' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#75695f' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: '#f1e9e3' }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e6e1db', fontSize: '0.85rem' }}
              />
              <Bar dataKey="agendamentos" fill="#8a5a44" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
