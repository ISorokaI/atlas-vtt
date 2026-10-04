import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { SettingsService } from '../../../../src/app/services/SettingsService';
import { movePairToWindow, openStatblockEditor } from '../../../../src/app/statblocks/editor/openStatblockEditor';
import { setStatblockPaneSettings } from '../../../../src/app/statblocks/editor/paneSettings';
import { FOCUS_FIRST_EMPTY, STATBLOCK_PANE_VIEW_TYPE } from '../../../../src/app/statblocks/editor/paneState';
import { createInMemoryApp } from '../../../mocks/inMemoryVault';
import { withStatblockEditor } from '../../../mocks/experimentalFeatures';
import { FakeLeaf, fakeWorkspace, noteLeaf, type FakeWorkspace } from './workspaceKit';

const NOTE = 'Bestiary/Marsh Warden.md';

function setup(leaves: FakeLeaf[], current: FakeLeaf | null, switchedOn = true): { app: App; fake: FakeWorkspace } {
  const { app } = createInMemoryApp({ files: { [NOTE]: '---\nstatblock: true\n---\n' } });
  const fake = fakeWorkspace(leaves, current);
  app.workspace = fake.workspace;
  if (switchedOn) withStatblockEditor(app);
  return { app, fake };
}

const paneOf = (fake: FakeWorkspace): FakeLeaf | undefined =>
  fake.leaves.find((leaf) => leaf.getViewState().type === STATBLOCK_PANE_VIEW_TYPE);

