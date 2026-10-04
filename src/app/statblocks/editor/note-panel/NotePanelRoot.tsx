import React from 'react';
import { StatblockEditorRoot } from '../StatblockEditorRoot';
import type { StatblockPaneProps } from '../statblock-pane/paneTypes';
import { PanelResizeHandle } from './PanelResizeHandle';
import './note-statblock-panel.scss';

export interface NotePanelRootProps {
  pane: StatblockPaneProps;
  width: number;
  /** The view is too narrow for two columns: the panel stands above the note and keeps its height. */
  stacked: boolean;
  availableWidth: () => number;
  onResize: (width: number, done: boolean) => void;
}

/** What the panel beside a note draws: the line that resizes it and, scrolling on its own, the statblock pane. */
export function NotePanelRoot({ pane, width, stacked, availableWidth, onResize }: NotePanelRootProps): React.JSX.Element {
  return (
    <>
      {!stacked && <PanelResizeHandle width={width} availableWidth={availableWidth} onResize={onResize} />}
      <div className="atlas-sb-note-panel__scroll">
        <StatblockEditorRoot surface={{ kind: 'statblock-pane', props: pane }} />
      </div>
    </>
  );
}
