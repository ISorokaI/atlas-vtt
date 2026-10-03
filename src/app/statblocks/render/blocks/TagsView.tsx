import React from 'react';
import type { FieldValue, TagsBlock } from '../../model/templateTypes';
import { isEmptyValue } from '../../values/emptyValue';
import { splitListText } from '../../values/listText';
import { valueText } from '../../values/valueText';
import { StatblockMarkdown } from '../shared/StatblockMarkdown';
import { useSheet } from '../sheetContext';
import { LabelledLine } from '../values/LabelledLine';
import { StandIn, ValueText } from '../values/ValueText';
import type { BlockViewProps } from './blockViewProps';

/** A list field's items; a list written as one line of text is split at its commas. */
function tagItems(value: FieldValue | undefined): string[] {
  if (value === undefined || isEmptyValue(value)) return [];
  if (Array.isArray(value)) return value.map(valueText).filter((text) => text.trim() !== '');
  return splitListText(valueText(value));
}

/** Chips, one per item. */
function Chips({ items }: { items: readonly string[] }): React.JSX.Element {
  const { app, sourcePath } = useSheet();
  return (
    <ul className="atlas-sb-chips">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="atlas-sb-chip">
          <StatblockMarkdown text={item} app={app} sourcePath={sourcePath} />
        </li>
      ))}
    </ul>
  );
}

/** A list as chips, or run in after its label as "Common, Elvish". */
export function TagsView({ block, display }: BlockViewProps<TagsBlock>): React.JSX.Element {
  const { state } = useSheet();
  const label = block.label ?? state.fields.get(block.field)?.label ?? block.field;
  const items = display.state === 'value' ? tagItems(state.reader(block.field)) : [];

  // Chips name themselves; they get a label only where the template gives one.
  if (block.look === 'chips') {
    return (
      <LabelledLine label={block.label ?? ''} look="stacked" className="atlas-sb-tags">
        {display.state === 'value' ? <Chips items={items} /> : <StandIn display={display} />}
      </LabelledLine>
    );
  }
  return (
    <LabelledLine label={label} className="atlas-sb-tags">
      {display.state === 'value' ? <ValueText shown={{ text: items.join(', '), problems: [] }} /> : <StandIn display={display} />}
    </LabelledLine>
  );
}
