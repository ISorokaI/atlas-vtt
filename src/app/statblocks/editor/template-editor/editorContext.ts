import { createContext, useContext } from 'react';
import type { App } from 'obsidian';
import type { InsertItem } from './insertItems';
import type { BlockSelection } from './selection';
import type { EditorSession, SessionSnapshot } from './sessionTypes';
import type { CollectionFieldKeys } from './useCollectionFieldKeys';

/** Below this width of the view the left pane folds into a rail and the inspector into a popover (§7.4). */
export const NARROW_EDITOR_WIDTH = 900;

/**
 * What the template editor shares with the parts that sit beside the canvas:
 * the left pane (Blocks, Outline, Fields) and the inspector, which read and
 * change the same session and the same selection.
 */
export interface TemplateEditorContextValue {
  app: App | undefined;
  session: EditorSession;
  snapshot: SessionSnapshot;
  selection: BlockSelection;
  /** Selects blocks; focus moves to the primary one in the canvas when `focus` is set. */
  select: (selection: BlockSelection, focus?: boolean) => void;
  /** Inserts a block or recipe after the selection, selects it and opens its label (§7.6). */
  insert: (item: InsertItem) => void;
  /** Opens a block's label for editing in the canvas. */
  editLabel: (id: string) => void;
  /** Says something in the view's live region. */
  announce: (text: string) => void;
  /** The collection context (§7.1): its notes' keys, its roles in questions. */
  collectionId: string | null;
  collectionKeys: CollectionFieldKeys;
  /** `narrow` below `NARROW_EDITOR_WIDTH`. */
  layout: 'wide' | 'narrow';
}

export const TemplateEditorContext = createContext<TemplateEditorContextValue | null>(null);

/** The template editor around a part; only parts rendered inside `TemplateEditor` may ask. */
export function useTemplateEditor(): TemplateEditorContextValue {
  const editor = useContext(TemplateEditorContext);
  if (!editor) throw new Error('A template editor part was rendered outside TemplateEditor.');
  return editor;
}
