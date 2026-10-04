import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { parse, stringify } from 'yaml';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { cacheFrontmatter } from '../../../../src/app/statblocks/notes/frontmatterBounds';
import { applyFrontmatterPatches } from '../../../../src/app/statblocks/notes/frontmatterPatch';
import type { NotePatch } from '../../../../src/app/statblocks/notes/patchTypes';
import { blockOf, NOTE_PATH, renderPane, type PaneHarness } from './paneKit';

vi.mock('../../../../src/app/services/AssetService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/app/services/AssetService')>();
  const assets = {
    getCollections: async () => [{ id: 'campaign', name: 'Campaign' }],
    getAssets: async () => [],
    getDefaultCollectionId: () => 'campaign',
    getCollectionSettings: () => ({ conditions: [] }),
  };
  return { ...actual, AssetService: { getInstance: () => assets } };
});

const apps: App[] = [];
afterEach(() => {
  cleanup();
  for (const app of apps.splice(0)) TemplateLibrary.release(app);
});

const BITE = { name: 'Bite', desc: 'It bites.' };
const LASH = { name: 'Lash', desc: 'It lashes.' };
const WARDEN = {
  statblock: true,
  'atlas-template': 'builtin:generic-creature',
  name: 'Marsh Warden',
  hp: 14,
  lair: 'Sunken causeway',
  actions: [BITE, LASH],
};

/**
 * The note as text, patched as the real writer patches it: a patch applies only
 * where the note still holds its base. What is written reaches the pane only
 * when the test says so (`tell`), as the note's change arrives after the key
 * handler or the blur that wrote it.
 */
class NoteText {
  private text: string;

  constructor(private readonly harness: PaneHarness, frontmatter: Record<string, unknown>) {
    this.text = `---\n${stringify(frontmatter)}---\nBody\n`;
    harness.writer.answer = (patches) => ({ ...this.patch(patches), backend: 'editor', problem: null });
  }

  /** Another writer's change (Properties, sync), told to the pane at once. */
  external(patches: readonly NotePatch[]): void {
    expect(this.patch(patches).conflicts).toEqual([]);
    this.tell();
  }

  tell(): void {
    act(() => this.harness.source.set(NOTE_PATH, this.values()));
  }

  values(): Record<string, unknown> {
    return parse(cacheFrontmatter(this.text) ?? '') as Record<string, unknown>;
  }

  private patch(patches: readonly NotePatch[]): { applied: NotePatch[]; conflicts: NotePatch[] } {
    const result = applyFrontmatterPatches(this.text, patches);
    this.text = result.text;
    return { applied: result.applied, conflicts: result.conflicts };
  }
}

async function pane(): Promise<{ harness: PaneHarness; note: NoteText }> {
  const harness = await renderPane({ frontmatter: WARDEN });
  apps.push(harness.app);
  return { harness, note: new NoteText(harness, WARDEN) };
}

/** Opens the actions on their first entry; returns its focused name input. */
function openFirstAction(harness: PaneHarness): HTMLInputElement {
  fireEvent.click(blockOf(harness.result.container, 'gcaction').querySelectorAll('.atlas-sb-trait')[0]!);
  const name = document.activeElement as HTMLInputElement;
  expect(name.value).toBe('Bite');
  return name;
}

const rowOf = (element: Element | null): string | null => element?.closest('[data-entry-row]')?.getAttribute('data-entry-row') ?? null;

