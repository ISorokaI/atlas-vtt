import React from 'react';
import { boundFieldOf, editBlock, editField } from './blockEdits';
import { canBeEmpty, type GroupProps } from './groupProps';
import { InspectorGroup } from './InspectorGroup';
import { ChoiceSetting, Setting, TextSetting } from './InspectorControls';
import { PatternEditor } from './PatternEditor';

/**
 * When empty (§7.4): a block whose fields are empty hides, or shows a
 * fallback pattern in their place, which may work a value out of other
 * fields. The prompt is what the statblock pane shows in an empty field.
 */
export function WhenEmptyGroup({ block, template, session, readOnly }: GroupProps): React.JSX.Element | null {
  if (!canBeEmpty(block)) return null;
  const field = boundFieldOf(template, block);
  const mode = block.whenEmpty === 'fallback' ? 'fallback' : 'hide';
  return (
    <InspectorGroup id="when-empty" title="When empty">
      <ChoiceSetting
        label="Then"
        value={mode}
        options={[{ value: 'hide', label: 'Hide' }, { value: 'fallback', label: 'Show a fallback' }]}
        disabled={readOnly}
        onChange={(next) => editBlock(session, block.id, block.type, { whenEmpty: next === 'fallback' ? 'fallback' : undefined })}
      />
      {mode === 'fallback' && (
        <Setting label="Fallback" wide>
          {(labelId) => (
            <PatternEditor
              labelledBy={labelId}
              value={block.fallback ?? ''}
              session={session}
              disabled={readOnly}
              placeholder="What shows instead"
              onText={(text) => editBlock(session, block.id, block.type, { fallback: text || undefined })}
            />
          )}
        </Setting>
      )}
      {field && (
        <TextSetting
          label="Prompt"
          value={field.prompt ?? ''}
          // Unset, the statblock pane prompts with the field's label.
          placeholder={field.label || field.key}
          session={session}
          disabled={readOnly}
          onText={(text) => editField(session, field.key, { prompt: text.trim() ? text : undefined })}
        />
      )}
    </InspectorGroup>
  );
}
