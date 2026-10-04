import React from 'react';
import { Plus } from 'lucide-react';
import type { RecipeId } from '../../model/blockRecipes';
import { insertItems, itemKey, type InsertItem } from './insertItems';

const ITEMS = new Map(insertItems().map((item) => [itemKey(item), item]));

function item(key: string): InsertItem {
  const found = ITEMS.get(key);
  if (!found) throw new Error(`No insert item ${key}.`);
  return found;
}

/** The four rows of a blank template's ghost card, each the insert it stands for (spec §12.4). */
const GHOST_ROWS: ReadonlyArray<{ label: string; item: InsertItem }> = [
  { label: 'Name', item: item('block:title') },
  { label: 'A line under the name', item: item('block:line') },
  { label: 'Stats', item: item('recipe:stat-strip') },
  { label: 'A list of abilities', item: item('recipe:actions') },
];

/** "Start like…": whole statblocks to start from, each a few recipes put in at once. */
export const STARTS: ReadonlyArray<{ label: string; recipes: readonly RecipeId[] }> = [
  { label: '5E-style creature', recipes: ['name-line', 'stat-strip', 'ability-scores', 'saves-skills', 'senses-languages', 'traits', 'actions'] },
  { label: 'One-line stats', recipes: ['name-line', 'one-line-stats', 'traits'] },
  { label: 'Boxes and features', recipes: ['name-line', 'hp-boxes', 'stress-boxes', 'thresholds', 'kinded-features'] },
];

export interface BlankCardProps {
  /** Unset while the template takes no edits. */
  onInsert?: ((item: InsertItem) => void) | undefined;
  /** Puts several recipes in at once; unset while the template takes no edits. */
  onStart?: ((recipes: readonly RecipeId[], name: string) => void) | undefined;
}

/**
 * What a template without blocks shows (spec §12.4): a ghost of a card, rows
 * that each insert what they name, and "Start like…" chips that put a whole
 * statblock's worth of parts in at once.
 */
export function BlankCard({ onInsert, onStart }: BlankCardProps): React.JSX.Element {
  return (
    <div className="atlas-te-blank" role="group" aria-label="Empty template">
      {GHOST_ROWS.map(({ label, item: row }) => (
        <button
          key={label}
          type="button"
          className="atlas-te-blank__row atlas-te-chrome-control"
          data-row={itemKey(row)}
          disabled={!onInsert}
          onClick={() => onInsert?.(row)}
        >
          <Plus aria-hidden="true" />
          {label}
        </button>
      ))}
      <div className="atlas-te-blank__starts" role="group" aria-label="Start like">
        <span className="atlas-te-blank__starts-label">Start like…</span>
        {STARTS.map((start) => (
          <button
            key={start.label}
            type="button"
            className="atlas-te-blank__start atlas-te-chrome-control"
            disabled={!onStart}
            onClick={() => onStart?.(start.recipes, start.label)}
          >
            {start.label}
          </button>
        ))}
      </div>
    </div>
  );
}
