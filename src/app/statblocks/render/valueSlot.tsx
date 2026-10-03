import React, { createContext, useContext } from 'react';
import type { TemplateBlock } from '../model/templateTypes';

/**
 * How the statblock pane edits values in place (§7.6). Each block view puts
 * its values (not its label or heading) in a `ValueSlot`; while the pane edits
 * one of the block's fields, its input stands there instead, in the values'
 * own typographic spot, so the card around it does not move.
 */
export interface ValueEditing {
  /** What shows where `block`'s values show: `values` themselves, or the pane's input in their place or beside them. */
  slot(block: TemplateBlock, values: React.ReactNode): React.ReactNode;
}

export const ValueEditingContext = createContext<ValueEditing | null>(null);

interface ValueSlotProps {
  block: TemplateBlock;
  children: React.ReactNode;
}

/** A block's values. The runtime card has no editing context: the values render exactly as they are. */
export function ValueSlot({ block, children }: ValueSlotProps): React.ReactNode {
  const editing = useContext(ValueEditingContext);
  return editing ? editing.slot(block, children) : children;
}
