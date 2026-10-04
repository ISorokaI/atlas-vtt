import { useCallback, useState } from 'react';
import type { App } from 'obsidian';
import type { LibraryTemplate } from '../../model/resolvedTypes';
import type { FieldRecord } from '../../values/fieldValues';
import type { PaneServices } from '../paneServices';
import { addFieldPlan, addFieldToCopy, addFieldToTemplate, templateKeyPatch, type AddedField } from './addFieldFlow';
import { choiceProblem, type FieldChoice } from './fieldChoices';
import type { TemplateBlockTarget } from './paneTypes';

/** Where "Add a field…" stands: closed, the picker open, the question asked, or the field on its way. */
export type AddFieldStep =
  | { kind: 'closed' }
  | { kind: 'picking' }
  | { kind: 'asking'; choice: FieldChoice; count: number; open: boolean }
  | { kind: 'adding' };

export interface AddFieldInput {
  app: App;
  notePath: string;
  /** The note's template; null while it cannot take fields (missing, from a newer Atlas, not read yet). */
  entry: LibraryTemplate | null;
  record: FieldRecord;
  collectionId: string | null;
  writer: PaneServices['writer'];
  announce: (text: string) => void;
  /** Opens the template editor on the new block (Add to template); unset while that is not wired in. */
  openTemplate?: ((target: TemplateBlockTarget) => void) | undefined;
}

export interface AddField {
  step: AddFieldStep;
  /** The block just added, which the card moves focus to once it shows it. */
  added: string | null;
  openPicker: () => void;
  close: () => void;
  /** A field was chosen in the picker; `open` also opens the template editor on it (the tray). */
  choose: (choice: FieldChoice, open?: boolean) => void;
  /** The answer to "Change the template for all n statblocks" or "Make a copy for this one". */
  answer: (where: 'template' | 'copy') => void;
}

/**
 * "Add a field…" and the tray's Add to template (D15): the picker, the
 * question for a shared template, and the edit through the template's
 * session. A copy made for this note becomes its template through one
 * `atlas-template` patch.
 */
export function useAddField(input: AddFieldInput): AddField {
  const { app, notePath, entry, record, collectionId, writer, announce, openTemplate } = input;
  const [step, setStep] = useState<AddFieldStep>({ kind: 'closed' });
  const [added, setAdded] = useState<string | null>(null);

  const finish = useCallback(async (choice: FieldChoice, where: 'template' | 'copy', open: boolean): Promise<void> => {
    if (!entry) return;
    setStep({ kind: 'adding' });
    let result: AddedField | null = null;
    try {
      result = where === 'template' ? addFieldToTemplate(app, entry, choice) : await addFieldToCopy(app, entry, choice, collectionId);
      if (result?.copied) {
        const outcome = await writer.write(notePath, [templateKeyPatch(record, result.templateId)]);
        if (outcome.problem || outcome.conflicts.length) announce('The copy was made, but this statblock could not switch to it.');
      }
    } catch (error) {
      console.error('[Atlas] Adding a field to the template failed:', error);
      result = null;
    }
    setStep({ kind: 'closed' });
    if (!result) {
      announce(`Couldn't add ${choice.label}.`);
      return;
    }
    announce(result.copied ? `Added ${choice.label} to a copy of ${entry.name}.` : `Added ${choice.label} to ${entry.name}.`);
    if (open && openTemplate) openTemplate({ templateId: result.templateId, path: result.path, blockId: result.blockId, collectionId, notePath });
    else setAdded(result.blockId);
  }, [app, entry, record, notePath, collectionId, writer, announce, openTemplate]);

  const choose = useCallback((choice: FieldChoice, open = false): void => {
    if (!entry) return;
    const problem = choiceProblem(choice, entry.template);
    if (problem) {
      announce(problem);
      setStep({ kind: 'closed' });
      return;
    }
    const plan = addFieldPlan(app, entry, notePath);
    if (plan.kind === 'ask') setStep({ kind: 'asking', choice, count: plan.count, open });
    else void finish(choice, plan.kind, open);
  }, [app, entry, notePath, announce, finish]);

  const answer = useCallback((where: 'template' | 'copy'): void => {
    if (step.kind === 'asking') void finish(step.choice, where, step.open);
  }, [step, finish]);

  return {
    step,
    added,
    openPicker: useCallback(() => { setAdded(null); setStep({ kind: 'picking' }); }, []),
    close: useCallback(() => setStep({ kind: 'closed' }), []),
    choose,
    answer,
  };
}
