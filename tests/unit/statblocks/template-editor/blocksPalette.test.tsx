import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

const row = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('.atlas-te-palette__row')].find((element) => element.querySelector('.atlas-te-palette__row-name')?.textContent === name);
  if (!found) throw new Error(`no row ${name}`);
  return found;
};
const names = (group: HTMLElement): string[] => [...group.querySelectorAll('.atlas-te-palette__row-name')].map((name) => name.textContent ?? '');

/** The Add panel (spec §10.7, §12.3). */
describe('the Add panel', () => {
  it('lists the parts of a statblock by book part, then the blocks by group, each in plain words with what it makes', () => {
    mountEditor(undefined, { dock: 'Add' });
    const pane = document.querySelector<HTMLElement>('.atlas-te-dock-panel')!;
    expect([...pane.querySelectorAll('.atlas-te-palette__group-label')].map((label) => label.textContent))
      .toEqual(['Common parts', 'Tracks', 'Dense lines', 'Tags and costs', 'Text and stats', 'Lists', 'Numbers', 'Layout', 'Pictures']);
    const common = within(pane).getByRole('group', { name: 'Common parts' });
    expect(names(common).slice(0, 4)).toEqual(['Name and type line', 'Armor, hit points and speed', 'Ability scores', 'Actions']);
    expect(names(within(pane).getByRole('group', { name: 'Tracks' }))).toEqual(['Hit point boxes', 'Stress boxes', 'Clock', 'Damage thresholds']);
    expect(row('Stat').querySelector('.atlas-te-palette__row-example')?.textContent).toBe('Armor Class 17');
    for (const banned of ['Stat strip', 'Entries', 'Pairs', 'Title', 'Line', 'Row']) expect(pane.textContent).not.toContain(banned);
  });

  it('previews the row under the pointer beside the panel, drawn by the card\'s renderer, out of reach of the pointer', () => {
    mountEditor(undefined, { dock: 'Add' });
    fireEvent.pointerEnter(row('Ability scores'));
    const preview = document.querySelector('.atlas-te-palette__preview')!;
    expect(preview.querySelector('.atlas-statblock')).not.toBeNull();
    expect(preview.querySelector('.atlas-te-item-preview')?.hasAttribute('inert')).toBe(true);
  });

  it('inserts a clicked block after the selection, in one step, and selects it without opening its label', () => {
    const { session, frame } = mountEditor(undefined, { dock: 'Add' });
    fireEvent.click(frame('stat-ac1'));
    fireEvent.click(row('Stat'));
    const section = findBlock(session.template.layout.blocks, 'section1')?.block;
    expect(section && 'blocks' in section ? section.blocks.map((block) => block.type) : []).toEqual(['stat', 'stat', 'stat']);
    expect(section && 'blocks' in section ? section.blocks[0]?.id : '').toBe('stat-ac1');
    expect(session.steps).toBe(1);
    // Inserting never opens the label (spec §6.1): Delete right after it deletes the block.
    expect(document.querySelector('.atlas-te-label-input')).toBeNull();
    expect(document.querySelector('[data-te-selected="primary"]')?.getAttribute('data-block-id')).toBe(section && 'blocks' in section ? section.blocks[1]?.id : '');
  });

  it('inserts a recipe at the end without a selection', () => {
    const { session } = mountEditor(undefined, { dock: 'Add' });
    fireEvent.click(row('Actions'));
    expect(session.template.layout.blocks.at(-1)).toMatchObject({ type: 'entries', heading: 'Actions' });
    expect(session.template.fields.at(-1)).toMatchObject({ key: 'actions', type: 'entries' });
    expect(session.steps).toBe(1);
  });

  it('finds by name, line and other words ("spell" finds Spellcasting), and inserts the highlighted one with Enter', () => {
    const { session } = mountEditor(undefined, { dock: 'Add' });
    const search = screen.getByRole('combobox', { name: 'Find a block or part' });
    fireEvent.change(search, { target: { value: 'spell' } });
    const list = screen.getByRole('listbox', { name: 'Blocks and parts' });
    expect(list.hasAttribute('data-atlas-standing-list')).toBe(true);
    expect(names(list)).toEqual(['Spellcasting', 'Spells']);
    key(search, 'ArrowDown');
    expect(search.getAttribute('aria-activedescendant')).toContain('block:spells');
    key(search, 'Enter');
    expect(session.template.layout.blocks.at(-1)?.type).toBe('spells');
    expect((search as HTMLInputElement).value).toBe('');
  });

  it('offers a stat of the name typed when nothing matches', () => {
    const { session } = mountEditor(undefined, { dock: 'Add' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Find a block or part' }), { target: { value: 'mana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make a stat called “mana”' }));
    expect(session.template.fields.at(-1)).toEqual({ key: 'mana', label: 'mana', type: 'text' });
    expect(session.template.layout.blocks.at(-1)).toMatchObject({ type: 'stat', field: 'mana' });
  });

  it('clears the search with Escape, and an empty search\'s Escape puts the panel away', async () => {
    mountEditor(undefined, { dock: 'Add' });
    const search = screen.getByRole<HTMLInputElement>('combobox', { name: 'Find a block or part' });
    fireEvent.change(search, { target: { value: 'zzz' } });
    const clearing = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => { search.dispatchEvent(clearing); });
    expect(clearing.defaultPrevented).toBe(true);
    expect(search.value).toBe('');
    const closing = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => { search.dispatchEvent(closing); });
    expect(closing.defaultPrevented).toBe(true);
    await waitFor(() => expect(document.querySelector('.atlas-te-dock-panel')).toBeNull());
  });

  it('is one tab stop whose arrows move between the rows', () => {
    mountEditor(undefined, { dock: 'Add' });
    const rows = [...document.querySelectorAll<HTMLElement>('.atlas-te-palette__row')];
    expect(rows.filter((element) => element.tabIndex === 0)).toEqual([rows[0]]);
    act(() => rows[0]?.focus());
    key(rows[0]!, 'ArrowDown');
    expect(document.activeElement).toBe(rows[1]);
    key(rows[1]!, 'ArrowUp');
    expect(document.activeElement).toBe(rows[0]);
  });
});
