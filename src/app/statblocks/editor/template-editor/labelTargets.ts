/**
 * What a block's label is in the template editor (§7.6): the words the
 * template writes beside the values, edited in place. A block that binds a
 * field but has none yet takes its first label as the name of a new field.
 */

import { blockSpec } from '../../model/blockCatalogue';
import { fieldByKey } from '../../model/fieldKeys';
import { boundField } from '../../model/treeQueries';
import type { TemplateBlock, TemplateField } from '../../model/templateTypes';

export type LabelKind =
  /** A Stat's, Tags', Pairs' or Track's label: the field's, or the block's own. */
  | 'label'
  /** The heading of a Section, Entries, Spells or Text block. */
  | 'heading'
  /** A Heading block's text. */
  | 'text'
  /** A block not bound yet: the label names the field it gets. */
  | 'new-field';

export interface LabelTarget {
  kind: LabelKind;
  /** What the input starts with; selected, so typing replaces it. */
  text: string;
}

/** Whether the block shows no field yet; the renderer's rule (`blockDisplay`). */
export function isUnboundBlock(block: TemplateBlock): boolean {
  if (block.type === 'text') return !block.field && !block.text?.trim();
  return blockSpec(block.type).binds.length > 0 && !boundField(block);
}

/** The label a block offers to edit, or null where it has none (a Row, a Divider, a bound Title). */
export function labelTargetOf(block: TemplateBlock, fields: readonly TemplateField[]): LabelTarget | null {
  if (isUnboundBlock(block)) return { kind: 'new-field', text: blockSpec(block.type).label };
  if (block.type === 'heading') return { kind: 'text', text: block.text };
  if (block.type === 'section') return block.headingField ? null : { kind: 'heading', text: block.heading ?? '' };
  if (block.type === 'entries' || block.type === 'spells' || block.type === 'text') return { kind: 'heading', text: block.heading ?? '' };
  if (block.type === 'stat' || block.type === 'tags' || block.type === 'pairs' || block.type === 'track') {
    const key = boundField(block);
    const field = key ? fieldByKey(fields, key) : undefined;
    return { kind: 'label', text: block.label ?? field?.label ?? key ?? '' };
  }
  return null;
}

/** Where the label's text stands in the card, for each kind; the first match is used. */
const LABEL_SELECTORS: Readonly<Record<LabelKind, readonly string[]>> = {
  label: ['.atlas-sb-label', '.atlas-sb-prompt'],
  heading: ['.atlas-sb-section-heading'],
  text: ['.atlas-sb-section-heading'],
  'new-field': ['.atlas-sb-prompt', '.atlas-sb-label', '.atlas-sb-value'],
};

/** An element of the block's own, not of a block nested in it. */
function ownElement(frame: HTMLElement, selector: string): HTMLElement | null {
  for (const element of frame.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest('[data-block-id]') === frame) return element;
  }
  return null;
}

/** The element the label input stands over; the frame itself where the label is not drawn (an empty heading). */
export function labelElement(frame: HTMLElement, kind: LabelKind): HTMLElement {
  for (const selector of LABEL_SELECTORS[kind]) {
    const element = ownElement(frame, selector);
    if (element) return element;
  }
  return frame;
}
