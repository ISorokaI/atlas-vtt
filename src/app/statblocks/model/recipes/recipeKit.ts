/** What every recipe shares (spec §12.3): its shape, and finding or making the properties its blocks show. */

import { bindsFieldType } from '../blockCatalogue';
import { fieldByKey, fieldKeysOf, labelToKey } from '../fieldKeys';
import type { BlockIdSource } from '../templateIds';
import type { BlockType, FieldType, TemplateBlock, TemplateField } from '../templateTypes';

export type RecipeId =
  | 'name-line' | 'stat-strip' | 'ability-scores' | 'actions' | 'traits' | 'spellcasting' | 'saves-skills' | 'senses-languages' | 'defenses'
  | 'hp-boxes' | 'stress-boxes' | 'clock' | 'thresholds'
  | 'one-line-stats' | 'attack-line' | 'morale-treasure'
  | 'trait-tags' | 'costed-abilities' | 'kinded-features';

/** The book part a recipe is listed under (§12.3). */
export type RecipeGroup = 'common' | 'tracks' | 'dense' | 'tagged';

/** lucide-react icon names of the recipes. */
export type RecipeIcon =
  | 'heading' | 'rows-3' | 'table-2' | 'swords' | 'scroll-text' | 'sparkles' | 'list-checks' | 'eye' | 'shield'
  | 'heart' | 'zap' | 'clock' | 'gauge' | 'align-justify' | 'sword' | 'coins' | 'tags' | 'list-ordered' | 'list-tree';

/** What a recipe inserts: its blocks, top to bottom, and the new properties they show. */
export interface RecipeResult {
  blocks: TemplateBlock[];
  fields: TemplateField[];
}

/** Several blocks inserted at once, by the part of a statblock they make (§7.5, §12.3). */
export interface BlockRecipe {
  id: RecipeId;
  label: string;
  /** One line under its name in the Add panel: what it makes. */
  example: string;
  group: RecipeGroup;
  icon: RecipeIcon;
  /** Words it is also found by. */
  keywords?: readonly string[];
  /**
   * The recipe's blocks for a template holding `existing` properties. A block shows the template's own property where
   * it has the recipe's key (a former key too) and the block can show it, so a stat strip in a template with `ac` shows
   * `ac`; only the other properties are new, with keys free among the template's keys and former keys.
   */
  create(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult;
}

/** A property a recipe's block shows, and whether the recipe adds it to the template. */
export interface RecipeField {
  field: TemplateField;
  isNew: boolean;
}

/** Finds or makes the properties a recipe's blocks show; made ones get keys free in the template and among each other. */
export function fieldMaker(existing: readonly TemplateField[]): (label: string, type: FieldType, shownBy: BlockType, extra?: Partial<TemplateField>) => RecipeField {
  const taken = fieldKeysOf(existing);
  return (label, type, shownBy, extra = {}) => {
    const own = fieldByKey(existing, labelToKey(label, []));
    if (own && bindsFieldType(shownBy, own.type)) return { field: own, isNew: false };
    const key = labelToKey(label, taken);
    taken.add(key);
    return { field: { key, label, type, ...extra }, isNew: true };
  };
}

/** The properties among `shown` that the recipe adds. */
export function newFields(shown: readonly RecipeField[]): TemplateField[] {
  return shown.filter((found) => found.isNew).map((found) => found.field);
}
