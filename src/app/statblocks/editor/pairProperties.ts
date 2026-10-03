import type { WorkspaceLeaf } from 'obsidian';
import { PAIRED_LEAF_ATTRIBUTE } from '../notes/openEditors';
import './pair-properties.scss';

/** On the note leaf of a statblock pair while its Properties are hidden; its value is the pair id (D7). The writer reads the same mark. */
export const PAIR_ATTRIBUTE = PAIRED_LEAF_ATTRIBUTE;

/**
 * The leaf's own element (`div.workspace-leaf`), which keeps the attribute
 * while the leaf navigates, changes view or moves to a popout. Undocumented:
 * without it Properties simply stay shown.
 */
function leafElement(leaf: WorkspaceLeaf): HTMLElement | null {
  const el: unknown = leaf.containerEl;
  return el !== null && typeof el === 'object' && 'setAttribute' in el && 'removeAttribute' in el ? (el as HTMLElement) : null;
}

/** Whether the leaf carries this pair's mark. */
export function isLeafMarked(leaf: WorkspaceLeaf, pairId: string): boolean {
  return leafElement(leaf)?.getAttribute(PAIR_ATTRIBUTE) === pairId;
}

/**
 * Hides or shows the Properties of a pair's note leaf. A static rule in Atlas'
 * stylesheet reads the attribute (pair-properties.scss); nothing is generated
 * at runtime and no key is named. Only this pair's own mark is ever removed.
 */
export function markPairedLeaf(leaf: WorkspaceLeaf, pairId: string, hide: boolean): void {
  const el = leafElement(leaf);
  if (!el) return;
  if (hide) el.setAttribute(PAIR_ATTRIBUTE, pairId);
  else if (el.getAttribute(PAIR_ATTRIBUTE) === pairId) el.removeAttribute(PAIR_ATTRIBUTE);
}

/**
 * The one leaf a pane marks. It follows the partner: a partner that changes
 * (closed, unlinked, replaced) loses the mark before the new one gets it.
 */
export class PairPropertiesMark {
  private marked: WorkspaceLeaf | null = null;

  constructor(private readonly pairId: string) {}

  /** Marks `partner` while `hide`; unmarks whatever it marked before. */
  update(partner: WorkspaceLeaf | null, hide: boolean): void {
    const next = hide ? partner : null;
    if (this.marked && this.marked !== next) markPairedLeaf(this.marked, this.pairId, false);
    if (next) markPairedLeaf(next, this.pairId, true);
    this.marked = next;
  }

  /** Shows the Properties again; called when the pane closes. */
  release(): void {
    this.update(null, false);
  }
}
