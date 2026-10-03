import { describe, expect, it } from 'vitest';
import {
  choiceProblem, collectionFieldChoices, fieldAddition, matchingChoices, newFieldChoices, noteFieldChoices, noteKeyChoice,
} from '../../../../src/app/statblocks/editor/statblock-pane/fieldChoices';
import { findBlock } from '../../../../src/app/statblocks/model/treeQueries';
import { MARSH_CREATURE } from '../../../fixtures/statblockTemplateFixtures';

const RECORD = {
  statblock: true,
  'atlas-template': MARSH_CREATURE.id,
  name: 'Marsh Warden',
  hp: 52,
  lair: 'A sunken causeway',
  reactions: [{ name: 'Parry', desc: 'It parries.' }],
  tags: ['marsh'],
  'odd key': 'kept out',
};

describe('the choices of Add a field…', () => {
  it('offers the note\'s keys the template leaves out, shaped by their values', () => {
    const choices = noteFieldChoices(RECORD, MARSH_CREATURE);
    expect(choices.map(({ key, label, type }) => ({ key, label, type }))).toEqual([
      { key: 'lair', label: 'Lair', type: 'text' },
      { key: 'reactions', label: 'Reactions', type: 'entries' },
    ]);
  });

  it('offers the collection\'s keys the note and template lack, the most used first', () => {
    const counts = new Map([['legendary', 2], ['speed', 9], ['lair', 4], ['mythic', 5]]);
    expect(collectionFieldChoices(counts, MARSH_CREATURE, RECORD).map((choice) => [choice.key, choice.detail]))
      .toEqual([['mythic', '5 statblocks'], ['legendary', '2 statblocks']]);
  });

  it('offers a new field of each kind once a name is typed', () => {
    expect(newFieldChoices('  ')).toEqual([]);
    expect(newFieldChoices('Lair actions').map((choice) => [choice.label, choice.type, choice.detail])).toEqual([
      ['Lair actions', 'text', 'Text'],
      ['Lair actions', 'number', 'Number'],
      ['Lair actions', 'markdown', 'Paragraphs'],
      ['Lair actions', 'list', 'List'],
      ['Lair actions', 'entries', 'Entries'],
    ]);
  });

  it('finds choices by every word typed, in label or key', () => {
    const choices = noteFieldChoices(RECORD, MARSH_CREATURE);
    expect(matchingChoices(choices, 'LAI').map((choice) => choice.key)).toEqual(['lair']);
    expect(matchingChoices(choices, 'rea ions').map((choice) => choice.key)).toEqual(['reactions']);
  });
});

describe('fieldAddition', () => {
  it('adds the field and the block the auto template gives it at the end of the template', () => {
    const added = fieldAddition(MARSH_CREATURE, noteKeyChoice('reactions', RECORD))!;
    expect(added.key).toBe('reactions');
    expect(added.template.fields.at(-1)).toEqual({ key: 'reactions', label: 'Reactions', type: 'entries' });
    const blocks = added.template.layout.blocks;
    expect(blocks.at(-1)).toMatchObject({ id: added.blockId, type: 'entries', field: 'reactions', heading: 'Reactions' });
    expect(blocks.slice(0, -1)).toEqual(MARSH_CREATURE.layout.blocks);
    expect(findBlock(blocks, added.blockId)?.parentId).toBeNull();
  });

  it('derives a new field\'s key from its label, past the keys the template holds', () => {
    const [text] = newFieldChoices('Hit Points');
    const added = fieldAddition(MARSH_CREATURE, text!)!;
    expect(added.key).toBe('hp_2');
    expect(added.template.layout.blocks.at(-1)).toMatchObject({ type: 'stat', field: 'hp_2' });
  });

  it('refuses a key the template already reads', () => {
    const choice = noteKeyChoice('hp', RECORD);
    expect(choiceProblem(choice, MARSH_CREATURE)).toBe('Another field already uses “hp”.');
    expect(fieldAddition(MARSH_CREATURE, choice)).toBeNull();
  });
});
