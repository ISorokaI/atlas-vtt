import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUTHORABLE_BLOCK_TYPES, BLOCK_CATALOGUE, BLOCK_TYPES, bindsFieldType, blockSpec, canContain, createBlock,
  isAuthorableBlockType, naturalBlockFor, rowSizeOf,
} from '../../../../src/app/statblocks/model/blockCatalogue';
import { BLOCK_RECIPES, recipeById } from '../../../../src/app/statblocks/model/blockRecipes';
import { isLegalSubtree } from '../../../../src/app/statblocks/model/treeEdit';
import { fieldsShownBy, flattenReadingOrder } from '../../../../src/app/statblocks/model/treeQueries';
import { FIELD_TYPES, type BlockType, type TemplateBlock, type TemplateField } from '../../../../src/app/statblocks/model/templateTypes';
import { idsFrom } from './treeFixtures';

const ALL_TYPES: BlockType[] = [
  'section', 'row', 'tabs', 'title', 'line', 'stat', 'scores', 'tags', 'text', 'entries', 'pairs', 'track', 'image',
  'spells', 'heading', 'divider', 'script', 'opaque',
];

const lucideIcon = (name: string): boolean =>
  existsSync(resolve(__dirname, '../../../../node_modules/lucide-react/dist/esm/icons', `${name}.js`));

describe('block catalogue', () => {
  it('describes every block type, labelled in sentence case with a lucide icon', () => {
    expect([...BLOCK_TYPES].sort()).toEqual([...ALL_TYPES].sort());
    for (const type of ALL_TYPES) {
      const spec = blockSpec(type);
      expect(spec.type).toBe(type);
      // Sentence case; only proper names (Fantasy Statblocks, Atlas) keep their capitals.
      expect(spec.label.replace(/Fantasy Statblocks|Atlas/, '')).toMatch(/^[A-Z]?[a-z ]*$/);
      expect(lucideIcon(spec.icon), `${type}: ${spec.icon}`).toBe(true);
    }
    for (const recipe of BLOCK_RECIPES) expect(lucideIcon(recipe.icon), recipe.icon).toBe(true);
  });

  it('offers every block but scripts and unknown blocks to authors', () => {
    expect([...AUTHORABLE_BLOCK_TYPES].sort()).toEqual(ALL_TYPES.filter((type) => type !== 'script' && type !== 'opaque').sort());
    expect(isAuthorableBlockType('script')).toBe(false);
    expect(isAuthorableBlockType('opaque')).toBe(false);
    for (const type of AUTHORABLE_BLOCK_TYPES) expect(BLOCK_CATALOGUE[type].group).not.toBeNull();
  });

  it('binds no field to layout blocks, headings and dividers', () => {
    for (const type of ['section', 'row', 'tabs', 'heading', 'divider', 'script', 'opaque'] as const) expect(blockSpec(type).binds).toEqual([]);
    expect(blockSpec('stat').binds).toEqual(['text', 'number', 'rating', 'dice', 'choice']);
    expect(bindsFieldType('track', 'number')).toBe(true);
    expect(bindsFieldType('tags', 'text')).toBe(false);
  });

  it('names the FS block type each block exports to', () => {
    expect(Object.fromEntries(ALL_TYPES.map((type) => [type, blockSpec(type).fsType]))).toEqual({
      section: 'group', row: 'inline', tabs: 'group', title: 'heading', line: 'subheading', stat: 'property', scores: 'table',
      tags: 'property', text: 'text', entries: 'traits', pairs: 'saves', track: 'property', image: 'image',
      spells: 'spells', heading: 'text', divider: null, script: 'javascript', opaque: null,
    });
  });

  it('lets the root and Sections take every block, Rows every block but a Row and Tabs, Tabs only Sections, and nothing else any', () => {
    for (const child of ALL_TYPES) {
      expect(canContain('root', child)).toBe(true);
      expect(canContain('section', child)).toBe(true);
      expect(canContain('row', child)).toBe(child !== 'row' && child !== 'tabs');
      expect(canContain('tabs', child)).toBe(child === 'section');
      for (const leaf of ALL_TYPES.filter((type) => type !== 'section' && type !== 'row' && type !== 'tabs')) expect(canContain(leaf, child)).toBe(false);
    }
  });

  it('makes a new Tabs block with two empty tabs, "Tab 1" and "Tab 2"', () => {
    const tabs = createBlock('tabs', idsFrom('tabs0001', 'tab00001', 'tab00002'));
    expect(tabs).toEqual({
      id: 'tabs0001', type: 'tabs', blocks: [
        { id: 'tab00001', type: 'section', heading: 'Tab 1', blocks: [] },
        { id: 'tab00002', type: 'section', heading: 'Tab 2', blocks: [] },
      ],
    });
    expect(isLegalSubtree(tabs)).toBe(true);
  });

  it('sizes blocks inside a Row by their own size, else their type', () => {
    expect(rowSizeOf({ id: 'a', type: 'stat', field: 'ac', look: 'run-in' })).toBe('fit');
    expect(rowSizeOf({ id: 'a', type: 'stat', field: 'ac', look: 'run-in', size: 'fill' })).toBe('fill');
    expect(rowSizeOf({ id: 'a', type: 'section', blocks: [] })).toBe('fill');
  });

  it('gives every field type a natural block that binds it', () => {
    for (const fieldType of FIELD_TYPES) expect(bindsFieldType(naturalBlockFor(fieldType), fieldType), fieldType).toBe(true);
    expect(Object.fromEntries(FIELD_TYPES.map((type) => [type, naturalBlockFor(type)]))).toEqual({
      text: 'stat', markdown: 'text', number: 'stat', rating: 'stat', dice: 'stat', choice: 'stat', list: 'tags',
      scores: 'scores', entries: 'entries', pairs: 'pairs', image: 'image', spells: 'spells',
    });
  });
});

