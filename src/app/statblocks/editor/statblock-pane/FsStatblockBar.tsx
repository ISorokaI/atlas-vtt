import React, { useCallback, useRef } from 'react';
import type { App } from 'obsidian';
import { Button } from '../../../packages/components/primitives/button';
import { isFantasyStatblocksAvailable } from '../../../services/FantasyStatblocksService';
import type { FrontmatterRecord } from '../../notes/statblockSource';
import type { PaneServices } from '../paneServices';
import { PaneBar } from './PaneStates';
import { PaneMenuButton } from './PaneMenuButton';
import { useFenceCopy, useFsAdoption } from './useFsAdoption';

export const EDIT_WITH_TEMPLATE = 'Edit with an Atlas template';
export const COPY_INTO_STATBLOCK = 'Copy into a new statblock';

export interface FsStatblockBarProps {
  app: App;
  notePath: string;
  record: FrontmatterRecord;
  /** The statblock is a ```statblock fence (or `statblock: inline`): it is copied, never changed in place. */
  fence: boolean;
  collectionId: string | null;
  writer: PaneServices['writer'];
  onWriteProblem: (problem: string | null) => void;
}

/** "Copy into a new statblock": a button with one role, the role menu with several. */
function FenceCopyBar({ app, notePath, collectionId }: Pick<FsStatblockBarProps, 'app' | 'notePath' | 'collectionId'>): React.JSX.Element {
  const entries = useFenceCopy(app, notePath, collectionId);
  const [only] = entries;
  const control = entries.length === 1 && only?.type === 'item'
    ? <Button type="button" variant="ghost" size="sm" onClick={() => { void only.onClick(); }}>{COPY_INTO_STATBLOCK}</Button>
    : <PaneMenuButton entries={entries} disabled={entries.length === 0}>{COPY_INTO_STATBLOCK}</PaneMenuButton>;
  return <PaneBar text="Made with Fantasy Statblocks" control={control} />;
}

/** "Edit with an Atlas template": the template of the note's layout and the roles' templates. */
function AdoptionBar(props: FsStatblockBarProps): React.JSX.Element {
  const anchor = useRef<HTMLButtonElement>(null);
  const doc = useCallback((): Document => anchor.current?.ownerDocument ?? activeDocument, []);
  const entries = useFsAdoption({ ...props, doc });
  // Without the plugin the values are edited right here, drawn with the auto template.
  const text = isFantasyStatblocksAvailable() ? 'Made with Fantasy Statblocks' : 'Shown with Atlas\' field layout';
  return (
    <PaneBar
      text={text}
      control={<PaneMenuButton ref={anchor} entries={entries} disabled={entries.length === 0}>{EDIT_WITH_TEMPLATE}</PaneMenuButton>}
    />
  );
}

/**
 * The bar over a statblock of Fantasy Statblocks in the pane (§6.4): a
 * frontmatter statblock can take an Atlas template, a fence is copied into a
 * new native statblock. The Fantasy Statblocks note itself is never rewritten
 * beyond its one `atlas-template` key.
 */
export function FsStatblockBar(props: FsStatblockBarProps): React.JSX.Element {
  return props.fence ? <FenceCopyBar app={props.app} notePath={props.notePath} collectionId={props.collectionId} /> : <AdoptionBar {...props} />;
}
