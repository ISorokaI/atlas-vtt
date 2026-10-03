import React from 'react';
import { rowSizeOf } from '../../../model/blockCatalogue';
import type { TemplateBlock } from '../../../model/templateTypes';
import { boundFieldOf, editBlock } from './blockEdits';
import { isLabelled, type GroupProps, type LabelledBlock } from './groupProps';
import { InspectorGroup } from './InspectorGroup';
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

function ShowLabel({ block, template, session, readOnly }: GroupProps & { block: LabelledBlock }): React.JSX.Element {
  const toggle = (show: boolean): void => {
    const chips = block.type === 'tags' && block.look === 'chips';
    const fieldLabel = boundFieldOf(template, block)?.label;
    const label = show ? (chips ? fieldLabel ?? block.field : undefined) : (chips ? undefined : '');
    editBlock(session, block.id, block.type, { label });
  };
  return <SwitchSetting label="Show label" value={labelShown(block)} onChange={toggle} disabled={readOnly} />;
}

/** The settings of the block's own look, by type. */
function OwnLook(props: GroupProps): React.JSX.Element | null {
  const { block, session, readOnly: disabled } = props;
  switch (block.type) {
    case 'title':
      return <ChoiceSetting label="Level" value={String(block.level) as '1' | '2' | '3'} disabled={disabled}
        options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]}
        onChange={(level) => editBlock(session, block.id, 'title', { level: Number(level) as 1 | 2 | 3 })} />;
    case 'stat':
      return <ChoiceSetting label="Style" value={block.look} disabled={disabled}
        options={[{ value: 'run-in', label: 'Run-in' }, { value: 'stacked', label: 'Stacked' }]}
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
          <ChoiceSetting label="Orientation" value={block.orientation} disabled={disabled}
            options={[{ value: 'row', label: 'Row' }, { value: 'table', label: 'Table' }]}
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
        options={[{ value: 'run-in', label: 'Run-in' }, { value: 'heading', label: 'Heading' }]}
        onChange={(nameStyle) => editBlock(session, block.id, 'entries', { nameStyle: nameStyle === 'run-in' ? undefined : nameStyle })} />;
    case 'image':
      return <ChoiceSetting label="Shape" value={block.shape} disabled={disabled}
        options={[{ value: 'token', label: 'Token' }, { value: 'portrait', label: 'Portrait' }]}
        onChange={(shape) => editBlock(session, block.id, 'image', { shape })} />;
    case 'heading':
      return <ChoiceSetting label="Level" value={block.level} disabled={disabled}
        options={[{ value: 'section', label: 'Section' }, { value: 'minor', label: 'Minor' }]}
        onChange={(level) => editBlock(session, block.id, 'heading', { level })} />;
    case 'section':
      return <ChoiceSetting label="Folds" value={block.collapsible ?? 'no'} disabled={disabled}
        options={[{ value: 'no', label: 'No' }, { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]}
        onChange={(fold) => editBlock(session, block.id, 'section', { collapsible: fold === 'no' ? undefined : fold })} />;
    case 'row':
      return <ChoiceSetting label="Align" value={block.align ?? 'start'} disabled={disabled}
        options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }, { value: 'spread', label: 'Spread' }]}
        onChange={(align) => editBlock(session, block.id, 'row', { align: align === 'start' ? undefined : align })} />;
    default:
      return null;
  }
}

/** Inside a Row: whether the block takes the width it needs or shares what is left. */
function SizeInRow({ block, session, disabled }: { block: TemplateBlock; session: EditorSession; disabled: boolean }): React.JSX.Element {
  return <ChoiceSetting label="In the row" value={rowSizeOf(block)} disabled={disabled}
    options={[{ value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' }]}
    onChange={(size) => editBlock(session, block.id, block.type, { size })} />;
}

function hasOwnLook(block: TemplateBlock): boolean {
  return !['line', 'text', 'spells', 'pairs', 'divider', 'script', 'opaque'].includes(block.type) || isLabelled(block);
}

/** Look (§7.4): style, run-in or stacked, the label, orientation and columns, chips or a list, boxes or a gauge. */
export function LookGroup(props: GroupProps): React.JSX.Element | null {
  const { block, parent, session, readOnly } = props;
  const inRow = parent?.type === 'row';
  if (!hasOwnLook(block) && !inRow) return null;
  return (
    <InspectorGroup id="look" title="Look">
      <OwnLook {...props} />
      {isLabelled(block) && <ShowLabel {...props} block={block} />}
      {inRow && <SizeInRow block={block} session={session} disabled={readOnly} />}
    </InspectorGroup>
  );
}