describe('createBlock', () => {
  it.each([
    ['section', undefined, { blocks: [] }],
    ['row', undefined, { blocks: [] }],
    ['title', undefined, { field: 'name', level: 1 }],
    ['line', 'size', { fields: ['size'] }],
    ['line', undefined, { fields: [] }],
    ['stat', 'ac', { field: 'ac', look: 'run-in' }],
    ['stat', undefined, { field: '', look: 'run-in' }],
    ['scores', 'stats', { field: 'stats', orientation: 'row' }],
    ['tags', 'languages', { field: 'languages', look: 'comma' }],
    ['text', 'description', { field: 'description' }],
    ['entries', 'actions', { field: 'actions' }],
    ['pairs', 'saves', { field: 'saves' }],
    ['track', 'hp', { field: 'hp', look: 'boxes', counts: 'down' }],
    ['image', undefined, { field: 'image', shape: 'token' }],
    ['spells', 'spells', { field: 'spells' }],
    ['heading', undefined, { text: 'Heading', level: 'section' }],
    ['divider', undefined, {}],
  ] as const)('makes a %s (field %s) with its defaults', (type, field, defaults) => {
    expect(createBlock(type, idsFrom('abcd1234'), field)).toStrictEqual({ id: 'abcd1234', type, ...defaults });
  });
});

