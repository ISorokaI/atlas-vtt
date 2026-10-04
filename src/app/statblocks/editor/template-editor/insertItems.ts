/**
 * What the Add panel and the insert menu offer (spec §10.7, §12.3): recipes
 * by the part of a statblock they make, then the catalogue's blocks by group,
 * each with one line saying what it makes; and the small template each one
 * is previewed with, filled with samples.
 */

import {
  AUTHORABLE_BLOCK_TYPES, blockSpec, createBlock, type AuthorableBlockType, type PaletteGroup,
} from '../../model/blockCatalogue';
import { BLOCK_RECIPES, type RecipeGroup, type RecipeId } from '../../model/blockRecipes';
import type { BlockIdSource } from '../../model/templateIds';
import {
  TEMPLATE_FORMAT, TEMPLATE_VERSION, type FieldType, type StatblockTemplate, type TemplateBlock, type TemplateField,
} from '../../model/templateTypes';

export type InsertGroup = RecipeGroup | PaletteGroup;

interface ItemWords {
  label: string;
  /** One line saying what it makes ("Armor Class 17"). */
  example: string;
  /** Words it is also found by. */
  keywords: readonly string[];
}

export type InsertItem =
  | ({ kind: 'recipe'; id: RecipeId; group: RecipeGroup } & ItemWords)
  | ({ kind: 'block'; type: AuthorableBlockType; group: PaletteGroup } & ItemWords);

export const INSERT_GROUPS: ReadonlyArray<{ id: InsertGroup; label: string }> = [
  { id: 'common', label: 'Common parts' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'dense', label: 'Dense lines' },
  { id: 'tagged', label: 'Tags and costs' },
  { id: 'basics', label: 'Text and stats' },
  { id: 'lists', label: 'Lists' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'layout', label: 'Layout' },
  { id: 'media', label: 'Pictures' },
];

/** What each block makes, in one line (spec §1). */
const BLOCK_WORDS: Readonly<Record<AuthorableBlockType, { example: string; keywords: readonly string[] }>> = {
  section: { example: 'A heading with blocks under it', keywords: ['group'] },
  row: { example: 'Blocks next to each other', keywords: ['row', 'columns'] },
  tabs: { example: 'Sections shown one at a time', keywords: ['tab', 'pages', 'levels', 'kinds'] },
  title: { example: 'The creature\'s name', keywords: ['title'] },
  line: { example: 'Large aberration, lawful evil', keywords: ['line', 'subtitle', 'type'] },
  stat: { example: 'Armor Class 17', keywords: ['value', 'number', 'property'] },
  scores: { example: 'STR DEX CON with modifiers', keywords: ['ability scores', 'stats', 'attributes'] },
  tags: { example: 'Fire, Undead, Fey', keywords: ['keywords', 'list'] },
  text: { example: 'A paragraph', keywords: ['description', 'notes'] },
  entries: { example: 'Multiattack. The creature makes two attacks.', keywords: ['actions', 'traits', 'features', 'entries'] },
  pairs: { example: 'Saving Throws Con +6, Int +8', keywords: ['saves', 'skills', 'pairs'] },
  track: { example: 'Boxes or a gauge: Hit points ☐☐☐☐☐', keywords: ['boxes', 'stress', 'hp'] },
  image: { example: 'Token art or a portrait', keywords: ['image', 'art', 'portrait', 'token'] },
  spells: { example: 'Spells by level', keywords: ['spellcasting', 'magic'] },
  heading: { example: 'A heading on its own', keywords: ['title'] },
  divider: { example: 'A line across', keywords: ['rule', 'separator'] },
};

export function itemKey(item: InsertItem): string {
  return item.kind === 'recipe' ? `recipe:${item.id}` : `block:${item.type}`;
}

