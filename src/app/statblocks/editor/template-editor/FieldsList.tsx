import React, { useId, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { ToolButton } from '../../../packages/components/primitives/ToolButton';
import { blocksReadingField, fieldsNotShown } from '../../model/fieldOps';
import { sampleRecord } from '../../model/sampleValues';
import type { TemplateField } from '../../model/templateTypes';
import { useFieldDrag } from '../dnd/useDragSources';
import { useTemplateEditor } from './editorContext';
import { fieldTypeGlyph, FIELD_TYPE_LABELS, MEANING_LABELS } from './editorGlyphs';
import { useGestureText } from './inspector/useGestureText';
import { hasOwnSample, sampleIsTyped, sampleToText, textToSample, withSample } from './sampleText';

/** The sample a field previews with, typed as one line; typing it is one undo step. */
function SampleInput({ field, labelledBy }: { field: TemplateField; labelledBy: string }): React.JSX.Element {
  const { session, snapshot } = useTemplateEditor();
  const { template, readOnly } = snapshot;
  const value = useMemo(() => sampleToText(field, sampleRecord(template)[field.key]), [field, template]);
  const text = useGestureText({
    value,
    session,
    onText: (typed) => session.apply((current) => withSample(current, field, textToSample(field, typed, sampleRecord(current)[field.key]))),
  });
  return (
    <div className="atlas-te-fields__sample">
      <input {...text} type="text" className="atlas-te-input" aria-labelledby={labelledBy} disabled={readOnly} spellCheck={false}
        placeholder="Empty" />
      {hasOwnSample(template, field.key) && (
        <ToolButton icon={RotateCcw} label="Use the default sample" isActive={false} disabled={readOnly}
          onClick={() => session.apply((current) => withSample(current, field, undefined))} />
      )}
    </div>
  );
}

/** A field's glyph, label, type, key and meaning; the drag carries the same face. */
export function FieldFace({ field, labelId }: { field: TemplateField; labelId?: string | undefined }): React.JSX.Element {
  const Glyph = fieldTypeGlyph(field.type);
  return (
    <>
      <Glyph className="atlas-te-fields__glyph" aria-hidden="true" />
      <span id={labelId} className="atlas-te-fields__label">{field.label || field.key}</span>
      <span className="atlas-te-fields__type">{FIELD_TYPE_LABELS[field.type]}</span>
      <code className="atlas-te-fields__key">{field.key}</code>
      {field.meaning && <span className="atlas-te-fields__badge">{MEANING_LABELS[field.meaning]}</span>}
    </>
  );
}

function FieldRow({ field }: { field: TemplateField }): React.JSX.Element {
  const { snapshot, select, announce } = useTemplateEditor();
  const labelId = useId();
  const drag = useFieldDrag(field, snapshot.readOnly);
  const goToBlock = (): void => {
    const [first] = blocksReadingField(snapshot.template, field.key);
    if (first) select([first.id], true);
    else announce(`No block shows ${field.label || field.key} yet.`);
  };
  return (
    <li className="atlas-te-fields__row">
      <div
        ref={drag.ref}
        className="atlas-te-fields__head"
        role="button"
        tabIndex={0}
        onPointerDown={drag.onPointerDown}
        onClick={goToBlock}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          goToBlock();
        }}
      >
        <FieldFace field={field} labelId={labelId} />
      </div>
      {sampleIsTyped(field) && <SampleInput field={field} labelledBy={labelId} />}
    </li>
  );
}

/**
 * The Fields tab (§7.4, §7.9): every field of the template in form order, its
 * type, label, key and meaning, and the sample the canvas previews it with.
 * Fields no block shows stand apart under "Not shown". A field's name selects
 * the first block that shows it; dragged onto the canvas, it gets the natural
 * block for its type there.
 */
export function FieldsList(): React.JSX.Element {
  const { snapshot } = useTemplateEditor();
  const { template } = snapshot;
  const apartId = useId();
  const hidden = useMemo(() => new Set(fieldsNotShown(template).map((field) => field.key)), [template]);
  const shown = template.fields.filter((field) => !hidden.has(field.key));
  const apart = template.fields.filter((field) => hidden.has(field.key));
  if (template.fields.length === 0) return <p className="atlas-te-fields__empty">Fields appear here as you add blocks.</p>;
  return (
    <div className="atlas-te-fields">
      {shown.length > 0 && <ul className="atlas-te-fields__list">{shown.map((field) => <FieldRow key={field.key} field={field} />)}</ul>}
      {apart.length > 0 && (
        <>
          <div id={apartId} className="atlas-te-fields__group-label">Not shown</div>
          <ul className="atlas-te-fields__list" aria-labelledby={apartId}>{apart.map((field) => <FieldRow key={field.key} field={field} />)}</ul>
        </>
      )}
    </div>
  );
}