describe('recipes', () => {
  const blocksOf = (blocks: TemplateBlock[]): TemplateBlock[] => flattenReadingOrder(blocks);
  let counter = 0;
  const nextId = (): string => `r${(counter++).toString(36).padStart(7, '0')}`;

  it('insert legal blocks with unique ids that show every new field', () => {
    for (const recipe of BLOCK_RECIPES) {
      const { blocks, fields } = recipe.create(nextId, [{ key: 'name', label: 'Name', type: 'text' }]);
      const all = blocksOf(blocks);
      expect(new Set(all.map((block) => block.id)).size).toBe(all.length);
      expect(blocks.every(isLegalSubtree)).toBe(true);
      const shown = new Set(all.flatMap((block) => fieldsShownBy(block)));
      expect(fields.map((field) => field.key).every((key) => shown.has(key)), recipe.id).toBe(true);
      expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length);
    }
  });

  it('builds a Stat strip of three stacked Stats in a Row', () => {
    const { blocks, fields } = recipeById('stat-strip')?.create(idsFrom('row00000', 's1', 's2', 's3'), []) ?? { blocks: [], fields: [] };
    expect(fields).toEqual([
      { key: 'ac', label: 'Armor class', type: 'number' },
      { key: 'hp', label: 'Hit points', type: 'number' },
      { key: 'speed', label: 'Speed', type: 'text' },
    ]);
    expect(blocks).toStrictEqual([{ id: 'row00000', type: 'row', blocks: [
      { id: 's1', type: 'stat', field: 'ac', look: 'stacked' },
      { id: 's2', type: 'stat', field: 'hp', look: 'stacked' },
      { id: 's3', type: 'stat', field: 'speed', look: 'stacked' },
    ] }]);
  });

  it('shows the template\'s own fields where it has the recipe\'s keys, and adds only the others', () => {
    const existing: TemplateField[] = [
      { key: 'ac', label: 'AC', type: 'number' },
      { key: 'hit_points', label: 'HP', type: 'text', formerKeys: ['hp'] },
      { key: 'actions', label: 'Actions', type: 'entries' },
    ];
    const strip = recipeById('stat-strip')?.create(idsFrom('row00000', 's1', 's2', 's3'), existing);
    expect(strip?.fields).toEqual([{ key: 'speed', label: 'Speed', type: 'text' }]);
    const row = strip?.blocks[0];
    expect(row && 'blocks' in row ? row.blocks.map((block) => 'field' in block && block.field) : []).toEqual(['ac', 'hit_points', 'speed']);
    expect(recipeById('actions')?.create(idsFrom('a'), existing)).toStrictEqual({
      blocks: [{ id: 'a', type: 'entries', field: 'actions', heading: 'Actions', addLabel: 'Add action' }],
      fields: [],
    });
  });

  it('gives a new field a free key where the template\'s field of that key is one the block cannot show', () => {
    const existing: TemplateField[] = [{ key: 'ac', label: 'AC', type: 'entries' }, { key: 'stats', label: 'Stats', type: 'text' }];
    const { fields } = recipeById('stat-strip')?.create(nextId, existing) ?? { fields: [] };
    expect(fields.map((field) => field.key)).toEqual(['ac_2', 'hp', 'speed']);
    const scores = recipeById('ability-scores')?.create(nextId, existing);
    expect(scores?.fields).toEqual([{ key: 'stats_2', label: 'Abilities', type: 'scores', slots: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }]);
  });

  it('builds ability scores with six slots and a signed modifier column', () => {
    const { blocks, fields } = recipeById('ability-scores')?.create(idsFrom('sc'), []) ?? { blocks: [], fields: [] };
    expect(fields).toEqual([{ key: 'stats', label: 'Abilities', type: 'scores', slots: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] }]);
    expect(blocks).toStrictEqual([{
      id: 'sc', type: 'scores', field: 'stats', orientation: 'row',
      columns: [{ label: 'Mod', formula: 'floor((value - 10) / 2)', display: 'signed' }],
    }]);
  });

  it('builds Actions and Defenses, whose saving throws read as modifiers like the other saves', () => {
    expect(recipeById('actions')?.create(idsFrom('ac'), [])).toStrictEqual({
      blocks: [{ id: 'ac', type: 'entries', field: 'actions', heading: 'Actions', addLabel: 'Add action' }],
      fields: [{ key: 'actions', label: 'Actions', type: 'entries' }],
    });
    expect(recipeById('defenses')?.create(idsFrom('d', 'p', 'r', 'i'), [])).toStrictEqual({
      blocks: [{ id: 'd', type: 'section', heading: 'Defenses', blocks: [
        { id: 'p', type: 'pairs', field: 'saves', display: 'signed' },
        { id: 'r', type: 'stat', field: 'damage_resistances', look: 'run-in' },
        { id: 'i', type: 'stat', field: 'damage_immunities', look: 'run-in' },
      ] }],
      fields: [
        { key: 'saves', label: 'Saving throws', type: 'pairs' },
        { key: 'damage_resistances', label: 'Damage resistances', type: 'text' },
        { key: 'damage_immunities', label: 'Damage immunities', type: 'text' },
      ],
    });
  });
});
