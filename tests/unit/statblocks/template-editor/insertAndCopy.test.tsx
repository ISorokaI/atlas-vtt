import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopySwitchBar } from '../../../../src/app/statblocks/editor/template-editor/BuiltInBar';
import { copySwitchQuestion, type CopySwitch } from '../../../../src/app/statblocks/editor/template-editor/copySwitch';
import { findItems, groupItems, insertItems, previewTemplate } from '../../../../src/app/statblocks/editor/template-editor/insertItems';
import { handleTemplateKey, type KeyboardTarget } from '../../../../src/app/statblocks/editor/template-editor/useTemplateKeyboard';
import { turnIntoTypes } from '../../../../src/app/statblocks/editor/template-editor/toolbarMenu';
import { FakeSession, sampleTemplate } from './editorKit';

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

describe('the question after a copy', () => {
  const question = (change: Partial<CopySwitch> = {}): CopySwitch => ({
    from: 'builtin:x', to: 'copy-abc123', notes: ['A.md', 'B.md'], roleNames: ['Monster'], collectionId: 'marsh', collectionName: 'Marsh campaign', ...change,
  });

  it('names the statblocks and the roles of the collection', () => {
    expect(copySwitchQuestion(question())).toBe('Use the copy for the 2 statblocks and the role Monster of Marsh campaign?');
    expect(copySwitchQuestion(question({ notes: ['A.md'], roleNames: [] }))).toBe('Use the copy for the statblock?');
    expect(copySwitchQuestion(question({ notes: [], roleNames: ['Monster', 'NPC', 'Boss'] }))).toBe('Use the copy for the roles Monster, NPC and Boss of Marsh campaign?');
    expect(copySwitchQuestion(question({ notes: [], roleNames: [] }))).toBeNull();
  });

  it('lists the statblocks before switching, and answers Switch or Keep', async () => {
    const onSwitch = vi.fn(async () => undefined);
    const onKeep = vi.fn();
    render(<CopySwitchBar question={question()} onSwitch={onSwitch} onKeep={onKeep} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show statblocks' }));
    expect(screen.getByRole('list', { name: 'Statblocks that would switch' }).textContent).toBe('AB');
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onKeep).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(onSwitch).toHaveBeenCalled();
    // While the batch runs, neither answer can be given again.
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Keep' }).disabled).toBe(true);
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
