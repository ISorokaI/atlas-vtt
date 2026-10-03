/**
 * What the insert menu offers (§7.4, §7.6): the recipes under Common, then the
 * catalogue's blocks by palette group; and the small template each one is
 * previewed with, filled with neutral samples.
 */

import {
  AUTHORABLE_BLOCK_TYPES, blockSpec, createBlock, type AuthorableBlockType, type PaletteGroup,
} from '../../model/blockCatalogue';
import { BLOCK_RECIPES, type RecipeId } from '../../model/blockRecipes';
import type { BlockIdSource } from '../../model/templateIds';
import {
  TEMPLATE_FORMAT, TEMPLATE_VERSION, type FieldType, type StatblockTemplate, type TemplateBlock, type TemplateField,
} from '../../model/templateTypes';

export type InsertGroup = 'common' | PaletteGroup;

export type InsertItem =
  | { kind: 'recipe'; id: RecipeId; label: string; group: 'common' }
  | { kind: 'block'; type: AuthorableBlockType; label: string; group: PaletteGroup };

export const INSERT_GROUPS: ReadonlyArray<{ id: InsertGroup; label: string }> = [
  { id: 'common', label: 'Common' },
  { id: 'basics', label: 'Basics' },
  { id: 'lists', label: 'Lists' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'layout', label: 'Layout' },
  { id: 'media', label: 'Media' },
];

export function itemKey(item: InsertItem): string {
  return item.kind === 'recipe' ? `recipe:${item.id}` : `block:${item.type}`;
}

/** Every item, recipes first, then blocks in the order of their groups. */
export function insertItems(): InsertItem[] {
  const recipes: InsertItem[] = BLOCK_RECIPES.map((recipe) => ({ kind: 'recipe', id: recipe.id, label: recipe.label, group: 'common' }));
  const blocks: InsertItem[] = AUTHORABLE_BLOCK_TYPES.flatMap((type) => {
    const spec = blockSpec(type);
    return spec.group ? [{ kind: 'block' as const, type, label: spec.label, group: spec.group }] : [];
  });
  const order = INSERT_GROUPS.map((group) => group.id);
  return [...recipes, ...blocks.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))];
}

/** The items whose name holds every word typed, in any case. */
export function findItems(items: readonly InsertItem[], query: string): InsertItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => words.every((word) => item.label.toLowerCase().includes(word)));
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
  const shape = PREVIEW_FIELDS[item.type];
  const field: TemplateField | null = shape ? { key: item.type, label: item.label, type: shape.type, ...(shape.slots && { slots: shape.slots }) } : null;
  return { blocks: [createBlock(item.type, nextId, field?.key)], fields: field ? [field] : [] };
}

/** A one-column template holding just the item, for the menu's preview. */
export function previewTemplate(item: InsertItem): StatblockTemplate {
  const { blocks, fields } = previewParts(item, previewIds());
  return { format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, id: 'preview', fields, layout: { maxColumns: 1, blocks } };
}
