import React, { useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { handledByAnotherControl } from '../../../keyboard/tooltipEscape';
import { isModHeld } from '../../../keyboard/modKey';
import { Button } from '../../../packages/components/primitives/button';
import type { FieldValue, TemplateField } from '../../model/templateTypes';
import { deepEqual } from '../../notes/listIdentity';
import type { NotePatch } from '../../notes/patchTypes';
import { entryName, entryText } from '../../values/entryValues';
import { SortableEntries, SortableEntry } from '../dnd/SortableEntries';
import {
  entryList, entryPartPatches, entryWithPart, insertEntryPatch, moveEntryPatch, moveEntryToPatch, newEntry, removeEntryPatch,
  shownEntryIndexes, type EntryPart,
} from './entryPatches';
import { EntryRow, type PendingPart } from './EntryRow';
import { removedMessage } from './announcements';
import { focusStaysIn } from './focusWithin';
import { usePaneEdit } from './paneEditContext';

interface EntriesEditorProps {
  field: TemplateField;
  /** The entry clicked, counted as the card shows them; the first when unset. */
  entry: number | undefined;
  /** "Add action": the block's own words for a new entry. */
  addLabel: string | undefined;
}

/**
 * A part to focus. `awaits` holds a request made with a write (a move, a
 * duplicate): the row is focused only once the note holds `entry` at `index`,
 * since a row focused earlier shows its neighbour and would take its text.
 */
type Focus = { index: number; part: EntryPart; awaits?: { list: FieldValue[]; entry: FieldValue } } | null;

/** "Action" for "Actions", "Ability" for "Abilities": what one entry of the field is called. */
export function singular(label: string): string {
  const trimmed = label.trim();
  if (/ies$/i.test(trimmed)) return `${trimmed.slice(0, -3)}y`;
  return /[^su]s$/i.test(trimmed) ? trimmed.slice(0, -1) : trimmed;
}

/**
 * An entries field edited in place (§7.6): each entry's name, then Enter to
 * its text; Mod+Enter adds the next entry; Alt+↑/↓ or a drag of its handle
 * moves one; each row's menu moves, duplicates and deletes. Every change is one patch by the entry's
 * identity, so a list that changed in the note meanwhile is never written
 * into the wrong entry.
 */
export function EntriesEditor({ field, entry, addLabel }: EntriesEditorProps): React.JSX.Element {
  const pane = usePaneEdit();
  const read = pane.read(field);
  const items = entryList(read.value);
  const list = read.key;
  const shape = field.entry;
  const rootRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<Focus>(() => {
    const index = shownEntryIndexes(items, shape)[entry ?? 0];
    return index === undefined ? null : { index, part: 'name' };
  });
  const [adding, setAdding] = useState<{ afterIndex: number | null } | null>(() => (items.length ? null : { afterIndex: null }));
  const noun = singular(field.label) || 'Entry';

  useLayoutEffect(() => {
    if (!focus) return;
    const { awaits } = focus;
    if (awaits && !deepEqual(items[focus.index], awaits.entry)) {
      // Not in the note yet: wait. A note that changed some other way leaves focus where it is.
      if (!deepEqual(items, awaits.list)) setFocus(null);
      return;
    }
    const row = rootRef.current?.querySelector(`[data-entry-row="${focus.index}"] [data-entry-part="${focus.part}"]`);
    if (row?.instanceOf(HTMLElement)) row.focus();
    setFocus(null);
  }, [focus, items]);

  const write = (patches: Array<NotePatch | null>): void => {
    void pane.write(field, patches.filter((patch): patch is NotePatch => patch !== null));
  };
  /** Writes the new entry; `another` (Mod+Enter) starts the next one after it. */
  const commitNew = (name: string, text: string, another: boolean): void => {
    const position = adding?.afterIndex ?? null;
    const written = position === null ? 0 : position + 1;
    setAdding(null);
    if (!name.trim() && !text.trim()) return;
    write([insertEntryPatch(list, items, position, newEntry(shape, name, text))]);
    if (another) setAdding({ afterIndex: written });
  };

  const rowKey = (index: number) => (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    part: EntryPart,
    pending: () => PendingPart | null,
  ): void => {
    const item = items[index];
    if (item === undefined) return;
    const step = !event.altKey ? null : event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : null;
    if (step !== null) {
      event.preventDefault();
      const typed = pending();
      const parts = typed ? entryPartPatches(list, index, typed.from, shape, typed.part, typed.text) : [];
      const moved = typed ? entryWithPart(item, shape, typed.part, typed.text) : item;
      const order = items.map((value, at): FieldValue => (at === index ? moved : value));
      write([...parts, moveEntryPatch(list, order, index, step)]);
      const to = Math.min(Math.max(index + step, 0), items.length - 1);
      setFocus({ index: to, part, awaits: { list: items, entry: moved } });
    } else if (event.key.toLowerCase() === 'd' && isModHeld(event)) {
      event.preventDefault();
      write([insertEntryPatch(list, items, index, item)]);
      setFocus({ index: index + 1, part, awaits: { list: items, entry: item } });
    } else if (event.key === 'Enter' && part === 'name' && !isModHeld(event)) {
      event.preventDefault();
      setFocus({ index, part: 'text' });
    } else if (event.key === 'Enter' && part === 'text' && isModHeld(event)) {
      event.preventDefault();
      const typed = pending();
      if (typed) write(entryPartPatches(list, index, typed.from, shape, typed.part, typed.text));
      setAdding({ afterIndex: index });
    } else if (event.key === 'Escape' && !handledByAnotherControl(event.nativeEvent)) {
      event.preventDefault();
      pane.stop(true);
    }
  };

  const moveTo = (from: number, to: number): void => {
    const item = items[from];
    write([moveEntryToPatch(list, items, from, to)]);
    if (item !== undefined) pane.announce(`Moved ${entryName(item, shape) ?? noun.toLowerCase()} to position ${to + 1} of ${items.length}.`);
  };

  return (
    <div ref={rootRef} className="atlas-sb-pane-entries">
      <SortableEntries ids={items.map((_, index) => String(index))} onMove={moveTo}>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <SortableEntry id={String(index)}>
              {(handle) => (
                <EntryRow
                  index={index}
                  item={item}
                  rowId={String(index)}
                  name={entryName(item, shape) ?? ''}
                  text={entryText(item, shape) ?? ''}
                  noun={noun}
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
                  handle={handle}
                  onCommit={(part, text, from) => write(entryPartPatches(list, index, from, shape, part, text))}
                  onRowKey={rowKey(index)}
                  onMove={(step) => write([moveEntryPatch(list, items, index, step)])}
                  onDuplicate={() => write([insertEntryPatch(list, items, index, item)])}
                  onDelete={() => {
                    write([removeEntryPatch(list, item)]);
                    pane.announce(removedMessage(entryName(item, shape) ?? noun.toLowerCase()));
                  }}
                />
              )}
            </SortableEntry>
            {adding?.afterIndex === index && <NewEntryRow noun={noun} onDone={commitNew} />}
          </React.Fragment>
        ))}
      </SortableEntries>
      {adding?.afterIndex === null && <NewEntryRow noun={noun} onDone={commitNew} />}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="atlas-sb-pane-entries__add"
        onClick={() => setAdding({ afterIndex: items.length ? items.length - 1 : null })}
      >
        <Plus aria-hidden="true" />
        {addLabel ?? `Add ${noun.toLowerCase()}`}
      </Button>
    </div>
  );
}