describe('openStatblockEditor', () => {
  it('opens the note in the current leaf, splits the pane to its right and groups the two', async () => {
    const current = new FakeLeaf({ type: 'empty' });
    const { app, fake } = setup([current], current);
    await openStatblockEditor(app, { notePath: NOTE, collectionId: 'campaign', from: 'command' });

    expect(current.openFile).toHaveBeenCalled();
    expect(fake.workspace.createLeafBySplit).toHaveBeenCalledWith(current, 'vertical');
    const pane = paneOf(fake)!;
    expect(pane.getViewState().state).toEqual(expect.objectContaining({ notePath: NOTE, collectionId: 'campaign' }));
    expect(pane.eState).toEqual({ [FOCUS_FIRST_EMPTY]: true });
    expect(current.group).toMatch(/^atlas-pair-/);
    expect(pane.group).toBe(current.group);
    expect(pane.getViewState().state?.pairId).toBe(current.group);
    expect(fake.workspace.setActiveLeaf).toHaveBeenCalledWith(pane, { focus: true });
  });

  it('never opens the note over a map: it splits to the map\'s right, and the pane to the note\'s', async () => {
    const map = new FakeLeaf({ type: 'atlas-vtt', state: { file: 'Maps/Village.atlasmap' } });
    const { app, fake } = setup([map], map);
    await openStatblockEditor(app, { notePath: NOTE, from: 'map' });

    expect(map.openFile).not.toHaveBeenCalled();
    expect(map.getViewState().type).toBe('atlas-vtt');
    const [, note, pane] = fake.leaves;
    expect(fake.workspace.createLeafBySplit).toHaveBeenNthCalledWith(1, map, 'vertical');
    expect(fake.workspace.createLeafBySplit).toHaveBeenNthCalledWith(2, note, 'vertical');
    expect(note!.getViewState().state?.file).toBe(NOTE);
    expect(pane!.getViewState().type).toBe(STATBLOCK_PANE_VIEW_TYPE);
    expect(map.group).toBeNull();
  });

  it('pairs with the leaf that already shows the note', async () => {
    const showing = noteLeaf(NOTE);
    const other = new FakeLeaf({ type: 'markdown', state: { file: 'Other.md' } });
    const { app, fake } = setup([other, showing], other);
    await openStatblockEditor(app, { notePath: NOTE });

    expect(showing.openFile).not.toHaveBeenCalled();
    expect(other.openFile).not.toHaveBeenCalled();
    expect(fake.workspace.createLeafBySplit).toHaveBeenCalledWith(showing, 'vertical');
    expect(showing.group).toBe(paneOf(fake)!.group);
  });

  it('focuses the pane already open for the note instead of opening another', async () => {
    const note = noteLeaf(NOTE);
    const pane = new FakeLeaf({ type: STATBLOCK_PANE_VIEW_TYPE, state: { notePath: NOTE, pairId: 'atlas-pair-1' } });
    note.group = 'atlas-pair-1';
    pane.group = 'atlas-pair-1';
    const { app, fake } = setup([note, pane], note);
    await openStatblockEditor(app, { notePath: NOTE });

    expect(fake.workspace.createLeafBySplit).not.toHaveBeenCalled();
    expect(fake.workspace.setActiveLeaf).toHaveBeenCalledWith(pane, { focus: true });
  });

  it('never takes another pair\'s note leaf, though it is the current one: the note opens in a new tab', async () => {
    const other = 'Bestiary/Bog Hag.md';
    const note = noteLeaf(other);
    const pane = new FakeLeaf({ type: STATBLOCK_PANE_VIEW_TYPE, state: { notePath: other, pairId: 'atlas-pair-1' } });
    note.group = 'atlas-pair-1';
    pane.group = 'atlas-pair-1';
    const { app, fake } = setup([note, pane], note);
    await openStatblockEditor(app, { notePath: NOTE });

    expect(note.openFile).not.toHaveBeenCalled();
    expect(note.getViewState().state?.file).toBe(other);
    expect(note.group).toBe('atlas-pair-1');
    expect(fake.workspace.getLeaf).toHaveBeenCalledWith('tab');
    const [, , opened, newPane] = fake.leaves;
    expect(opened!.getViewState().state?.file).toBe(NOTE);
    expect(newPane!.group).toBe(opened!.group);
    expect(newPane!.group).not.toBe('atlas-pair-1');
  });

  it('opens a pair in a new window on request, and from the map when the setting says so', async () => {
    const map = new FakeLeaf({ type: 'atlas-vtt' });
    const asked = setup([map], map);
    await openStatblockEditor(asked.app, { notePath: NOTE, newWindow: true });
    expect(asked.fake.workspace.openPopoutLeaf).toHaveBeenCalled();

    const fromMap = setup([new FakeLeaf({ type: 'atlas-vtt' })], null);
    const settings = SettingsService.forApp(fromMap.app)!;
    setStatblockPaneSettings(settings, { openFromMapInNewWindow: true });
    await openStatblockEditor(fromMap.app, { notePath: NOTE, from: 'map' });
    expect(fromMap.fake.workspace.openPopoutLeaf).toHaveBeenCalled();
    // The setting's save would otherwise run after the test.
    await settings.saveSettingsNow();
  });

  it('opens nothing while the statblock editor is switched off', async () => {
    const current = new FakeLeaf();
    const { app, fake } = setup([current], current, false);
    await openStatblockEditor(app, { notePath: NOTE });
    expect(fake.workspace.createLeafBySplit).not.toHaveBeenCalled();
    expect(current.openFile).not.toHaveBeenCalled();
  });
});

describe('movePairToWindow', () => {
  it('moves the note to a popout and makes the pane anew beside it, in the same pair', async () => {
    const note = noteLeaf(NOTE);
    const pane = new FakeLeaf({ type: STATBLOCK_PANE_VIEW_TYPE, state: { notePath: NOTE, pairId: 'atlas-pair-7', collectionId: 'c' } });
    note.group = 'atlas-pair-7';
    pane.group = 'atlas-pair-7';
    const { app, fake } = setup([note, pane], pane);
    await movePairToWindow(app, pane as never);

    expect(fake.workspace.moveLeafToPopout).toHaveBeenCalledWith(note);
    const moved = fake.leaves[2]!;
    expect(fake.workspace.createLeafBySplit).toHaveBeenCalledWith(note, 'vertical');
    expect(moved.getViewState().state).toEqual({ notePath: NOTE, pairId: 'atlas-pair-7', collectionId: 'c' });
    expect(moved.group).toBe('atlas-pair-7');
    expect(pane.detached).toBe(true);
  });
});
