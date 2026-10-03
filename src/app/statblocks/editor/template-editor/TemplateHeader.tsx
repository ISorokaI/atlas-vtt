import React from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { ActionsMenuButton } from '../../../packages/components/shared/ActionsMenuButton';
import { Button } from '../../../packages/components/primitives/button';
import { ToolButton } from '../../../packages/components/primitives/ToolButton';
import type { ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import type { TemplateUsage } from '../../library/templateUsage';
import type { CollectionContext } from '../collectionContext';
import { CollectionChip } from '../statblock-pane/CollectionChip';
import { PaneMenuButton } from '../statblock-pane/PaneMenuButton';
import type { EditorSession, SessionSnapshot } from './sessionTypes';
import { shortcutText } from './shortcutText';
import { TemplateNameField } from './TemplateNameField';

/** At most this many statblocks are listed under "Used by"; the count says how many there are. */
const LISTED_NOTES = 50;

export interface TemplateHeaderActions {
  newStatblock: () => void;
  duplicate: () => void;
  /** Unset for templates that cannot be deleted (built-ins). */
  delete?: (() => void) | undefined;
  openNote: (path: string) => void;
}

export interface TemplateHeaderProps {
  session: EditorSession;
  snapshot: SessionSnapshot;
  usage: TemplateUsage;
  collection: CollectionContext | null;
  onCollectionChange: (collectionId: string) => void;
  actions: TemplateHeaderActions;
}

function noteName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/i, '');
}

/** "Saved", "Saving…" or "Couldn't save: <reason>" with Retry; nothing for a template that is not saved here. */
function SaveStateText({ session, snapshot }: { session: EditorSession; snapshot: SessionSnapshot }): React.JSX.Element | null {
  if (snapshot.readOnly || snapshot.saveState === 'conflict') return null;
  if (snapshot.saveState === 'error') {
    return (
      <span className="atlas-te-save atlas-te-save--error" role="status">
        {/* The session words it: "Couldn't save: <reason>. Retrying". */}
        <span className="atlas-te-save__text">{snapshot.saveProblem ?? 'Couldn\'t save.'}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => { void session.flush(); }}>Retry</Button>
      </span>
    );
  }
  return <span className="atlas-te-save" role="status">{snapshot.saveState === 'saved' ? 'Saved' : 'Saving…'}</span>;
}

function UsageButton({ usage, openNote }: { usage: TemplateUsage; openNote: (path: string) => void }): React.JSX.Element {
  const count = usage.notes.length;
  if (count === 0) return <span className="atlas-te-usage atlas-te-usage--none">Not used yet</span>;
  const entries: ContextMenuEntry[] = usage.notes.slice(0, LISTED_NOTES).map((path) => ({
    type: 'item', label: noteName(path), icon: 'scroll-text', onClick: () => openNote(path),
  }));
  return (
    <PaneMenuButton className="atlas-te-usage" entries={entries}>
      {`Used by ${count} ${count === 1 ? 'statblock' : 'statblocks'}`}
    </PaneMenuButton>
  );
}

/**
 * The template editor's header (§7.4): the name, edited in place; what uses
 * the template; the collection the editor works for; undo, redo and a quiet
 * save state; and the "…" menu.
 */
export function TemplateHeader({ session, snapshot, usage, collection, onCollectionChange, actions }: TemplateHeaderProps): React.JSX.Element {
  const more: ContextMenuEntry[] = [
    { type: 'item', label: 'New statblock from this template', icon: 'file-plus', onClick: actions.newStatblock },
    { type: 'item', label: 'Duplicate', icon: 'copy', onClick: actions.duplicate },
    { type: 'item', label: 'Delete…', icon: 'trash-2', destructive: true, disabled: !actions.delete, onClick: () => actions.delete?.() },
  ];
  const rename = async (name: string): Promise<string | null> => {
    const result = await session.rename(name);
    return result.ok ? null : result.problem;
  };

  return (
    <div className="atlas-te-header" role="toolbar" aria-label="Template" data-te-region="header">
      <TemplateNameField name={snapshot.name} editable={!snapshot.readOnly && snapshot.path !== null} onRename={rename} />
      <UsageButton usage={usage} openNote={actions.openNote} />
      {collection && <CollectionChip context={collection} onChange={onCollectionChange} />}
      <span className="atlas-te-header__end">
        <ToolButton icon={Undo2} label="Undo" shortcut={shortcutText(['Mod'], 'Z')} isActive={false} disabled={!snapshot.canUndo} onClick={() => session.undo()} />
        <ToolButton icon={Redo2} label="Redo" shortcut={shortcutText(['Mod', 'Shift'], 'Z')} isActive={false} disabled={!snapshot.canRedo} onClick={() => session.redo()} />
        <SaveStateText session={session} snapshot={snapshot} />
        <ActionsMenuButton label="More template actions" entries={more} className="atlas-te-header__more" />
      </span>
    </div>
  );
}
