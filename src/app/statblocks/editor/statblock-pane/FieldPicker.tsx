import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { App } from 'obsidian';
import { STANDING_LIST } from '../../../keyboard/tooltipEscape';
import type { StatblockTemplate } from '../../model/templateTypes';
import type { FieldRecord } from '../../values/fieldValues';
import { useCollectionFieldKeys } from '../template-editor/useCollectionFieldKeys';
import {
  collectionFieldChoices, matchingChoices, newFieldChoices, noteFieldChoices, type FieldChoice,
} from './fieldChoices';

interface ChoiceGroup {
  id: string;
  label: string;
  choices: FieldChoice[];
}

const keyOf = (choice: FieldChoice): string => `${choice.source}:${choice.key ?? choice.label}:${choice.type}`;

/** The picker's groups for what is typed: the note's keys, the collection's, then a new field of each kind. */
export function pickerGroups(note: readonly FieldChoice[], collection: readonly FieldChoice[], query: string): ChoiceGroup[] {
  const name = query.trim();
  const groups: ChoiceGroup[] = [
    { id: 'note', label: 'In this note', choices: matchingChoices(note, query) },
    { id: 'collection', label: 'Used in this collection', choices: matchingChoices(collection, query) },
    { id: 'new', label: `New field “${name}”`, choices: newFieldChoices(name) },
  ];
  return groups.filter((group) => group.choices.length > 0);
}

export interface FieldPickerProps {
  app: App;
  collectionId: string | null;
  template: StatblockTemplate;
  record: FieldRecord;
  onChoose: (choice: FieldChoice) => void;
  onClose: () => void;
}

/**
 * The field picker of "Add a field…" (§7.2, §7.4): "Field name", then the
 * note's own keys the template leaves out, the keys the collection's
 * statblocks use, and a new field of each kind once a name is typed. Arrows
 * move, Enter adds, Escape closes.
 */
export function FieldPicker({ app, collectionId, template, record, onChoose, onClose }: FieldPickerProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const counts = useCollectionFieldKeys(app, collectionId);
  const note = useMemo(() => noteFieldChoices(record, template), [record, template]);
  const collection = useMemo(() => collectionFieldChoices(counts, template, record), [counts, template, record]);
  const groups = useMemo(() => pickerGroups(note, collection, query), [note, collection, query]);
  const ordered = groups.flatMap((group) => group.choices);
  const current = ordered[Math.min(active, ordered.length - 1)];

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, groups]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return;
    const count = ordered.length;
    if (event.key === 'ArrowDown' && count) setActive((index) => (index + 1) % count);
    else if (event.key === 'ArrowUp' && count) setActive((index) => (index - 1 + count) % count);
    else if (event.key === 'Enter' && current) onChoose(current);
    else if (event.key === 'Escape') onClose();
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="atlas-sb-add-field__picker">
      <input
        type="text"
        className="atlas-sb-add-field__search"
        placeholder="Field name"
        aria-label="Field name"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={current ? `${listId}-${keyOf(current)}` : undefined}
        spellCheck={false}
        autoComplete="off"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div ref={listRef} id={listId} className="atlas-sb-add-field__list" role="listbox" aria-label="Fields" {...STANDING_LIST}>
        {groups.length === 0 && <div className="atlas-sb-add-field__empty">Type a name for a new field</div>}
        {groups.map((group) => (
          <div key={group.id} role="group" aria-label={group.label} className="atlas-sb-add-field__group">
            <div className="atlas-sb-add-field__group-label" aria-hidden="true">{group.label}</div>
            {group.choices.map((choice) => (
              <div
                key={keyOf(choice)}
                id={`${listId}-${keyOf(choice)}`}
                data-index={ordered.indexOf(choice)}
                role="option"
                aria-selected={choice === current}
                data-highlighted={choice === current ? '' : undefined}
                className="atlas-ctx-item atlas-sb-add-field__option"
                onPointerMove={() => setActive(ordered.indexOf(choice))}
                // The search keeps focus, so the keys go on working after a click.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => onChoose(choice)}
              >
                <span className="atlas-ctx-item__label">{choice.source === 'new' ? choice.detail : choice.label}</span>
                {choice.source !== 'new' && (
                  <span className="atlas-sb-add-field__detail">{choice.detail ?? choice.key}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
