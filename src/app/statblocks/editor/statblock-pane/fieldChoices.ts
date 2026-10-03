/**
 * What "Add a field…" offers (D15, §7.2) and the edit it makes. The note's own
 * keys the template does not show come first, then the keys the collection's
 * statblocks use, then a new field of a kind the user picks. Pure.
 */

import { autoTemplate, blockFor } from '../../model/autoTemplate';
import { addField } from '../../model/fieldOps';
import { fieldKeysOf, keyProblem, labelFromKey, labelToKey } from '../../model/fieldKeys';
import { blockIdSource } from '../../model/templateIds';
import { collectBlockIds } from '../../model/treeQueries';
import { insertBlock } from '../../model/treeOps';
import type { EntryShape, FieldKey, FieldType, StatblockTemplate, TemplateField } from '../../model/templateTypes';
import type { FieldRecord } from '../../values/fieldValues';
import { keysOutsideTemplate } from './templateChoices';

export type FieldChoiceSource = 'note' | 'collection' | 'new';

/** A field to add: an existing key keeps its spelling, a new one takes a key derived from its label. */
export interface FieldChoice {
  source: FieldChoiceSource;
  key: FieldKey | null;
  label: string;
  type: FieldType;
  entry?: EntryShape | undefined;
  slots?: string[] | undefined;
  /** A quiet word at the row's end: the kind of a new field, how many statblocks use a key. */
  detail?: string | undefined;
}

/** The kinds a new field may have, in the words the picker shows. */
export const NEW_FIELD_KINDS: ReadonlyArray<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Number' },
  { type: 'markdown', label: 'Paragraphs' },
  { type: 'list', label: 'List' },
  { type: 'entries', label: 'Entries' },
];

/** The field a value's shape suggests, as the auto template reads it; text where no block shows the shape. */
function shapedChoice(source: FieldChoiceSource, key: FieldKey, value: unknown): FieldChoice {
  const field = autoTemplate({ [key]: value }).fields[0];
  if (!field) return { source, key, label: labelFromKey(key), type: 'text' };
  return { source, key, label: field.label, type: field.type, entry: field.entry, slots: field.slots };
}

/** Keys a field may take: only those no other field holds and that a template may name. */
const usableKey = (key: FieldKey, taken: ReadonlySet<FieldKey>): boolean => keyProblem(key, taken) === null;

/** The note's values the template does not show, each as the field its value suggests. */
export function noteFieldChoices(record: FieldRecord, template: StatblockTemplate): FieldChoice[] {
  const taken = fieldKeysOf(template.fields);
  return keysOutsideTemplate(record, template)
    .filter((key) => usableKey(key, taken))
    .map((key) => shapedChoice('note', key, record[key]));
}

/** Keys the collection's statblocks use that neither the template nor the note has; the most used first. */
export function collectionFieldChoices(
  counts: ReadonlyMap<string, number>, template: StatblockTemplate, record: FieldRecord,
): FieldChoice[] {
  const taken = fieldKeysOf(template.fields);
  return [...counts]
    .filter(([key]) => !(key in record) && usableKey(key, taken))
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([key, count]) => ({
      source: 'collection', key, label: labelFromKey(key), type: 'text', detail: count === 1 ? '1 statblock' : `${count} statblocks`,
    }));
}

/** A new field named `label`, once per kind; none for a blank name. */
export function newFieldChoices(label: string): FieldChoice[] {
  const name = label.trim();
  if (!name) return [];
  return NEW_FIELD_KINDS.map(({ type, label: kind }) => ({ source: 'new', key: null, label: name, type, detail: kind }));
}

/** The choices whose label or key holds every word typed, in any case. */
export function matchingChoices(choices: readonly FieldChoice[], query: string): FieldChoice[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return choices.filter((choice) => {
    const text = `${choice.label} ${choice.key ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** The choice for a key of the note (the tray's Add to template). */
export function noteKeyChoice(key: FieldKey, record: FieldRecord): FieldChoice {
  return shapedChoice('note', key, record[key]);
}

/** Why the key cannot become a field of the template, or null. */
export function choiceProblem(choice: FieldChoice, template: StatblockTemplate): string | null {
  return choice.key === null ? null : keyProblem(choice.key, fieldKeysOf(template.fields));
}

export interface FieldAddition {
  template: StatblockTemplate;
  key: FieldKey;
  blockId: string;
}

/**
 * The template with the chosen field and a block showing it at its end, the
 * block the auto template would give the field. Null where the key is
 * refused (`keyProblem`) or no block could be added.
 */
export function fieldAddition(template: StatblockTemplate, choice: FieldChoice): FieldAddition | null {
  const key = choice.key ?? labelToKey(choice.label, fieldKeysOf(template.fields));
  const field: TemplateField = {
    key, label: choice.label, type: choice.type, ...(choice.entry && { entry: choice.entry }), ...(choice.slots && { slots: choice.slots }),
  };
  const withField = addField(template, field);
  if (withField === template) return null;
  const block = blockFor(field, blockIdSource(collectBlockIds(template.layout.blocks)));
  const edit = insertBlock(withField.layout, block, { parentId: null, index: withField.layout.blocks.length });
  if (!edit.ok) return null;
  return { template: { ...withField, layout: edit.layout }, key, blockId: block.id };
}
