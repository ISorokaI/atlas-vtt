/**
 * The Markdown views that hold a note, in every window (spike S2).
 *
 * - A deferred leaf (a background tab after a reload) has no `MarkdownView` yet, though
 *   `getLeavesOfType('markdown')` lists it: only `instanceof MarkdownView` tells. Views are
 *   objects of the main window's realm in popouts too, so `instanceof` holds there.
 * - In Reading view the view's editor is a hidden, stale buffer: a transaction there is lost.
 *   Only views in an editing mode take writes; any view gives the note's text through
 *   `getViewData()`, which in Reading view follows edits made in other leaves.
 */

import { MarkdownView, type App } from 'obsidian';

/** Set on the note leaf of a statblock pair while the pair lasts (D7); writes prefer that leaf's editor. */
export const PAIRED_LEAF_ATTRIBUTE = 'data-atlas-statblock-pair';

/** Every loaded Markdown view in the workspace, in any window and mode. */
export function loadedMarkdownViews(app: App): MarkdownView[] {
  const views: MarkdownView[] = [];
  app.workspace.iterateAllLeaves((leaf) => {
    // A block body: a truthy return value would stop the iteration.
    if (leaf.view instanceof MarkdownView) views.push(leaf.view);
  });
  return views;
}

/** The loaded Markdown views of a note, in any window and mode. */
export function loadedViewsOf(app: App, path: string): MarkdownView[] {
  return loadedMarkdownViews(app).filter((view) => view.file?.path === path);
}

/** The view whose editor holds the note and takes writes: an editing one, the paired leaf's first; null when none. */
export function editingViewOf(app: App, path: string): MarkdownView | null {
  const editing = loadedViewsOf(app, path).filter(isEditing);
  return editing.find(isPaired) ?? editing[0] ?? null;
}

/** The view to read the note from: an editing one (it holds unsaved typing), else one in Reading view; null when none. */
export function bufferViewOf(app: App, path: string): MarkdownView | null {
  const views = loadedViewsOf(app, path);
  return views.find(isEditing) ?? views[0] ?? null;
}

/** Whether the view's leaf is the note leaf of a pair; `containerEl` is undocumented, so it may be missing. */
function isPaired(view: MarkdownView): boolean {
  const el: HTMLElement | undefined = view.leaf.containerEl;
  return el?.hasAttribute(PAIRED_LEAF_ATTRIBUTE) ?? false;
}

/** Live Preview and Source mode; Obsidian names both `source`. */
function isEditing(view: MarkdownView): boolean {
  return view.getMode() === 'source';
}
