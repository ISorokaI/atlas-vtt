import React from 'react';
import { rowSizeOf } from '../../../model/blockCatalogue';
import type { TemplateBlock } from '../../../model/templateTypes';
import { boundFieldOf, editBlock } from './blockEdits';
import type { GroupProps, LabelledBlock } from './groupProps';
import { ChoiceSetting, SelectSetting, SwitchSetting } from './InspectorControls';
import { ScoreColumns } from './ScoreColumns';
import type { EditorSession } from '../sessionTypes';

/** Slots side by side in a Scores table. */
const PER_LINE = ['1', '2', '3', '4', '5', '6'] as const;

/**
 * Whether a labelled block shows its label. An empty label hides it; chips
 * show one only where the template gives one (`TagsView`).
 */
function labelShown(block: LabelledBlock): boolean {
  if (block.type === 'tags' && block.look === 'chips') return Boolean(block.label);
  return block.label !== '';
}

export function ShowLabel({ block, template, session, readOnly }: GroupProps & { block: LabelledBlock }): React.JSX.Element {
  const toggle = (show: boolean): void => {
    const chips = block.type === 'tags' && block.look === 'chips';
    const fieldLabel = boundFieldOf(template, block)?.label;
    const label = show ? (chips ? fieldLabel ?? block.field : undefined) : (chips ? undefined : '');
    editBlock(session, block.id, block.type, { label });
  };
  return <SwitchSetting label="Show label" value={labelShown(block)} onChange={toggle} disabled={readOnly} />;
}

/** The settings of the block's own look, by type. */
export function OwnLook(props: GroupProps): React.JSX.Element | null {
  const { block, session, readOnly: disabled } = props;
  switch (block.type) {
    case 'title':
      return <ChoiceSetting label="Size" value={String(block.level) as '1' | '2' | '3'} disabled={disabled}
        options={[{ value: '1', label: 'Large' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Small' }]}
        onChange={(level) => editBlock(session, block.id, 'title', { level: Number(level) as 1 | 2 | 3 })} />;
    case 'stat':
      return <ChoiceSetting label="Style" value={block.look} disabled={disabled}
        options={[{ value: 'run-in', label: 'Label first' }, { value: 'stacked', label: 'Label above' }]}
        onChange={(look) => editBlock(session, block.id, 'stat', { look })} />;
    case 'tags':
      return <ChoiceSetting label="Style" value={block.look} disabled={disabled}
        options={[{ value: 'comma', label: 'Comma list' }, { value: 'chips', label: 'Chips' }]}
        onChange={(look) => editBlock(session, block.id, 'tags', { look })} />;
    case 'track':
      return (
        <>
          <ChoiceSetting label="Style" value={block.look} disabled={disabled}
            options={[{ value: 'boxes', label: 'Boxes' }, { value: 'gauge', label: 'Gauge' }]}
            onChange={(look) => editBlock(session, block.id, 'track', { look })} />
          <ChoiceSetting label="Counts" value={block.counts} disabled={disabled}
            options={[{ value: 'down', label: 'Down' }, { value: 'up', label: 'Up' }]}
            onChange={(counts) => editBlock(session, block.id, 'track', { counts })} />
        </>
      );
    case 'scores':
      return (
        <>
          <ChoiceSetting label="Layout" value={block.orientation} disabled={disabled}
            options={[{ value: 'row', label: 'One row' }, { value: 'table', label: 'Table' }]}
            onChange={(orientation) => editBlock(session, block.id, 'scores', { orientation })} />
          {block.orientation === 'table' && (
            <SelectSetting label="Per line" value={String(block.perLine ?? 1)} disabled={disabled}
              options={PER_LINE.map((count) => ({ value: count, label: count === '1' ? '1 slot' : `${count} slots` }))}
              onChange={(count) => editBlock(session, block.id, 'scores', { perLine: count === '1' ? undefined : Number(count) })} />
          )}
          <ScoreColumns {...props} block={block} />
        </>
      );
    case 'entries':
      return <ChoiceSetting label="Names" value={block.nameStyle ?? 'run-in'} disabled={disabled}
        options={[{ value: 'run-in', label: 'Run-in' }, { value: 'heading', label: 'As headings' }]}
        onChange={(nameStyle) => editBlock(session, block.id, 'entries', { nameStyle: nameStyle === 'run-in' ? undefined : nameStyle })} />;
    case 'spells':
      return <ChoiceSetting label="Levels" value={block.look ?? 'lines'} disabled={disabled}
        options={[{ value: 'lines', label: 'Lines' }, { value: 'tabs', label: 'Tabs' }]}
        onChange={(look) => editBlock(session, block.id, 'spells', { look: look === 'lines' ? undefined : look })} />;
    case 'image':
      return <ChoiceSetting label="Shape" value={block.shape} disabled={disabled}
        options={[{ value: 'token', label: 'Token' }, { value: 'portrait', label: 'Portrait' }]}
        onChange={(shape) => editBlock(session, block.id, 'image', { shape })} />;
    case 'heading':
      return <ChoiceSetting label="Size" value={block.level} disabled={disabled}
        options={[{ value: 'section', label: 'Section' }, { value: 'minor', label: 'Minor' }]}
        onChange={(level) => editBlock(session, block.id, 'heading', { level })} />;
    case 'section':
      return <ChoiceSetting label="Folds" value={block.collapsible ?? 'no'} disabled={disabled}
        options={[{ value: 'no', label: 'No' }, { value: 'open', label: 'Starts open' }, { value: 'closed', label: 'Starts closed' }]}
        onChange={(fold) => editBlock(session, block.id, 'section', { collapsible: fold === 'no' ? undefined : fold })} />;
    case 'row':
      return <ChoiceSetting label="Align" value={block.align ?? 'start'} disabled={disabled}
        options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Centre' }, { value: 'spread', label: 'Spread' }]}
        onChange={(align) => editBlock(session, block.id, 'row', { align: align === 'start' ? undefined : align })} />;
    default:
      return null;
  }
}

/** Inside a Row: whether the block takes the width it needs or shares what is left. */
export function SizeInRow({ block, session, disabled }: { block: TemplateBlock; session: EditorSession; disabled: boolean }): React.JSX.Element {
  return <ChoiceSetting label="Width in the row" value={rowSizeOf(block)} disabled={disabled}
    options={[{ value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' }]}
    onChange={(size) => editBlock(session, block.id, block.type, { size })} />;
}
