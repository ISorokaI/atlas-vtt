import React, { useMemo, useState } from 'react';
import type { App } from 'obsidian';
import type { TemplateUsage } from '../../library/templateUsage';
import type { TemplateId } from '../../model/templateTypes';
import type { CollectionContext } from '../collectionContext';
import { BuiltInBar, CopySwitchBar } from './BuiltInBar';
import { ConflictBar } from './ConflictBar';
import { copySwitchFor, switchToCopy } from './copySwitch';
import type { EditorSession, SessionSnapshot } from './sessionTypes';
import { TemplateHeader } from './TemplateHeader';
import { duplicateTemplate, newStatblockFromTemplate, type TemplateTarget } from './templateEditorActions';

export interface EditorTopProps {
  app: App | undefined;
  session: EditorSession;
  snapshot: SessionSnapshot;
  usage: TemplateUsage;
  collection: CollectionContext | null;
  collectionId: string | null;
  onCollectionChange: (collectionId: string) => void;
  /** Opens a template here (a copy, asking about its use) or in a new tab. */
  openTemplate: (target: TemplateTarget, where: 'here' | 'tab', copiedFrom?: TemplateId) => void;
  openNote: (path: string) => void;
  onDelete: () => void;
  copiedFrom: TemplateId | null;
  onCopyQuestionDone: () => void;
}

/**
 * The editor's top (§7.4): the header, then the bars about the template: a
 * built-in's Make a copy, the question after the copy, a conflict with the file.
 */
export function EditorTop(props: EditorTopProps): React.JSX.Element {
  const { app, session, snapshot, collectionId, openTemplate, copiedFrom } = props;
  const [copying, setCopying] = useState(false);
  const question = useMemo(
    () => (app && copiedFrom ? copySwitchFor(app, copiedFrom, snapshot.id, collectionId) : null),
    [app, copiedFrom, snapshot.id, collectionId],
  );
  const copy = (where: 'here' | 'tab'): void => {
    if (!app) return;
    setCopying(true);
    void duplicateTemplate(app, snapshot.id).then((made) => {
      setCopying(false);
      if (made) openTemplate(made, where, where === 'here' ? snapshot.id : undefined);
    });
  };

  return (
    <div className="atlas-te-top">
      <TemplateHeader
        session={session}
        snapshot={snapshot}
        usage={props.usage}
        collection={props.collection}
        onCollectionChange={props.onCollectionChange}
        actions={{
          newStatblock: () => { if (app) void newStatblockFromTemplate(app, snapshot.id, collectionId); },
          duplicate: () => copy('tab'),
          delete: snapshot.path !== null && app ? props.onDelete : undefined,
          openNote: props.openNote,
        }}
      />
      {snapshot.readOnlyReason && (
        <BuiltInBar reason={snapshot.readOnlyReason} onCopy={app && !copying ? () => copy('here') : undefined} />
      )}
      {question && app && (
        <CopySwitchBar
          question={question}
          onSwitch={async () => {
            await switchToCopy(app, question);
            props.onCopyQuestionDone();
          }}
          onKeep={props.onCopyQuestionDone}
        />
      )}
      <ConflictBar session={session} snapshot={snapshot} />
    </div>
  );
}
