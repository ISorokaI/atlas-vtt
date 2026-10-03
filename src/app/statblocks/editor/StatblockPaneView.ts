import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ItemView, Scope, type EventRef, type TAbstractFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { StatblockEditorRoot } from './StatblockEditorRoot';
import { movePairToWindow, reopenPartner } from './openStatblockEditor';
import { PairPropertiesMark } from './pairProperties';
import type { PaneServices } from './paneServices';
import { FOCUS_FIRST_EMPTY, STATBLOCK_PANE_VIEW_TYPE, readPaneState, type StatblockPaneState } from './paneState';
import { partnerInfo, trackPartner, type PartnerInfo } from './partnerTracking';
import type { PaneNoteKind, PendingCommit, StatblockPaneActions } from './statblock-pane/paneTypes';
import { noteName } from '../../utils/pathUtils';

/** What the plugin gives every pane: its note services, and the actions other parts of Atlas wire in. */
export interface StatblockPaneDeps {
  services: (app: StatblockPaneView['app']) => PaneServices;
  actions?: Pick<StatblockPaneActions, 'createStatblock' | 'editTemplate' | 'linkToToken' | 'openTemplateAt'>;
}

const NO_PARTNER: PartnerInfo = { leaf: null, path: null };

/**
 * The statblock pane (§4.6, §7.1, §7.2): an `ItemView` beside a statblock
 * note that edits its values in place. `navigation = false`, so neither
 * Obsidian's linked-tab sync nor any navigation ever opens a file in it; it
 * follows its partner itself. Restoring its state reads, never writes.
 */
export class StatblockPaneView extends ItemView {
  navigation = false;
  private state: StatblockPaneState | null = null;
  private root: Root | null = null;
  private partner: PartnerInfo = NO_PARTNER;
  private mark: PairPropertiesMark | null = null;
  private stopTracking: (() => void) | null = null;
  private readonly fileRefs: EventRef[] = [];
  private propertiesShown = false;
  private kind: PaneNoteKind = 'loading';
  private announcement = '';
  private focusRequest = 0;
  private readonly pendingCommit: PendingCommit = { current: null };
  private readonly services: PaneServices;
  private readonly paneActions: StatblockPaneActions;

  constructor(leaf: WorkspaceLeaf, private readonly deps: StatblockPaneDeps) {
    super(leaf);
    this.services = deps.services(this.app);
    this.paneActions = this.makeActions();
    this.scope = new Scope(this.app.scope);
    this.scope.register(['Mod'], 'z', () => this.historyKey('undo'));
    this.scope.register(['Mod', 'Shift'], 'z', () => this.historyKey('redo'));
  }

  getViewType(): string {
    return STATBLOCK_PANE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.state ? `${noteName(this.state.notePath)} · statblock` : 'Statblock';
  }

  getIcon(): string {
    return 'scroll-text';
  }

  getState(): Record<string, unknown> {
    return this.state ? { ...this.state } : {};
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const next = readPaneState(state);
    if (next) this.applyState(next);
    await super.setState(state, result);
  }

  /** `openStatblockEditor` asks for focus on the first empty value; a restored workspace never does. */
  setEphemeralState(state: unknown): void {
    super.setEphemeralState(state);
    if (state !== null && typeof state === 'object' && (state as Record<string, unknown>)[FOCUS_FIRST_EMPTY] === true) {
      this.focusRequest += 1;
      this.render();
    }
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('atlas-vtt-plugin', 'atlas-statblock-pane-view');
    this.root = createRoot(this.contentEl);
    const { vault } = this.app;
    this.fileRefs.push(
      vault.on('rename', (file: TAbstractFile, oldPath: string) => this.renamed(file.path, oldPath)),
      // The pane turns to "Note deleted", keeping what it showed so typed text can still be copied.
      vault.on('delete', (file: TAbstractFile) => {
        if (file.path === this.state?.notePath) this.render();
      }),
    );
    this.render();
  }

  async onClose(): Promise<void> {
    const path = this.state?.notePath;
    try {
      await this.pendingCommit.current?.();
      if (path) await this.services.writer.flush(path);
    } catch (error) {
      console.error(`[Atlas] Saving the statblock of ${path ?? 'a note'} failed:`, error);
    }
    for (const ref of this.fileRefs.splice(0)) this.app.vault.offref(ref);
    this.stopTracking?.();
    this.stopTracking = null;
    if (!this.anotherPaneHoldsPair()) this.mark?.release();
    const root = this.root;
    this.root = null;
    root?.unmount();
  }

