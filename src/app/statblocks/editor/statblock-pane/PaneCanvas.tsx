import React, { useEffect, useRef } from 'react';
import type { App } from 'obsidian';
import type { StatblockTemplate } from '../../model/templateTypes';
import { isEmptyValue } from '../../values/emptyValue';
import { readField, type FieldRecord } from '../../values/fieldValues';
import { PanelCard } from '../panel-frame/PanelFrame';
import type { PaneServices } from '../paneServices';
import { PaneEditContext } from './paneEditContext';
import type { PendingCommit } from './paneTypes';
import { usePaneEditor } from './usePaneEditor';

export interface PaneCanvasProps {
  app: App;
  services: PaneServices;
  notePath: string;
  /** The pane's collection, whose tokens the token socket links. */
  collectionId: string | null;
  template: StatblockTemplate;
  /** The template's name: `data-template` on the card. */
  templateName: string;
  record: FieldRecord;
  writable: boolean;
  pendingCommit: PendingCommit;
  /** Shown under the card: "Add a field…". */
  footer?: React.ReactNode;
  /** Raised to move focus to the first empty value (a statblock just created); 0 never does. */
  focusRequest: number;
  /**
   * The last request acted on, kept by the pane across notes: the canvas is
   * made anew for each note, and a view turning to another note must not move focus.
   */
  handledFocusRequest: React.RefObject<number>;
  onExit: (step: 1 | -1) => void;
  onCommitted: () => void;
  onWriteProblem: (problem: string | null) => void;
  /** Says something in the pane's live region. */
  announce: (text: string) => void;
  /** Shown under the card, with the card's editing at hand: the tray. */
  children?: React.ReactNode;
}

/**
 * The runtime card in the editing mode (§7.2, §7.11): empty fields show their
 * prompts, and the pane's chrome and inputs come in through the renderer's
 * seams, so the card is drawn by the same code the map and the DM screen use.
 */
export function PaneCanvas(props: PaneCanvasProps): React.JSX.Element {
  const { app, notePath, template, templateName, record, footer, focusRequest, handledFocusRequest, writable } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const editor = usePaneEditor({ ...props, cardRef });
  const { spots } = editor.controller;

  // A statblock just created opens with focus on the first empty value; a restored workspace never moves focus.
  useEffect(() => {
    if (focusRequest === handledFocusRequest.current || !writable) return;
    handledFocusRequest.current = focusRequest;
    const empty = spots.order.find((spot) => isEmptyValue(readField(record, spot.field).value)) ?? spots.order[0];
    if (!empty) return;
    cardRef.current?.querySelector<HTMLElement>(`[data-block-id="${empty.blockId}"]`)?.focus({ preventScroll: true });
  }, [focusRequest, handledFocusRequest, writable, spots, record]);

  return (
    <PaneEditContext.Provider value={editor.controller}>
      <PanelCard
        ref={cardRef}
        chrome={editor.chrome}
        valueEditing={editor.valueEditing}
        template={template}
        name={templateName}
        record={record}
        app={app}
        sourcePath={notePath}
      />
      {footer}
      {props.children}
    </PaneEditContext.Provider>
  );
}
