import { ReactNode } from 'react';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';

export interface KanbanColumnDef {
  id: string;
  label: string;
}

interface KanbanBoardProps<T extends { id: string }> {
  columns: KanbanColumnDef[];
  itemsByColumn: Record<string, T[] | undefined>;
  renderCard: (item: T) => ReactNode;
  onMove: (itemId: string, toColumnId: string) => void;
}

function DroppableColumn({
  id,
  label,
  count,
  children,
}: {
  id: string;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`kanban-column${isOver ? ' over' : ''}`}>
      <div className="kanban-column-header">
        <span>{label}</span>
        <span className="kanban-column-count">{count}</span>
      </div>
      <div className="kanban-column-body">{children}</div>
    </div>
  );
}

function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 10,
        opacity: isDragging ? 0.6 : 1,
      }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="kanban-card">
      {children}
    </div>
  );
}

/** Kanban genérico (colunas + drag-and-drop entre elas), reaproveitado pelo Pipeline Comercial e pelo Sucesso do Cliente. */
export function KanbanBoard<T extends { id: string }>({
  columns,
  itemsByColumn,
  renderCard,
  onMove,
}: KanbanBoardProps<T>) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const toColumnId = String(over.id);
    const fromColumnId = columns.find((col) => itemsByColumn[col.id]?.some((item) => item.id === active.id))?.id;
    if (fromColumnId === toColumnId) return;
    onMove(String(active.id), toColumnId);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {columns.map((col) => (
          <DroppableColumn key={col.id} id={col.id} label={col.label} count={itemsByColumn[col.id]?.length ?? 0}>
            {(itemsByColumn[col.id] ?? []).map((item) => (
              <DraggableCard key={item.id} id={item.id}>
                {renderCard(item)}
              </DraggableCard>
            ))}
          </DroppableColumn>
        ))}
      </div>
    </DndContext>
  );
}
