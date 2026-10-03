import '../setup/obsidianDom';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TemplateLibrary } from '../../src/app/statblocks/library/TemplateLibrary';
import { blockOf, renderPane } from '../unit/statblocks/editor/paneKit';
import { pointer, pointIn } from './dragHarness';
import { frames, useEditorStyles, wait } from './sidePanesHarness';

// Dice links and the template editor's file actions reach the map view and the token link service, whose
// Node `events` has no browser build; nothing here rolls dice or writes files.
vi.mock('../../src/app/services/statblockDiceLinks', () => ({
  attachDiceRolling: () => () => undefined,
  diceLinkProps: () => ({}),
  linkDiceIn: () => undefined,
  splitDiceSegments: (text: string) => [{ text, dice: false }],
}));
vi.mock('../../src/app/statblocks/render/shared/useStatblockDiceRolling', () => ({ useStatblockDiceRolling: () => undefined }));
vi.mock('../../src/app/statblocks/editor/template-editor/templateEditorActions', () => ({
  duplicateTemplate: async () => null,
  newStatblockFromTemplate: async () => undefined,
}));
vi.mock('../../src/app/services/AssetService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/services/AssetService')>();
  const assets = {
    getCollections: async () => [{ id: 'campaign', name: 'Campaign' }],
    getAssets: async () => [],
    getDefaultCollectionId: () => 'campaign',
    getCollectionSettings: () => ({ conditions: [] }),
  };
  return { ...actual, AssetService: { getInstance: () => assets } };
});

const ACTIONS = [{ name: 'Bite', desc: 'It bites.' }, { name: 'Lash', desc: 'It lashes.' }, { name: 'Roar', desc: 'It roars.' }];
const WARDEN = { statblock: true, 'atlas-template': 'builtin:generic-creature', name: 'Marsh Warden', hp: 14, actions: ACTIONS };

const apps: App[] = [];
afterEach(() => {
  cleanup();
  for (const app of apps.splice(0)) TemplateLibrary.release(app);
});

/** The statblock pane's entries reordered by their handles (§7.6): rows slide by transform only, the drop is one move patch. */
describe('dragging entries in the statblock pane', () => {
  useEditorStyles();

  it('moves an entry to where it is dropped with one move patch, the rows between sliding aside', async () => {
    const harness = await renderPane({ frontmatter: WARDEN });
    apps.push(harness.app);
    const { result, writer } = harness;
    fireEvent.click(blockOf(result.container, 'gcaction').querySelectorAll('.atlas-sb-trait')[0]!);
    await frames(2);
    const handles = [...result.container.querySelectorAll<HTMLElement>('.atlas-sb-pane-entry__handle')];
    const slots = [...result.container.querySelectorAll<HTMLElement>('.atlas-sb-pane-entry-slot')];
    expect(handles).toHaveLength(3);

    const from = pointIn(handles[0]!);
    const last = slots[2]!.getBoundingClientRect();
    pointer(window, 'pointerdown', from);
    pointer(window, 'pointermove', { x: from.x, y: from.y + 6 });
    await frames(1);
    for (let step = 1; step <= 6; step++) {
      pointer(window, 'pointermove', { x: from.x, y: from.y + ((last.bottom - 4 - from.y) * step) / 6 });
      await frames(1);
    }
    await wait(250);
    expect(slots[0]!.hasAttribute('data-dragging')).toBe(true);
    for (const slot of slots.slice(1)) {
      expect(getComputedStyle(slot).transform).not.toBe('none');
      expect(slot.getAnimations().every((animation) => animation instanceof CSSTransition)).toBe(true);
    }

    await act(async () => {
      pointer(window, 'pointerup', { x: from.x, y: last.bottom - 4 });
      await frames(2);
    });
    expect(writer.writes.at(-1)?.patches).toEqual([{ op: 'move', list: 'actions', item: ACTIONS[0], after: ACTIONS[2] }]);
    expect(result.container.querySelector('.atlas-sb-pane-live')?.textContent).toBe('Moved Bite to position 3 of 3.');
  });
});
