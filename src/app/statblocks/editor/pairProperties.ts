import type { WorkspaceLeaf } from 'obsidian';
import { PAIRED_LEAF_ATTRIBUTE } from '../notes/openEditors';
import './pair-properties.scss';

/** On the note leaf of a statblock pair while its Properties are hidden; its value is the pair id (D7). The writer reads the same mark. */
export const PAIR_ATTRIBUTE = PAIRED_LEAF_ATTRIBUTE;
/** On the note leaf of a statblock pair while the pane draws its statblock, native or not; its value is the pair id (D14). */
export const BESIDE_ATTRIBUTE = 'data-atlas-statblock-beside';

/** What a pane marks on its note leaf. */
export interface PairMarks {
  /** Properties hide: beside a native statblock, whose tray edits what they would show (D7). */
  hideProperties: boolean;
  /** The pane draws the note's statblock, so the note's `atlas-statblock` fence shrinks to one line (D14). */
  shownBeside: boolean;
}

const NO_MARKS: PairMarks = { hideProperties: false, shownBeside: false };

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
export function markPairedLeaf(leaf: WorkspaceLeaf, pairId: string, hide: boolean, attribute: string = PAIR_ATTRIBUTE): void {
  const el = leafElement(leaf);
  if (!el) return;
  if (hide) el.setAttribute(attribute, pairId);
  else if (el.getAttribute(attribute) === pairId) el.removeAttribute(attribute);
}

/**
 * The one leaf a pane marks. It follows the partner: a partner that changes
 * (closed, unlinked, replaced) loses the marks before the new one gets them.
 */
export class PairPropertiesMark {
  private marked: WorkspaceLeaf | null = null;

  constructor(private readonly pairId: string) {}

  /** Marks `partner` with what `marks` asks for; unmarks whatever it marked before. */
  update(partner: WorkspaceLeaf | null, marks: PairMarks): void {
    const next = marks.hideProperties || marks.shownBeside ? partner : null;
    if (this.marked && this.marked !== next) this.apply(this.marked, NO_MARKS);
    if (next) this.apply(next, marks);
    this.marked = next;
  }

  /** Shows the Properties and the note's fence again; called when the pane closes. */
  release(): void {
    this.update(null, NO_MARKS);
  }

  private apply(leaf: WorkspaceLeaf, marks: PairMarks): void {
    markPairedLeaf(leaf, this.pairId, marks.hideProperties);
    markPairedLeaf(leaf, this.pairId, marks.shownBeside, BESIDE_ATTRIBUTE);
  }
}
