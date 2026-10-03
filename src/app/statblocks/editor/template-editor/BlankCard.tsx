import React from 'react';
import { Plus } from 'lucide-react';
import type { InsertItem } from './insertItems';

/** The four rows of a blank template's ghost card, each the insert it stands for (§7.9). */
const GHOST_ROWS: ReadonlyArray<{ label: string; item: InsertItem }> = [
  { label: 'Name', item: { kind: 'block', type: 'title', label: 'Title', group: 'basics' } },
  { label: 'Line', item: { kind: 'block', type: 'line', label: 'Line', group: 'basics' } },
  { label: 'Stats', item: { kind: 'recipe', id: 'stat-strip', label: 'Stat strip', group: 'common' } },
  { label: 'Actions', item: { kind: 'recipe', id: 'actions', label: 'Actions', group: 'common' } },
];

export interface BlankCardProps {
  /** Unset while the template takes no edits. */
  onInsert?: ((item: InsertItem) => void) | undefined;
}

/**
 * What a template without blocks shows (§7.9): a ghost of a card, four dashed
 * rows that each insert what they name. The first click starts the template.
 */
export function BlankCard({ onInsert }: BlankCardProps): React.JSX.Element {
  return (
    <div className="atlas-te-blank" role="group" aria-label="Empty template">
      {GHOST_ROWS.map(({ label, item }) => (
        <button
          key={label}
          type="button"
          className="atlas-te-blank__row atlas-te-chrome-control"
          data-row={label.toLowerCase()}
          disabled={!onInsert}
          onClick={() => onInsert?.(item)}
        >
          <Plus aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
