import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PipelineApi } from '../api/endpoints';
import type { Client, PipelineBoard, PipelineStage } from '../api/types';
import { KanbanBoard, KanbanColumnDef } from '../components/KanbanBoard';
import { CallScheduleModal } from '../components/CallScheduleModal';
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER } from '../constants/pipelineLabels';

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

  if (!board) return <p>Carregando...</p>;

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Pipeline Comercial</h1>
      </div>
      {error && <p className="error-text">{error}</p>}

      <KanbanBoard
        columns={COLUMNS}
        itemsByColumn={board}
        onMove={handleMove}
        renderCard={(client: Client) => (
          <Link to={`/leads/${client.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            <strong>{client.name || '(sem nome)'}</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{client.phoneE164}</div>
            {client.nextActionNote && (
              <div style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>📌 {client.nextActionNote}</div>
            )}
            <div className="kanban-card-meta">
              <span className={`score-badge${(client.leadScore ?? 0) >= 60 ? ' high' : ''}`}>
                Score {client.leadScore ?? 0}
              </span>
              {client.proposalValue != null && <span>R$ {client.proposalValue}</span>}
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
