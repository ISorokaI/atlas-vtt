import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { STANDING_LIST } from '../../../keyboard/tooltipEscape';
import { useTemplateEditor } from './editorContext';
import { insertItemGlyph } from './editorGlyphs';
import { findItems, groupItems, INSERT_GROUPS, insertItems, itemKey, type InsertItem } from './insertItems';
import { PaletteTile } from './PaletteTile';

const ALL_ITEMS = insertItems();
const GROUPS = groupItems(ALL_ITEMS);
const GROUP_LABELS = new Map(INSERT_GROUPS.map((group) => [group.id, group.label]));
/** Tiles stand two to a row; the arrows move by one, up and down by a row. */
const ROW = 2;
const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -ROW, ArrowDown: ROW };

interface ResultsProps {
  id: string;
  items: readonly InsertItem[];
  active: InsertItem | undefined;
  onHover: (item: InsertItem) => void;
  onChoose: (item: InsertItem) => void;
}

/** What "Find a block" found: a list that stands open beside the search, so Escape is never its own. */
function SearchResults({ id, items, active, onHover, onChoose }: ResultsProps): React.JSX.Element {
  return (
    <div id={id} role="listbox" aria-label="Blocks found" className="atlas-te-palette__results" {...STANDING_LIST}>
      {items.length === 0 && <div className="atlas-te-palette__empty">No block matches</div>}
      {items.map((item) => {
        const Glyph = insertItemGlyph(item);
        return (
          <div
            key={itemKey(item)}
            id={`${id}-${itemKey(item)}`}
            role="option"
            aria-selected={item === active}
            data-highlighted={item === active ? '' : undefined}
            className="atlas-ctx-item atlas-te-palette__result"
            onPointerMove={() => onHover(item)}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onChoose(item)}
          >
            <span className="atlas-ctx-item__leading">
              <Glyph className="atlas-te-palette__result-glyph" aria-hidden="true" />
              <span className="atlas-ctx-item__label">{item.label}</span>
            </span>
            <span className="atlas-ctx-item__hint">{GROUP_LABELS.get(item.group)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The Blocks tab (§7.4): "Find a block", then Common (the recipes), Basics,
 * Lists, Numbers, Layout and Media as live miniatures, two to a row. A click
 * or Enter inserts after the selection, which the canvas then selects with
 * its label open.
 */
export function BlocksPalette(): React.JSX.Element {
  const { insert, snapshot } = useTemplateEditor();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [stop, setStop] = useState(0);
  const tilesRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const searching = query.trim() !== '';
  const found = useMemo(() => findItems(ALL_ITEMS, query), [query]);
  const current = found[Math.min(active, found.length - 1)];
  const locked = snapshot.readOnly;

  // Tiles are drawn once: they hold one callback that always inserts through the editor as it is now.
  const latestInsert = useRef(insert);
  latestInsert.current = insert;
  const choose = useCallback((item: InsertItem): void => {
    setQuery('');
    latestInsert.current(item);
  }, []);

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return;
    const count = found.length;
    if (event.key === 'ArrowDown' && searching && count) setActive((index) => (index + 1) % count);
    else if (event.key === 'ArrowUp' && searching && count) setActive((index) => (index - 1 + count) % count);
    else if (event.key === 'Enter' && searching && current) choose(current);
    else if (event.key === 'Escape' && query) setQuery('');
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onTilesKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = STEPS[event.key];
    const last = ALL_ITEMS.length - 1;
    const next = step !== undefined ? stop + step : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    const index = Math.min(Math.max(next, 0), last);
    setStop(index);
    tilesRef.current?.querySelectorAll<HTMLElement>('.atlas-te-tile')[index]?.focus();
  };

  return (
    <div className="atlas-te-palette">
      <input
        type="search"
        className="atlas-te-input atlas-te-palette__search"
        placeholder="Find a block"
        aria-label="Find a block"
        role="combobox"
        aria-expanded={searching}
        aria-controls={searching ? listId : undefined}
        aria-activedescendant={searching && current ? `${listId}-${itemKey(current)}` : undefined}
        spellCheck={false}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onSearchKey}
      />
      {searching ? (
        <SearchResults id={listId} items={found} active={current} onHover={(item) => setActive(found.indexOf(item))} onChoose={choose} />
      ) : (
        <div ref={tilesRef} className="atlas-te-palette__groups" onKeyDown={onTilesKey}>
          {GROUPS.map((group) => (
            <PaletteGroup key={group.id} label={group.label}>
              {group.items.map((item) => {
                const index = ALL_ITEMS.indexOf(item);
                return (
                  <PaletteTile key={itemKey(item)} item={item} index={index} tabStop={index === stop} locked={locked}
                    onInsert={choose} onFocusIndex={setStop} />
                );
              })}
            </PaletteGroup>
          ))}
        </div>
      )}
    </div>
  );
}

function PaletteGroup({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  const labelId = useId();
  return (
    <>
      <div id={labelId} className="atlas-te-palette__group-label">{label}</div>
      <div className="atlas-te-palette__grid" role="group" aria-labelledby={labelId}>{children}</div>
    </>
  );
}
