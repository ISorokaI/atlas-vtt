import React, { useState, useSyncExternalStore } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { TooltipProvider } from '../../../../src/app/packages/components/primitives/tooltip';
import { TemplateEditorContext, type TemplateEditorContextValue } from '../../../../src/app/statblocks/editor/template-editor/editorContext';
import { LeftPanel } from '../../../../src/app/statblocks/editor/template-editor/LeftPanel';
import { Inspector } from '../../../../src/app/statblocks/editor/template-editor/inspector/Inspector';
import type { BlockSelection } from '../../../../src/app/statblocks/editor/template-editor/selection';
import { TemplateEditor, type TemplateEditorHost } from '../../../../src/app/statblocks/editor/template-editor/TemplateEditor';
import { FakeSession, sampleTemplate } from './editorKit';

const host: TemplateEditorHost = { openTemplate: vi.fn(), openNote: vi.fn(), close: vi.fn() };

export interface Mounted {
  session: FakeSession;
  /** A block's frame in the canvas. */
  frame: (id: string) => HTMLElement;
}

/**
 * The template editor with the real left pane and inspector. `narrow` makes
 * the editor measure 800 px, below the width where both fold.
 */
export function mountEditor(session = new FakeSession(sampleTemplate()), options: { narrow?: boolean } = {}): Mounted {
  if (options.narrow) {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('atlas-te') ? 800 : 0;
    });
  }
  render(
    <TooltipProvider>
      <div className="atlas-vtt-plugin">
        <TemplateEditor
          session={session}
          host={host}
          previewPath={null}
          onPreviewPathChange={vi.fn()}
          collectionId={null}
          onCollectionChange={vi.fn()}
          leftPanel={LeftPanel}
          inspector={Inspector}
        />
      </div>
    </TooltipProvider>,
  );
  const frame = (id: string): HTMLElement => {
    const element = document.querySelector<HTMLElement>(`.atlas-te-stage [data-block-id="${id}"]`);
    if (!element) throw new Error(`no frame ${id}`);
    return element;
  };
  return { session, frame };
}

export interface ContextOptions {
  collectionKeys?: ReadonlyMap<string, number>;
  selection?: BlockSelection;
  layout?: 'wide' | 'narrow';
}

/** Renders a part inside an editor context of its own: a session's live snapshot and the given collection keys. */
export function renderInEditor(session: FakeSession, ui: React.ReactElement, options: ContextOptions = {}): { selected: () => BlockSelection } {
  const seen = { selection: options.selection ?? [] as BlockSelection };
  function Host(): React.JSX.Element {
    const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
    const [selection, setSelection] = useState<BlockSelection>(options.selection ?? []);
    seen.selection = selection;
    const value: TemplateEditorContextValue = {
      app: undefined,
      session,
      snapshot,
      selection,
      select: (next) => setSelection(next),
      insert: vi.fn(),
      editLabel: vi.fn(),
      announce: vi.fn(),
      collectionId: null,
      collectionKeys: options.collectionKeys ?? new Map(),
      layout: options.layout ?? 'wide',
    };
    return (
      <TooltipProvider>
        <div className="atlas-vtt-plugin">
          <TemplateEditorContext.Provider value={value}>{ui}</TemplateEditorContext.Provider>
        </div>
      </TooltipProvider>
    );
  }
  render(<Host />);
  return { selected: () => seen.selection };
}

/** Types into an input as one typing session: each value in turn, then leaves it. */
export function typeAndLeave(input: HTMLElement, ...values: string[]): void {
  for (const value of values) fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

export const key = (target: Element, name: string, init: KeyboardEventInit = {}): void => {
  fireEvent.keyDown(target, { key: name, ...init });
};
