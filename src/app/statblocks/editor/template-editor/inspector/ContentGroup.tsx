import React from 'react';
import { blockSpec } from '../../../model/blockCatalogue';
import { updateField, type FieldChanges } from '../../../model/fieldOps';
import { boundField } from '../../../model/treeQueries';
import type { FieldType } from '../../../model/templateTypes';
import { useTemplateEditor } from '../editorContext';
import { FIELD_TYPE_LABELS } from '../editorGlyphs';
import { commitLabel } from '../labelCommit';
import { isUnboundBlock, labelTargetOf } from '../labelTargets';
import { boundFieldOf, listFromText, sameList, textFromList } from './blockEdits';
import { EntriesContent, LineFields, ScriptContent, SectionHeading, TextSource, TrackResource } from './ContentParts';
import { FieldSetting, withOwnField } from './FieldSetting';
import type { GroupProps } from './groupProps';
import { InspectorGroup } from './InspectorGroup';
import { SelectSetting, SwitchSetting, TextSetting } from './InspectorControls';

/** The label, heading or text the block writes, as the canvas edits it in place. */
function LabelSetting({ block, template, session, readOnly }: GroupProps): React.JSX.Element | null {
  const { collectionKeys } = useTemplateEditor();
  const target = labelTargetOf(block, template.fields);
  if (!target || block.type === 'section' || block.type === 'text') return null;
  const label = target.kind === 'heading' ? 'Heading' : target.kind === 'text' ? 'Text' : 'Label';
  return (
    <TextSetting
      label={label}
      value={target.kind === 'new-field' ? '' : target.text}
      placeholder={target.kind === 'new-field' ? 'Name the field' : undefined}
      session={session}
      disabled={readOnly}
      // A first label names a new field: its key comes from the whole label, so it is put in once.
      mode={target.kind === 'new-field' ? 'commit' : 'live'}
      onText={(text) => session.apply((current) => commitLabel(current, block.id, text, collectionKeys.keys()).template)}
    />
  );
}

/** What the bound field holds: its type where the block takes several, its options, its slots. */
function FieldShape({ block, template, session, readOnly }: GroupProps): React.JSX.Element | null {
  const field = boundFieldOf(template, block);
  if (!field || block.type === 'line') return null;
  const binds = blockSpec(block.type).binds;
  const edit = (changes: FieldChanges): void => session.apply((current) => updateField(current, field.key, changes));
  return (
    <>
      {binds.length > 1 && (
        <SelectSetting<FieldType>
          label="Type"
          value={field.type}
          options={binds.map((type) => ({ value: type, label: FIELD_TYPE_LABELS[type] }))}
          onChange={(type) => edit({ type })}
          disabled={readOnly}
        />
      )}
      {field.type === 'choice' && (
        <>
          <TextSetting
            label="Options"
            value={textFromList(field.options)}
            placeholder="Small, Medium, Large"
            session={session}
            disabled={readOnly}
            onText={(text) => {
              const options = listFromText(text);
              if (!sameList(options, field.options)) edit({ options: options.length > 0 ? options : undefined });
            }}
          />
          <SwitchSetting label="Allow others" value={field.open === true} onChange={(open) => edit({ open: open || undefined })} disabled={readOnly} />
        </>
      )}
      {field.type === 'scores' && (
        <TextSetting
          label="Slots"
          value={textFromList(field.slots)}
          placeholder="STR, DEX, CON"
          session={session}
          disabled={readOnly}
          onText={(text) => {
            const slots = listFromText(text);
            if (!sameList(slots, field.slots)) edit({ slots });
          }}
        />
      )}
    </>
  );
}

/** The block's own field, for the blocks that show one. */
function OwnField(props: GroupProps): React.JSX.Element | null {
  const { block, session, readOnly } = props;
  const binds = blockSpec(block.type).binds;
  const [first] = binds;
  if (!first || block.type === 'line' || block.type === 'text') return null;
  const key = boundField(block);
  return (
    <FieldSetting
      value={key || null}
      accepts={binds}
      newType={first}
      session={session}
      disabled={readOnly}
      placeholder={isUnboundBlock(block) ? 'Choose or name a field' : undefined}
      onBind={(template, chosen) => withOwnField(template, block, chosen)}
    />
  );
}

/**
 * Content (§7.4): what the block shows. Its label, the field it binds and
 * what that field holds, and what only some blocks have: a Line's fields, a
 * Section's or Text's source, an Entries block's intro and parts, a Track's
 * resource. A Row and a Divider show nothing of their own, so they have none.
 */
export function ContentGroup(props: GroupProps): React.JSX.Element | null {
  const { block } = props;
  if (block.type === 'row' || block.type === 'divider') return null;
  return (
    <InspectorGroup id="content" title="Content">
      <LabelSetting {...props} />
      {block.type === 'section' && <SectionHeading {...props} block={block} />}
      {block.type === 'text' && <TextSource {...props} block={block} />}
      {block.type === 'line' && <LineFields {...props} block={block} />}
      <OwnField {...props} />
      <FieldShape {...props} />
      {block.type === 'entries' && <EntriesContent {...props} block={block} />}
      {block.type === 'track' && <TrackResource {...props} block={block} />}
      {(block.type === 'script' || block.type === 'opaque') && <ScriptContent {...props} block={block} />}
    </InspectorGroup>
  );
}
