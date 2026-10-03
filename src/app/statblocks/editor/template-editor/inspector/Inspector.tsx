import React from 'react';
import { useTemplateEditor } from '../editorContext';
import { FadingInspectorBody } from './InspectorBody';
import { InspectorPopover } from './InspectorPopover';
import './inspector.scss';

/** The wide inspector: a 280 px column beside the canvas. */
function InspectorPanel(): React.JSX.Element {
  const { selection } = useTemplateEditor();
  return (
    <div className="atlas-te-insp">
      <FadingInspectorBody selection={selection} />
    </div>
  );
}

/**
 * The template editor's inspector (§7.4), mounted in the editor's inspector
 * slot: a column beside the canvas, or below 900 px of view width a popover
 * beside the selected block. Every edit goes through the session.
 */
export function Inspector(): React.JSX.Element {
  const { layout } = useTemplateEditor();
  return layout === 'narrow' ? <InspectorPopover /> : <InspectorPanel />;
}