/** A new entry, written once its name or text is committed; left blank, it is dropped. */
function NewEntryRow({ noun, onDone }: { noun: string; onDone: (name: string, text: string, another: boolean) => void }): React.JSX.Element {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const rowRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => nameRef.current?.focus(), []);
  // Once only: the row unmounts as it is written, and a blur may follow.
  const finish = (another: boolean): void => {
    if (done.current) return;
    done.current = true;
    onDone(name, text, another);
  };
  const leave = (event: React.FocusEvent): void => {
    if (!focusStaysIn(rowRef.current, event.relatedTarget)) finish(false);
  };

  return (
    <div ref={rowRef} className="atlas-sb-pane-entry atlas-sb-pane-entry--new" onBlur={leave}>
      <input
        ref={nameRef}
        type="text"
        className="atlas-sb-pane-input atlas-sb-pane-entry__name"
        value={name}
        placeholder="Name"
        aria-label={`New ${noun.toLowerCase()} name`}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          rowRef.current?.querySelector('textarea')?.focus();
        }}
      />
      <textarea
        className="atlas-sb-pane-input atlas-sb-pane-textarea atlas-sb-pane-entry__text"
        value={text}
        rows={1}
        placeholder="Description"
        aria-label={`New ${noun.toLowerCase()} description`}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !isModHeld(event)) return;
          event.preventDefault();
          finish(true);
        }}
      />
    </div>
  );
}
