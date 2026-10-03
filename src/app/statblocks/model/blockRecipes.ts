import { createBlock } from './blockCatalogue';
import { labelToKey } from './fieldKeys';
import type { BlockIdSource } from './templateIds';
import type { FieldKey, FieldType, TemplateBlock, TemplateField } from './templateTypes';

export type RecipeId = 'stat-strip' | 'ability-scores' | 'actions' | 'defenses';

/** lucide-react icon names of the recipes. */
export type RecipeIcon = 'rows-3' | 'table-2' | 'swords' | 'shield';

/** What a recipe inserts: its blocks, top to bottom, and the new fields they show. */
export interface RecipeResult {
  blocks: TemplateBlock[];
  fields: TemplateField[];
}

/** Several blocks inserted at once, listed under "Common" at the top of the palette (§7.5). */
export interface BlockRecipe {
  id: RecipeId;
  label: string;
  icon: RecipeIcon;
  /** New fields get keys free in `existingKeys` (the template's keys and former keys). */
  create(nextId: BlockIdSource, existingKeys: Iterable<FieldKey>): RecipeResult;
}

const ABILITY_SLOTS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
/** The d20 ability modifier a Scores column works out from its slot's score. */
export const MODIFIER_FORMULA = 'floor((value - 10) / 2)';

/** Makes fields whose keys are free in the template and among each other. */
function fieldMaker(existingKeys: Iterable<FieldKey>): (label: string, type: FieldType) => TemplateField {
  const taken = new Set(existingKeys);
  return (label, type) => {
    const key = labelToKey(label, taken);
    taken.add(key);
    return { key, label, type };
  };
}

function statStrip(nextId: BlockIdSource, existingKeys: Iterable<FieldKey>): RecipeResult {
  const field = fieldMaker(existingKeys);
  const fields = [field('Armor class', 'number'), field('Hit points', 'number'), field('Speed', 'text')];
  const row = createBlock('row', nextId);
  const stats = fields.map((shown) => ({ ...createBlock('stat', nextId, shown.key), look: 'stacked' as const }));
  return { blocks: [{ ...row, blocks: stats }], fields };
}

function abilityScores(nextId: BlockIdSource, existingKeys: Iterable<FieldKey>): RecipeResult {
  const abilities: TemplateField = { ...fieldMaker(existingKeys)('Abilities', 'scores'), slots: [...ABILITY_SLOTS] };
  const scores = {
    ...createBlock('scores', nextId, abilities.key),
    columns: [{ label: 'Mod', formula: MODIFIER_FORMULA, display: 'signed' as const }],
  };
  return { blocks: [scores], fields: [abilities] };
}

function actions(nextId: BlockIdSource, existingKeys: Iterable<FieldKey>): RecipeResult {
  const field = fieldMaker(existingKeys)('Actions', 'entries');
  const entries = { ...createBlock('entries', nextId, field.key), heading: 'Actions', addLabel: 'Add action' };
  return { blocks: [entries], fields: [field] };
}

function defenses(nextId: BlockIdSource, existingKeys: Iterable<FieldKey>): RecipeResult {
  const field = fieldMaker(existingKeys);
  const saves = field('Saving throws', 'pairs');
  const resistances = field('Damage resistances', 'text');
  const immunities = field('Damage immunities', 'text');
  const section = createBlock('section', nextId);
  const blocks = [
    createBlock('pairs', nextId, saves.key),
    createBlock('stat', nextId, resistances.key),
    createBlock('stat', nextId, immunities.key),
  ];
  return { blocks: [{ ...section, heading: 'Defenses', blocks }], fields: [saves, resistances, immunities] };
}

export const BLOCK_RECIPES: readonly BlockRecipe[] = [
  { id: 'stat-strip', label: 'Stat strip', icon: 'rows-3', create: statStrip },
  { id: 'ability-scores', label: 'Ability scores', icon: 'table-2', create: abilityScores },
  { id: 'actions', label: 'Actions', icon: 'swords', create: actions },
  { id: 'defenses', label: 'Defenses', icon: 'shield', create: defenses },
];

export function recipeById(id: RecipeId): BlockRecipe | undefined {
  return BLOCK_RECIPES.find((recipe) => recipe.id === id);
}
