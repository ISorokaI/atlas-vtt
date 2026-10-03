import React, { useEffect, useRef } from 'react';
import type { App } from 'obsidian';
import type { StatblockTemplate } from '../../model/templateTypes';
import { BlockChromeContext } from '../../render/blockChrome';
import { StatblockSheet } from '../../render/StatblockSheet';
import { ValueEditingContext } from '../../render/valueSlot';
import { isEmptyValue } from '../../values/emptyValue';
import { readField, type FieldRecord } from '../../values/fieldValues';
import type { PaneServices } from '../paneServices';
import { PaneEditContext } from './paneEditContext';
import type { PendingCommit } from './paneTypes';
import { usePaneEditor } from './usePaneEditor';

export interface PaneCanvasProps {
  app: App;
  services: PaneServices;
  notePath: string;
  template: StatblockTemplate;
  /** The template's name: `data-template` on the card. */
  templateName: string;
  record: FieldRecord;
  writable: boolean;
  pendingCommit: PendingCommit;
  /** Shown above the blocks, inside the card. */
  header?: React.ReactNode;
  /** Raised to move focus to the first empty value (a pair just opened); 0 never does. */
  focusRequest: number;
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
  const { app, notePath, template, templateName, record, header, focusRequest, writable } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const editor = usePaneEditor({ ...props, cardRef });
  const handledRequest = useRef(0);
  const { spots } = editor.controller;

  // A pair opens with focus on the first empty value; a restored workspace never moves focus.
  useEffect(() => {
    if (focusRequest === handledRequest.current || !writable) return;
    handledRequest.current = focusRequest;
    const empty = spots.order.find((spot) => isEmptyValue(readField(record, spot.field).value)) ?? spots.order[0];
    if (!empty) return;
    cardRef.current?.querySelector<HTMLElement>(`[data-block-id="${empty.blockId}"]`)?.focus({ preventScroll: true });
  }, [focusRequest, writable, spots, record]);

  return (
    <PaneEditContext.Provider value={editor.controller}>
      <div ref={cardRef} className="atlas-sb-pane-card" data-columns={template.layout.maxColumns}>
        <BlockChromeContext.Provider value={editor.chrome}>
          <ValueEditingContext.Provider value={editor.valueEditing}>
            <StatblockSheet
              template={template}
              name={templateName}
              fields={record}
              variant="full"
              mode="editing"
              app={app}
              sourcePath={notePath}
              header={header}
            />
          </ValueEditingContext.Provider>
        </BlockChromeContext.Provider>
      </div>
      {props.children}
    </PaneEditContext.Provider>
  );
}