describe('entries moved or copied with the keyboard', () => {
  it('moves focus with the entry only once the note holds the move, and writes nothing into its neighbour', async () => {
    const { harness, note } = await pane();
    const name = openFirstAction(harness);
    await act(async () => { fireEvent.keyDown(name, { key: 'ArrowDown', altKey: true }); });
    // The row below still shows Lash: focus stays until the note holds the move.
    expect(document.activeElement).toBe(name);
    expect(rowOf(document.activeElement)).toBe('0');

    note.tell();
    const focused = document.activeElement as HTMLInputElement;
    expect(rowOf(focused)).toBe('1');
    expect(focused.value).toBe('Bite');
    await act(async () => { fireEvent.blur(focused); });

    expect(harness.writer.patches()).toEqual([{ op: 'move', list: 'actions', item: BITE, after: LASH }]);
    expect(note.values().actions).toEqual([LASH, BITE]);
  });

  it('focuses a duplicate once the note holds it, and leaves the next entry as it was', async () => {
    const { harness, note } = await pane();
    const name = openFirstAction(harness);
    await act(async () => { fireEvent.keyDown(name, { key: 'd', ctrlKey: true, metaKey: true }); });
    expect(rowOf(document.activeElement)).toBe('0');

    note.tell();
    const focused = document.activeElement as HTMLInputElement;
    expect(rowOf(focused)).toBe('1');
    expect(focused.value).toBe('Bite');
    await act(async () => { fireEvent.blur(focused); });

    expect(harness.writer.patches()).toEqual([{ op: 'insert', list: 'actions', after: BITE, item: BITE }]);
    expect(note.values().actions).toEqual([BITE, BITE, LASH]);
  });

  it('writes typed text into the entry typing started on, though the list was reordered meanwhile', async () => {
    const { harness, note } = await pane();
    const name = openFirstAction(harness);
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Big bite' } });
    note.external([{ op: 'move', list: 'actions', item: BITE, after: LASH }]);
    await act(async () => { fireEvent.blur(name); });

    expect(harness.writer.patches()).toEqual([{ op: 'set', path: ['actions', 0, 'name'], base: 'Bite', next: 'Big bite' }]);
    expect(note.values().actions).toEqual([LASH, { name: 'Big bite', desc: 'It bites.' }]);
  });
});

describe('commits based on the value typing started from', () => {
  it('reports an entry\'s text that changed in the note meanwhile, never overwriting it', async () => {
    const { harness, note } = await pane();
    openFirstAction(harness);
    const text = screen.getAllByRole('textbox', { name: 'Action description' })[0] as HTMLTextAreaElement;
    fireEvent.focus(text);
    fireEvent.change(text, { target: { value: 'Mine.' } });
    note.external([{ op: 'set', path: ['actions', 0, 'desc'], base: 'It bites.', next: 'Theirs.' }]);
    await act(async () => { fireEvent.blur(text); });

    expect(harness.writer.patches()).toEqual([{ op: 'set', path: ['actions', 0, 'desc'], base: 'It bites.', next: 'Mine.' }]);
    expect(note.values().actions).toEqual([{ name: 'Bite', desc: 'Theirs.' }, LASH]);
    expect(screen.getByRole('group', { name: 'Actions conflict' })).toBeTruthy();
  });

  it('reports a tray value that changed in the note meanwhile, and keeps mine on request', async () => {
    const { harness, note } = await pane();
    fireEvent.click(screen.getByRole('button', { name: /^More properties/ }));
    const lair = screen.getByRole('textbox', { name: 'lair' });
    fireEvent.change(lair, { target: { value: 'Mine' } });
    note.external([{ op: 'set', path: ['lair'], base: 'Sunken causeway', next: 'Theirs' }]);
    await act(async () => { fireEvent.blur(lair); });

    expect(harness.writer.patches()).toEqual([{ op: 'set', path: ['lair'], base: 'Sunken causeway', next: 'Mine' }]);
    expect(note.values().lair).toBe('Theirs');
    const chip = screen.getByRole('group', { name: 'lair conflict' });
    expect(chip.textContent).toContain('Changed in the note: Sunken causeway → Theirs');

    const keep = within(chip).getByRole('button', { name: 'Keep mine' });
    keep.focus();
    await act(async () => { fireEvent.click(keep); });
    expect(note.values().lair).toBe('Mine');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'lair' }));
  });
});
