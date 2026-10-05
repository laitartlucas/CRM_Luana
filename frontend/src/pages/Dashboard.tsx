import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ClientSuccessApi, DashboardApi, PipelineApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { ExportButton } from '../components/ExportButton';
import { AppointmentStatusBadge } from '../components/ui/StatusBadge';
import { CHART, CHART_TOOLTIP_STYLE } from '../constants/chartTheme';
import { PeriodPicker } from '../components/PeriodPicker';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateViews';
import { LEAD_SOURCE_LABELS, PIPELINE_STAGE_LABELS } from '../constants/pipelineLabels';
import { useAsyncData } from '../hooks/useAsyncData';
import { useProfessional } from '../hooks/useProfessional';
import { chartPoints, PeriodSelection, readPeriod, writePeriod } from '../utils/period';

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const TOOLTIP_STYLE = CHART_TOOLTIP_STYLE;

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { professional, loading: professionalLoading } = useProfessional();

  // Faturamento, funil e origem são só para ADMIN/MANAGER (o backend também recusa os demais).
  const canSeeReports = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const selection = useMemo(() => readPeriod(searchParams), [searchParams]);
  const { from, to } = selection.period;
  const professionalId = professional?.id;
  const ready = !professionalLoading;

  function changePeriod(next: PeriodSelection) {
    setSearchParams(writePeriod(next, searchParams), { replace: true });
  }

  const today = useAsyncData(() => DashboardApi.today(professionalId).then((r) => r.data), [professionalId], ready);
  const byDay = useAsyncData(
    () => DashboardApi.appointmentsByDay({ professionalId, from, to }).then((r) => r.data),
    [professionalId, from, to],
    ready,
  );
  const kpis = useAsyncData(() => DashboardApi.kpis({ professionalId, from, to }).then((r) => r.data), [professionalId, from, to], ready && canSeeReports);
  const metrics = useAsyncData(() => PipelineApi.metrics({ from, to }).then((r) => r.data), [from, to], canSeeReports);
  const funnel = useAsyncData(() => PipelineApi.funnelReport({ from, to }).then((r) => r.data), [from, to], canSeeReports);
  const origins = useAsyncData(() => PipelineApi.originReport({ from, to }).then((r) => r.data), [from, to], canSeeReports);
  const successBoard = useAsyncData(() => ClientSuccessApi.board().then((r) => r.data), [], canSeeReports);

  // Renovação/indicação olha todas as clientes (a etapa de sucesso não tem data própria): não depende do período.
  const renewalRate = useMemo(() => {
    const board = successBoard.data;
    if (!board) return 0;
    const total = Object.values(board).reduce((sum, list) => sum + (list?.length ?? 0), 0);
    if (total === 0) return 0;
    return ((board.RENEWAL?.length ?? 0) + (board.REFERRAL?.length ?? 0)) / total;
  }, [successBoard.data]);

  const funnelChartData = useMemo(
    () => (funnel.data?.mainPath ?? []).map((e) => ({ etapa: PIPELINE_STAGE_LABELS[e.stage], leads: e.count, won: e.stage === 'CLOSED_WON' })),
    [funnel.data],
  );
  const originChartData = useMemo(
    () =>
      (origins.data ?? []).slice(0, 8).map((e) => ({
        origem: LEAD_SOURCE_LABELS[e.leadSource],
        leads: e.leads,
        fechados: e.closedWon,
      })),
    [origins.data],
  );
  const dayChartData = useMemo(() => chartPoints(byDay.data ?? []), [byDay.data]);

  // "meter" desenha a barra de progresso (caramelo = progresso, sempre a mesma linguagem).
  const realizedShare = kpis.data && kpis.data.revenueProjection > 0 ? kpis.data.revenueRealized / kpis.data.revenueProjection : 0;
  const kpiTiles: Array<{ label: string; value: string | number; meter?: number; note?: string }> = [
    {
      label: 'Faturamento realizado',
      value: kpis.data ? money(kpis.data.revenueRealized) : '—',
      meter: kpis.data ? realizedShare : undefined,
      note: kpis.data ? `${pct(Math.min(realizedShare, 1))} do projetado` : undefined,
    },
    { label: 'Faturamento projetado', value: kpis.data ? money(kpis.data.revenueProjection) : '—' },
    { label: 'Agendamentos no período', value: kpis.data?.totalAppointments ?? '—' },
    { label: 'Taxa de confirmação', value: kpis.data ? pct(kpis.data.confirmationRate) : '—', meter: kpis.data?.confirmationRate },
    { label: 'Taxa de no-show', value: kpis.data ? pct(kpis.data.noShowRate) : '—' },
    { label: 'Ocupação da agenda', value: kpis.data ? pct(kpis.data.occupancyRate) : '—', meter: kpis.data?.occupancyRate },
    { label: 'Ticket médio (fechados no período)', value: metrics.data ? money(metrics.data.averageTicket) : '—' },
    { label: 'Renovação/indicação (todas as clientes)', value: successBoard.data ? pct(renewalRate) : '—' },
  ];

  return (
    <div>
      <div className="toolbar">
        <h1>Painel</h1>
        <PeriodPicker selection={selection} onChange={changePeriod} />
      </div>

      {canSeeReports && (
        <>
          {(kpis.error || metrics.error) && (
            <ErrorState
              message="Não foi possível carregar todos os indicadores."
              onRetry={() => {
                kpis.reload();
                metrics.reload();
              }}
            />
          )}
          <div className="kpi-grid" aria-busy={kpis.loading || metrics.loading}>
            {kpiTiles.map((tile) => (
              <div key={tile.label} className="card kpi-tile">
                <span className="value">{tile.value}</span>
                <span className="label">{tile.label}</span>
                {tile.meter !== undefined && (
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${Math.round(Math.min(Math.max(tile.meter, 0), 1) * 100)}%` }} />
                  </span>
                )}
                {tile.note && <span className="help-text">{tile.note}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="two-col">
        <div className="card">
          <h2 className="section-title">Agendamentos de hoje</h2>
          {today.error && <ErrorState message="Não foi possível carregar os agendamentos de hoje." onRetry={today.reload} />}
          {today.loading && !today.data && <LoadingState />}
          {today.data?.length === 0 && <EmptyState>Nenhum agendamento para hoje.</EmptyState>}
          {today.data?.map((a) => (
            <div className="appointment-row" key={a.id}>
              <span className="appointment-time">{formatTime(a.startAt)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="appointment-who">{a.client?.name}</div>
                <div className="appointment-what">{a.service?.name}</div>
              </div>
              <AppointmentStatusBadge status={a.status} />
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="section-title">Agendamentos no período</h2>
          {byDay.error && <ErrorState message="Não foi possível carregar o gráfico." onRetry={byDay.reload} />}
          {byDay.loading && !byDay.data && <LoadingState />}
          {byDay.data && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dayChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.axisLine }} tickLine={false} minTickGap={12} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: CHART.cursor }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="agendamentos" name="Agendamentos" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {canSeeReports && (
        <>
          <div className="card-grid-2" style={{ marginTop: 'var(--space-4)' }}>
            <div className="card">
              <div className="card-header">
                <h2 className="section-title">Funil do pipeline comercial</h2>
                <ExportButton label="Exportar CSV" path="/reports/funnel.csv" params={{ from, to }} fallbackName="funil.csv" />
              </div>
              {funnel.error && <ErrorState message="Não foi possível carregar o funil." onRetry={funnel.reload} />}
              {funnel.loading && !funnel.data && <LoadingState />}
              {funnel.data && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={funnelChartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={CHART.grid} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="etapa" width={110} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: CHART.cursor }} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="leads" name="Leads" fill={CHART.primary} radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {funnelChartData.map((d) => (
                        <Cell key={d.etapa} fill={d.won ? CHART.success : CHART.primary} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="section-title">Origem das leads</h2>
                <ExportButton label="Exportar CSV" path="/reports/origins.csv" params={{ from, to }} fallbackName="origem-das-leads.csv" />
              </div>
              {origins.error && <ErrorState message="Não foi possível carregar a origem das leads." onRetry={origins.reload} />}
              {origins.loading && !origins.data && <LoadingState />}
              {origins.data?.length === 0 && <EmptyState>Nenhuma lead cadastrada neste período.</EmptyState>}
              {origins.data && origins.data.length > 0 && (
                <>
                <ul className="chart-legend">
                  <li>
                    <i style={{ background: CHART.secondary }} />
                    Leads
                  </li>
                  <li>
                    <i style={{ background: CHART.primary }} />
                    Fecharam
                  </li>
                </ul>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={originChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="origem" tick={{ fontSize: 10, fill: CHART.axis }} axisLine={{ stroke: CHART.axisLine }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip cursor={{ fill: CHART.cursor }} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="leads" name="Leads" fill={CHART.secondary} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="fechados" name="Fecharam" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
                </>
              )}
            </div>
          </div>
          <p className="report-note">
            O período vale para agendamentos, faturamento, funil, origem das leads (leads cadastradas nele) e ticket médio (fechamentos
            nele). Renovação/indicação considera todas as clientes.
          </p>
        </>
      )}
    </div>
  );
}
