import type { BlockIdSource } from './templateIds';
import type { BlockType, FieldKey, FieldType, TemplateBlock } from './templateTypes';

/** Blocks an author can insert; `script` and `opaque` only ever come from a file. */
export type AuthorableBlockType = Exclude<BlockType, 'script' | 'opaque'>;

/** The Fantasy Statblocks block type a block exports to and names in `data-type`. */
export type FsBlockType =
  | 'heading' | 'subheading' | 'property' | 'table' | 'traits' | 'saves' | 'text' | 'image' | 'spells'
  | 'group' | 'inline' | 'javascript';

/** lucide-react icon names the catalogue uses. */
export type BlockIcon =
  | 'square-stack' | 'columns-3' | 'heading' | 'subtitles' | 'hash' | 'table' | 'tags' | 'text' | 'swords'
  | 'list' | 'gauge' | 'image' | 'sparkles' | 'heading-2' | 'minus' | 'code' | 'circle-help' | 'panel-top';

/** The palette group a block is listed under (§7.4); recipes are "Common". */
export type PaletteGroup = 'basics' | 'lists' | 'numbers' | 'layout' | 'media';

export interface BlockSpec {
  type: BlockType;
  /** Sentence case, in plain words (spec §1), as the Add panel, the toolbar, Structure and Settings show it. Type ids never change. */
  label: string;
  icon: BlockIcon;
  /** Field types the block's own field (each of a Line's fields) may have; empty where it binds none. */
  binds: readonly FieldType[];
  authorable: boolean;
  /** null: a Divider exports as `hasRule` on the block before it, an unknown block as it was read. */
  fsType: FsBlockType | null;
  /** Its size inside a Row while `size` is unset. */
  rowSize: 'fit' | 'fill';
  /** null exactly for the blocks that are not authorable, which the palette does not offer. */
  group: PaletteGroup | null;
}

const SCALAR_FIELDS: readonly FieldType[] = ['text', 'number', 'rating', 'dice', 'choice'];

function spec(
  type: BlockType, label: string, icon: BlockIcon, binds: readonly FieldType[],
  fsType: FsBlockType | null, rowSize: 'fit' | 'fill', group: PaletteGroup | null,
): BlockSpec {
  return { type, label, icon, binds, authorable: group !== null, fsType, rowSize, group };
}

export const BLOCK_CATALOGUE: Readonly<Record<BlockType, BlockSpec>> = {
  section: spec('section', 'Section', 'square-stack', [], 'group', 'fill', 'layout'),
  row: spec('row', 'Side by side', 'columns-3', [], 'inline', 'fill', 'layout'),
  tabs: spec('tabs', 'Tabs', 'panel-top', [], 'group', 'fill', 'layout'),
  title: spec('title', 'Name', 'heading', ['text'], 'heading', 'fill', 'basics'),
  line: spec('line', 'Stats on one line', 'subtitles', SCALAR_FIELDS, 'subheading', 'fill', 'basics'),
  stat: spec('stat', 'Stat', 'hash', SCALAR_FIELDS, 'property', 'fit', 'basics'),
  scores: spec('scores', 'Score table', 'table', ['scores'], 'table', 'fill', 'numbers'),
  tags: spec('tags', 'Tags', 'tags', ['list'], 'property', 'fill', 'lists'),
  text: spec('text', 'Text', 'text', ['markdown'], 'text', 'fill', 'basics'),
  entries: spec('entries', 'Abilities', 'swords', ['entries'], 'traits', 'fill', 'lists'),
  pairs: spec('pairs', 'Labelled values', 'list', ['pairs'], 'saves', 'fill', 'lists'),
  track: spec('track', 'Track', 'gauge', ['number'], 'property', 'fit', 'numbers'),
  image: spec('image', 'Picture', 'image', ['image'], 'image', 'fit', 'media'),
  spells: spec('spells', 'Spells', 'sparkles', ['spells'], 'spells', 'fill', 'lists'),
  heading: spec('heading', 'Heading', 'heading-2', [], 'text', 'fill', 'basics'),
  divider: spec('divider', 'Divider', 'minus', [], null, 'fill', 'layout'),
  script: spec('script', 'Kept from Fantasy Statblocks', 'code', [], 'javascript', 'fill', null),
  opaque: spec('opaque', 'From a newer Atlas', 'circle-help', [], null, 'fill', null),
};

