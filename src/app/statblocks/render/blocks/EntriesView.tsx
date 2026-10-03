import React from 'react';
import type { EntriesBlock, EntryShape, FieldValue } from '../../model/templateTypes';
import { entryExtras, entryItems, entryName, entryText } from '../../values/entryValues';
import { valueText } from '../../values/valueText';
import { EntryLine } from '../shared/EntryLine';
import { useSheet } from '../sheetContext';
import { SheetHeading } from '../values/SheetHeading';
import { StandIn, ValueText } from '../values/ValueText';
import { ValueSlot } from '../valueSlot';
import type { BlockViewProps } from './blockViewProps';

/** An entry's labelled parts before its text: "Range 30 ft. Cost 2". */
function EntryExtras({ entry, shape }: { entry: FieldValue; shape: EntryShape | undefined }): React.JSX.Element | null {
  const extras = entryExtras(entry, shape);
  if (!extras.length) return null;
  return (
    <span className="atlas-sb-entry-extras">
      {extras.map((extra) => (
        <span key={extra.key} className="atlas-sb-entry-extra">
          <span className="atlas-sb-entry-extra-label">{extra.label}</span> {valueText(extra.value)}
        </span>
      ))}
    </span>
  );
}

/** A list of traits or actions under its heading: "***Claws.*** Melee Attack Roll: +5…". */
export function EntriesView({ block, display }: BlockViewProps<EntriesBlock>): React.JSX.Element {
  const { state, app, sourcePath } = useSheet();
  const shape = state.fields.get(block.field)?.entry;
  const entries = display.state === 'value' ? entryItems(state.reader(block.field)) : [];
  const intro = block.introField && display.state === 'value' ? valueText(state.reader(block.introField)) : '';

  return (
    <div className="atlas-sb-entries">
      {block.heading?.trim() && <SheetHeading>{block.heading}</SheetHeading>}
      {intro.trim() && (
        <div className="atlas-sb-entries-intro">
          <ValueText shown={{ text: intro, problems: [] }} />
        </div>
      )}
      <ValueSlot block={block}>
        {display.state !== 'value' && <StandIn display={display} />}
        {entries.map((entry, index) => (
          <EntryLine
            key={`${entryName(entry, shape) ?? 'entry'}-${index}`}
            name={entryName(entry, shape)}
            text={entryText(entry, shape) ?? ''}
            app={app}
            sourcePath={sourcePath}
            nameStyle={block.nameStyle ?? 'run-in'}
          >
            <EntryExtras entry={entry} shape={shape} />
          </EntryLine>
        ))}
      </ValueSlot>
    </div>
  );
}
