import type { EntryShape, FieldKey, FieldValue, StatblockTemplate, TemplateField } from './templateTypes';

/** Neutral samples (§7.9): never creature content, so a preview never reads like one. */
const SAMPLE_NUMBER = 10;
const SAMPLE_RATING = '2';
const SAMPLE_DICE = '2d6 + 2';
const SAMPLE_LINE = 'A line of text.';
const SAMPLE_PARAGRAPH = 'A short paragraph of text.';
const SAMPLE_ITEMS = ['First item', 'Second item'];
const SAMPLE_ENTRY_NAMES = ['First entry', 'Second entry'];
const SAMPLE_PAIR_VALUE = 1;

function extraSample(type: 'text' | 'number' | 'list' | 'dice', label: string): FieldValue {
  switch (type) {
    case 'number': return SAMPLE_NUMBER;
    case 'dice': return SAMPLE_DICE;
    case 'list': return [...SAMPLE_ITEMS];
    case 'text': return label.toLowerCase();
  }
}

function sampleEntries(shape: EntryShape | undefined): FieldValue {
  const nameKey = shape?.nameKey ?? 'name';
  const textKey = shape?.textKey ?? 'desc';
  return SAMPLE_ENTRY_NAMES.map((name) => {
    const entry: Record<string, FieldValue> = { [nameKey]: name };
    for (const extra of shape?.extras ?? []) entry[extra.key] = extraSample(extra.type, extra.label);
    entry[textKey] = SAMPLE_LINE;
    return entry;
  });
}

/** One pair per slot key (or slot label), else `first: 1`. */
function samplePairs(field: TemplateField): FieldValue {
  const keys = field.slotKeys ?? field.slots?.map((slot) => slot.toLowerCase()) ?? ['first'];
  return Object.fromEntries(keys.map((key) => [key, SAMPLE_PAIR_VALUE]));
}

/** The value the template editor previews a field with while no statblock is picked. */
export function sampleValueFor(field: TemplateField): FieldValue {
  switch (field.type) {
    case 'number': return SAMPLE_NUMBER;
    case 'rating': return SAMPLE_RATING;
    case 'dice': return SAMPLE_DICE;
    case 'text': return field.label.toLowerCase();
    case 'markdown': return SAMPLE_PARAGRAPH;
    case 'choice': return field.options?.[0] ?? field.label.toLowerCase();
    case 'list': return [...SAMPLE_ITEMS];
    case 'scores': return (field.slots ?? []).map(() => SAMPLE_NUMBER);
    case 'entries': return sampleEntries(field.entry);
    case 'pairs': return samplePairs(field);
    // The renderer shows a neutral silhouette for a missing image.
    case 'image': return null;
    case 'spells': return [SAMPLE_LINE];
  }
}

/** A sample for every field, overlaid with the template's own `sample`. */
export function sampleRecord(template: StatblockTemplate): Record<FieldKey, FieldValue> {
  const record: Record<FieldKey, FieldValue> = {};
  for (const field of template.fields) record[field.key] = sampleValueFor(field);
  return { ...record, ...template.sample };
}