export const BLOCK_TYPES: readonly BlockType[] = Object.keys(BLOCK_CATALOGUE) as BlockType[];

export const AUTHORABLE_BLOCK_TYPES: readonly AuthorableBlockType[] =
  BLOCK_TYPES.filter((type): type is AuthorableBlockType => BLOCK_CATALOGUE[type].authorable);

export function isAuthorableBlockType(type: BlockType): type is AuthorableBlockType {
  return BLOCK_CATALOGUE[type].authorable;
}

export function blockSpec(type: BlockType): BlockSpec {
  return BLOCK_CATALOGUE[type];
}

export function bindsFieldType(type: BlockType, fieldType: FieldType): boolean {
  return BLOCK_CATALOGUE[type].binds.includes(fieldType);
}

/** A block's size inside a Row: its own `size`, else its type's default. */
export function rowSizeOf(block: TemplateBlock): 'fit' | 'fill' {
  return block.size ?? BLOCK_CATALOGUE[block.type].rowSize;
}

/** Where a block sits: at the root, or inside a block of this type. */
export type ParentType = 'root' | BlockType;

/**
 * The root and a Section take every block, a Row every block but a Row (a Row
 * already wraps) and Tabs, Tabs only Sections (one per tab), and no other
 * block holds children. That a block is never placed inside itself is the
 * tree's rule (`treeOps`), not the catalogue's.
 */
export function canContain(parent: ParentType, child: BlockType): boolean {
  if (parent === 'root' || parent === 'section') return true;
  if (parent === 'row') return child !== 'row' && child !== 'tabs';
  if (parent === 'tabs') return child === 'section';
  return false;
}

/** The label a new tab gets: "Tab 3" for the third. */
export function tabLabel(position: number): string {
  return `Tab ${position}`;
}

const NATURAL_BLOCKS: Readonly<Record<FieldType, AuthorableBlockType>> = {
  text: 'stat', number: 'stat', rating: 'stat', dice: 'stat', choice: 'stat',
  markdown: 'text', list: 'tags', scores: 'scores', entries: 'entries', pairs: 'pairs', image: 'image', spells: 'spells',
};

/** The block a field of this type gets when it is dragged onto the canvas or shown by the auto template. */
export function naturalBlockFor(fieldType: FieldType): AuthorableBlockType {
  return NATURAL_BLOCKS[fieldType];
}

type BlockOfType<T extends BlockType> = Extract<TemplateBlock, { type: T }>;

/**
 * A new block with its type's defaults. A block that binds a field shows
 * `fieldKey`; without one it is unbound (`''`) until its label is committed
 * (§7.6), except a Title, which shows `name`, and an Image, which shows `image`.
 */
export function createBlock<T extends AuthorableBlockType>(type: T, nextId: BlockIdSource, fieldKey?: FieldKey): BlockOfType<T>;
export function createBlock(type: AuthorableBlockType, nextId: BlockIdSource, fieldKey?: FieldKey): TemplateBlock {
  const id = nextId();
  const field = fieldKey ?? '';
  switch (type) {
    case 'section': return { id, type, blocks: [] };
    case 'row': return { id, type, blocks: [] };
    case 'tabs': return {
      id, type, blocks: [1, 2].map((position) => ({ id: nextId(), type: 'section', heading: tabLabel(position), blocks: [] })),
    };
    case 'title': return { id, type, field: fieldKey ?? 'name', level: 1 };
    case 'line': return { id, type, fields: fieldKey ? [fieldKey] : [] };
    case 'stat': return { id, type, field, look: 'run-in' };
    case 'scores': return { id, type, field, orientation: 'row' };
    case 'tags': return { id, type, field, look: 'comma' };
    case 'text': return { id, type, field };
    case 'entries': return { id, type, field };
    case 'pairs': return { id, type, field };
    case 'track': return { id, type, field, look: 'boxes', counts: 'down' };
    case 'image': return { id, type, field: fieldKey ?? 'image', shape: 'token' };
    case 'spells': return { id, type, field };
    case 'heading': return { id, type, text: 'Heading', level: 'section' };
    case 'divider': return { id, type };
  }
}
