import '../setup/obsidianDom';
import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { FakeSession, sampleTemplate } from '../unit/statblocks/template-editor/editorKit';
import { frames, mount, useEditorStyles, walk } from './sidePanesHarness';

// Dice links and the header's file actions reach the map view and the token link service, whose
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

/**
 * The keys of the template editor's side panes in a real browser (§7.7): Tab
 * passes through every tab of the left pane and the inspector, both ways, with
 * no trap, and the outline keeps focus while its keys move and delete blocks.
 */
describe('the template editor\'s side panes by keyboard', () => {
  useEditorStyles();
  afterEach(cleanup);

  it('lets Tab pass through the left pane and the inspector both ways, in every tab of the pane', async () => {
    mount(new FakeSession(sampleTemplate()), 1180);
    for (const tab of ['Blocks', 'Outline', 'Fields']) {
      const option = [...document.querySelectorAll<HTMLButtonElement>('.atlas-segmented__option')].find((element) => element.textContent === tab)!;
      await act(async () => { option.click(); });
      page.getByRole('button', { name: 'Before' }).element().focus();
      expect(await walk('After', false), tab).toEqual(['header', 'left', 'preview', 'canvas', 'inspector', 'After']);
      expect(await walk('Before', true), tab).toEqual(['inspector', 'canvas', 'preview', 'left', 'header', 'Before']);
    }
  });

  it('keeps focus in the outline while its keys move and delete blocks', async () => {
    const session = new FakeSession(sampleTemplate());
    mount(session, 1180);
    const outline = [...document.querySelectorAll<HTMLButtonElement>('.atlas-segmented__option')].find((element) => element.textContent === 'Outline')!;
    await act(async () => { outline.click(); });
    const row = (id: string): HTMLElement => document.querySelector<HTMLElement>(`[data-outline-id="${id}"]`)!;
    await userEvent.click(row('stat-ac1'));
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await frames(2);
    expect(session.template.layout.blocks[1]).toMatchObject({ blocks: [{ id: 'stat-hp1' }, { id: 'stat-ac1' }] });
    expect(document.activeElement).toBe(row('stat-ac1'));
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(row('stat-hp1'));
    await userEvent.keyboard('{Delete}');
    await frames(2);
    expect(document.activeElement).toBe(row('stat-ac1'));
    expect(row('stat-ac1').getAttribute('aria-selected')).toBe('true');
  });
});
