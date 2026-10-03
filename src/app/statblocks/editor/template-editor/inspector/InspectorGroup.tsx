import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTemplateEditor } from '../editorContext';

export type InspectorGroupId = 'content' | 'look' | 'when-empty' | 'format' | 'advanced';

/** Content starts open; the others stay closed until opened (§7.4). */
const OPEN_AT_FIRST: ReadonlySet<InspectorGroupId> = new Set(['content']);

/** Which groups were opened or closed, per app, so every block and every view shows them the same way. */
const remembered = new WeakMap<object, Map<InspectorGroupId, boolean>>();
/** Where there is no app (a test): one memory for all. */
const NO_APP = {};

function memoryOf(owner: object): Map<InspectorGroupId, boolean> {
  let memory = remembered.get(owner);
  if (!memory) {
    memory = new Map();
    remembered.set(owner, memory);
  }
  return memory;
}

export interface InspectorGroupProps {
  id: InspectorGroupId;
  title: string;
  children: React.ReactNode;
}

/**
 * One of the inspector's groups (§7.4): a header that opens and closes it,
 * then its settings in two columns. It remembers whether it was open.
 */
export function InspectorGroup({ id, title, children }: InspectorGroupProps): React.JSX.Element {
  const { app } = useTemplateEditor();
  const memory = memoryOf(app ?? NO_APP);
  const [open, setOpen] = useState(() => memory.get(id) ?? OPEN_AT_FIRST.has(id));
  const titleId = useId();
  const toggle = (): void => {
    memory.set(id, !open);
    setOpen(!open);
  };
  return (
    <section className="atlas-te-group" data-group={id} data-open={open || undefined} aria-labelledby={titleId}>
      <button type="button" className="atlas-te-group__header atlas-te-span" aria-expanded={open} onClick={toggle}>
        <span id={titleId}>{title}</span>
        <ChevronRight className="atlas-te-group__chevron" aria-hidden="true" />
      </button>
      {open && children}
    </section>
  );
}
