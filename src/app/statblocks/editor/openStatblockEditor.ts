/**
 * Opening a statblock pair (§4.6, §7.1): the note in a Markdown leaf, the
 * statblock pane split to its right, both in a group of Atlas' own pair id.
 * Every way in is behind the `statblockEditor` experimental switch.
 */

import { Notice, TFile, type App, type WorkspaceLeaf } from 'obsidian';
import { experimentalFeatureOn } from '../../experimental/experimentalFeatures';
import { SettingsService } from '../../services/SettingsService';
import { statblockPaneSettings } from './paneSettings';
import { FOCUS_FIRST_EMPTY, STATBLOCK_PANE_VIEW_TYPE, newPairId, readPaneState, type StatblockPaneState } from './paneState';
import { findPartner, leafNotePath } from './partnerTracking';

/** Where a pair is opened from; the map's pairs open beside the map, never over it. */
export type StatblockEditorEntry = 'map' | 'asset-manager' | 'settings' | 'command' | 'note' | 'link-dialog';

export interface OpenStatblockEditorOptions {
  notePath: string;
  /** The entry point's collection; resolved from the note's tokens when absent. */
  collectionId?: string | null;
  from?: StatblockEditorEntry;
  /** Opens the pair in a popout; unset, pairs from the map follow the setting. */
  newWindow?: boolean;
}

/** The map view's type (`ATLAS_VIEW_TYPE`); not imported, which would load the whole map view. */
const MAP_VIEW_TYPE = 'atlas-vtt';
/** Leaves a note may open in, replacing what they show. */
const REPLACEABLE_VIEW_TYPES: ReadonlySet<string> = new Set(['markdown', 'empty']);

/** Every leaf of every window. A callback that returns a value stops Obsidian's iteration, so the body is a block. */
function allLeaves(app: App): WorkspaceLeaf[] {
  const leaves: WorkspaceLeaf[] = [];
  app.workspace.iterateAllLeaves((leaf) => {
    leaves.push(leaf);
  });
  return leaves;
}

function viewTypeOf(leaf: WorkspaceLeaf): string {
  return leaf.getViewState().type;
}

/** Panes of every window, each with its state. */
function panes(app: App): Array<{ leaf: WorkspaceLeaf; state: StatblockPaneState }> {
  return allLeaves(app).flatMap((leaf) => {
    const state = viewTypeOf(leaf) === STATBLOCK_PANE_VIEW_TYPE ? readPaneState(leaf.getViewState().state) : null;
    return state ? [{ leaf, state }] : [];
  });
}

/** Whether the leaf is a pair's note leaf, which belongs to its pane. */
function isPairedNoteLeaf(app: App, leaf: WorkspaceLeaf): boolean {
  return panes(app).some((pane) => findPartner(app, pane.state.pairId, pane.leaf) === leaf);
}

/** A pane already paired with a leaf that shows the note. */
function openPaneFor(app: App, notePath: string): WorkspaceLeaf | null {
  return panes(app).find(({ leaf, state }) => {
    const partner = findPartner(app, state.pairId, leaf);
    return state.notePath === notePath && partner !== null && leafNotePath(partner) === notePath;
  })?.leaf ?? null;
}

/**
 * Where the note opens: the leaf already showing it, else the current leaf
 * when it shows a note or nothing, else a new tab. A map is never replaced:
 * from the map, or with a map as the current leaf, the note splits to its right.
 * Nor is another pair's note leaf, which would leave that pair's pane without
 * its note.
 */
function noteLeafFor(app: App, notePath: string, from: StatblockEditorEntry | undefined): WorkspaceLeaf {
  const leaves = allLeaves(app);
  const showing = leaves.find((leaf) => leafNotePath(leaf) === notePath);
  if (showing) return showing;
  const current = app.workspace.getMostRecentLeaf();
  const map = current && viewTypeOf(current) === MAP_VIEW_TYPE
    ? current
    : from === 'map' ? leaves.find((leaf) => viewTypeOf(leaf) === MAP_VIEW_TYPE) : undefined;
  if (map) return app.workspace.createLeafBySplit(map, 'vertical');
  if (current && REPLACEABLE_VIEW_TYPES.has(viewTypeOf(current)) && !isPairedNoteLeaf(app, current)) return current;
  return app.workspace.getLeaf('tab');
}

/** Splits the pane to the right of `noteLeaf`, loads it and groups the two; focus goes to the pane. */
export async function pairWithPane(app: App, noteLeaf: WorkspaceLeaf, state: StatblockPaneState): Promise<WorkspaceLeaf> {
  const paneLeaf = app.workspace.createLeafBySplit(noteLeaf, 'vertical');
  await paneLeaf.setViewState({ type: STATBLOCK_PANE_VIEW_TYPE, state: { ...state } }, { [FOCUS_FIRST_EMPTY]: true });
  // A leaf that is not shown may stay deferred.
  await paneLeaf.loadIfDeferred();
  noteLeaf.setGroup(state.pairId);
  paneLeaf.setGroup(state.pairId);
  // A new split ends up active whatever `setViewState` was told: decide focus explicitly.
  app.workspace.setActiveLeaf(paneLeaf, { focus: true });
  return paneLeaf;
}

/** Opens a statblock note with its pane beside it, or focuses the pane already open for it. */
export async function openStatblockEditor(app: App, options: OpenStatblockEditorOptions): Promise<void> {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return;
  const file = app.vault.getAbstractFileByPath(options.notePath);
  if (!(file instanceof TFile)) {
    new Notice(`Couldn't find ${options.notePath}.`);
    return;
  }
  const open = openPaneFor(app, file.path);
  if (open) {
    app.workspace.setActiveLeaf(open, { focus: true });
    return;
  }
  const popout = options.newWindow
    ?? (options.from === 'map' && statblockPaneSettings(SettingsService.forApp(app)).openFromMapInNewWindow);
  const noteLeaf = popout ? app.workspace.openPopoutLeaf() : noteLeafFor(app, file.path, options.from);
  if (leafNotePath(noteLeaf) !== file.path) await noteLeaf.openFile(file, { active: false });
  await pairWithPane(app, noteLeaf, { notePath: file.path, pairId: newPairId(), collectionId: options.collectionId ?? null });
}

/**
 * Moves a pair into a popout. No call moves two leaves into one window: the
 * note moves (keeping its group), and the pane is made anew beside it from
 * its own state, then the old pane goes.
 */
export async function movePairToWindow(app: App, paneLeaf: WorkspaceLeaf): Promise<void> {
  const state = readPaneState(paneLeaf.getViewState().state);
  const partner = state ? findPartner(app, state.pairId, paneLeaf) : null;
  if (!state || !partner) {
    app.workspace.moveLeafToPopout(paneLeaf);
    return;
  }
  app.workspace.moveLeafToPopout(partner);
  await pairWithPane(app, partner, state);
  paneLeaf.detach();
}

/** Opens the pane's note to its left again and pairs the two, for a pane whose partner closed. */
export async function reopenPartner(app: App, paneLeaf: WorkspaceLeaf, state: StatblockPaneState): Promise<void> {
  const file = app.vault.getAbstractFileByPath(state.notePath);
  if (!(file instanceof TFile)) return;
  const partner = findPartner(app, state.pairId, paneLeaf);
  if (partner) {
    app.workspace.setActiveLeaf(partner, { focus: true });
    return;
  }
  const noteLeaf = app.workspace.createLeafBySplit(paneLeaf, 'vertical', true);
  await noteLeaf.openFile(file, { active: false });
  noteLeaf.setGroup(state.pairId);
  paneLeaf.setGroup(state.pairId);
}
