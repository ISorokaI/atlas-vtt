import React, { useEffect, useMemo, useState } from 'react';
import type { App } from 'obsidian';
import type { TemplateId } from '../../../model/templateTypes';
import { ConflictBar } from '../ConflictBar';
import { copySwitchFor, switchToCopy } from '../copySwitch';
import { EditorBar } from '../EditorBar';
import type { EditorSession, SessionSnapshot } from '../sessionTypes';
import { CopySwitchBar } from './CopySwitchBar';

/** Autosave is quiet: "Saving…" shows only once a write has taken this long. */
const SAVING_SHOWN_AFTER_MS = 1000;

/** True once `waiting` has held for `ms` without a break. */
function useAfter(waiting: boolean, ms: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    setLate(false);
    if (!waiting) return undefined;
    const timer = window.setTimeout(() => setLate(true), ms);
    return () => window.clearTimeout(timer);
  }, [waiting, ms]);
  return late;
}

export interface TemplateStateBarsProps {
  app: App | undefined;
  session: EditorSession;
  snapshot: SessionSnapshot;
  collectionId: string | null;
  /** The built-in this template was just copied from: the question whether its statblocks move over. */
  copiedFrom: TemplateId | null;
  onCopyQuestionDone: () => void;
}

/**
 * The template editor's lines above the card (§2.3), in the state-bar slot
 * where a note shows its own: a conflict with the file, a save that failed or
 * takes long, and after a copy of a built-in the question about its statblocks.
 */
export function TemplateStateBars({ app, session, snapshot, collectionId, copiedFrom, onCopyQuestionDone }: TemplateStateBarsProps): React.JSX.Element {
  const question = useMemo(
    () => (app && copiedFrom ? copySwitchFor(app, copiedFrom, snapshot.id, collectionId) : null),
    [app, copiedFrom, snapshot.id, collectionId],
  );
  const saving = useAfter(!snapshot.readOnly && snapshot.saveState === 'saving', SAVING_SHOWN_AFTER_MS);

  return (
    <>
      <ConflictBar session={session} snapshot={snapshot} />
      {snapshot.saveState === 'error' && !snapshot.readOnly && (
        <EditorBar
          tone="warning"
          text={snapshot.saveProblem ?? 'Couldn\'t save.'}
          actions={[{ label: 'Retry', onClick: () => { void session.flush(); } }]}
        />
      )}
      {saving && <p className="atlas-te-saving" role="status">Saving…</p>}
      {question && app && (
        <CopySwitchBar
          question={question}
          onSwitch={async () => {
            await switchToCopy(app, question);
            onCopyQuestionDone();
          }}
          onKeep={onCopyQuestionDone}
        />
      )}
    </>
  );
}
