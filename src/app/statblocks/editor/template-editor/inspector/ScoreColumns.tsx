import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../../../packages/components/primitives/button';
import { ToolButton } from '../../../../packages/components/primitives/ToolButton';
import { isExpressionError } from '../../../expressions/errors';
import { parseFormula } from '../../../expressions/parse';
import { MODIFIER_FORMULA } from '../../../model/scoreFormulas';
import { findBlock } from '../../../model/treeQueries';
import type { ScoreColumn, ScoresBlock, StatblockTemplate } from '../../../model/templateTypes';
import { withBlockChanges } from './blockEdits';
import { FieldSetting } from './FieldSetting';
import type { GroupProps } from './groupProps';
import { ChoiceSetting, SelectSetting, TextSetting } from './InspectorControls';

/** What a column reads per slot (§7.5): the modifier, a pairs field's entry falling back to it, or a formula of its own. */
type ColumnKind = 'modifier' | 'field' | 'formula';

const KINDS: Array<{ value: ColumnKind; label: string }> = [
  { value: 'modifier', label: 'Modifier' },
  { value: 'field', label: 'A property, else modifier' },
  { value: 'formula', label: 'Formula' },
];

/** What is wrong with a typed formula, in plain words. */
function formulaProblem(text: string): string | null {
  if (!text.trim()) return `Type a formula, like ${MODIFIER_FORMULA}.`;
  const parsed = parseFormula(text);
  return isExpressionError(parsed) ? parsed.message : null;
}

function kindOf(column: ScoreColumn): ColumnKind {
  if (column.field !== undefined) return 'field';
  return column.formula?.replace(/\s+/g, '') === MODIFIER_FORMULA.replace(/\s+/g, '') ? 'modifier' : 'formula';
}

/** The template with the Scores block's columns changed by `edit`, read from the block as the template holds it now. */
function withColumns(template: StatblockTemplate, id: string, edit: (columns: ScoreColumn[]) => ScoreColumn[]): StatblockTemplate {
  const found = findBlock(template.layout.blocks, id)?.block;
  if (found?.type !== 'scores') return template;
  const columns = edit([...(found.columns ?? [])]);
  return withBlockChanges(template, id, 'scores', { columns: columns.length > 0 ? columns : undefined });
}

/** A copy of the column without one of its settings. */
function without(column: ScoreColumn, key: keyof ScoreColumn): ScoreColumn {
  const copy = { ...column };
  delete copy[key];
  return copy;
}

/** A column that reads the modifier again: its field goes, its label and display stay. */
function asModifier(column: ScoreColumn): ScoreColumn {
  return { ...without(without(column, 'field'), 'formula'), formula: MODIFIER_FORMULA };
}

interface ColumnProps extends GroupProps {
  block: ScoresBlock;
  column: ScoreColumn;
  index: number;
}

function ColumnCard({ block, column, index, session, readOnly }: ColumnProps): React.JSX.Element {
  const change = (next: (column: ScoreColumn) => ScoreColumn): void => session.apply((template) =>
    withColumns(template, block.id, (columns) => columns.map((item, at) => (at === index ? next(item) : item))));
  // "Field" holds no field and "Formula" the modifier until the author picks or types one.
  const [chosen, setChosen] = useState<ColumnKind | null>(null);
  const kind = chosen ?? kindOf(column);
  return (
    <div className="atlas-te-column atlas-te-span">
      <TextSetting label="Label" value={column.label ?? ''} session={session} disabled={readOnly} placeholder="Mod"
        onText={(text) => change((item) => (text ? { ...item, label: text } : without(item, 'label')))} />
      <SelectSetting<ColumnKind> label="Reads" value={kind} options={KINDS} disabled={readOnly}
        onChange={(next) => {
          setChosen(next === 'modifier' ? null : next);
          if (next === 'modifier') change(asModifier);
          else if (next === 'formula') change((item) => without(item, 'field'));
        }} />
      {kind === 'field' && (
        <FieldSetting value={column.field ?? null} accepts={['pairs']} newType="pairs" session={session} disabled={readOnly}
          onBind={(template, key) => withColumns(template, block.id, (columns) =>
            columns.map((item, at) => (at === index ? { ...item, field: key } : item)))} />
      )}
      {kind === 'formula' && (
        <TextSetting label="Formula" value={column.formula ?? ''} session={session} disabled={readOnly} code
          check={formulaProblem}
          onText={(text) => change((item) => ({ ...item, formula: text }))} />
      )}
      <ChoiceSetting label="Shows" value={column.display ?? 'plain'} disabled={readOnly}
        options={[{ value: 'plain', label: 'Plain' }, { value: 'signed', label: 'Signed' }]}
        onChange={(display) => change((item) => (display === 'plain' ? without(item, 'display') : { ...item, display }))} />
      <div className="atlas-te-column__remove atlas-te-span">
        <ToolButton icon={X} label="Remove column" isActive={false} disabled={readOnly}
          onClick={() => session.apply((template) => withColumns(template, block.id, (columns) => columns.filter((_, at) => at !== index)))} />
      </div>
    </div>
  );
}

/** A Scores block's columns after the score: a modifier, a save from a pairs field, a formula. */
export function ScoreColumns(props: GroupProps & { block: ScoresBlock }): React.JSX.Element {
  const { block, session, readOnly } = props;
  const columns = block.columns ?? [];
  return (
    <>
      {columns.map((column, index) => (
        // Columns have no ids; a column is its place in the list.
        <ColumnCard key={index} {...props} column={column} index={index} />
      ))}
      <Button type="button" variant="ghost" size="sm" className="atlas-te-setting__add atlas-te-span" disabled={readOnly}
        onClick={() => session.apply((template) => withColumns(template, block.id, (current) =>
          [...current, { label: 'Mod', formula: MODIFIER_FORMULA, display: 'signed' }]))}>
        <Plus aria-hidden="true" />
        Add column
      </Button>
    </>
  );
}
