import { describe, expect, it } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { chooseCollection, linkingCollectionIds, roleNameFor } from '../../../../src/app/statblocks/editor/collectionContext';
import { BESIDE_ATTRIBUTE, PAIR_ATTRIBUTE, PairPropertiesMark, isLeafMarked, markPairedLeaf } from '../../../../src/app/statblocks/editor/pairProperties';
import { newPairId, readPaneState } from '../../../../src/app/statblocks/editor/paneState';
import { choiceOptions } from '../../../../src/app/statblocks/editor/statblock-pane/ChoiceValueInput';
import { singular } from '../../../../src/app/statblocks/editor/statblock-pane/EntriesEditor';
import { keysOutsideTemplate, templateGroups, unshownKeys } from '../../../../src/app/statblocks/editor/statblock-pane/templateChoices';
import { builtInEntry } from '../../../../src/app/statblocks/library/templateFiles';
import { GENERIC_CREATURE, GENERIC_NPC, GENERIC_HAZARD } from '../../../../src/app/statblocks/presets/generic';
import { FakeLeaf } from './workspaceKit';

const leaf = (): WorkspaceLeaf => new FakeLeaf() as unknown as WorkspaceLeaf;

describe('the pair attribute', () => {
  it('is set while Properties hide and removed only for its own pair', () => {
    const note = leaf();
    markPairedLeaf(note, 'pair-a', true);
    expect(note.containerEl.getAttribute(PAIR_ATTRIBUTE)).toBe('pair-a');
    markPairedLeaf(note, 'pair-b', false);
    expect(isLeafMarked(note, 'pair-a')).toBe(true);
    markPairedLeaf(note, 'pair-a', false);
    expect(note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);
  });

  it('follows the partner: the old one loses the mark, and release shows Properties again', () => {
    const first = leaf();
    const second = leaf();
    const mark = new PairPropertiesMark('pair-a');
    const both = { hideProperties: true, shownBeside: true };
    mark.update(first, both);
    mark.update(second, both);
    expect(isLeafMarked(first, 'pair-a')).toBe(false);
    expect(first.containerEl.hasAttribute(BESIDE_ATTRIBUTE)).toBe(false);
    expect(isLeafMarked(second, 'pair-a')).toBe(true);
    mark.update(second, { hideProperties: false, shownBeside: false });
    expect(isLeafMarked(second, 'pair-a')).toBe(false);
    mark.update(first, both);
    mark.release();
    expect(isLeafMarked(first, 'pair-a')).toBe(false);
    expect(first.containerEl.hasAttribute(BESIDE_ATTRIBUTE)).toBe(false);
  });

  it('shrinks the note\'s fence beside any statblock the pane draws, and hides Properties only where asked', () => {
    const note = leaf();
    const mark = new PairPropertiesMark('pair-a');
    mark.update(note, { hideProperties: false, shownBeside: true });
    expect(note.containerEl.getAttribute(BESIDE_ATTRIBUTE)).toBe('pair-a');
    expect(note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);
    mark.update(note, { hideProperties: true, shownBeside: true });
    expect(note.containerEl.getAttribute(PAIR_ATTRIBUTE)).toBe('pair-a');
    mark.update(note, { hideProperties: false, shownBeside: true });
    expect(note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);
    expect(note.containerEl.getAttribute(BESIDE_ATTRIBUTE)).toBe('pair-a');
  });
});

describe('the pane state', () => {
  it('restores what it saved and refuses a state without a note or pair', () => {
    expect(readPaneState({ notePath: 'a.md', pairId: 'p', collectionId: 'c', previewPath: 'b.md' }))
      .toEqual({ notePath: 'a.md', pairId: 'p', collectionId: 'c', previewPath: 'b.md' });
    expect(readPaneState({ notePath: 'a.md', pairId: 'p', collectionId: 4 })).toEqual({ notePath: 'a.md', pairId: 'p', collectionId: null });
    expect(readPaneState({ notePath: 'a.md' })).toBeNull();
    expect(readPaneState(null)).toBeNull();
  });

  it('makes pair ids of its own that never repeat', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newPairId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^atlas-pair-[0-9a-z]+-[0-9a-z]{6}$/);
  });
});

describe('the collection context', () => {
  const tokens = [
    { collection: 'a', statblockPath: 'Warden.md' },
    { collection: 'b', statblockPath: 'Hag.md' },
    { collection: 'a', statblockPath: 'Warden.md' },
  ];

  it('takes the entry point\'s collection, else the only one linking the note, else the default', () => {
    const known = new Set(['a', 'b', 'c']);
    expect(chooseCollection('b', known, ['a'], 'c')).toBe('b');
    expect(chooseCollection(null, known, linkingCollectionIds(tokens, 'Warden.md'), 'c')).toBe('a');
    expect(chooseCollection(null, known, ['a', 'b'], 'c')).toBe('c');
    expect(chooseCollection('gone', known, [], 'c')).toBe('c');
  });

  it('names a role only when exactly one role uses the template', () => {
    const roles = [
      { id: 'monster', name: 'Monster', templateId: 't1' },
      { id: 'boss', name: 'Boss', templateId: 't1' },
      { id: 'npc', name: 'NPC', templateId: 't2' },
    ];
    expect(roleNameFor(roles, 't2')).toBe('NPC');
    expect(roleNameFor(roles, 't1')).toBeNull();
    expect(roleNameFor(roles, 't3')).toBeNull();
  });
});

describe('Change template', () => {
  const library = [GENERIC_CREATURE, GENERIC_NPC, GENERIC_HAZARD].map(builtInEntry);

  it('lists the collection\'s templates first, named with their roles', () => {
    const groups = templateGroups(library, [{ id: 'npc', name: 'NPC', templateId: 'builtin:generic-npc' }]);
    expect(groups.map((group) => group.heading)).toEqual(['Used by this collection', 'All templates']);
    expect(groups[0]!.items.map((item) => [item.entry.name, item.detail])).toEqual([['NPC', 'NPC']]);
    expect(groups[1]!.items.map((item) => item.entry.name)).toEqual(['Creature', 'Hazard']);
  });

  it('says which of the note\'s values a template leaves out, never markers or Obsidian\'s own', () => {
    const record = { statblock: true, 'atlas-template': 'x', name: 'Warden', hp: 9, lair: 'Bog', tags: ['m'], wants: 'Quiet' };
    expect(unshownKeys(record, GENERIC_CREATURE.template)).toEqual(['lair', 'wants']);
    expect(keysOutsideTemplate(record, GENERIC_NPC.template)).toEqual(['lair']);
  });
});

describe('choice options', () => {
  const size = { options: ['Tiny', 'Small', 'Large'], open: true };

  it('filters by what was typed and offers the typed text where any is allowed', () => {
    expect(choiceOptions(size, 'l').map((option) => option.label)).toEqual(['Small', 'Large', 'Use “l”']);
    expect(choiceOptions(size, 'large').map((option) => option.value)).toEqual(['Large']);
    expect(choiceOptions({ ...size, open: false }, 'Swamp').map((option) => option.label)).toEqual([]);
  });
});

describe('entry nouns', () => {
  it('names one entry of a field', () => {
    expect(['Actions', 'Abilities', 'Villain Actions', 'Lair', 'Status'].map(singular)).toEqual(['Action', 'Ability', 'Villain Action', 'Lair', 'Status']);
  });
});
