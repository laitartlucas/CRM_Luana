import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PipelineApi } from '../api/endpoints';
import type { Client, PipelineBoard, PipelineStage } from '../api/types';
import { KanbanBoard, KanbanColumnDef } from '../components/KanbanBoard';
import { CallScheduleModal } from '../components/CallScheduleModal';
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER } from '../constants/pipelineLabels';
import { LoadingState } from '../components/ui/StateViews';

const COLUMNS: KanbanColumnDef[] = PIPELINE_STAGE_ORDER.map((stage) => ({
  id: stage,
  label: PIPELINE_STAGE_LABELS[stage],
}));

export default function Pipeline() {
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [pendingCallCard, setPendingCallCard] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    PipelineApi.board().then((res) => setBoard(res.data));
  }

  useEffect(load, []);

  async function handleMove(itemId: string, toColumnId: string) {
    const toStage = toColumnId as PipelineStage;
    setError(null);

    if (toStage === 'CALL_SCHEDULED') {
      const card = Object.values(board ?? {})
        .flat()
        .find((c) => c?.id === itemId);
      if (card) setPendingCallCard(card);
      return;
    }

    try {
      await PipelineApi.changeStage(itemId, { toStage });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível mover o card.');
    }
  }

  async function confirmCallSchedule(callDateIso: string) {
    if (!pendingCallCard) return;
    try {
      await PipelineApi.changeStage(pendingCallCard.id, { toStage: 'CALL_SCHEDULED', callDate: callDateIso });
      setPendingCallCard(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível agendar a call.');
    }
  }

  if (!board) return <LoadingState />;

  const openCards = PIPELINE_STAGE_ORDER.filter((st) => st !== 'CLOSED_WON' && st !== 'CLOSED_LOST').flatMap((st) => board[st] ?? []);
  const total = openCards.length;
  const proposalTotal = openCards.reduce((sum, c) => sum + (c.proposalValue != null ? Number(c.proposalValue) : 0), 0);

  return (
    <div className="page-wide">
      <div className="toolbar">
        <div>
          <h1>Pipeline comercial</h1>
          <p className="page-subtitle">
            {total} {total === 1 ? 'oportunidade' : 'oportunidades'}
            {proposalTotal > 0 && (
              <>
                {' · '}
                <strong style={{ color: 'var(--color-text)' }}>
                  {proposalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </strong>{' '}
                em propostas
              </>
            )}
            {' · '}arraste os cartões ou use “Mover para…”. Etapas vazias ficam recolhidas.
          </p>
        </div>
      </div>
      {error && (
        <div className="alert danger" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>{error}</strong>
        </div>
      )}

      <KanbanBoard
        columns={COLUMNS}
        itemsByColumn={board}
        getItemLabel={(client: Client) => client.name || 'lead sem nome'}
        onMove={handleMove}
        renderCard={(client: Client) => (
          <Link to={`/leads/${client.id}`}>
            <strong>{client.name || '(sem nome)'}</strong>
            {client.phoneE164 && <div className="kanban-card-sub">{client.phoneE164}</div>}
            {client.nextActionNote && (
              <div className="kanban-card-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span>{client.nextActionNote}</span>
              </div>
            )}
            <div className="kanban-card-meta">
              {(client.leadScore ?? 0) > 0 ? (
                <span className={`score-badge${(client.leadScore ?? 0) >= 60 ? ' high' : ''}`}>Score {client.leadScore}</span>
              ) : (
                <span />
              )}
              {client.proposalValue != null && (
                <span className="kanban-card-value">
                  {Number(client.proposalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </Link>
        )}
      />

      {pendingCallCard && (
        <CallScheduleModal
          clientName={pendingCallCard.name || '(sem nome)'}
          onClose={() => setPendingCallCard(null)}
          onConfirm={confirmCallSchedule}
        />
      )}
    </div>
  );
}
