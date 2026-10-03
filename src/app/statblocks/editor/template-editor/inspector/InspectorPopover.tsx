import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { handledByAnotherControl } from '../../../../keyboard/tooltipEscape';
import { CloseButton } from '../../../../packages/components/primitives/CloseButton';
import { useAnchoredPopoverVariants } from '../../../../packages/components/primitives/dialogMotion';
import { useKeepInView } from '../../../../packages/components/primitives/useKeepInView';
import { cn } from '../../../../../utils/cn';
import { useTemplateEditor } from '../editorContext';
import { blockFrame } from '../editorChrome';
import type { ChromeStyle } from '../LabelEditor';
import { primaryOf, type BlockSelection } from '../selection';
import { useBesideBlock } from './besidePlacement';
import { FadingInspectorBody } from './InspectorBody';

/**
 * The inspector below 900 px of view width (§7.4): a popover beside the
 * selected block, kept in view. Escape or its close button puts it away
 * until a block is selected again; focus goes back to the block.
 */
export function InspectorPopover(): React.JSX.Element {
  const { selection, snapshot } = useTemplateEditor();
  const [dismissed, setDismissed] = useState<BlockSelection | null>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const variants = useAnchoredPopoverVariants();
  const primary = primaryOf(selection);
  // Selecting a block, even the same one again, makes a new selection and brings the popover back.
  const open = primary !== null && dismissed !== selection;
  const placement = useBesideBlock(originRef, popoverRef, open ? primary : null, snapshot.template);
  const keepInView = useKeepInView(popoverRef, open && placement !== null, 'bottom', placement ? `${placement.left},${placement.top}` : undefined);

  const close = (): void => {
    setDismissed(selection);
    const stage = originRef.current?.closest('.atlas-te')?.querySelector<HTMLElement>('.atlas-te-stage');
    const frame = stage && primary ? blockFrame(stage, primary) : null;
    frame?.focus({ preventScroll: true });
  };

  const style: React.CSSProperties & ChromeStyle = {
    ...keepInView.style,
    '--atlas-te-insp-x': `${placement?.left ?? 0}px`,
    '--atlas-te-insp-y': `${placement?.top ?? 0}px`,
  };

  return (
    <div ref={originRef} className="atlas-te-insp-origin">
      <AnimatePresence>
        {open && (
          <div
            key="inspector"
            ref={popoverRef}
            className={cn('atlas-te-insp-popover', keepInView.capped && 'atlas-keep-in-view--capped')}
            style={style}
            data-side={placement?.side}
            data-placed={placement ? '' : undefined}
            role="dialog"
            aria-label="Block settings"
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || handledByAnotherControl(event.nativeEvent)) return;
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
          >
            <motion.div className="atlas-te-insp-popover__panel atlas-te-insp" variants={variants} initial="hidden" animate="visible" exit="exit">
              <FadingInspectorBody selection={selection} headerEnd={<CloseButton className="atlas-te-insp__close" onClick={close} />} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
