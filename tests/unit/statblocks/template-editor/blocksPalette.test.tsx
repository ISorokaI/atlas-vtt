import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { findBlock } from '../../../../src/app/statblocks/model/treeQueries';
import { FakeSession, sampleTemplate } from './editorKit';
import { key, mountEditor } from './sidePanesKit';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  Element.prototype.scrollIntoView = vi.fn();
  Range.prototype.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 40, 16);
});
afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tile = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('.atlas-te-tile')].find((element) => element.querySelector('.atlas-te-tile__name')?.textContent === name);
  if (!found) throw new Error(`no tile ${name}`);
  return found;
};

describe('the Blocks tab', () => {
  it('lists the recipes, then the catalogue by group, as live miniatures', () => {
    mountEditor();
    const pane = document.querySelector<HTMLElement>('.atlas-te-pane')!;
    expect([...pane.querySelectorAll('.atlas-te-palette__group-label')].map((label) => label.textContent))
      .toEqual(['Common', 'Basics', 'Lists', 'Numbers', 'Layout', 'Media']);
    const common = within(pane).getByRole('group', { name: 'Common' });
    expect([...common.querySelectorAll('.atlas-te-tile__name')].map((name) => name.textContent)).toEqual(['Stat strip', 'Ability scores', 'Actions', 'Defenses']);
    // Each tile draws the real card, out of reach of focus and the pointer.
    const preview = tile('Ability scores').querySelector('.atlas-te-tile__preview')!;
    expect(preview.querySelector('.atlas-statblock')).not.toBeNull();
    expect(preview.hasAttribute('inert')).toBe(true);
  });

  it('inserts a clicked block after the selection, in one step, and opens its label', () => {
    const { session, frame } = mountEditor();
    fireEvent.click(frame('stat-ac1'));
    fireEvent.click(tile('Stat'));
    const section = findBlock(session.template.layout.blocks, 'section1')?.block;
    expect(section && 'blocks' in section ? section.blocks.map((block) => block.type) : []).toEqual(['stat', 'stat', 'stat']);
    expect(section && 'blocks' in section ? section.blocks[0]?.id : '').toBe('stat-ac1');
    expect(session.steps).toBe(1);
    expect(document.querySelector<HTMLInputElement>('.atlas-te-label-input')?.value).toBe('Stat');
  });

  it('inserts a recipe at the end without a selection', () => {
    const { session } = mountEditor();
    fireEvent.click(tile('Actions'));
    expect(session.template.layout.blocks.at(-1)).toMatchObject({ type: 'entries', heading: 'Actions' });
    expect(session.template.fields.at(-1)).toMatchObject({ key: 'actions', type: 'entries' });
    expect(session.steps).toBe(1);
  });

  it('finds blocks in a list that stands open, and inserts the highlighted one with Enter', () => {
    const { session } = mountEditor();
    const search = screen.getByRole('combobox', { name: 'Find a block' });
    fireEvent.change(search, { target: { value: 'sc' } });
    const results = screen.getByRole('listbox', { name: 'Blocks found' });
    expect(results.hasAttribute('data-atlas-standing-list')).toBe(true);
    expect(within(results).getAllByRole('option').map((option) => option.querySelector('.atlas-ctx-item__label')?.textContent)).toEqual(['Ability scores', 'Scores']);
    key(search, 'ArrowDown');
    expect(search.getAttribute('aria-activedescendant')).toContain('block:scores');
    key(search, 'Enter');
    expect(session.template.layout.blocks.at(-1)?.type).toBe('scores');
    expect((search as HTMLInputElement).value).toBe('');
  });

  it('clears the search with Escape and leaves an empty search\'s Escape alone', () => {
    mountEditor();
    const search = screen.getByRole<HTMLInputElement>('combobox', { name: 'Find a block' });
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No block matches')).toBeTruthy();
    const clearing = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => { search.dispatchEvent(clearing); });
    expect(clearing.defaultPrevented).toBe(true);
    expect(search.value).toBe('');
    const passing = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => { search.dispatchEvent(passing); });
    expect(passing.defaultPrevented).toBe(false);
  });

  it('is one tab stop whose arrows move between the tiles', () => {
    mountEditor();
    const tiles = [...document.querySelectorAll<HTMLElement>('.atlas-te-tile')];
    expect(tiles.filter((element) => element.tabIndex === 0)).toEqual([tiles[0]]);
    act(() => tiles[0]?.focus());
    key(tiles[0]!, 'ArrowRight');
    expect(document.activeElement).toBe(tiles[1]);
    key(tiles[1]!, 'ArrowDown');
    expect(document.activeElement).toBe(tiles[3]);
    key(tiles[3]!, 'End');
    expect(document.activeElement).toBe(tiles.at(-1));
    expect(tiles.at(-1)?.tabIndex).toBe(0);
  });

  it('says why a built-in takes no block', () => {
    const session = new FakeSession(sampleTemplate(), { readOnly: true, readOnlyReason: 'built-in', path: null });
    mountEditor(session);
    expect(tile('Stat').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(tile('Stat'));
    expect(session.steps).toBe(0);
    expect(document.querySelector('.atlas-te-live')?.textContent).toBe('Built-in template. Make a copy to change it.');
  });
});
