import React, { useRef } from 'react';
import type { TemplateBlock, TemplateField } from '../../model/templateTypes';
import { blockDisplay } from '../../render/blockDisplay';
import { ChoiceValueInput } from './ChoiceValueInput';
import { ConflictChip } from './ConflictChip';
import { DerivedMark, patternInWords } from './DerivedMark';
import { EntriesEditor } from './EntriesEditor';
import { focusStaysIn } from './focusWithin';
import { ListValueInput } from './ListValueInput';
import { MarkdownValueInput } from './MarkdownValueInput';
import { usePaneEdit, type EditTarget, type PaneEditController } from './paneEditContext';
import { TextValueInput } from './TextValueInput';
import { WarningDot } from './ValueMarks';
import { valueProblem } from './valuePatches';

/** The input for one field, by its type group (§7.6). */
function FieldInput({ field, autoFocus }: { field: TemplateField; autoFocus: boolean }): React.JSX.Element {
  switch (field.type) {
    case 'list': return <ListValueInput field={field} autoFocus={autoFocus} />;
    case 'markdown': case 'spells': return <MarkdownValueInput field={field} autoFocus={autoFocus} />;
    case 'choice': return field.options?.length
      ? <ChoiceValueInput field={field} autoFocus={autoFocus} />
      : <TextValueInput field={field} autoFocus={autoFocus} />;
    default: return <TextValueInput field={field} autoFocus={autoFocus} />;
  }
}

interface BlockEditorProps {
  block: TemplateBlock;
  fields: readonly TemplateField[];
  target: EditTarget;
}

/**
 * What stands where a block's values show while one of its fields is edited:
 * an input per field, in the order the block writes them, focus on the one
 * clicked or reached with Tab. Focus leaving the block ends editing.
 */
function BlockEditor({ block, fields, target }: BlockEditorProps): React.JSX.Element {
  const pane = usePaneEdit();
  const ref = useRef<HTMLSpanElement>(null);
  const entries = fields.find((field) => field.type === 'entries' && field.key === target.field);
  const onBlur = (event: React.FocusEvent): void => {
    if (!focusStaysIn(ref.current, event.relatedTarget)) pane.leave(block.id);
  };

  return (
    <span ref={ref} className="atlas-sb-pane-editor" onBlur={onBlur}>
      {entries
        ? <EntriesEditor field={entries} entry={target.entry} addLabel={block.type === 'entries' ? block.addLabel : undefined} />
        : fields.map((field, index) => (
          <React.Fragment key={field.key}>
            {index > 0 && ' '}
            <FieldInput field={field} autoFocus={field.key === target.field} />
          </React.Fragment>
        ))}
    </span>
  );
}

/** How a value the template works out is made, while the block shows its fallback; null otherwise. */
function derivedWords(block: TemplateBlock, pane: PaneEditController): string | null {
  if (!block.fallback || blockDisplay(block, pane.sheet)?.state !== 'fallback') return null;
  return patternInWords(block.fallback, pane.sheet.context.labelOf);
}

/** A block's values at rest, with what the pane has to say about them: a conflict, or a value kept as typed. */
function PaneSlot({ block, values }: { block: TemplateBlock; values: React.ReactNode }): React.ReactNode {
  const pane = usePaneEdit();
  const fields = pane.spots.byBlock.get(block.id) ?? [];
  if (pane.editing?.blockId === block.id && fields.length) return <BlockEditor block={block} fields={fields} target={pane.editing} />;
  const marks = fields.flatMap((field) => {
    const conflict = pane.conflicts.get(field.key);
    if (conflict) return [<ConflictChip key={field.key} field={field} conflict={conflict} />];
    const problem = valueProblem(field, pane.read(field).value);
    return problem ? [<WarningDot key={field.key} problem={problem} />] : [];
  });
  const words = derivedWords(block, pane);
  if (words) marks.push(<DerivedMark key="derived" words={words} />);
  return marks.length ? <>{values}{marks}</> : values;
}

/** The pane's `ValueEditing.slot`: one element type, so a block's values keep their place in the tree. */
export function renderPaneSlot(block: TemplateBlock, values: React.ReactNode): React.ReactNode {
  return <PaneSlot block={block} values={values} />;
}
