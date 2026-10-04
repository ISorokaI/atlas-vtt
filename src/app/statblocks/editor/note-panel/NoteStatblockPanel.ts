import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Scope, setIcon, type App, type MarkdownView } from 'obsidian';
import { noteName } from '../../../utils/pathUtils';
import { STATBLOCK_NOTE_CLASS } from '../../notes/openEditors';
import { observeResize } from '../../../utils/observeResize';
import type { PaneServices } from '../paneServices';
import type { PendingCommit, StatblockPaneActions } from '../statblock-pane/paneTypes';
import { NotePanelRoot } from './NotePanelRoot';
import { STACK_BELOW, type PanelPrefs } from './panelPrefs';

/** On the view's container while its statblock shows: the content becomes a row, the note's fence shrinks. */
export const NOTE_PANEL_CLASS = STATBLOCK_NOTE_CLASS;
/** On the view's container while the panel's tray edits what Properties would show. */
export const HIDE_PROPERTIES_CLASS = 'atlas-sb-note--hide-properties';
/** On the view's container while the view is too narrow for two columns: the panel stands above the note. */
export const STACKED_CLASS = 'atlas-sb-note--stacked';

/** What the manager gives each panel. */
export interface PanelContext {
  app: App;
  services: PaneServices;
  actions: Pick<StatblockPaneActions, 'editTemplate' | 'linkToToken' | 'openTemplateAt'>;
  prefs: () => PanelPrefs;
  /** A new width while dragging (`done` false) and once let go, which stores it. */
  setWidth: (width: number, done: boolean) => void;
  /** Hides or shows the statblock beside every note, on this device. */
  setHidden: (hidden: boolean) => void;
}

/** What an entry point asks of the panel of the note it opened. */
export interface PanelRequest {
  /** The entry point's collection; resolved from the note's tokens when absent. */
  collectionId?: string | null | undefined;
  /** Focus the first empty value, as after creating a statblock. */
  focusFirstEmpty?: boolean | undefined;
}

/**
 * The statblock beside one Markdown view's note (§7.2): a header action that
 * hides or shows it and, while shown, one element appended to the view's
 * content, where the editable card is drawn. Obsidian's editor and reader
 * stay where they are; only the stylesheet lays the content out as a row.
 */
export class NoteStatblockPanel {
  private host: HTMLElement | null = null;
  private root: Root | null = null;
  private action: HTMLElement | null = null;
  private collectionId: string | null = null;
  private propertiesShown = false;
  private stacked = false;
  private announcement = '';
  private focusRequest = 0;
  private readonly pendingCommit: PendingCommit = { current: null };
  private readonly teardown: Array<() => void> = [];
  private readonly scope: Scope;
  private scopePushed = false;
  private readonly paneActions: StatblockPaneActions;

  constructor(readonly view: MarkdownView, private path: string, private readonly context: PanelContext) {
    this.scope = new Scope(context.app.scope);
    this.scope.register(['Mod'], 'z', () => this.historyKey('undo'));
    this.scope.register(['Mod', 'Shift'], 'z', () => this.historyKey('redo'));
    this.paneActions = {
      ...context.actions,
      showProperties: () => {
        this.propertiesShown = true;
        this.update();
      },
      hide: () => context.setHidden(true),
      changeCollection: (collectionId) => {
        if (this.collectionId === collectionId) return;
        this.collectionId = collectionId;
        this.render();
      },
    };
  }

  get notePath(): string {
    return this.path;
  }

  /** Whether the statblock is on screen (not hidden). */
  get shown(): boolean {
    return this.host !== null;
  }

  /** The leaf now shows another statblock note: the panel starts over for it. */
  setNote(path: string): void {
    if (path === this.path) return;
    this.commitPending();
    this.path = path;
    this.collectionId = null;
    this.propertiesShown = false;
    this.update();
  }

  request(request: PanelRequest): void {
    if (request.collectionId) this.collectionId = request.collectionId;
    if (request.focusFirstEmpty) this.focusRequest += 1;
    this.render();
  }

  /** Brings the panel in line with the device's choices: shown or hidden, and its width. */
  update(): void {
    const { hidden, width } = this.context.prefs();
    this.updateAction(hidden);
    if (hidden) this.removeHost();
    else this.ensureHost();
    this.host?.style.setProperty('--atlas-sb-panel-width', `${width}px`);
    const { containerEl } = this.view;
    containerEl.toggleClass(NOTE_PANEL_CLASS, this.host !== null);
    containerEl.toggleClass(HIDE_PROPERTIES_CLASS, this.host !== null && !this.propertiesShown);
    containerEl.toggleClass(STACKED_CLASS, this.host !== null && this.stacked);
    this.render();
  }

