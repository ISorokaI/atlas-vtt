import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FileView, Scope, TFile, type Modifier, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { experimentalFeatureOn } from '../../experimental/experimentalFeatures';
import { TemplateLibrary } from '../library/TemplateLibrary';
import { TemplateSession } from '../library/TemplateSession';
import { TEMPLATE_EXTENSION } from '../library/templateFiles';
import type { TemplateId } from '../model/templateTypes';
import { StatblockEditorRoot } from './StatblockEditorRoot';
import { openTemplateEditor } from './openTemplateEditor';
import type { TemplateEditorProblem } from './template-editor/TemplateEditorSurface';
import type { TemplateEditorHost } from './template-editor/TemplateEditor';
import type { KeyHandler } from './template-editor/useTemplateKeyboard';
import { showWithState, type ShowWith, type ShowWithMode } from './template-editor/shell/showWith';
import {
  TEMPLATE_EDITOR_VIEW_TYPE, readTemplateEditorEphemeral, readTemplateEditorState, type TemplateEditorEphemeral,
} from './templateEditorState';

/**
 * Keys Obsidian or the browser would take before any listener of the editor
 * (Mod+G opens the graph): the view's scope asks the editor first while its
 * tab is active, and lets every key it does not use through (spike S4).
 */
const SCOPED_KEYS: ReadonlyArray<readonly [Modifier[], string]> = [
  [['Mod'], 'z'], [['Mod', 'Shift'], 'z'], [['Mod'], 'y'], [['Mod'], 'd'], [['Mod'], 'g'], [['Mod', 'Shift'], 'g'],
  [['Mod', 'Alt'], 'r'], [['Mod'], 'c'], [['Mod'], 'v'],
];

/**
 * The template editor (§4.6): a `FileView` for `.atlastemplate` files, so the
 * file explorer, rename and the file menu work as for any file; built-ins open
 * in it by id, read-only. Restoring its state reads, never writes. One
 * `TemplateSession` per template, shared with every other view of it.
 */
