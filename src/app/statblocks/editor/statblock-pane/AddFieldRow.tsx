import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { App } from 'obsidian';
import { Button } from '../../../packages/components/primitives/button';
import { useAnchoredPopoverVariants } from '../../../packages/components/primitives/dialogMotion';
import { useKeepInView } from '../../../packages/components/primitives/useKeepInView';
import { cn } from '../../../../utils/cn';
import type { StatblockTemplate } from '../../model/templateTypes';
import type { FieldRecord } from '../../values/fieldValues';
import { FieldPicker } from './FieldPicker';
import type { AddField } from './useAddField';
import './add-field.scss';

/** The question for a template other statblocks share (D15). */
function SharedTemplateQuestion({ templateName, count, onAnswer, onClose }: {
  templateName: string;
  count: number;
  onAnswer: (where: 'template' | 'copy') => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      className="atlas-sb-add-field__question"
      role="group"
      aria-label="Where the field goes"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <p className="atlas-sb-add-field__text">{count} statblocks use {templateName}.</p>
      <Button type="button" variant="default" size="sm" autoFocus onClick={() => onAnswer('template')}>
        Change the template for all {count} statblocks
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => onAnswer('copy')}>Make a copy for this one</Button>
    </div>
  );
}

export interface AddFieldRowProps {
  app: App;
  adder: AddField;
  collectionId: string | null;
  template: StatblockTemplate;
  templateName: string;
  record: FieldRecord;
}

/**
 * "Add a field…", the last row of the card (D15, §7.2): the field picker,
 * then, for a template other statblocks share, the question where the field
 * goes. The block it adds takes the focus once the card shows it.
 */
export function AddFieldRow({ app, adder, collectionId, template, templateName, record }: AddFieldRowProps): React.JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);
  const { step, close } = adder;
  const open = step.kind === 'picking' || step.kind === 'asking';
  const variants = useAnchoredPopoverVariants();
  const keepInView = useKeepInView(popoverRef, open, above ? 'top' : 'bottom', step.kind);

  const dismiss = (): void => {
    close();
    buttonRef.current?.focus({ preventScroll: true });
  };

  // Opens upward where the leaf has no room below the row.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!open || !row) return;
    const frame = (row.closest('.workspace-leaf') ?? row.doc.body).getBoundingClientRect();
    const box = row.getBoundingClientRect();
    setAbove(frame.bottom - box.bottom < 320 && box.top - frame.top > frame.bottom - box.bottom);
  }, [open]);

  useEffect(() => {
    const row = rowRef.current;
    if (!open || !row) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      if (!event.composedPath().includes(row)) close();
    };
    row.doc.addEventListener('pointerdown', onPointerDown, true);
    return () => row.doc.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, close]);

  // The new block takes the focus once the card shows it (a copy shows only after the note names it).
  useEffect(() => {
    if (!adder.added) return;
    // The row stands under the card, in the pane's body.
    const card = rowRef.current?.closest('.atlas-sb-pane-body')?.querySelector('.atlas-sb-pane-card');
    card?.querySelector<HTMLElement>(`[data-block-id="${adder.added}"]`)?.focus({ preventScroll: false });
  }, [adder.added, template]);

  return (
    <div ref={rowRef} className="atlas-sb-add-field">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        className="atlas-sb-add-field__button"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={step.kind === 'adding'}
        onClick={() => (open ? dismiss() : adder.openPicker())}
      >
        <Plus aria-hidden="true" />
        {step.kind === 'adding' ? 'Adding…' : 'Add a field…'}
      </Button>
      <AnimatePresence>
        {open && (
          <div
            key="popover"
            ref={popoverRef}
            className={cn('atlas-sb-add-field__popover', keepInView.capped && 'atlas-keep-in-view--capped')}
            data-above={above || undefined}
            style={keepInView.style}
            role="dialog"
            aria-label="Add a field"
          >
            <motion.div className="atlas-sb-add-field__panel" variants={variants} initial="hidden" animate="visible" exit="exit">
              {step.kind === 'asking' ? (
                <SharedTemplateQuestion templateName={templateName} count={step.count} onAnswer={adder.answer} onClose={dismiss} />
              ) : (
                <FieldPicker
                  app={app}
                  collectionId={collectionId}
                  template={template}
                  record={record}
                  onChoose={(choice) => adder.choose(choice)}
                  onClose={dismiss}
                />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
