import React from 'react';
import type { FieldValue, SpellsBlock } from '../../model/templateTypes';
import { toFieldValue } from '../../values/fieldValueOf';
import { valueText } from '../../values/valueText';
import { spellGroups } from '../shared/spellGroups';
import { StatblockMarkdown } from '../shared/StatblockMarkdown';
import { useSheet } from '../sheetContext';
import { SheetHeading } from '../values/SheetHeading';
import { StandIn } from '../values/ValueText';
import type { BlockViewProps } from './blockViewProps';

/** A spells value as Fantasy Statblocks writes it: a list, or a record of level lines, or one line. */
function spellEntries(value: FieldValue | undefined): FieldValue[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.entries(value).map(([level, spells]): FieldValue => ({ [level]: spells }));
  return [value];
}

/** Spell lists grouped under their header lines, each line led by its level. */
export function SpellsView({ block, display }: BlockViewProps<SpellsBlock>): React.JSX.Element {
  const { state, app, sourcePath } = useSheet();
  const name = valueText(state.reader('name')) || 'The creature';
  const groups = display.state === 'value'
    ? spellGroups(spellEntries(state.reader(block.field)), `${name} knows the following spells:`, (value) => valueText(toFieldValue(value)))
    : [];

  return (
    <div className="atlas-sb-spells-block">
      {block.heading?.trim() && <SheetHeading>{block.heading}</SheetHeading>}
      {display.state !== 'value' && <StandIn display={display} />}
      {groups.map((group, groupIndex) => (
        <div key={`${group.header}-${groupIndex}`} className="atlas-sb-spell-group">
          <div className="atlas-sb-spell-header">
            <StatblockMarkdown text={group.header} app={app} sourcePath={sourcePath} />
          </div>
          <ul className="atlas-sb-spell-list">
            {group.spells.map((spell, index) => (
              <li key={`${spell.level ?? ''}-${index}`}>
                {spell.level && <span className="atlas-sb-spell-level">{spell.level}: </span>}
                <StatblockMarkdown text={spell.spells} app={app} sourcePath={sourcePath} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