/** Every item in the order of their groups: recipes first, then blocks. */
export function insertItems(): InsertItem[] {
  const recipes: InsertItem[] = BLOCK_RECIPES.map((recipe) => ({
    kind: 'recipe', id: recipe.id, label: recipe.label, group: recipe.group, example: recipe.example, keywords: recipe.keywords ?? [],
  }));
  const blocks: InsertItem[] = AUTHORABLE_BLOCK_TYPES.flatMap((type) => {
    const spec = blockSpec(type);
    return spec.group ? [{ kind: 'block' as const, type, label: spec.label, group: spec.group, ...BLOCK_WORDS[type] }] : [];
  });
  const order = INSERT_GROUPS.map((group) => group.id);
  return [...recipes, ...blocks].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

/** The items whose name, line or other words hold every word typed, in any case ("spell" finds Spellcasting and Spells). */
export function findItems(items: readonly InsertItem[], query: string): InsertItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const text = `${item.label} ${item.example} ${item.keywords.join(' ')}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/**
 * Which of the items found the keys start on: one named exactly what was typed ("stat" is Stat, not Stats on one line),
 * else the first whose name starts with it, else the first.
 */
export function bestMatch(items: readonly InsertItem[], query: string): number {
  const typed = query.trim().toLowerCase();
  if (!typed) return 0;
  const exact = items.findIndex((item) => item.label.toLowerCase() === typed);
  if (exact !== -1) return exact;
  return Math.max(items.findIndex((item) => item.label.toLowerCase().startsWith(typed)), 0);
}

/** The items under their group headings, groups in menu order, empty groups left out. */
export function groupItems(items: readonly InsertItem[]): Array<{ id: InsertGroup; label: string; items: InsertItem[] }> {
  return INSERT_GROUPS
    .map((group) => ({ ...group, items: items.filter((item) => item.group === group.id) }))
    .filter((group) => group.items.length > 0);
}

/** The field a block's preview shows, by the type it binds; named after the block. */
const PREVIEW_FIELDS: Partial<Record<AuthorableBlockType, { type: FieldType; slots?: string[] }>> = {
  title: { type: 'text' }, line: { type: 'text' }, stat: { type: 'number' }, scores: { type: 'scores', slots: ['A', 'B', 'C'] },
  tags: { type: 'list' }, text: { type: 'markdown' }, entries: { type: 'entries' }, pairs: { type: 'pairs' },
  track: { type: 'number' }, image: { type: 'image' }, spells: { type: 'spells' },
};

function previewIds(): BlockIdSource {
  let next = 0;
  return () => `preview${(next++).toString(36)}`;
}

function previewParts(item: InsertItem, nextId: BlockIdSource): { blocks: TemplateBlock[]; fields: TemplateField[] } {
  if (item.kind === 'recipe') return BLOCK_RECIPES.find((recipe) => recipe.id === item.id)?.create(nextId, []) ?? { blocks: [], fields: [] };
  if (item.type === 'section' || item.type === 'row') {
    const fields: TemplateField[] = [{ key: 'first', label: 'First', type: 'number' }, { key: 'second', label: 'Second', type: 'number' }];
    const look = item.type === 'row' ? 'stacked' as const : 'run-in' as const;
    const children = fields.map((field) => ({ ...createBlock('stat', nextId, field.key), look }));
    const container = createBlock(item.type, nextId);
    return { blocks: [{ ...container, blocks: children }], fields };
  }
  if (item.type === 'tabs') {
    const fields: TemplateField[] = [{ key: 'first', label: 'First', type: 'number' }, { key: 'second', label: 'Second', type: 'number' }];
    const tabs = createBlock('tabs', nextId);
    const blocks = tabs.blocks.map((tab, index) => ({ ...tab, blocks: [createBlock('stat', nextId, fields[index]?.key)] }));
    return { blocks: [{ ...tabs, blocks }], fields };
  }
  const shape = PREVIEW_FIELDS[item.type];
  const field: TemplateField | null = shape ? { key: item.type, label: item.label, type: shape.type, ...(shape.slots && { slots: shape.slots }) } : null;
  return { blocks: [createBlock(item.type, nextId, field?.key)], fields: field ? [field] : [] };
}

/** A one-column template holding just the item, for the menu's preview. */
export function previewTemplate(item: InsertItem): StatblockTemplate {
  const { blocks, fields } = previewParts(item, previewIds());
  return { format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, id: 'preview', fields, layout: { maxColumns: 1, blocks } };
}