export class TemplateEditorView extends FileView {
  allowNoFile = true;
  private builtInId: TemplateId | null = null;
  private previewPath: string | null = null;
  private previewMode: ShowWithMode | null = null;
  private collectionId: string | null = null;
  private ephemeral: TemplateEditorEphemeral = {};
  private selectRequests = 0;
  private session: TemplateSession | null = null;
  private problem: TemplateEditorProblem | null = { kind: 'loading' };
  private root: Root | null = null;
  private keyHandler: KeyHandler | null = null;
  private stopLibrary: (() => void) | null = null;
  private readonly host: TemplateEditorHost;
  private readonly registerKeys = (handler: KeyHandler | null): void => {
    this.keyHandler = handler;
  };

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.scope = new Scope(this.app.scope);
    for (const [modifiers, key] of SCOPED_KEYS) {
      this.scope.register(modifiers, key, (event) => !(this.keyHandler?.(event, true) ?? false));
    }
    this.host = {
      openTemplate: (target, where, copiedFrom) => {
        void openTemplateEditor(this.app, {
          templateId: target.id,
          path: target.path,
          collectionId: this.collectionId,
          previewPath: where === 'here' ? this.previewPath : null,
          leaf: where === 'here' ? this.leaf : undefined,
          copiedFrom,
        });
      },
      openNote: (path) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) void this.app.workspace.getLeaf('tab').openFile(file);
      },
      close: () => this.leaf.detach(),
    };
  }

  getViewType(): string {
    return TEMPLATE_EDITOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    const id = this.builtInId;
    return this.session?.getSnapshot().name ?? this.file?.basename ?? (id ? TemplateLibrary.forApp(this.app).get(id)?.name : null) ?? 'Statblock template';
  }

  getIcon(): string {
    return 'layout-template';
  }

  canAcceptExtension(extension: string): boolean {
    return extension === TEMPLATE_EXTENSION;
  }

  getState(): Record<string, unknown> {
    const own = { previewPath: this.previewPath, previewMode: this.previewMode, collectionId: this.collectionId };
    return this.builtInId ? { templateId: this.builtInId, ...own } : { ...super.getState(), ...own };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const next = readTemplateEditorState(state);
    this.builtInId = next.templateId;
    this.previewPath = next.previewPath;
    this.previewMode = next.previewMode;
    this.collectionId = next.collectionId;
    await super.setState(state, result);
    this.resolve();
  }

  /** `openTemplateEditor` asks once: a block to select, the built-in a copy came from. Never restored. */
  setEphemeralState(state: unknown): void {
    super.setEphemeralState(state);
    const next = readTemplateEditorEphemeral(state);
    if (next.select) this.selectRequests += 1;
    if (next.select || next.copiedFrom) this.ephemeral = { ...this.ephemeral, ...next };
    this.render();
  }

  async onLoadFile(file: TFile): Promise<void> {
    this.builtInId = null;
    await super.onLoadFile(file);
    this.resolve();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.releaseSession();
    await super.onUnloadFile(file);
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('atlas-vtt-plugin', 'atlas-template-editor-view');
    this.root = createRoot(this.contentEl);
    // The library reads files after the layout is ready; a restored editor waits for its file.
    this.stopLibrary = TemplateLibrary.forApp(this.app).subscribe(() => this.resolve());
    this.resolve();
  }

  async onClose(): Promise<void> {
    this.stopLibrary?.();
    this.stopLibrary = null;
    this.releaseSession();
    const root = this.root;
    this.root = null;
    root?.unmount();
  }

  /** The template the view shows: its built-in, else its file's; the session follows it. */
  private resolve(): void {
    if (!experimentalFeatureOn(this.app, 'statblockEditor')) {
      this.releaseSession();
      this.problem = { kind: 'off' };
      this.render();
      return;
    }
    const library = TemplateLibrary.forApp(this.app);
    let id: TemplateId | null = this.builtInId;
    let problem: TemplateEditorProblem | null = null;
    if (!id && this.file) {
      const read = library.fileAt(this.file.path);
      const duplicate = read ? library.duplicateOf(read.path) : null;
      // A file deleted under an open session stays with the session, which offers to recreate it.
      if (!read && this.session) id = this.session.getSnapshot().id;
      else if (!read) problem = library.isLoading() ? { kind: 'loading' } : { kind: 'unreadable', problems: [] };
      else if (duplicate) problem = { kind: 'duplicate', of: duplicate };
      else if (!read.entry) problem = { kind: 'unreadable', problems: read.problems };
      else id = read.entry.template.id;
    }
    if (id !== (this.session?.getSnapshot().id ?? null)) {
      this.releaseSession();
      this.session = id ? TemplateSession.open(this.app, id) : null;
    }
    this.problem = this.session ? null : problem ?? { kind: 'loading' };
    this.render();
  }

  private releaseSession(): void {
    this.session?.release();
    this.session = null;
  }

  private render(): void {
    if (!this.root) return;
    const { select, copiedFrom } = this.ephemeral;
    this.root.render(React.createElement(StatblockEditorRoot, {
      surface: {
        kind: 'template-editor',
        props: {
          app: this.app,
          session: this.session,
          problem: this.problem,
          host: this.host,
          previewPath: this.previewPath,
          previewMode: this.previewMode,
          onShowWithChange: (choice: ShowWith) => this.changeState(showWithState(choice)),
          collectionId: this.collectionId,
          onCollectionChange: (collectionId) => this.changeState({ collectionId }),
          initialSelection: select ? [select] : undefined,
          selectRequest: this.selectRequests,
          copiedFrom: copiedFrom ?? null,
          onCopyQuestionDone: () => {
            this.ephemeral = { ...this.ephemeral, copiedFrom: undefined };
            this.render();
          },
          registerKeys: this.registerKeys,
        },
      },
    }));
  }

  private changeState(change: { previewPath?: string | null; previewMode?: ShowWithMode | null; collectionId?: string }): void {
    if (change.previewPath !== undefined) this.previewPath = change.previewPath;
    if (change.previewMode !== undefined) this.previewMode = change.previewMode;
    if (change.collectionId !== undefined) this.collectionId = change.collectionId;
    this.app.workspace.requestSaveLayout();
    this.render();
  }
}
