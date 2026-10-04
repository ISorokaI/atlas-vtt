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
  it('lists the recipes under Common, then the catalogue by group', () => {
    const groups = groupItems(insertItems());
    expect(groups.map((group) => group.label)).toEqual(['Common', 'Basics', 'Lists', 'Numbers', 'Layout', 'Media']);
    expect(groups[0]?.items.map((item) => item.label)).toEqual(['Stat strip', 'Ability scores', 'Actions', 'Defenses']);
    expect(groups.flatMap((group) => group.items).some((item) => item.kind === 'block' && (item.type as string) === 'script')).toBe(false);
  });

  it('finds items by every word typed', () => {
    expect(findItems(insertItems(), 'ab sc').map((item) => item.label)).toEqual(['Ability scores']);
    expect(findItems(insertItems(), 'zzz')).toEqual([]);
  });

  it('starts the keys on the item named exactly what was typed, else on one whose name starts with it', () => {
    const found = (query: string): string[] => findItems(insertItems(), query).map((item) => item.label);
    expect(found('stat').slice(0, 2)).toEqual(['Stat strip', 'Stat']);
    expect(found('stat')[bestMatch(findItems(insertItems(), 'stat'), 'stat')]).toBe('Stat');
    expect(found('ab')[bestMatch(findItems(insertItems(), 'ab'), 'ab')]).toBe('Ability scores');
    expect(bestMatch(findItems(insertItems(), 'core'), 'core')).toBe(0);
    expect(bestMatch(insertItems(), '')).toBe(0);
  });

  it('inserts the exact match on Enter in the insert menu, not the recipe listed above it', () => {
    const onInsert = vi.fn();
    const layer = document.body.createDiv();
    // jsdom draws nothing, so it has no scrolling into view.
    Element.prototype.scrollIntoView = vi.fn();
    render(<InsertMenu layer={layer} anchor={{ left: 0, top: 0, right: 10, bottom: 10 }} onInsert={onInsert} onClose={vi.fn()} />);
    const search = screen.getByRole('combobox');
    fireEvent.change(search, { target: { value: 'stat' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'block', type: 'stat' }));
    layer.remove();
  });

  it('previews each item with a template of its own', () => {
    for (const item of insertItems()) {
      const preview = previewTemplate(item);
      expect(preview.layout.blocks.length, item.label).toBeGreaterThan(0);
    }
    expect(previewTemplate({ kind: 'block', type: 'stat', label: 'Stat', group: 'basics' }).fields).toEqual([{ key: 'stat', label: 'Stat', type: 'number' }]);
  });

  it('turns blocks only into blocks of their kind', () => {
    expect(turnIntoTypes('row')).toEqual(['section']);
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
