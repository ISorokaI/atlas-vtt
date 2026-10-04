import { bindsFieldType, canContain, createBlock, isAuthorableBlockType, type AuthorableBlockType } from './blockCatalogue';
import { fieldByKey } from './fieldKeys';
import { done, parentTypeOf, refuse, spliced, withChildren, type TreeEdit } from './treeEdit';
import { boundField, findBlock } from './treeQueries';
import {
  isContainerBlock, isContainerType, type BlockBase, type ContainerType, type BlockType, type TemplateBlock, type TemplateField, type TemplateLayout,
} from './templateTypes';

type CommonProps = Partial<Pick<BlockBase, 'showWhen' | 'whenEmpty' | 'fallback' | 'className' | 'size'>>;

/** Settings every block has that mean the same after a change of type; `fsExtras` belong to the old FS type. */
function commonProps(block: TemplateBlock): CommonProps {
  const kept: CommonProps = {};
  if (block.showWhen) kept.showWhen = block.showWhen;
  if (block.whenEmpty) kept.whenEmpty = block.whenEmpty;
  if (block.fallback !== undefined) kept.fallback = block.fallback;
  if (block.className !== undefined) kept.className = block.className;
  if (block.size) kept.size = block.size;
  return kept;
}

/** Settings that read alike in several block types, and the types that have them. */
const CARRIED: ReadonlyArray<readonly [key: string, types: readonly BlockType[]]> = [
  ['label', ['stat', 'tags', 'pairs', 'track']],
  ['heading', ['text', 'entries', 'spells']],
  ['display', ['stat', 'pairs', 'scores']],
];
const PATTERN_TYPES: readonly BlockType[] = ['title', 'line', 'stat'];

function turnedLeaf(block: TemplateBlock, type: AuthorableBlockType, fields: readonly TemplateField[]): TemplateBlock {
  const field = boundField(block);
  const fieldType = field ? fieldByKey(fields, field)?.type : undefined;
  const kept = field && fieldType && bindsFieldType(type, fieldType) ? field : undefined;
  const turned: Record<string, unknown> = { ...createBlock(type, () => block.id, kept), ...commonProps(block) };
  const source: Readonly<Record<string, unknown>> = { ...block };
  const carried = kept && PATTERN_TYPES.includes(type) ? [...CARRIED, ['pattern', PATTERN_TYPES] as const] : CARRIED;
  for (const [key, types] of carried) {
    if (types.includes(type) && types.includes(block.type) && source[key] !== undefined) turned[key] = source[key];
  }
  if (block.type === 'heading' && type === 'text') {
    delete turned.field;
    turned.text = block.text;
  }
  if (block.type === 'text' && type === 'heading') turned.text = block.text ?? block.heading ?? turned.text;
  return turned as unknown as TemplateBlock;
}

/**
 * Changes a block's type, keeping its id, its place and its field where the
 * new type binds that field's type (`fields` are the template's). Sections,
 * Rows and Tabs turn into each other with their children, where the new type
 * takes them; other blocks into any authorable block but those, keeping the
 * label, heading, pattern and display the new type shares.
 */
export function turnInto(
  layout: TemplateLayout, id: string, type: AuthorableBlockType, fields: readonly TemplateField[],
): TreeEdit {
  const found = findBlock(layout.blocks, id);
  if (!found) return refuse(layout, 'block-not-found');
  const { block } = found;
  if (block.type === type) return done(layout, id);
  if (!isAuthorableBlockType(type) || isContainerBlock(block) !== isContainerType(type)) return refuse(layout, 'cannot-turn-into');
  const parentType = parentTypeOf(layout, found.parentId);
  if (parentType === null || !canContain(parentType, type)) return refuse(layout, 'not-allowed-here');
  let turned: TemplateBlock;
  if (isContainerBlock(block)) {
    if (block.blocks.some((child) => !canContain(type, child.type))) return refuse(layout, 'not-allowed-here');
    turned = { id, type: type as ContainerType, blocks: block.blocks, ...commonProps(block) };
  } else {
    turned = turnedLeaf(block, type, fields);
  }
  return done(withChildren(layout, found.parentId, (children) => spliced(children, found.index, 1, turned)), id);
}
