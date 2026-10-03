import type { FieldKey, FieldMeaning, TemplateField } from '../model/templateTypes';
import { readField, type FieldRecord } from '../values/fieldValues';

export type FieldMeanings = Readonly<Partial<Record<FieldMeaning, FieldKey>>>;

/** What Fantasy Statblocks' statblocks and the auto template mean: nothing beyond their keys. */
export const NO_MEANINGS: FieldMeanings = Object.freeze({});

/** The key of the first field that carries each meaning (the template editor allows one per meaning). */
export function meaningsOf(fields: readonly TemplateField[]): FieldMeanings {
  const meanings: Partial<Record<FieldMeaning, FieldKey>> = {};
  for (const field of fields) {
    if (field.meaning && meanings[field.meaning] === undefined) meanings[field.meaning] = field.key;
  }
  return Object.keys(meanings).length > 0 ? meanings : NO_MEANINGS;
}

/**
 * The record with each renamed field also under its current key: where a
 * field's key is absent and one of its former keys holds a value (the newest
 * first, as `readField` reads them), the current key gets that value. Former
 * keys stay, so readers of either name find it. Unchanged records come back as
 * the same object.
 */
export function withFormerKeysAliased(record: FieldRecord, fields: readonly TemplateField[]): FieldRecord {
  let aliased: Record<string, unknown> | null = null;
  for (const field of fields) {
    if (!field.formerKeys?.length) continue;
    const read = readField(record, field);
    if (!read.viaFormerKey) continue;
    aliased ??= { ...record };
    aliased[field.key] = record[read.key];
  }
  return aliased ?? record;
}
