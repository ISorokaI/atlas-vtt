import React, { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useElementHeight } from '../../../react/hooks/useElementHeight';
import { MOTION_NORMAL_MS, EASE_OUT_CONTROL_POINTS } from '../../../utils/motion';
import type { SectionBlock } from '../../model/templateTypes';
import { valueText } from '../../values/valueText';
import { useSheet } from '../sheetContext';
import { SheetHeading } from '../values/SheetHeading';
import type { BlockViewProps } from './blockViewProps';

interface SectionViewProps extends BlockViewProps<SectionBlock> {
  children: React.ReactNode;
}

const HEIGHT_TRANSITION = { duration: MOTION_NORMAL_MS / 1000, ease: EASE_OUT_CONTROL_POINTS };

/**
 * A section that folds: its heading is a button, and the clip around its
 * content animates to the content's real height, never a scale, which would
 * stretch the text.
 */
function Collapsible({ heading, initiallyOpen, children }: {
  heading: string;
  initiallyOpen: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(initiallyOpen);
  const [contentRef, height] = useElementHeight<HTMLDivElement>();
  const reduced = useReducedMotion() === true;
  const contentId = useId();
  const target = open ? height ?? 'auto' : 0;

  return (
    <>
      <SheetHeading>
        <button
          type="button"
          className="atlas-sb-section-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((was) => !was)}
        >
          <ChevronRight className="atlas-sb-chevron" aria-hidden="true" />
          {heading}
        </button>
      </SheetHeading>
      <motion.div
        id={contentId}
        className="atlas-sb-collapse-clip"
        initial={false}
        animate={{ height: target }}
        transition={reduced ? { duration: 0 } : HEIGHT_TRANSITION}
        inert={!open}
      >
        <div ref={contentRef} className="atlas-sb-stack">{children}</div>
      </motion.div>
    </>
  );
}

/** A vertical stack of blocks with an optional heading, which may fold. */
export function SectionView({ block, children }: SectionViewProps): React.JSX.Element {
  const { state } = useSheet();
  const heading = (block.headingField ? valueText(state.reader(block.headingField)) : '') || block.heading || '';

  if (block.collapsible && heading.trim()) {
    return (
      <Collapsible heading={heading} initiallyOpen={block.collapsible === 'open'}>
        {children}
      </Collapsible>
    );
  }
  return (
    <>
      {heading.trim() && <SheetHeading>{heading}</SheetHeading>}
      <div className="atlas-sb-stack">{children}</div>
    </>
  );
}
