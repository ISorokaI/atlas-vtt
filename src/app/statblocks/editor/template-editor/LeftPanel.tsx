import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Blocks, ListTree, Settings2, TextCursorInput, type LucideIcon } from 'lucide-react';
import { handledByAnotherControl } from '../../../keyboard/tooltipEscape';
import { CloseButton } from '../../../packages/components/primitives/CloseButton';
import { useAnchoredPopoverVariants } from '../../../packages/components/primitives/dialogMotion';
import { SegmentedControl } from '../../../packages/components/primitives/SegmentedControl';
import { ToolButton } from '../../../packages/components/primitives/ToolButton';
import { useKeepInView } from '../../../packages/components/primitives/useKeepInView';
import { cn } from '../../../../utils/cn';
import { BlocksPalette } from './BlocksPalette';
import { useTemplateEditor } from './editorContext';
import { FieldsList } from './FieldsList';
import { TemplateSettings } from './inspector/TemplateSettings';
import { Outline } from './Outline';
import './left-panel.scss';

type PaneTab = 'blocks' | 'outline' | 'fields';
/** The narrow rail also opens the template's settings, which the inspector shows only while nothing is selected. */
type RailTab = PaneTab | 'template';

const TABS: ReadonlyArray<{ value: PaneTab; label: string }> = [
  { value: 'blocks', label: 'Blocks' },
  { value: 'outline', label: 'Outline' },
  { value: 'fields', label: 'Fields' },
];

const RAIL: ReadonlyArray<{ id: RailTab; label: string; icon: LucideIcon }> = [
  { id: 'blocks', label: 'Blocks', icon: Blocks },
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'fields', label: 'Fields', icon: TextCursorInput },
  { id: 'template', label: 'Template settings', icon: Settings2 },
];

function TabContent({ tab }: { tab: RailTab }): React.JSX.Element {
  switch (tab) {
    case 'blocks': return <BlocksPalette />;
    case 'outline': return <Outline />;
    case 'fields': return <FieldsList />;
    case 'template': return <TemplateSettings />;
  }
}

/** The wide left pane: Blocks, Outline and Fields under a segmented control. */
function Pane(): React.JSX.Element {
  const [tab, setTab] = useState<PaneTab>('blocks');
  return (
    <div className="atlas-te-pane">
      <div className="atlas-te-pane__tabs">
        <SegmentedControl value={tab} options={TABS} onChange={setTab} ariaLabel="Side pane" />
      </div>
      <div className="atlas-te-pane__body">
        <TabContent tab={tab} />
      </div>
    </div>
  );
}

interface FlyoutProps {
  tab: RailTab;
  label: string;
  /** The rail button it opened from, where focus goes back on close. */
  opener: HTMLElement | null;
  onClose: () => void;
}

/** A rail tab opened as a floating panel beside the rail; Escape, its close button or a press outside close it. */
function Flyout({ tab, label, opener, onClose }: FlyoutProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const variants = useAnchoredPopoverVariants();
  const keepInView = useKeepInView(ref, true, 'bottom');
  const close = (): void => {
    onClose();
    opener?.focus({ preventScroll: true });
  };
  const latestClose = useRef(onClose);
  latestClose.current = onClose;

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      const path = event.composedPath();
      const rail = element.parentElement;
      if (!path.includes(element) && !(rail && path.includes(rail))) latestClose.current();
    };
    element.doc.addEventListener('pointerdown', onPointerDown, true);
    return () => element.doc.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  return (
    <div
      ref={ref}
      className={cn('atlas-te-flyout', keepInView.capped && 'atlas-keep-in-view--capped')}
      style={keepInView.style}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || handledByAnotherControl(event.nativeEvent)) return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <motion.div className="atlas-te-flyout__panel" variants={variants} initial="hidden" animate="visible" exit="exit">
        <div className="atlas-te-flyout__header">
          <span id={titleId} className="atlas-te-flyout__title">{label}</span>
          <CloseButton onClick={close} />
        </div>
        <div className="atlas-te-flyout__body">
          <TabContent tab={tab} />
        </div>
      </motion.div>
    </div>
  );
}

/** Below 900 px of view width: a 40 px rail whose tabs open as floating panels (§7.4). */
function Rail(): React.JSX.Element {
  const [open, setOpen] = useState<RailTab | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const current = RAIL.find((tab) => tab.id === open);
  return (
    <div className="atlas-te-rail-holder">
      <div ref={railRef} className="atlas-te-rail" role="toolbar" aria-orientation="vertical" aria-label="Side pane">
        {RAIL.map((tab) => (
          <ToolButton
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            isActive={open === tab.id}
            onClick={() => {
              const active = railRef.current?.doc.activeElement;
              setOpener(active?.instanceOf(HTMLElement) ? active : null);
              setOpen((was) => (was === tab.id ? null : tab.id));
            }}
          />
        ))}
      </div>
      <AnimatePresence>
        {current && <Flyout key={current.id} tab={current.id} label={current.label} opener={opener} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}

/**
 * The template editor's left pane (§7.4), mounted in the editor's left slot:
 * the block palette, the outline and the fields, 260 px wide; below 900 px of
 * view width a rail of icons whose tabs open as floating panels.
 */
export function LeftPanel(): React.JSX.Element {
  const { layout } = useTemplateEditor();
  return layout === 'narrow' ? <Rail /> : <Pane />;
}
