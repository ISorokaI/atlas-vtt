import type { App, EventRef, TFile, WorkspaceLeaf } from 'obsidian';

/** What a pane knows of the note leaf it is paired with. */
export interface PartnerInfo {
  /** The pair's other leaf; null once the pair is over (the note closed, a tab header's link icon unlinked it). */
  leaf: WorkspaceLeaf | null;
  /** The note it shows, from its view state, which a deferred leaf has too; null for a leaf that shows no note. */
  path: string | null;
}

/** The note a leaf shows, read from its view state so that a deferred leaf (no view yet) answers too. */
export function leafNotePath(leaf: WorkspaceLeaf): string | null {
  const state = leaf.getViewState();
  const file = state.state?.file;
  return state.type === 'markdown' && typeof file === 'string' ? file : null;
}

/**
 * The pair's other leaf. Obsidian keeps no group of one: once the partner
 * closes or is unlinked, `getGroupLeaves` finds neither leaf, and the pair id
 * in the pane's own state is all that is left of the pair.
 */
export function findPartner(app: App, pairId: string, self: WorkspaceLeaf): WorkspaceLeaf | null {
  return app.workspace.getGroupLeaves(pairId).find((leaf) => leaf !== self) ?? null;
}

export function partnerInfo(app: App, pairId: string, self: WorkspaceLeaf): PartnerInfo {
  const leaf = findPartner(app, pairId, self);
  return { leaf, path: leaf ? leafNotePath(leaf) : null };
}

/**
 * Follows a pane's partner and calls `onChange` when the partner leaf or the
 * note it shows changes. `file-open` fires only for the active leaf, so a
 * partner that navigates while the pane has focus (or through a third leaf
 * of the group) shows only in `layout-change`; both are followed, and
 * `file-open` without a file (a leaf with no note became active) is ignored.
 */
export function trackPartner(app: App, self: WorkspaceLeaf, pairId: string, onChange: (info: PartnerInfo) => void): () => void {
  let last = partnerInfo(app, pairId, self);
  const check = (): void => {
    const next = partnerInfo(app, pairId, self);
    if (next.leaf === last.leaf && next.path === last.path) return;
    last = next;
    onChange(next);
  };
  const { workspace } = app;
  const refs: EventRef[] = [
    workspace.on('layout-change', check),
    workspace.on('active-leaf-change', check),
    workspace.on('file-open', (file: TFile | null) => {
      if (file) check();
    }),
  ];
  // The pane's own leaf joining or leaving a group (pairing, a tab header's link icon).
  const groupRef = self.on('group-change', check);
  return () => {
    for (const ref of refs) workspace.offref(ref);
    self.offref(groupRef);
  };
}
