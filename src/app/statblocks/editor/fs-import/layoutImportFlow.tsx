/**
 * The ways into a Fantasy Statblocks import that are no React tree of their
 * own (the gallery as it closes, the pane, a command, the file menu): the
 * import, the template opened in the template editor, and the report, shown
 * where it has something to say.
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence } from 'framer-motion';
import { Notice, type App } from 'obsidian';
import { identityOf, importFsLayout, readLayoutText, type FsLayoutImport, type LayoutIdentity } from '../../fs/fsImport';
import { notesUsingLayout } from '../../fs/fsLayoutNotes';
import { firstBlockId } from '../gallery/gallerySources';
import { TemplateLibrary } from '../../library/TemplateLibrary';
import { openTemplateEditor } from '../openTemplateEditor';
import { LayoutImportDialog, type LayoutImportDialogProps } from './LayoutImportDialog';

type HostedDialog = Omit<LayoutImportDialogProps, 'onClose'>;

function DialogHost({ dialog, onGone }: { dialog: HostedDialog; onGone: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <AnimatePresence onExitComplete={onGone}>
      {open && <LayoutImportDialog key="layout-import" {...dialog} onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}

/** Shows the dialog in `dialog.doc`; focus goes back where it was once it has left. */
export function showLayoutImportDialog(dialog: HostedDialog): void {
  const { doc } = dialog;
  const previous = doc.activeElement;
  const container = doc.body.createDiv({ cls: 'atlas-fs-import-host' });
  const root = createRoot(container);
  const onGone = (): void => {
    // Never inside React's own commit.
    queueMicrotask(() => {
      root.unmount();
      container.remove();
      if (previous?.instanceOf(HTMLElement) && previous.isConnected) previous.focus({ preventScroll: true });
    });
  };
  root.render(<DialogHost dialog={dialog} onGone={onGone} />);
}

/** Opens the layout's template in the template editor, its first block selected. */
export function openImportedTemplate(app: App, imported: FsLayoutImport, collectionId: string | null): Promise<unknown> {
  const template = TemplateLibrary.forApp(app).get(imported.id)?.template;
  return openTemplateEditor(app, {
    templateId: imported.id,
    path: imported.path,
    collectionId,
    select: template ? firstBlockId(template) ?? undefined : undefined,
  });
}

export interface ImportOutcomeOptions {
  collectionId?: string | null;
  /** Offers Open template; unset where the template is open already. */
  offerOpen?: boolean;
  /** A note that takes the template already (the pane's own), left out of the batch. */
  except?: string;
}

/**
 * After an import: the report, and the batch for the statblocks the layout
 * draws. Nothing shows for a layout imported before that draws no statblock
 * still waiting for its template.
 */
export function showImportOutcome(app: App, doc: Document, layout: LayoutIdentity, imported: FsLayoutImport, options: ImportOutcomeOptions = {}): void {
  const notes = notesUsingLayout(app, layout).filter((path) => path !== options.except);
  if (!imported.report && notes.length === 0) return;
  const collectionId = options.collectionId ?? null;
  showLayoutImportDialog({
    app,
    doc,
    layout,
    imported,
    notes,
    onOpenTemplate: options.offerOpen ? () => { void openImportedTemplate(app, imported, collectionId); } : undefined,
  });
}

/** Imports a layout file, opens its template and shows the report; a file that is no layout says so. */
export async function importLayoutFile(app: App, text: string, doc: Document): Promise<void> {
  const read = readLayoutText(text);
  if ('problem' in read) {
    new Notice(read.problem);
    return;
  }
  const imported = await importFsLayout(app, read.layout);
  await openImportedTemplate(app, imported, null);
  showImportOutcome(app, doc, identityOf(read.layout), imported);
}
