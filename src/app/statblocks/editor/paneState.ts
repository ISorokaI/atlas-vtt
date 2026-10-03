/** The statblock pane's view type and the state Obsidian saves for it in the workspace. */

/** Never `atlas-statblock`: that was a removed view's type, and old workspaces may still carry it. */
export const STATBLOCK_PANE_VIEW_TYPE = 'atlas-statblock-editor';

export interface StatblockPaneState {
  /** The statblock note the pane edits; it follows its partner and renames. */
  notePath: string;
  /** Atlas' id of the pair, set as the group of both leaves; the only record left once the group dissolves. */
  pairId: string;
  /** The collection the pane works for (§7.1); null until resolved. */
  collectionId: string | null;
  /** A note to preview with, carried through unchanged. */
  previewPath?: string;
}

/** Ephemeral state `openStatblockEditor` passes: focus the first empty value of the pair it opened. */
export const FOCUS_FIRST_EMPTY = 'atlasFocusFirstEmpty';

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** The pane's state from a saved workspace or a `setViewState` call; null when it names no note or pair. */
export function readPaneState(state: unknown): StatblockPaneState | null {
  if (state === null || typeof state !== 'object') return null;
  const { notePath, pairId, collectionId, previewPath } = state as Record<string, unknown>;
  if (!isText(notePath) || !isText(pairId)) return null;
  return {
    notePath,
    pairId,
    collectionId: isText(collectionId) ? collectionId : null,
    ...(isText(previewPath) ? { previewPath } : {}),
  };
}

/** A new pair id: Atlas' own prefix, the time and a random part, so two pairs never share one. */
export function newPairId(random: () => number = Math.random): string {
  const part = Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0');
  return `atlas-pair-${Date.now().toString(36)}-${part}`;
}
