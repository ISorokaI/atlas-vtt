import React, { useEffect, useRef, useState } from 'react';
import type { App } from 'obsidian';
import { useTemplateLibrary } from '../../library/useTemplateLibrary';
import { deleteTemplate } from '../../library/templateActions';
import type { TemplateId } from '../../model/templateTypes';
import { BlankCard } from './BlankCard';
import { Canvas } from './Canvas';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { TemplateEditorContext, type TemplateEditorContextValue } from './editorContext';
import { EditorOverlays } from './EditorOverlays';
import { EditorTop } from './EditorTop';
import { PreviewPicker } from './PreviewPicker';
import type { BlockSelection } from './selection';
import type { EditorSession } from './sessionTypes';
import { useCollectionFieldKeys } from './useCollectionFieldKeys';
import { useEditorCollection, useEditorLayout } from './useEditorFrame';
import { useSessionSnapshot } from './useEditorSession';
import { useEditorState } from './useEditorState';
import { usePreviewRecord } from './usePreviewRecord';
import { useTemplateKeyboard, type KeyboardTarget, type KeyHandler } from './useTemplateKeyboard';
import { useTemplateUsage } from './useTemplateUsage';
import type { TemplateTarget } from './templateEditorActions';
import './template-editor.scss';

/** What the editor asks of the view that hosts it. */
export interface TemplateEditorHost {
  /** Opens a template: in this tab (the copy of a built-in, asking about its use) or in a new one. */
  openTemplate: (target: TemplateTarget, where: 'here' | 'tab', copiedFrom?: TemplateId) => void;
  openNote: (path: string) => void;
  /** The template was deleted from here. */
  close: () => void;
}

export interface TemplateEditorProps {
  app?: App | undefined;
  session: EditorSession;
  host: TemplateEditorHost;
  /** The statblock shown in place of sample values ("Edit template" from a statblock). */
  previewPath: string | null;
  onPreviewPathChange: (path: string | null) => void;
  collectionId: string | null;
  onCollectionChange: (collectionId: string) => void;
  initialSelection?: BlockSelection | undefined;
  /** The built-in this template was just copied from: the editor asks whether its statblocks move over. */
  copiedFrom?: TemplateId | null | undefined;
  onCopyQuestionDone?: (() => void) | undefined;
  /** The left pane (Blocks, Outline, Fields) and the inspector; the layout holds without them. */
  leftPanel?: React.ComponentType | undefined;
  inspector?: React.ComponentType | undefined;
  /** The view's key scope asks this handler first (§7.7). */
  registerKeys?: ((handler: KeyHandler | null) => void) | undefined;
}

/** Shares copied blocks where no app does (a test without Obsidian). */
const LOCAL_CLIPS = {};

/**
 * The template editor (§7.4): the header and the bars about the template,
 * then the left pane, the canvas and the inspector. Everything it changes goes
 * through the session, one undo step per action.
 */
export function TemplateEditor(props: TemplateEditorProps): React.JSX.Element {
  const { app, session, host, leftPanel: LeftPanel, inspector: Inspector, registerKeys } = props;
  const snapshot = useSessionSnapshot(session);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const layout = useEditorLayout(rootRef);
  const collection = useEditorCollection(app, props.collectionId);
  const collectionId = collection?.collectionId ?? props.collectionId;
  const collectionKeys = useCollectionFieldKeys(app, collectionId);
  const usage = useTemplateUsage(app, snapshot.id);
  const preview = usePreviewRecord(app, snapshot.template, props.previewPath);
  const library = useTemplateLibrary(app ?? null);
  const state = useEditorState({ session, snapshot, collectionKeys, stageRef, layer, initialSelection: props.initialSelection });
  const editable = !snapshot.readOnly;

  const target: KeyboardTarget = {
    rootRef, session, selection: state.selection, drawn: state.drawn, select: state.select, settle: state.settle,
    editLabel: state.editLabel, openInsert: () => state.openInsert(), openMenu: () => setMenuOpen(true), clipOwner: app ?? LOCAL_CLIPS,
  };
  const onKey = useTemplateKeyboard(target);
  useEffect(() => {
    registerKeys?.(onKey);
    return () => registerKeys?.(null);
  }, [registerKeys, onKey]);

  const context: TemplateEditorContextValue = {
    app, session, snapshot, selection: state.selection, select: state.select, insert: (item) => state.insert(item),
    editLabel: state.editLabel, announce: state.announce, collectionId, collectionKeys, layout,
  };

  return (
    <TemplateEditorContext.Provider value={context}>
      <div
        ref={rootRef}
        className="atlas-te"
        data-layout={layout}
        data-has-left={LeftPanel ? '' : undefined}
        data-has-inspector={Inspector ? '' : undefined}
        onKeyDown={(event) => {
          if (!onKey(event.nativeEvent)) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <EditorTop
          app={app}
          session={session}
          snapshot={snapshot}
          usage={usage}
          collection={collection}
          collectionId={collectionId}
          onCollectionChange={props.onCollectionChange}
          openTemplate={host.openTemplate}
          openNote={host.openNote}
          onDelete={() => setDeleting(true)}
          copiedFrom={props.copiedFrom ?? null}
          onCopyQuestionDone={() => props.onCopyQuestionDone?.()}
        />
        <div className="atlas-te-body">
          {LeftPanel && <aside className="atlas-te-left" data-te-region="left"><LeftPanel /></aside>}
          <div className="atlas-te-main">
            {state.hinted && editable && (
              <p className="atlas-te-hint">{LeftPanel ? 'Add blocks from the left, or press / to add one.' : 'Press / to add a block.'}</p>
            )}
            <Canvas
              stageRef={stageRef}
              app={app}
              template={snapshot.template}
              templateName={snapshot.name}
              record={preview.record}
              sourcePath={preview.sourcePath}
              selection={state.selection}
              editable={editable}
              label={state.editing}
              washId={state.washId}
              onWashed={state.clearWash}
              onSelect={(selection) => state.select(selection, false)}
              onEditLabel={state.editLabel}
              onInsertAt={state.openInsertAtGap}
              focusRequest={state.focusRequest}
              previewBar={(
                <div className="atlas-te-preview-bar" data-te-region="preview">
                  <PreviewPicker notes={usage.notes} value={preview.missing ? null : props.previewPath} onChange={props.onPreviewPathChange} />
                </div>
              )}
              empty={<BlankCard onInsert={editable ? (item) => state.insert(item) : undefined} />}
            />
          </div>
          {Inspector && <aside className="atlas-te-inspector" data-te-region="inspector"><Inspector /></aside>}
        </div>
        <div ref={setLayer} className="atlas-te-layer" />
        <EditorOverlays
          app={app}
          layer={layer}
          stage={stageRef.current}
          snapshot={snapshot}
          state={state}
          target={target}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
        />
        {deleting && rootRef.current && app && (
          <DeleteTemplateDialog
            anchor={rootRef.current}
            name={snapshot.name}
            templateId={snapshot.id}
            usage={usage}
            templates={library?.templates ?? []}
            onDelete={async (replacement) => {
              await deleteTemplate(app, snapshot.id, replacement);
              setDeleting(false);
              host.close();
            }}
            onClose={() => setDeleting(false)}
          />
        )}
      </div>
    </TemplateEditorContext.Provider>
  );
}
