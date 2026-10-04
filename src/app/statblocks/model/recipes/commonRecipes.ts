/** The parts nearly every statblock has (spec §12.3, "Common"). */

import { createBlock } from '../blockCatalogue';
import type { BlockIdSource } from '../templateIds';
import type { TemplateField } from '../templateTypes';
import { fieldMaker, newFields, type BlockRecipe, type RecipeResult } from './recipeKit';

const ABILITY_SLOTS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
/** The d20 ability modifier a score column works out from its score. */
export const MODIFIER_FORMULA = 'floor((value - 10) / 2)';

function nameLine(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const name = field('Name', 'text', 'title');
  const parts = [field('Size', 'text', 'line'), field('Type', 'text', 'line'), field('Alignment', 'text', 'line')];
  const [size, type, alignment] = parts.map((part) => part.field.key);
  const line = { ...createBlock('line', nextId), fields: parts.map((part) => part.field.key), pattern: `{${size}} {${type}}[, {${alignment}}]` };
  return { blocks: [createBlock('title', nextId, name.field.key), line], fields: newFields([name, ...parts]) };
}

function statStrip(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const shown = [field('Armor class', 'number', 'stat'), field('Hit points', 'number', 'stat'), field('Speed', 'text', 'stat')];
  const row = createBlock('row', nextId);
  const stats = shown.map(({ field: { key } }) => ({ ...createBlock('stat', nextId, key), look: 'stacked' as const }));
  return { blocks: [{ ...row, blocks: stats }], fields: newFields(shown) };
}

function abilityScores(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const found = fieldMaker(existing)('Abilities', 'scores', 'scores', { slots: [...ABILITY_SLOTS] });
  const scores = {
    ...createBlock('scores', nextId, found.field.key),
    columns: [{ label: 'Mod', formula: MODIFIER_FORMULA, display: 'signed' as const }],
  };
  return { blocks: [scores], fields: newFields([found]) };
}

function abilities(label: string, addLabel: string) {
  return (nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult => {
    const found = fieldMaker(existing)(label, 'entries', 'entries');
    const entries = { ...createBlock('entries', nextId, found.field.key), heading: label, addLabel };
    return { blocks: [entries], fields: newFields([found]) };
  };
}

function spellcasting(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const found = fieldMaker(existing)('Spells', 'spells', 'spells');
  return { blocks: [{ ...createBlock('spells', nextId, found.field.key), heading: 'Spellcasting' }], fields: newFields([found]) };
}

function savesAndSkills(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const saves = field('Saving throws', 'pairs', 'pairs');
  const skills = field('Skills', 'pairs', 'pairs');
  return {
    blocks: [
      { ...createBlock('pairs', nextId, saves.field.key), display: 'signed' },
      { ...createBlock('pairs', nextId, skills.field.key), display: 'signed' },
    ],
    fields: newFields([saves, skills]),
  };
}

function sensesAndLanguages(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const senses = field('Senses', 'text', 'stat', { meaning: 'senses' });
  const languages = field('Languages', 'text', 'stat');
  return {
    blocks: [createBlock('stat', nextId, senses.field.key), createBlock('stat', nextId, languages.field.key)],
    fields: newFields([senses, languages]),
  };
}

function defenses(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const saves = field('Saving throws', 'pairs', 'pairs');
  const resistances = field('Damage resistances', 'text', 'stat');
  const immunities = field('Damage immunities', 'text', 'stat');
  const section = createBlock('section', nextId);
  const blocks = [
    { ...createBlock('pairs', nextId, saves.field.key), display: 'signed' as const },
    createBlock('stat', nextId, resistances.field.key),
    createBlock('stat', nextId, immunities.field.key),
  ];
  return { blocks: [{ ...section, heading: 'Defenses', blocks }], fields: newFields([saves, resistances, immunities]) };
}

export const COMMON_RECIPES: readonly BlockRecipe[] = [
  { id: 'name-line', label: 'Name and type line', example: 'Aboleth · Large aberration, lawful evil', group: 'common', icon: 'heading', create: nameLine },
  { id: 'stat-strip', label: 'Armor, hit points and speed', example: 'Three stats side by side', group: 'common', icon: 'rows-3', keywords: ['ac', 'hp', 'stat strip'], create: statStrip },
  { id: 'ability-scores', label: 'Ability scores', example: 'STR DEX CON with modifiers', group: 'common', icon: 'table-2', keywords: ['stats', 'attributes'], create: abilityScores },
  { id: 'actions', label: 'Actions', example: 'Multiattack. The creature makes two attacks.', group: 'common', icon: 'swords', keywords: ['attacks'], create: abilities('Actions', 'Add action') },
  { id: 'traits', label: 'Traits', example: 'Keen Senses. It notices what moves nearby.', group: 'common', icon: 'scroll-text', keywords: ['features', 'abilities'], create: abilities('Traits', 'Add trait') },
  { id: 'spellcasting', label: 'Spellcasting', example: 'Spells by level', group: 'common', icon: 'sparkles', keywords: ['spells', 'magic', 'casting'], create: spellcasting },
  { id: 'saves-skills', label: 'Saving throws and skills', example: 'Saving Throws Dex +2, Wis +3', group: 'common', icon: 'list-checks', create: savesAndSkills },
  { id: 'senses-languages', label: 'Senses and languages', example: 'Darkvision 60 ft. · Common', group: 'common', icon: 'eye', create: sensesAndLanguages },
  { id: 'defenses', label: 'Defenses', example: 'A section: saves, resistances, immunities', group: 'common', icon: 'shield', create: defenses },
];
