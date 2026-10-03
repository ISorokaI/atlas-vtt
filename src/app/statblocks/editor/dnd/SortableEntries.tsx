import React, { useMemo } from 'react';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useReducedMotion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { MOTION_EASE_OUT, MOTION_NORMAL_MS } from '../../../utils/motion';
import { POINTER_ACTIVATION, SILENT_ANNOUNCEMENTS } from './dndConfig';


export interface SortableEntriesProps {
  /** One id per row, in the list's order. */
  ids: readonly string[];
  /** A row was dropped: it moves from `from` to `to`, both counted in the list as it stands. */
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
}

/**
 * The statblock pane's entries ("Actions", "Traits") reordered by dragging a
 * row's handle (§7.6): the rows between slide by transform only, and the drop
 * is one move. The keys (Alt+↑/↓ in a row) and each row's menu move entries
 * too; the handle is the pointer's way only.
 */
export function SortableEntries({ ids, onMove, children }: SortableEntriesProps): React.JSX.Element {
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION));
  const items = useMemo(() => [...ids], [ids]);
  const drop = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return;
    const from = items.indexOf(String(active.id));
    const to = items.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onMove(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop} accessibility={{ announcements: SILENT_ANNOUNCEMENTS, restoreFocus: false }}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

export interface SortableEntryProps {
  id: string;
  /** The row, given the handle to place in it. */
  children: (handle: React.ReactNode) => React.ReactNode;
}

/** One row of `SortableEntries`: it slides while another row passes and follows the pointer while dragged (only opacity changes where motion is reduced). */
export function SortableEntry({ id, children }: SortableEntryProps): React.JSX.Element {
  const reduced = useReducedMotion() === true;
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id, transition: reduced ? null : { duration: MOTION_NORMAL_MS, easing: MOTION_EASE_OUT },
  });
  const handle = (
    <span ref={setActivatorNodeRef} className="atlas-sb-pane-entry__handle" aria-hidden="true" onPointerDown={listeners?.onPointerDown as React.PointerEventHandler | undefined}>
      <GripVertical />
    </span>
  );
  return (
    <div
      ref={setNodeRef}
      className="atlas-sb-pane-entry-slot"
      data-dragging={isDragging || undefined}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
    >
      {children(handle)}
    </div>
  );
}
