/** Tracks, dense lines, and abilities with tags and costs (spec §12.3): the parts unusual systems need. */

import { createBlock } from '../blockCatalogue';
import type { BlockIdSource } from '../templateIds';
import type { TemplateField } from '../templateTypes';
import { fieldMaker, newFields, type BlockRecipe, type RecipeResult } from './recipeKit';

function track(label: string, look: 'boxes' | 'gauge', counts: 'down' | 'up', meaning?: TemplateField['meaning']) {
  return (nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult => {
    const found = fieldMaker(existing)(label, 'number', 'track', meaning ? { meaning } : {});
    return { blocks: [{ ...createBlock('track', nextId, found.field.key), look, counts }], fields: newFields([found]) };
  };
}

function thresholds(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const major = field('Major threshold', 'number', 'line');
  const severe = field('Severe threshold', 'number', 'line');
  const line = {
    ...createBlock('line', nextId), fields: [major.field.key, severe.field.key],
    pattern: `Thresholds {${major.field.key}} / {${severe.field.key}}`,
  };
  return { blocks: [line], fields: newFields([major, severe]) };
}

function oneLineStats(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const parts = [
    field('Armor class', 'number', 'line'), field('Hit points', 'number', 'line'), field('Attack', 'text', 'line'),
    field('Move', 'text', 'line'), field('Morale', 'number', 'line'),
  ];
  const [ac, hp, attack, move, morale] = parts.map((part) => part.field.key);
  const line = {
    ...createBlock('line', nextId), fields: parts.map((part) => part.field.key),
    pattern: `AC {${ac}}, HP {${hp}}[, ATK {${attack}}][, MV {${move}}][, ML {${morale}}]`,
  };
  return { blocks: [line], fields: newFields(parts) };
}

function attackLine(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const found = fieldMaker(existing)('Attack', 'text', 'stat');
  return { blocks: [createBlock('stat', nextId, found.field.key)], fields: newFields([found]) };
}

function moraleTreasure(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const field = fieldMaker(existing);
  const parts = [field('Morale', 'number', 'line'), field('Treasure', 'text', 'line')];
  const [morale, treasure] = parts.map((part) => part.field.key);
  return {
    blocks: [{ ...createBlock('line', nextId), fields: parts.map((part) => part.field.key), pattern: `Morale {${morale}}[ · Treasure {${treasure}}]` }],
    fields: newFields(parts),
  };
}

function traitTags(nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult {
  const found = fieldMaker(existing)('Traits', 'list', 'tags', { meaning: 'traits' });
  return { blocks: [{ ...createBlock('tags', nextId, found.field.key), look: 'chips' }], fields: newFields([found]) };
}

function withExtra(label: string, extra: { key: string; label: string; type: 'number' | 'text' }) {
  return (nextId: BlockIdSource, existing: readonly TemplateField[]): RecipeResult => {
    const found = fieldMaker(existing)(label, 'entries', 'entries', { entry: { extras: [extra] } });
    return { blocks: [{ ...createBlock('entries', nextId, found.field.key), heading: label }], fields: newFields([found]) };
  };
}

export const PART_RECIPES: readonly BlockRecipe[] = [
  { id: 'hp-boxes', label: 'Hit point boxes', example: 'Hit points ☐☐☐☐☐', group: 'tracks', icon: 'heart', keywords: ['hp', 'track'], create: track('Hit points', 'boxes', 'down', 'hit-points') },
  { id: 'stress-boxes', label: 'Stress boxes', example: 'Stress ☐☐☐ that fill up', group: 'tracks', icon: 'zap', keywords: ['track'], create: track('Stress', 'boxes', 'up') },
  { id: 'clock', label: 'Clock', example: 'A gauge that fills as time runs', group: 'tracks', icon: 'clock', keywords: ['countdown', 'track'], create: track('Clock', 'gauge', 'up') },
  { id: 'thresholds', label: 'Damage thresholds', example: 'Thresholds 7 / 14', group: 'tracks', icon: 'gauge', create: thresholds },
  { id: 'one-line-stats', label: 'One-line stats', example: 'AC 12, HP 9, ATK sword, MV 40, ML 8', group: 'dense', icon: 'align-justify', keywords: ['osr', 'compact'], create: oneLineStats },
  { id: 'attack-line', label: 'Attack line', example: 'Attack Claw (1d6)', group: 'dense', icon: 'sword', create: attackLine },
  { id: 'morale-treasure', label: 'Morale and treasure line', example: 'Morale 8 · Treasure 3d6 gp', group: 'dense', icon: 'coins', create: moraleTreasure },
  { id: 'trait-tags', label: 'Trait tags', example: 'Fire · Undead · Fey', group: 'tagged', icon: 'tags', keywords: ['keywords'], create: traitTags },
  { id: 'costed-abilities', label: 'Abilities with action cost', example: 'Strike (1 action). It attacks.', group: 'tagged', icon: 'list-ordered', create: withExtra('Actions', { key: 'cost', label: 'Cost', type: 'number' }) },
  { id: 'kinded-features', label: 'Features with kind', example: 'Relentless — Passive: it keeps going.', group: 'tagged', icon: 'list-tree', create: withExtra('Features', { key: 'kind', label: 'Kind', type: 'text' }) },
];
