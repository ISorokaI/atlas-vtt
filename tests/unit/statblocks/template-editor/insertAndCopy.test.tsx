import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { builtInLine, switchChipText } from '../../../../src/app/statblocks/editor/template-editor/shell/builtInLine';
import { SwitchStatblocksChip } from '../../../../src/app/statblocks/editor/template-editor/shell/SwitchStatblocksChip';
import { switchTemplates } from '../../../../src/app/statblocks/notes/templateSwitch';
import { bestMatch, findItems, groupItems, insertItems, previewTemplate } from '../../../../src/app/statblocks/editor/template-editor/insertItems';
import { InsertMenu } from '../../../../src/app/statblocks/editor/template-editor/InsertMenu';
import { handleTemplateKey, type KeyboardTarget } from '../../../../src/app/statblocks/editor/template-editor/useTemplateKeyboard';
import { turnIntoTypes } from '../../../../src/app/statblocks/editor/template-editor/menus/blockMenu';
import { FakeSession, sampleTemplate } from './editorKit';

vi.mock('../../../../src/app/statblocks/notes/templateSwitch', () => ({ switchTemplates: vi.fn(async () => undefined) }));

afterEach(cleanup);

describe('the insert menu\'s items', () => {
  it('lists the parts of a statblock by book part, then the catalogue by group, in plain words', () => {
    const groups = groupItems(insertItems());
    expect(groups.map((group) => group.label)).toEqual([
      'Common parts', 'Tracks', 'Dense lines', 'Tags and costs', 'Text and stats', 'Lists', 'Numbers', 'Layout', 'Pictures',
    ]);
    expect(groups[0]?.items.map((item) => item.label)).toContain('Spellcasting');
    expect(groups.flatMap((group) => group.items).some((item) => item.kind === 'block' && (item.type as string) === 'script')).toBe(false);
    for (const item of insertItems()) expect(item.example, item.label).not.toBe('');
  });

  it('finds items by every word typed, in their name, their line or other words', () => {
    expect(findItems(insertItems(), 'ab sc').map((item) => item.label)).toEqual(['Ability scores', 'Score table']);
    expect(findItems(insertItems(), 'magic').map((item) => item.label)).toEqual(['Spellcasting', 'Spells']);
    expect(findItems(insertItems(), 'zzz')).toEqual([]);
  });

  it('starts the keys on the item named exactly what was typed, else on one whose name starts with it', () => {
    const items = findItems(insertItems(), 'stat');
    expect(items[bestMatch(items, 'stat')]?.label).toBe('Stat');
    const spell = findItems(insertItems(), 'spell');
    expect(spell[bestMatch(spell, 'spell')]?.label).toBe('Spellcasting');
  });

  it('turns blocks only into blocks of their kind', () => {
    expect(turnIntoTypes('row')).toEqual(['section', 'tabs']);
    expect(turnIntoTypes('stat')).not.toContain('row');
    expect(turnIntoTypes('stat')).toContain('track');
  });
});

describe('a built-in and its copy in the footer (spec §9.1, §9.3)', () => {
  it('says where the first change goes before it is made', () => {
    expect(builtInLine({ builtInName: '5E (2014 rules)', copy: null, fromNote: null })).toBe('Built in. Your first change makes your own copy.');
    expect(builtInLine({ builtInName: '5E (2014 rules)', copy: null, fromNote: 'Aboleth' })).toBe('Built in. Your first change makes your own copy for Aboleth.');
    expect(builtInLine({ builtInName: '5E (2014 rules)', copy: { name: '5E (2014 rules) copy', usage: 3 }, fromNote: 'Aboleth' }))
      .toBe('Built in. Your changes go to your copy of 5E (2014 rules) · 3 statblocks.');
  });

  it('switches the statblocks still on the built-in only after naming them and being asked', async () => {
    expect(switchChipText('5E (2014 rules)', 11)).toBe('11 more on 5E (2014 rules) · Switch…');
    render(<SwitchStatblocksChip app={{} as App} from="builtin:x" to="copy-abc123" builtInName="X" notes={['A.md', 'B.md']} />);
    fireEvent.click(screen.getByRole('button', { name: '2 more on X · Switch…' }));
    expect(screen.getByRole('dialog').textContent).toContain('AB');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(switchTemplates).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '2 more on X · Switch…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch them' }));
    expect(switchTemplates).toHaveBeenCalledWith({}, [{ path: 'A.md', from: 'builtin:x' }, { path: 'B.md', from: 'builtin:x' }], 'copy-abc123');
  });
});

describe('the keys from the view\'s scope', () => {
  function target(session: FakeSession, root: HTMLElement): KeyboardTarget {
    return {
      rootRef: { current: root }, session, selection: [], drawn: () => true, select: vi.fn(), settle: vi.fn(),
      editLabel: vi.fn(), openInsert: vi.fn(), openMenu: vi.fn(), clipOwner: {},
    };
  }

  it('undoes from the scope where focus left the editor\'s elements, and never inside an input', () => {
    const session = new FakeSession(sampleTemplate());
    session.apply((source) => ({ ...source, description: 'changed' }));
    const root = document.body.createDiv();
    const undo = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(handleTemplateKey(target(session, root), undo, false)).toBe(false);
    expect(handleTemplateKey(target(session, root), undo, false, true)).toBe(true);
    expect(session.getSnapshot().canUndo).toBe(false);

    const input = root.createEl('input', { type: 'text' });
    input.focus();
    expect(handleTemplateKey(target(session, root), new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }), false, true)).toBe(false);
    root.remove();
  });
});
