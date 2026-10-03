import { describe, expect, it } from 'vitest';
import { sampleRecord, sampleValueFor } from '../../../../src/app/statblocks/model/sampleValues';
import {
  FIELD_TYPES, TEMPLATE_FORMAT, TEMPLATE_VERSION, type FieldType, type StatblockTemplate, type TemplateField,
} from '../../../../src/app/statblocks/model/templateTypes';

const field = (type: FieldType, extra: Partial<TemplateField> = {}): TemplateField => ({ key: 'k', label: 'Speed', type, ...extra });

describe('sampleValueFor', () => {
  it.each([
    ['number', 10],
    ['rating', '2'],
    ['dice', '2d6 + 2'],
    ['text', 'speed'],
    ['markdown', 'A short paragraph of text.'],
    ['choice', 'speed'],
    ['list', ['First item', 'Second item']],
    ['scores', []],
    ['pairs', { first: 1 }],
    ['image', null],
    ['spells', ['A line of text.']],
    ['entries', [{ name: 'First entry', desc: 'A line of text.' }, { name: 'Second entry', desc: 'A line of text.' }]],
  ] as const)('%s → %j', (type, sample) => {
    expect(sampleValueFor(field(type))).toEqual(sample);
  });

  it('has a sample for every field type', () => {
    for (const type of FIELD_TYPES) expect(sampleValueFor(field(type))).not.toBeUndefined();
  });

  it('fills every slot, picks the first option and keys pairs by slot', () => {
    expect(sampleValueFor(field('scores', { slots: ['Str', 'Dex', 'Con'] }))).toEqual([10, 10, 10]);
    expect(sampleValueFor(field('choice', { options: ['Tiny', 'Small'] }))).toBe('Tiny');
    expect(sampleValueFor(field('pairs', { slots: ['Str', 'Dex'] }))).toEqual({ str: 1, dex: 1 });
    expect(sampleValueFor(field('pairs', { slots: ['Str'], slotKeys: ['strength'] }))).toEqual({ strength: 1 });
  });

  it('writes entries with the field\'s own entry keys and extras', () => {
    const shape = { nameKey: 'title', textKey: 'text', extras: [
      { key: 'range', label: 'Range', type: 'text' as const },
      { key: 'cost', label: 'Cost', type: 'number' as const },
      { key: 'damage', label: 'Damage', type: 'dice' as const },
      { key: 'tags', label: 'Tags', type: 'list' as const },
    ] };
    expect(sampleValueFor(field('entries', { entry: shape }))).toEqual([
      { title: 'First entry', range: 'range', cost: 10, damage: '2d6 + 2', tags: ['First item', 'Second item'], text: 'A line of text.' },
      { title: 'Second entry', range: 'range', cost: 10, damage: '2d6 + 2', tags: ['First item', 'Second item'], text: 'A line of text.' },
    ]);
  });
});

describe('sampleRecord', () => {
  it('samples every field and lets the template\'s own samples win', () => {
    const template: StatblockTemplate = {
      format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, id: 'marsh-creature-k7m2qa',
      fields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'hp', label: 'Hit Points', type: 'number' },
        { key: 'image', label: 'Portrait', type: 'image' },
      ],
      layout: { maxColumns: 2, blocks: [] },
      sample: { name: 'Creature name', speed: '30 ft.' },
    };
    expect(sampleRecord(template)).toEqual({ name: 'Creature name', hp: 10, image: null, speed: '30 ft.' });
  });
});
