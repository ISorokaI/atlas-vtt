import React from 'react';
import { TooltipProvider } from '../../packages/components/primitives/tooltip';
import { StatblockPane } from './statblock-pane/StatblockPane';
import type { StatblockPaneProps } from './statblock-pane/paneTypes';
import { TemplateEditorSurface, type TemplateEditorSurfaceProps } from './template-editor/TemplateEditorSurface';

/** What a statblock editor view shows: the pane beside a note, or the template editor (`atlas-statblock-template`). */
export type StatblockEditorSurface =
  | { kind: 'statblock-pane'; props: StatblockPaneProps }
  | { kind: 'template-editor'; props: TemplateEditorSurfaceProps };

function surfaceContent(surface: StatblockEditorSurface): React.JSX.Element {
  switch (surface.kind) {
    case 'statblock-pane': return <StatblockPane {...surface.props} />;
    case 'template-editor': return <TemplateEditorSurface {...surface.props} />;
  }
}

/**
 * The one React root the statblock editor's views mount (§4.6): the pane
 * beside a note, and the template editor. Each view renders it with its
 * surface; tooltips share one provider.
 */
export function StatblockEditorRoot({ surface }: { surface: StatblockEditorSurface }): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="atlas-statblock-editor" data-surface={surface.kind}>
        {surfaceContent(surface)}
      </div>
    </TooltipProvider>
  );
}
