import React from 'react';
import type { App } from 'obsidian';
import { Button } from '../../../packages/components/primitives/button';
import type { ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import type { StatblockRole } from '../../model/roleTypes';
import { LinkedStatblock } from '../../render/LinkedStatblock';
import { PaneMenuButton } from './PaneMenuButton';

/** A line about the statblock, with at most one action (a button, or a `control` such as a menu): one step down the radius scale inside the pane. */
export function PaneBar({ text, action, onAction, control }: {
  text: React.ReactNode;
  action?: string | undefined;
  onAction?: (() => void) | undefined;
  control?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="atlas-sb-pane-bar" role="status">
      <span className="atlas-sb-pane-bar__text">{text}</span>
      {action && onAction && <Button type="button" variant="ghost" size="sm" onClick={onAction}>{action}</Button>}
      {control}
    </div>
  );
}

/** The note names a template the library does not hold: the card shows with the auto template. */
export function TemplateMissingBar({ templateId, onChoose }: { templateId: string; onChoose?: (() => void) | undefined }): React.JSX.Element {
  return <PaneBar text={<>Template <code>{templateId}</code> not found</>} action="Choose a template" onAction={onChoose} />;
}

export function NewerTemplateBar(): React.JSX.Element {
  return <PaneBar text="Update Atlas to edit this template" />;
}

/** The pair is over: the note closed, or a tab header unlinked it. Values show read-only. */
export function PartnerClosedBar({ onOpenNote }: { onOpenNote: () => void }): React.JSX.Element {
  return <PaneBar text="Open the note to edit" action="Open note" onAction={onOpenNote} />;
}

export function NoteDeletedBar(): React.JSX.Element {
  return <PaneBar text="Note deleted. What it held stays here until the pane closes." />;
}

export function WriteProblemBar({ problem }: { problem: string }): React.JSX.Element {
  return <PaneBar text={`Couldn't save: ${problem}`} />;
}

/** YAML Obsidian rejects: Atlas never writes into it (§7.2). */
export function UnreadableState({ line, onOpenNote }: { line: number | null; onOpenNote: () => void }): React.JSX.Element {
  const where = line === null ? '' : ` (line ${line})`;
  return (
    <div className="atlas-sb-pane-state">
      <PaneBar text={`The note's properties can't be read${where}`} action="Open note" onAction={onOpenNote} />
    </div>
  );
}

/** A Fantasy Statblocks statblock, read-only in its own look, under the bar that offers to adopt or copy it (§6.4). */
export function FantasyState({ app, notePath, bar }: { app: App; notePath: string; bar: React.ReactNode }): React.JSX.Element {
  return (
    <div className="atlas-sb-pane-state">
      {bar}
      <div className="atlas-sb-pane-card">
        <LinkedStatblock app={app} path={notePath} variant="full" />
      </div>
    </div>
  );
}

interface NoStatblockStateProps {
  roles: readonly StatblockRole[];
  /** Offered only once the creation flow is wired in. */
  onCreate?: ((roleId: string) => void) | undefined;
}

/** A note without a statblock: a ghost card, and Create statblock with the collection's roles (§7.2, §7.3). */
export function NoStatblockState({ roles, onCreate }: NoStatblockStateProps): React.JSX.Element {
  const [only] = roles;
  const entries: ContextMenuEntry[] = roles.map((role) => ({ type: 'item', label: role.name, onClick: () => onCreate?.(role.id) }));
  return (
    <div className="atlas-sb-pane-state">
      <div className="atlas-sb-pane-ghost">
        <span className="atlas-sb-pane-ghost__line atlas-sb-pane-ghost__line--title" />
        <span className="atlas-sb-pane-ghost__line" />
        <span className="atlas-sb-pane-ghost__line atlas-sb-pane-ghost__line--short" />
        <p className="atlas-sb-pane-ghost__text">No statblock in this note</p>
        {onCreate && roles.length > 1 && <PaneMenuButton entries={entries}>Create statblock</PaneMenuButton>}
        {onCreate && roles.length === 1 && only && (
          <Button type="button" variant="default" size="sm" onClick={() => onCreate(only.id)}>Create statblock</Button>
        )}
      </div>
    </div>
  );
}
