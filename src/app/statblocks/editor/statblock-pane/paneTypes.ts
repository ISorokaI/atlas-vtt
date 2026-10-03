import type { App } from 'obsidian';
import type { PaneServices } from '../paneServices';

/** What the pane's note is, as far as editing goes. */
export type PaneNoteKind =
  | 'loading'
  /** A native statblock: values are edited here. */
  | 'atlas'
  /** A Fantasy Statblocks statblock: shown read-only. */
  | 'fantasy'
  | 'none'
  /** Its YAML is broken: Atlas never writes into it. */
  | 'unreadable'
  | 'deleted';

/**
 * Actions the pane hands back to its view, and the ones other parts of Atlas
 * wire in: a pane offers an action of the second kind only once it is given.
 */
export interface StatblockPaneActions {
  /** Opens the note beside the pane again, or focuses it. */
  openNote: () => void;
  openInNewWindow: () => void;
  /** Shows the note's Properties for this pair (D7). */
  showProperties: () => void;
  changeCollection: (collectionId: string) => void;
  /** What the note is now; the view hides Properties only beside a native statblock. */
  reportKind: (kind: PaneNoteKind) => void;
  createStatblock?: ((notePath: string, roleId: string, collectionId: string) => void) | undefined;
  editTemplate?: ((templateId: string, collectionId: string) => void) | undefined;
  linkToToken?: ((notePath: string, collectionId: string) => void) | undefined;
  addToTemplate?: ((templateId: string, key: string) => void) | undefined;
}

/** The input being edited registers its commit here, so closing the pane mid-word keeps the word. */
export interface PendingCommit {
  current: (() => Promise<void>) | null;
}

export interface StatblockPaneProps {
  app: App;
  services: PaneServices;
  notePath: string;
  /** The collection the view state names; null until one is chosen. */
  collectionId: string | null;
  /** Whether the note is open beside the pane, in its pair. */
  paired: boolean;
  /** Whether Properties show beside this pane (the user chose Show Properties). */
  propertiesShown: boolean;
  /** The last thing said to assistive technology ("Undid in Marsh Warden."). */
  announcement: string;
  /** Raised when the pair was just opened: focus moves to the first empty value. */
  focusRequest: number;
  pendingCommit: PendingCommit;
  actions: StatblockPaneActions;
}
