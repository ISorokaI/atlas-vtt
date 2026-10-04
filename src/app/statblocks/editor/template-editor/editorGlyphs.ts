/**
 * The glyphs and plain names the template editor's side panes show for blocks,
 * recipes, field types and meanings. The catalogue names its icons as
 * lucide names; these are the components behind them.
 */

import {
  AlignJustify, AlignLeft, CircleDot, CircleHelp, Clock, Code, Coins, Columns3, Dices, Eye, Gauge, Hash, Heading, Heading2, Heart,
  Image, List, ListChecks, ListOrdered, ListTree, Minus, PanelTop, Rows3, ScrollText, Shield, Sparkles, SquareStack, Star, Subtitles, Sword,
  Swords, Table, Table2, Tags, Text, Type, Zap, type LucideIcon,
} from 'lucide-react';
import { blockSpec, type BlockIcon } from '../../model/blockCatalogue';
import { recipeById, type RecipeIcon } from '../../model/blockRecipes';
import type { BlockType, FieldMeaning, FieldType } from '../../model/templateTypes';
import type { InsertItem } from './insertItems';

const BLOCK_GLYPHS: Readonly<Record<BlockIcon, LucideIcon>> = {
  'square-stack': SquareStack, 'columns-3': Columns3, heading: Heading, subtitles: Subtitles, hash: Hash, table: Table,
  tags: Tags, text: Text, swords: Swords, list: List, gauge: Gauge, image: Image, sparkles: Sparkles,
  'heading-2': Heading2, minus: Minus, code: Code, 'circle-help': CircleHelp, 'panel-top': PanelTop,
};

const RECIPE_GLYPHS: Readonly<Record<RecipeIcon, LucideIcon>> = {
  heading: Heading, 'rows-3': Rows3, 'table-2': Table2, swords: Swords, 'scroll-text': ScrollText, sparkles: Sparkles,
  'list-checks': ListChecks, eye: Eye, shield: Shield, heart: Heart, zap: Zap, clock: Clock, gauge: Gauge,
  'align-justify': AlignJustify, sword: Sword, coins: Coins, tags: Tags, 'list-ordered': ListOrdered, 'list-tree': ListTree,
};

export function blockGlyph(type: BlockType): LucideIcon {
  return BLOCK_GLYPHS[blockSpec(type).icon];
}

/** A palette item's glyph: its recipe's, or its block type's. */
export function insertItemGlyph(item: InsertItem): LucideIcon {
  if (item.kind === 'block') return blockGlyph(item.type);
  const recipe = recipeById(item.id);
  return recipe ? RECIPE_GLYPHS[recipe.icon] : SquareStack;
}

/** What a field holds, in the words the editor uses. */
export const FIELD_TYPE_LABELS: Readonly<Record<FieldType, string>> = {
  text: 'Text', markdown: 'Paragraphs', number: 'Number', rating: 'Rating', dice: 'Dice', choice: 'One of a list',
  list: 'List', scores: 'Scores', entries: 'Abilities', pairs: 'Labelled values', image: 'Picture', spells: 'Spells',
};

const FIELD_TYPE_GLYPHS: Readonly<Record<FieldType, LucideIcon>> = {
  text: Type, markdown: AlignLeft, number: Hash, rating: Star, dice: Dices, choice: CircleDot,
  list: ListChecks, scores: Table, entries: Swords, pairs: List, image: Image, spells: Sparkles,
};

export function fieldTypeGlyph(type: FieldType): LucideIcon {
  return FIELD_TYPE_GLYPHS[type];
}

/** What Atlas uses a field for (`meaning`), as badges and the Advanced group's choices name it. */
export const MEANING_LABELS: Readonly<Record<FieldMeaning, string>> = {
  'hit-points': 'Hit points', armor: 'Armor', rating: 'Rating', size: 'Size', 'creature-type': 'Creature type',
  senses: 'Senses', initiative: 'Initiative', traits: 'Traits',
};
