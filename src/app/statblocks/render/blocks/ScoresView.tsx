import React from 'react';
import type { ScoreColumn, ScoresBlock } from '../../model/templateTypes';
import { useSheet } from '../sheetContext';
import { ProblemMarker } from '../values/ProblemMarker';
import { scoreGroups, scoreSlots, type ScoreSlot } from '../values/scoreSlots';
import type { ShownText } from '../values/shownText';
import { StandIn } from '../values/ValueText';
import type { BlockViewProps } from './blockViewProps';

type GridStyle = React.CSSProperties & Record<`--${string}`, number>;

/** A number in a score grid; scores and modifiers are not dice to roll. */
function Cell({ shown, className }: { shown: ShownText; className: string }): React.JSX.Element {
  return (
    <span className={className}>
      {shown.text}
      {shown.problems.length > 0 && <ProblemMarker problems={shown.problems} />}
    </span>
  );
}

/** Labels over scores, each column's values in a row below ("18" over "+4"). */
function ScoresRow({ slots, columns }: { slots: readonly ScoreSlot[]; columns: readonly ScoreColumn[] }): React.JSX.Element {
  const labelled = columns.some((column) => column.label?.trim());
  const style: GridStyle = { '--atlas-sb-score-slots': slots.length };
  return (
    <div className={`atlas-sb-scores atlas-sb-scores--row${labelled ? ' atlas-sb-scores--labelled' : ''}`} style={style}>
      {labelled && <span className="atlas-sb-score-corner" />}
      {slots.map((slot, index) => <span key={`label-${index}`} className="atlas-sb-score-label">{slot.label}</span>)}
      {labelled && <span className="atlas-sb-score-corner" />}
      {slots.map((slot, index) => <Cell key={`score-${index}`} shown={slot.score} className="atlas-sb-score" />)}
      {columns.map((column, columnIndex) => (
        <React.Fragment key={`column-${columnIndex}`}>
          {labelled && <span className="atlas-sb-score-column-label">{column.label ?? ''}</span>}
          {slots.map((slot, index) => (
            <Cell key={index} shown={slot.columns[columnIndex] ?? { text: '', problems: [] }} className="atlas-sb-score-column" />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

/** One group of the table: a header of column labels, then "Str 21 +5 +5" per slot. */
function ScoreGroup({ slots, columns }: { slots: readonly ScoreSlot[]; columns: readonly ScoreColumn[] }): React.JSX.Element {
  const labelled = columns.some((column) => column.label?.trim());
  return (
    <table className="atlas-sb-score-group">
      {labelled && (
        <thead>
          <tr>
            <td className="atlas-sb-score-corner" colSpan={2} />
            {columns.map((column, index) => <th key={index} scope="col" className="atlas-sb-score-column-label">{column.label ?? ''}</th>)}
          </tr>
        </thead>
      )}
      <tbody>
        {slots.map((slot, index) => (
          <tr key={`${slot.label}-${index}`}>
            <th scope="row" className="atlas-sb-score-label">{slot.label}</th>
            <td><Cell shown={slot.score} className="atlas-sb-score" /></td>
            {slot.columns.map((shown, columnIndex) => (
              <td key={columnIndex}><Cell shown={shown} className="atlas-sb-score-column" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ability scores and the like: a row of labelled values, or a table of up to `perLine` groups side by side. */
export function ScoresView({ block, display }: BlockViewProps<ScoresBlock>): React.JSX.Element {
  const { state } = useSheet();
  if (display.state !== 'value') return <StandIn display={display} />;

  const slots = scoreSlots(block, state);
  if (!slots.length) return <></>;
  const columns = block.columns ?? [];
  if (block.orientation === 'row') return <ScoresRow slots={slots} columns={columns} />;

  const style: GridStyle = { '--atlas-sb-score-columns': columns.length };
  return (
    <div className="atlas-sb-scores atlas-sb-scores--table" style={style}>
      {scoreGroups(slots, block.perLine).map((group, index) => <ScoreGroup key={index} slots={group} columns={columns} />)}
    </div>
  );
}
