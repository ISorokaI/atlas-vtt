import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type { App } from 'obsidian';
import { findBlock } from '../../model/treeQueries';
import { turnSelectionInto } from './blockActions';
import { clipOf } from './blockClipboard';
import { BlockToolbar } from './BlockToolbar';
import { InsertMenu } from './InsertMenu';
import { primaryOf } from './selection';
import type { SessionSnapshot } from './sessionTypes';
import type { ToolbarAction } from './toolbarMenu';
import { UndoToast } from './UndoToast';
import type { EditorState } from './useEditorState';
import { runBlockCommand, type KeyboardTarget } from './useTemplateKeyboard';

export interface EditorOverlaysProps {
  app: App | undefined;
  /** The layer over the editor that floating parts are drawn in. */
  layer: HTMLElement | null;
  stage: HTMLElement | null;
  snapshot: SessionSnapshot;
  state: EditorState;
  target: KeyboardTarget;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}

/**
 * What floats over the template editor: the selected block's toolbar, the
 * insert menu, the delete toast, and the polite live region every
 * announcement goes to, inside the view's own document.
 */
export function EditorOverlays({ app, layer, stage, snapshot, state, target, menuOpen, onMenuOpenChange }: EditorOverlaysProps): React.JSX.Element {
  const primary = primaryOf(state.selection);
  const block = primary ? findBlock(snapshot.template.layout.blocks, primary)?.block : undefined;

  const act = (action: ToolbarAction): void => {
    if (typeof action === 'string') runBlockCommand(target, action);
    else state.settle(turnSelectionInto(target.session, state.selection, action.turnInto));
  };

  return (
    <>
      {layer && stage && primary && block && state.editing === null && (
        <BlockToolbar
          layer={layer}
          stage={stage}
          blockId={primary}
          blockType={block.type}
          editable={!snapshot.readOnly}
          canPaste={clipOf(target.clipOwner) !== null}
          revision={snapshot.template}
          menuOpen={menuOpen}
          onMenuOpenChange={onMenuOpenChange}
          onAction={act}
        />
      )}
      <AnimatePresence>
        {layer && state.insertMenu && (
          <InsertMenu
            key={state.insertMenu.opening}
            layer={layer}
            anchor={state.insertMenu.anchor}
            app={app}
            onInsert={(item) => state.insert(item, state.insertMenu?.place)}
            onClose={state.closeInsert}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.toast && (
          <UndoToast key={state.toast.text} text={state.toast.text} onUndo={() => target.session.undo()} onDismiss={state.dismissToast} />
        )}
      </AnimatePresence>
      <div className="atlas-te-live" role="status" aria-live="polite">{state.said}</div>
    </>
  );
}