  /** Takes everything off the view; what is being typed is written to the note first. */
  detach(): void {
    this.removeHost();
    this.action?.remove();
    this.action = null;
    this.view.containerEl.removeClass(NOTE_PANEL_CLASS, HIDE_PROPERTIES_CLASS, STACKED_CLASS);
  }

  private updateAction(hidden: boolean): void {
    if (!this.action) this.action = this.view.addAction('panel-right-close', 'Hide statblock', () => {
      this.context.setHidden(!this.context.prefs().hidden);
    });
    setIcon(this.action, hidden ? 'panel-right-open' : 'panel-right-close');
    this.action.setAttribute('aria-label', hidden ? 'Show statblock' : 'Hide statblock');
    this.action.toggleClass('is-active', !hidden);
  }

  private ensureHost(): void {
    if (this.host) return;
    const { contentEl } = this.view;
    const host = contentEl.createDiv({ cls: ['atlas-vtt-plugin', 'atlas-sb-note-panel'] });
    this.host = host;
    this.root = createRoot(host);
    const onFocusIn = (): void => this.pushScope();
    const onFocusOut = (event: FocusEvent): void => {
      if (!host.contains(event.relatedTarget as Node | null)) this.popScope();
    };
    host.addEventListener('focusin', onFocusIn);
    host.addEventListener('focusout', onFocusOut);
    // Quitting closes no view, so the writer's last flush commits the text being typed (§8.5).
    const releasePending = this.context.services.writer.registerPending(() => this.pendingCommit.current?.() ?? Promise.resolve());
    const measure = (): void => {
      const stacked = contentEl.clientWidth > 0 && contentEl.clientWidth < STACK_BELOW;
      if (stacked === this.stacked) return;
      this.stacked = stacked;
      this.update();
    };
    const stopObserving = observeResize([contentEl], measure);
    this.teardown.push(() => {
      host.removeEventListener('focusin', onFocusIn);
      host.removeEventListener('focusout', onFocusOut);
      releasePending();
      stopObserving();
    });
    measure();
  }

  private removeHost(): void {
    const { host, root } = this;
    if (!host) return;
    this.commitPending();
    this.popScope();
    for (const stop of this.teardown.splice(0)) stop();
    this.host = null;
    this.root = null;
    this.stacked = false;
    host.remove();
    // Never inside a render of React's: the switch may change from another root's event.
    queueMicrotask(() => root?.unmount());
  }

  /** Writes what is being typed, then the note's pending writes. */
  private commitPending(): void {
    const path = this.path;
    const { writer } = this.context.services;
    const commit = this.pendingCommit.current;
    this.pendingCommit.current = null;
    void (async () => {
      try {
        await commit?.();
        await writer.flush(path);
      } catch (error) {
        console.error(`[Atlas] Saving the statblock of ${path} failed:`, error);
      }
    })();
  }

  /** The panel's keys apply only while focus is inside it. */
  private pushScope(): void {
    if (this.scopePushed) return;
    this.scopePushed = true;
    this.context.app.keymap.pushScope(this.scope);
  }

  private popScope(): void {
    if (!this.scopePushed) return;
    this.scopePushed = false;
    this.context.app.keymap.popScope(this.scope);
  }

  /** Mod+Z and Mod+Shift+Z: the note's own history; a text field of the panel keeps its own undo. */
  private historyKey(kind: 'undo' | 'redo'): boolean {
    const active = this.host?.doc.activeElement;
    if (active && this.host?.contains(active)
      && (active.instanceOf(HTMLInputElement) || active.instanceOf(HTMLTextAreaElement))) return true;
    const done = this.context.services.writer[kind](this.path);
    const name = noteName(this.path);
    this.announcement = done
      ? `${kind === 'undo' ? 'Undid' : 'Redid'} in ${name}.`
      : `Switch ${name} to editing view to ${kind}.`;
    this.render();
    return false;
  }

  private render(): void {
    if (!this.root || !this.host) return;
    const { app, services } = this.context;
    this.root.render(React.createElement(NotePanelRoot, {
      pane: {
        app,
        services,
        notePath: this.path,
        collectionId: this.collectionId,
        propertiesShown: this.propertiesShown,
        announcement: this.announcement,
        focusRequest: this.focusRequest,
        pendingCommit: this.pendingCommit,
        actions: this.paneActions,
      },
      width: this.context.prefs().width,
      stacked: this.stacked,
      availableWidth: () => this.view.contentEl.clientWidth,
      onResize: (width, done) => {
        this.host?.style.setProperty('--atlas-sb-panel-width', `${width}px`);
        this.context.setWidth(width, done);
      },
    }));
  }
}
