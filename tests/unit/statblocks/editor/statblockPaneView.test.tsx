import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { BESIDE_ATTRIBUTE, PAIR_ATTRIBUTE } from '../../../../src/app/statblocks/editor/pairProperties';
import { StatblockPaneView } from '../../../../src/app/statblocks/editor/StatblockPaneView';
import { SettingsService } from '../../../../src/app/services/SettingsService';
import { createInMemoryApp } from '../../../mocks/inMemoryVault';
import { withStatblockEditor } from '../../../mocks/experimentalFeatures';
import { FakeSource, FakeWriter } from './paneKit';
import { FakeLeaf, fakeWorkspace, noteLeaf, type FakeWorkspace } from './workspaceKit';

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

const NOTE = 'Bestiary/Marsh Warden.md';
const PAIR = 'atlas-pair-test';
const NATIVE = { statblock: true, 'atlas-template': 'builtin:generic-creature', name: 'Marsh Warden', hp: 14 };

const opened: StatblockPaneView[] = [];
const apps: App[] = [];
afterEach(async () => {
  for (const view of opened.splice(0)) await act(async () => { await view.onClose(); });
  cleanup();
  for (const app of apps.splice(0)) TemplateLibrary.release(app);
});

interface Harness {
  app: App;
  fake: FakeWorkspace;
  view: StatblockPaneView;
  note: FakeLeaf;
  source: FakeSource;
  writer: FakeWriter;
}

function setup(switchedOn = true): Harness {
  const { app } = createInMemoryApp({ files: { [NOTE]: '---\nstatblock: true\n---\n' } });
  apps.push(app);
  if (switchedOn) withStatblockEditor(app);
  const note = noteLeaf(NOTE);
  const paneLeaf = new FakeLeaf({ type: 'atlas-statblock-editor' }, app);
  const fake = fakeWorkspace([note, paneLeaf], note);
  app.workspace = fake.workspace;
  const source = new FakeSource();
  const writer = new FakeWriter();
  source.set(NOTE, NATIVE);
  const view = new StatblockPaneView(paneLeaf as unknown as WorkspaceLeaf, { services: () => ({ source, writer }) });
  return { app, fake, view, note, source, writer };
}

/** Pairs the note and the pane, as `openStatblockEditor` does. */
function pair({ fake, note }: Harness): void {
  note.setGroup(PAIR);
  fake.leaves[1]!.setGroup(PAIR);
}

async function open(harness: Harness): Promise<void> {
  opened.push(harness.view);
  document.body.appendChild(harness.view.contentEl);
  await act(async () => { await harness.view.onOpen(); });
  await act(async () => { await Promise.resolve(); });
}

