import React, { memo, useMemo } from 'react';
import { sampleRecord } from '../../model/sampleValues';
import { StatblockSheet } from '../../render/StatblockSheet';
import { usePaletteDrag } from '../dnd/useDragSources';
import { insertItemGlyph } from './editorGlyphs';
import { itemKey, previewTemplate, type InsertItem } from './insertItems';

export interface PaletteTileProps {
  item: InsertItem;
  /** Its place among all tiles, which the arrows move by. */
  index: number;
  /** The one tile Tab stops on; arrows move between the others. */
  tabStop: boolean;
  /** A built-in: the tile says so instead of inserting, which the session refuses. */
  locked: boolean;
  onInsert: (item: InsertItem) => void;
  onFocusIndex: (index: number) => void;
}

/** What a tile shows: the item's miniature and its name. The drag carries the same face. */
export function TileFace({ item }: { item: InsertItem }): React.JSX.Element {
  const template = useMemo(() => previewTemplate(item), [item]);
  const record = useMemo(() => sampleRecord(template), [template]);
  const Glyph = insertItemGlyph(item);
  return (
    <>
      <span className="atlas-te-tile__preview" aria-hidden="true" inert>
        <span className="atlas-te-tile__scale">
          <StatblockSheet template={template} name={item.label} fields={record} variant="feed" mode="editing" />
        </span>
      </span>
      <span className="atlas-te-tile__label">
        <Glyph className="atlas-te-tile__glyph" aria-hidden="true" />
        <span className="atlas-te-tile__name">{item.label}</span>
      </span>
    </>
  );
}

/**
 * One palette tile (§7.4): a live miniature of the block or recipe drawn by
 * the real renderer with neutral samples, scaled down once and never again
 * (only its place moves), and its name. A click inserts it after the
 * selection; dragged onto the canvas, it inserts where it is dropped.
 */
export const PaletteTile = memo(function PaletteTile({ item, index, tabStop, locked, onInsert, onFocusIndex }: PaletteTileProps): React.JSX.Element {
  const drag = usePaletteDrag(item, locked);
  return (
    <div
      ref={drag.ref}
      role="button"
      tabIndex={tabStop ? 0 : -1}
      aria-disabled={locked || undefined}
      className="atlas-te-tile"
      data-item={itemKey(item)}
      onPointerDown={drag.onPointerDown}
      onClick={() => onInsert(item)}
      onFocus={() => onFocusIndex(index)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onInsert(item);
      }}
    >
      <TileFace item={item} />
    </div>
  );
});
