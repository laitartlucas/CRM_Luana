import { ReactNode, useId, useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';

export interface KanbanColumnDef {
  id: string;
  label: string;
}

interface KanbanBoardProps<T extends { id: string }> {
  columns: KanbanColumnDef[];
  itemsByColumn: Record<string, T[] | undefined>;
  renderCard: (item: T) => ReactNode;
  /** Nome do cartão para leitores de tela (ex.: nome da lead). */
  getItemLabel: (item: T) => string;
  onMove: (itemId: string, toColumnId: string) => void;
}

function DroppableColumn({
  id,
  label,
  count,
  collapsed,
  children,
}: {
  id: string;
  label: string;
  count: number;
  collapsed: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const headingId = useId();
  // Etapa vazia vira uma faixa estreita: o quadro mostra o que tem trabalho sem esconder as etapas.
  // Ao arrastar um cartão todas se abrem, para soltar com folga.
  if (collapsed) {
    return (
      <section ref={setNodeRef} className={`kanban-column collapsed${isOver ? ' over' : ''}`} aria-labelledby={headingId}>
        <span className="kanban-column-count" aria-label={`${count} cartões`}>
          {count}
        </span>
        <h2 id={headingId} className="kanban-column-title kanban-rail-title">
          {label}
        </h2>
      </section>
    );
  }
  return (
    <section ref={setNodeRef} className={`kanban-column${isOver ? ' over' : ''}`} aria-labelledby={headingId}>
      <div className="kanban-column-header">
        <h2 id={headingId} className="kanban-column-title">
          {label}
        </h2>
        <span className="kanban-column-count" aria-label={`${count} cartões`}>
          {count}
        </span>
      </div>
      <div className="kanban-column-body">{children}</div>
    </section>
  );
}

/**
 * O arrastar é um atalho para quem usa mouse/toque. NÃO recebe role="button" nem foco: o cartão contém um
 * link e um seletor, e controles dentro de controles quebram leitores de tela e o teclado. Quem não arrasta
 * move o cartão pelo seletor "Mover para…".
 */
function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10, opacity: isDragging ? 0.6 : 1 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} className="kanban-card">
      {children}
    </div>
  );
}

/**
 * Kanban genérico (colunas + mover entre elas), reaproveitado pelo Pipeline Comercial. Movimentos:
 * arrastar com o mouse (após 6px, para não atrapalhar o clique), arrastar com toque (segurando 250ms,
 * para não roubar a rolagem) ou o seletor em cada cartão — o caminho acessível por teclado e celular.
 */
export function KanbanBoard<T extends { id: string }>({ columns, itemsByColumn, renderCard, getItemLabel, onMove }: KanbanBoardProps<T>) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const [dragging, setDragging] = useState(false);

  function handleDragStart(_event: DragStartEvent) {
    setDragging(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over) return;
    const toColumnId = String(over.id);
    const fromColumnId = columns.find((col) => itemsByColumn[col.id]?.some((item) => item.id === active.id))?.id;
    if (fromColumnId === toColumnId) return;
    onMove(String(active.id), toColumnId);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragging(false)}>
      <div className={`kanban-board${dragging ? ' is-dragging' : ''}`}>
        {columns.map((col) => (
          <DroppableColumn
            key={col.id}
            id={col.id}
            label={col.label}
            count={itemsByColumn[col.id]?.length ?? 0}
            collapsed={!dragging && (itemsByColumn[col.id]?.length ?? 0) === 0}
          >
            {(itemsByColumn[col.id] ?? []).map((item) => (
              <DraggableCard key={item.id} id={item.id}>
                {renderCard(item)}
                {/* Os eventos de ponteiro não sobem para o cartão: abrir o seletor não pode iniciar um arrasto. */}
                <select
                  className="kanban-move"
                  aria-label={`Mover ${getItemLabel(item)} para outra etapa`}
                  value={col.id}
                  onChange={(e) => e.target.value !== col.id && onMove(item.id, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  {columns.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.id === col.id ? `Etapa: ${target.label}` : `Mover para ${target.label}`}
                    </option>
                  ))}
                </select>
              </DraggableCard>
            ))}
          </DroppableColumn>
        ))}
      </div>
    </DndContext>
  );
}
