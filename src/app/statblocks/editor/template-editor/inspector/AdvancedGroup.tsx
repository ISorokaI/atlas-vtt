import React, { useRef, useState } from 'react';
import { Button } from '../../../../packages/components/primitives/button';
import { renameFieldKey } from '../../../model/fieldOps';
import { FIELD_MEANINGS, type FieldMeaning, type TemplateField } from '../../../model/templateTypes';
import { useTemplateEditor } from '../editorContext';
import { MEANING_LABELS } from '../editorGlyphs';
import { useTemplateUsage } from '../useTemplateUsage';
import { boundFieldOf, editBlock, withMeaning } from './blockEdits';
import { ConditionBuilder } from './ConditionBuilder';
import type { GroupProps } from './groupProps';
import { InspectorGroup } from './InspectorGroup';
import { SelectSetting, Setting, SettingNote, TextSetting } from './InspectorControls';
import { RenameKeyDialog } from './RenameKeyDialog';

const NO_MEANING = '';

/** The bound field's key, and Rename… with the dialog it opens. */
function KeySetting({ field, readOnly }: { field: TemplateField; readOnly: boolean }): React.JSX.Element {
  const { app, session, snapshot, announce } = useTemplateEditor();
  const usage = useTemplateUsage(app, snapshot.id);
  // The button the dialog opens from: its window, and where focus goes back to.
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = (): void => {
    setOpener(null);
    buttonRef.current?.focus();
  };
  return (
    <>
      <Setting label="Key">
        {() => (
          <div className="atlas-te-setting__inline">
            <code className="atlas-te-setting__key">{field.key}</code>
            <Button ref={buttonRef} type="button" variant="ghost" size="sm" disabled={readOnly} onClick={() => setOpener(buttonRef.current)}>
              Rename…
            </Button>
          </div>
        )}
      </Setting>
      {field.formerKeys && field.formerKeys.length > 0 && (
        <SettingNote>Also reads {field.formerKeys.map((key) => `“${key}”`).join(', ')} from statblocks not yet moved over.</SettingNote>
      )}
      {opener && (
        <RenameKeyDialog
          anchor={opener}
          field={field}
          template={snapshot.template}
          statblocks={usage.notes.length}
          onClose={close}
          onRename={(to) => {
            session.apply((template) => renameFieldKey(template, field.key, to));
            announce(`Renamed the key ${field.key} to ${to}.`);
            close();
          }}
        />
      )}
    </>
  );
}

/** What Atlas uses the field for; one field per meaning, so taking one moves it here. */
function MeaningSetting({ field, readOnly }: { field: TemplateField; readOnly: boolean }): React.JSX.Element {
  const { session, snapshot } = useTemplateEditor();
  const holders = new Map(snapshot.template.fields.filter((other) => other.meaning).map((other) => [other.meaning, other]));
  const options = [
    { value: NO_MEANING, label: 'None' },
    ...FIELD_MEANINGS.map((meaning) => {
      const holder = holders.get(meaning);
      return { value: meaning, label: MEANING_LABELS[meaning], ...(holder && holder.key !== field.key && { detail: holder.label || holder.key }) };
    }),
  ];
  return (
    <SelectSetting<string>
      label="Meaning"
      value={field.meaning ?? NO_MEANING}
      options={options}
      disabled={readOnly}
      onChange={(value) => {
        const meaning = FIELD_MEANINGS.find((candidate): candidate is FieldMeaning => candidate === value);
        session.apply((template) => withMeaning(template, field.key, meaning));
      }}
    />
  );
}

/**
 * Advanced (§7.4): the field's key and its rename, the condition the block
 * shows under, the class themes and Fantasy Statblocks see, and what Atlas
 * uses the field for.
 */
export function AdvancedGroup({ block, template, session, readOnly }: GroupProps): React.JSX.Element | null {
  // A block of a newer Atlas is written back exactly as it was read.
  if (block.type === 'opaque') return null;
  const field = boundFieldOf(template, block);
  return (
    <InspectorGroup id="advanced" title="Advanced">
      {field && <KeySetting field={field} readOnly={readOnly} />}
      {block.type !== 'script' && <ConditionBuilder block={block} session={session} disabled={readOnly} />}
      <TextSetting label="Class" value={block.className ?? ''} placeholder="For themes" session={session} disabled={readOnly} code
        onText={(text) => editBlock(session, block.id, block.type, { className: text.trim() ? text.trim() : undefined })} />
      {field && <MeaningSetting field={field} readOnly={readOnly} />}
    </InspectorGroup>
  );
}
