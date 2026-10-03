/**
 * What a drag says in the view's live region (§7.6, §7.7): what was picked
 * up, where it would go, and how it ended. The drop itself says what the edit
 * did ("Moved Armor class to section Defenses, position 2 of 3.").
 */

import { childrenOf } from '../../model/treeEdit';
import { findBlock } from '../../model/treeQueries';
import type { TemplateField, TemplateLayout } from '../../model/templateTypes';
import { blockName, placeName } from '../template-editor/blockNames';
import type { DropTarget } from './dropTargets';

/** dnd-kit's hidden instructions, read with a block that can be picked up. */
export const DRAG_INSTRUCTIONS = 'To move a block, press Space, choose a place with the arrow keys, then press Space to drop it or Escape to cancel.';

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** "Picked up Armor class." and, for the keyboard, how to go on. */
export function pickedUpText(name: string, keyboard: boolean): string {
  return keyboard ? `Picked up ${name}. Choose a place with the arrow keys, then press Space to drop it or Escape to cancel.` : `Picked up ${name}.`;
}

/**
 * Where the drop would land: "Section Defenses, position 2 of 3.", "Beside
 * Speed, side by side.", "Into section Defenses.", "Can't go here."
 */
export function targetText(layout: TemplateLayout, fields: readonly TemplateField[], target: DropTarget, movingId: string | null): string {
  if (target.kind === 'refused') return "Can't go here.";
  if (target.kind === 'beside') {
    const neighbour = findBlock(layout.blocks, target.blockId)?.block;
    return `${target.side === 'before' ? 'Before' : 'After'} ${neighbour ? blockName(neighbour, fields) : 'the block'}, side by side.`;
  }
  const parent = target.parentId === null ? null : findBlock(layout.blocks, target.parentId)?.block ?? null;
  if (target.kind === 'into') return target.parentId === null ? 'Into the empty template.' : `Into ${placeName(parent, fields)}.`;
  const moving = movingId === null ? null : findBlock(layout.blocks, movingId);
  const length = childrenOf(layout, target.parentId)?.length ?? 0;
  const staying = moving !== null && moving.parentId === target.parentId;
  const position = staying && target.index > (moving?.index ?? 0) ? target.index : target.index + 1;
  return `${capitalised(placeName(parent, fields))}, position ${position} of ${staying ? length : length + 1}.`;
}

/** "Cancelled. Armor class stays where it was." */
export function cancelledText(name: string | null): string {
  return name ? `Cancelled. ${name} stays where it was.` : 'Cancelled.';
}
