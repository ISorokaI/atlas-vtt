/**
 * What a drop does to the template (§7.6): one session gesture, so one undo
 * step, worked out on the template the session holds at that moment. A move
 * keeps the block's id; a palette item or a field inserts as a click on the
 * palette does.
 */

import { fieldByKey } from '../../model/fieldKeys';
import { moveBlock } from '../../model/treeOps';
import type { TreeTarget } from '../../model/treeEdit';
import { findBlock } from '../../model/treeQueries';
import type { TemplateLayout } from '../../model/templateTypes';
import { insertCatalogueBlock, insertParts, insertRecipe, type InsertPlace } from '../template-editor/blockActions';
import { movedMessage } from '../template-editor/blockMoves';
import { applyTree, outcomeOf, type EditOutcome } from '../template-editor/sessionEdit';
import type { EditorSession } from '../template-editor/sessionTypes';
import { fieldBlock, type DragSource } from './dragSources';
import type { DropTarget } from './dropTargets';

/** What a drop leaves: the editor's outcome, and the block that landed (washed in the accent). */
export type DropOutcome = EditOutcome & { inserted?: string; landed?: string };

type Placed = Exclude<DropTarget, { kind: 'refused' }>;

/** The gap a target names, counted in the list as it stands: where the block's leading edge lands. */
function gapOf(target: Placed): { parentId: string | null; index: number } {
  return target.kind === 'between' ? { parentId: target.parentId, index: target.index } : { parentId: target.parentId, index: 0 };
}

/** The tree target of a gap once the moved block (if any) has left its place. */
export function treeTargetOf(layout: TemplateLayout, target: Placed, movingId: string | null): TreeTarget | null {
  const gap = gapOf(target);
  const moving = movingId === null ? null : findBlock(layout.blocks, movingId);
  const leaves = moving !== null && moving.parentId === gap.parentId && moving.index < gap.index;
  return { parentId: gap.parentId, index: leaves ? gap.index - 1 : gap.index };
}

function moveOnto(session: EditorSession, id: string, target: Placed): DropOutcome {
  const edit = applyTree(session, (layout) => {
    const to = treeTargetOf(layout, target, id);
    if (!to) return { ok: false, layout, reason: 'target-not-found' };
    return moveBlock(layout, id, to);
  });
  const snapshot = session.getSnapshot();
  return outcomeOf(edit, snapshot, (done) => ({ select: [id], landed: id, announce: movedMessage(done.layout, id, snapshot.template.fields) }));
}

function insertOnto(session: EditorSession, source: Exclude<DragSource, { kind: 'block' }>, target: Placed): DropOutcome {
  const to = treeTargetOf(session.getSnapshot().template.layout, target, null);
  if (!to) return {};
  const place: InsertPlace = { at: to };
  let outcome: DropOutcome;
  if (source.kind === 'item') {
    const { item } = source;
    outcome = item.kind === 'recipe' ? insertRecipe(session, item.id, place) : insertCatalogueBlock(session, item.type, place);
  } else {
    const field = fieldByKey(session.getSnapshot().template.fields, source.key);
    if (!field) return {};
    const { inserted, ...rest } = insertParts(session, place, (_template, nextId) => ({ blocks: [fieldBlock(field, nextId)], fields: [] }));
    outcome = inserted ? { ...rest, landed: inserted } : rest;
  }
  return outcome;
}

/**
 * Drops `source` at `target` as one undo step and says what happened; a
 * refused target or a read-only template changes nothing.
 */
export function applyDrop(session: EditorSession, source: DragSource, target: DropTarget): DropOutcome {
  if (target.kind === 'refused') return {};
  session.beginGesture();
  try {
    return source.kind === 'block' ? moveOnto(session, source.id, target) : insertOnto(session, source, target);
  } finally {
    session.endGesture();
  }
}