describe('StatblockPaneView', () => {
  it('is no navigation view and saves the state it restores, without writing', async () => {
    const harness = setup();
    const { view, app, writer } = harness;
    expect(view.navigation).toBe(false);
    expect(view.getViewType()).toBe('atlas-statblock-editor');

    const state = { notePath: NOTE, pairId: PAIR, collectionId: 'campaign', previewPath: 'Bestiary/Bog Hag.md' };
    await view.setState(state, { history: false });
    expect(view.getState()).toEqual(state);
    expect(view.getDisplayText()).toBe('Marsh Warden · statblock');

    await view.setState({ notePath: '', pairId: PAIR }, { history: false });
    expect(view.getState()).toEqual(state);
    expect(writer.writes).toEqual([]);
    expect(app.vault.process).not.toHaveBeenCalled();
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it('hides Properties beside a native statblock while paired, and shows them again on request', async () => {
    const harness = setup();
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    await open(harness);
    await waitFor(() => expect(harness.note.containerEl.getAttribute(PAIR_ATTRIBUTE)).toBe(PAIR));

    const more = screen.getByRole('button', { name: 'More statblock actions' });
    fireEvent.keyDown(more, { key: 'Enter' });
    await act(async () => { fireEvent.click(await screen.findByRole('menuitem', { name: 'Show Properties' })); });
    expect(harness.note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);
  });

  it('shrinks the note\'s fence beside a Fantasy Statblocks note too, whose Properties stay', async () => {
    const harness = setup();
    harness.source.set(NOTE, { statblock: true, name: 'Marsh Warden', hp: 14 });
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    await open(harness);
    await waitFor(() => expect(harness.note.containerEl.getAttribute(BESIDE_ATTRIBUTE)).toBe(PAIR));
    expect(harness.note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);
  });

  it('ends the pair when the partner closes: Properties show again and the pane turns read-only', async () => {
    const harness = setup();
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    await open(harness);
    await waitFor(() => expect(harness.note.containerEl.getAttribute(PAIR_ATTRIBUTE)).toBe(PAIR));

    await act(async () => {
      harness.note.detach();
      harness.fake.trigger('layout-change');
    });
    expect(harness.note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);
    expect(harness.note.containerEl.hasAttribute(BESIDE_ATTRIBUTE)).toBe(false);
    expect(screen.getByText('Open the note to edit')).toBeTruthy();
  });

  it('follows its partner to another note', async () => {
    const harness = setup();
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    harness.note.viewState = { type: 'markdown', state: { file: 'Bestiary/Bog Hag.md' } };
    harness.fake.trigger('layout-change');
    expect(harness.view.getState()).toEqual(expect.objectContaining({ notePath: 'Bestiary/Bog Hag.md' }));
    expect(harness.fake.workspace.requestSaveLayout).toHaveBeenCalled();
  });

  it('undoes in the note with Mod+Z, and leaves the key to a focused text field of its own', async () => {
    const harness = setup();
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    await open(harness);
    const scope = harness.view.scope as unknown as { keys: Array<{ modifiers: string[]; key: string; func: () => unknown }> };
    const undo = scope.keys.find((handler) => handler.key === 'z' && handler.modifiers.join() === 'Mod')!;

    let handled: unknown;
    act(() => { handled = undo.func(); });
    expect(handled).toBe(false);
    expect(harness.writer.undo).toHaveBeenCalledWith(NOTE);
    expect(harness.view.contentEl.querySelector('.atlas-sb-pane-live')?.textContent).toBe('Undid in Marsh Warden.');

    fireEvent.click(harness.view.contentEl.querySelector('[data-block-id="gchp0000"]')!);
    within(harness.view.contentEl).getByRole('textbox', { name: 'Hit Points' }).focus();
    harness.writer.undo.mockClear();
    expect(undo.func()).toBe(true);
    expect(harness.writer.undo).not.toHaveBeenCalled();
  });

  it('commits the input being typed in and flushes the note when it closes', async () => {
    const harness = setup();
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    await open(harness);
    fireEvent.click(harness.view.contentEl.querySelector('[data-block-id="gchp0000"]')!);
    const input = within(harness.view.contentEl).getByRole('textbox', { name: 'Hit Points' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '31' } });

    opened.splice(opened.indexOf(harness.view), 1);
    await act(async () => { await harness.view.onClose(); });
    expect(harness.writer.patches()).toEqual([{ op: 'set', path: ['hp'], base: 14, next: 31 }]);
    expect(harness.writer.flush).toHaveBeenCalledWith(NOTE);
  });

  it('hands the input being typed in to the writer\'s last flush, as quitting closes no pane', async () => {
    const harness = setup();
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    await open(harness);
    expect(harness.writer.pending.size).toBe(1);
    fireEvent.click(harness.view.contentEl.querySelector('[data-block-id="gchp0000"]')!);
    const input = within(harness.view.contentEl).getByRole('textbox', { name: 'Hit Points' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '45' } });

    await act(async () => { for (const commit of harness.writer.pending) await commit(); });
    expect(harness.writer.patches()).toEqual([{ op: 'set', path: ['hp'], base: 14, next: 45 }]);

    opened.splice(opened.indexOf(harness.view), 1);
    await act(async () => { await harness.view.onClose(); });
    expect(harness.writer.pending.size).toBe(0);
    expect(harness.writer.patches()).toHaveLength(1);
  });

  it('only shows the note while the statblock editor is switched off, and follows the switch', async () => {
    const harness = setup(false);
    const settings = new SettingsService(harness.app);
    pair(harness);
    await harness.view.setState({ notePath: NOTE, pairId: PAIR, collectionId: 'campaign' }, { history: false });
    await open(harness);
    const { contentEl } = harness.view;
    const hp = (): HTMLElement => contentEl.querySelector<HTMLElement>('[data-block-id="gchp0000"]')!;
    expect(within(contentEl).getByText('Turn on the statblock editor under Experimental features to edit statblocks.')).toBeTruthy();
    fireEvent.click(hp());
    expect(within(contentEl).queryByRole('textbox', { name: 'Hit Points' })).toBeNull();
    expect(harness.note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);

    await act(async () => { settings.setExperimental('statblockEditor', true); });
    await waitFor(() => expect(harness.note.containerEl.getAttribute(PAIR_ATTRIBUTE)).toBe(PAIR));
    fireEvent.click(hp());
    expect(within(contentEl).getByRole('textbox', { name: 'Hit Points' })).toBeTruthy();

    await act(async () => { settings.setExperimental('statblockEditor', false); });
    expect(harness.note.containerEl.hasAttribute(PAIR_ATTRIBUTE)).toBe(false);
    expect(within(contentEl).queryByRole('textbox', { name: 'Hit Points' })).toBeNull();
    expect(harness.writer.writes).toEqual([]);
    await settings.saveSettingsNow();
  });
});
