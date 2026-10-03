import React from 'react';
import { boundFieldOf, editBlock, editField, withBlockChanges } from './blockEdits';
import { FieldSetting } from './FieldSetting';
import type { GroupProps } from './groupProps';
import { InspectorGroup } from './InspectorGroup';
import { ChoiceSetting, Setting, TextSetting } from './InspectorControls';
import { PatternEditor } from './PatternEditor';

type Display = 'plain' | 'signed';
const DISPLAYS = [{ value: 'plain' as const, label: 'Plain' }, { value: 'signed' as const, label: 'Signed' }];

/** How a Stat, Pairs or Scores block writes its numbers: "3", or "+3". */
function DisplaySetting({ block, session, readOnly }: GroupProps): React.JSX.Element | null {
  if (block.type !== 'stat' && block.type !== 'pairs' && block.type !== 'scores') return null;
  const set = (display: Display): void => editBlock(session, block.id, block.type, { display: display === 'plain' ? undefined : display });
  return <ChoiceSetting label="Numbers" value={block.display ?? 'plain'} options={DISPLAYS} onChange={set} disabled={readOnly} />;
}

/**
 * Format (§7.4, §5.6): the pattern a Title, Line or Stat writes its values
 * with, how numbers show, a number's unit, a Line's separator and the dice a
 * Stat rolls.
 */
export function FormatGroup(props: GroupProps): React.JSX.Element | null {
  const { block, template, session, readOnly } = props;
  const field = boundFieldOf(template, block);
  const patterned = block.type === 'title' || block.type === 'line' || block.type === 'stat';
  const unit = field?.type === 'number' && (block.type === 'stat' || block.type === 'track');
  const numbers = block.type === 'stat' || block.type === 'pairs' || block.type === 'scores';
  if (!patterned && !unit && !numbers) return null;
  return (
    <InspectorGroup id="format" title="Format">
      {patterned && (
        <Setting label="Pattern" wide>
          {(labelId) => (
            <PatternEditor
              labelledBy={labelId}
              value={block.pattern ?? ''}
              session={session}
              disabled={readOnly}
              placeholder="Type { to add a field"
              onText={(text) => editBlock(session, block.id, block.type, { pattern: text || undefined })}
            />
          )}
        </Setting>
      )}
      <DisplaySetting {...props} />
      {unit && field && (
        <TextSetting label="Unit" value={field.unit ?? ''} placeholder="ft." session={session} disabled={readOnly}
          onText={(text) => editField(session, field.key, { unit: text.trim() ? text : undefined })} />
      )}
      {block.type === 'line' && (
        <TextSetting label="Separator" value={block.separator ?? ''} placeholder="A space" session={session} disabled={readOnly}
          onText={(text) => editBlock(session, block.id, 'line', { separator: text || undefined })} />
      )}
      {block.type === 'stat' && (
        <FieldSetting
          label="Rolls"
          value={block.rollFrom ?? null}
          accepts={['dice']}
          newType="dice"
          session={session}
          disabled={readOnly}
          placeholder="No dice"
          onBind={(current, key) => withBlockChanges(current, block.id, 'stat', { rollFrom: key })}
          onClear={() => editBlock(session, block.id, 'stat', { rollFrom: undefined })}
        />
      )}
    </InspectorGroup>
  );
}
