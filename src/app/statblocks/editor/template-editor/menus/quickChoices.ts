/**
 * A block menu's quick choices (spec §5.3): the one-click versions of the
 * settings that change a block's look most, each a submenu of choices with a
 * tick on the one in use. Each choice is one session step.
 */

import type { TemplateBlock } from '../../../model/templateTypes';
import type { SurfaceAction } from '../../interaction/surfaceActions';
import { editBlock } from '../inspector/blockEdits';
import type { EditorSession } from '../sessionTypes';

interface Choice<V extends string> {
  value: V;
  label: string;
}

function choices<V extends string>(id: string, label: string, current: V, options: ReadonlyArray<Choice<V>>, pick: (value: V) => void): SurfaceAction {
  return {
    kind: 'submenu',
    id,
    label,
    children: options.map((option) => ({
      kind: 'item', id: `${id}-${option.value}`, label: option.label, checked: option.value === current, run: () => pick(option.value),
    })),
  };
}

/** The quick choices of a block, most used first; at most two. */
export function quickChoices(session: EditorSession, block: TemplateBlock): SurfaceAction[] {
  const id = block.id;
  switch (block.type) {
    case 'section':
      return [choices('folds', 'Folds', block.collapsible ?? 'no', [
        { value: 'no', label: 'No' }, { value: 'open', label: 'Starts open' }, { value: 'closed', label: 'Starts closed' },
      ], (fold) => editBlock(session, id, 'section', { collapsible: fold === 'no' ? undefined : fold }))];
    case 'row':
      return [choices('align', 'Align', block.align ?? 'start', [
        { value: 'start', label: 'Start' }, { value: 'center', label: 'Centre' }, { value: 'spread', label: 'Spread' },
      ], (align) => editBlock(session, id, 'row', { align: align === 'start' ? undefined : align }))];
    case 'title':
      return [choices('size', 'Size', String(block.level) as '1' | '2' | '3', [
        { value: '1', label: 'Large' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Small' },
      ], (level) => editBlock(session, id, 'title', { level: Number(level) as 1 | 2 | 3 }))];
    case 'stat':
      return [choices('style', 'Style', block.look, [
        { value: 'run-in', label: 'Label first' }, { value: 'stacked', label: 'Label above' },
      ], (look) => editBlock(session, id, 'stat', { look }))];
    case 'scores':
      return [choices('layout', 'Layout', block.orientation, [
        { value: 'row', label: 'One row' }, { value: 'table', label: 'Table' },
      ], (orientation) => editBlock(session, id, 'scores', { orientation }))];
    case 'tags':
      return [choices('style', 'Style', block.look, [
        { value: 'comma', label: 'Comma list' }, { value: 'chips', label: 'Chips' },
      ], (look) => editBlock(session, id, 'tags', { look }))];
    case 'entries':
      return [choices('names', 'Names', block.nameStyle ?? 'run-in', [
        { value: 'run-in', label: 'Run-in' }, { value: 'heading', label: 'As headings' },
      ], (nameStyle) => editBlock(session, id, 'entries', { nameStyle: nameStyle === 'run-in' ? undefined : nameStyle }))];
    case 'pairs':
      return [choices('numbers', 'Numbers', block.display ?? 'plain', [
        { value: 'plain', label: '3' }, { value: 'signed', label: '+3' },
      ], (display) => editBlock(session, id, 'pairs', { display: display === 'plain' ? undefined : display }))];
    case 'track':
      return [
        choices('style', 'Style', block.look, [{ value: 'boxes', label: 'Boxes' }, { value: 'gauge', label: 'Gauge' }],
          (look) => editBlock(session, id, 'track', { look })),
        choices('counts', 'Counts', block.counts, [{ value: 'down', label: 'Down' }, { value: 'up', label: 'Up' }],
          (counts) => editBlock(session, id, 'track', { counts })),
      ];
    case 'image':
      return [choices('shape', 'Shape', block.shape, [{ value: 'token', label: 'Token' }, { value: 'portrait', label: 'Portrait' }],
        (shape) => editBlock(session, id, 'image', { shape }))];
    case 'heading':
      return [choices('size', 'Size', block.level, [{ value: 'section', label: 'Section' }, { value: 'minor', label: 'Minor' }],
        (level) => editBlock(session, id, 'heading', { level }))];
    default:
      return [];
  }
}