  private applyState(next: StatblockPaneState): void {
    const pairChanged = next.pairId !== this.state?.pairId;
    this.state = next;
    if (pairChanged) {
      this.mark?.release();
      this.mark = new PairPropertiesMark(next.pairId);
      this.propertiesShown = false;
      this.stopTracking?.();
      this.partner = partnerInfo(this.app, next.pairId, this.leaf);
      this.stopTracking = trackPartner(this.app, this.leaf, next.pairId, (info) => this.partnerChanged(info));
    }
    this.followPartner();
    this.render();
  }

  /** The pane shows whatever note its partner shows. */
  private partnerChanged(info: PartnerInfo): void {
    this.partner = info;
    this.followPartner();
    this.render();
  }

  private followPartner(): void {
    const path = this.partner.path;
    if (this.state && path && path !== this.state.notePath) {
      this.state = { ...this.state, notePath: path };
      this.kind = 'loading';
      this.app.workspace.requestSaveLayout();
    }
    this.updateMark();
  }

  private renamed(path: string, oldPath: string): void {
    if (!this.state || oldPath !== this.state.notePath) return;
    this.state = { ...this.state, notePath: path };
    this.app.workspace.requestSaveLayout();
    this.render();
  }

  /** Properties hide only beside a native statblock, where the tray edits what they would show (D7). */
  private updateMark(): void {
    this.mark?.update(this.partner.leaf, this.kind === 'atlas' && !this.propertiesShown);
  }

  /** After the pair moved to a popout the new pane holds the same pair: the old one leaves its mark. */
  private anotherPaneHoldsPair(): boolean {
    const pairId = this.state?.pairId;
    if (!pairId) return false;
    return this.app.workspace.getGroupLeaves(pairId)
      .some((leaf) => leaf !== this.leaf && leaf.getViewState().type === STATBLOCK_PANE_VIEW_TYPE);
  }

  /** Mod+Z and Mod+Shift+Z: the note's own history; a text field of the pane keeps its own undo. */
  private historyKey(kind: 'undo' | 'redo'): boolean {
    const active = this.contentEl.doc.activeElement;
    if (active && this.contentEl.contains(active)
      && (active.instanceOf(HTMLInputElement) || active.instanceOf(HTMLTextAreaElement))) return true;
    const path = this.state?.notePath;
    if (!path) return false;
    const done = this.services.writer[kind](path);
    const name = noteName(path);
    this.announcement = done
      ? `${kind === 'undo' ? 'Undid' : 'Redid'} in ${name}.`
      : `Open ${name} to ${kind} there.`;
    this.render();
    return false;
  }

  private makeActions(): StatblockPaneActions {
    return {
      ...this.deps.actions,
      openNote: () => {
        if (this.state) void reopenPartner(this.app, this.leaf, this.state);
      },
      openInNewWindow: () => {
        void movePairToWindow(this.app, this.leaf);
      },
      showProperties: () => {
        this.propertiesShown = true;
        this.updateMark();
        this.render();
      },
      changeCollection: (collectionId) => {
        if (!this.state || this.state.collectionId === collectionId) return;
        this.state = { ...this.state, collectionId };
        this.app.workspace.requestSaveLayout();
        this.render();
      },
      reportKind: (kind) => {
        if (kind === this.kind) return;
        this.kind = kind;
        this.updateMark();
      },
    };
  }

  private render(): void {
    if (!this.root || !this.state) return;
    this.root.render(React.createElement(StatblockEditorRoot, {
      surface: {
        kind: 'statblock-pane',
        props: {
          app: this.app,
          services: this.services,
          notePath: this.state.notePath,
          collectionId: this.state.collectionId,
          paired: this.partner.leaf !== null && this.partner.path === this.state.notePath,
          propertiesShown: this.propertiesShown,
          announcement: this.announcement,
          focusRequest: this.focusRequest,
          pendingCommit: this.pendingCommit,
          actions: this.paneActions,
        },
      },
    }));
  }
}
