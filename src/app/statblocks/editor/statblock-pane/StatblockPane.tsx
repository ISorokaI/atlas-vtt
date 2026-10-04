import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAtlasSettings } from '../../../keyboard/useMapHotkeys';
import { useBestiaryRevision } from '../../../react/hooks/useBestiaryRevision';
import { SettingsService } from '../../../services/SettingsService';
import { StatblockSkeleton } from '../../../react/components/statblock/StatblockSkeleton';
import { isFantasyStatblocksAvailable } from '../../../services/FantasyStatblocksService';
import { useTemplateLibrary } from '../../library/useTemplateLibrary';
import type { TemplateId } from '../../model/templateTypes';
import { frontmatterSource } from '../../notes/statblockSource';
import { saveStatblockAsTemplate } from '../gallery/galleryActions';
import { setStatblockPaneSettings, statblockPaneSettings } from '../paneSettings';
import { templateKeyPatch } from './addFieldFlow';
import { AddFieldRow } from './AddFieldRow';
import { ChangeTemplateDialog } from './ChangeTemplateDialog';
import { noteKeyChoice } from './fieldChoices';
import { MorePropertiesTray } from './MorePropertiesTray';
import { PaneCanvas } from './PaneCanvas';
import { PaneHeader } from './PaneHeader';
import { headerTemplate } from './paneHeaderTemplate';
import { FsStatblockBar } from './FsStatblockBar';
import {
  FantasyState, NewerTemplateBar, NoStatblockState, NoteDeletedBar, PartnerClosedBar, TemplateMissingBar, UnreadableState, WriteProblemBar,
} from './PaneStates';
import type { StatblockPaneProps } from './paneTypes';
import { usePaneCollection } from './usePaneCollection';
import { usePaneNote } from './usePaneNote';
import { usePaneTemplate } from './usePaneTemplate';
import { useAddField } from './useAddField';
import './statblock-pane.scss';

/**
 * The statblock pane (§7.2): a header, then the note's statblock as the
 * runtime card with its values editable in place, the first-visit hint and
 * the tray of the note's other properties; or, for every other kind of note,
 * the state the plan's edge-state table names.
 */
export function StatblockPane(props: StatblockPaneProps): React.JSX.Element {
  const { app, services, notePath, paired, actions } = props;
  const note = usePaneNote(app, services, notePath);
  const collection = usePaneCollection(app, notePath, props.collectionId, actions.changeCollection);
  const paneTemplate = usePaneTemplate(app, note.templateId, note.record);
  const library = useTemplateLibrary(app);
  const settings = useAtlasSettings(SettingsService.forApp(app));
  // Draws again once Fantasy Statblocks loads, which decides how its statblocks are edited here.
  useBestiaryRevision(app);
  const [choosing, setChoosing] = useState(false);
  const [writeProblem, setWriteProblem] = useState<string | null>(null);
  // The view's announcements (undo, redo) and the pane's own (a deleted entry), the latest one said.
  const [said, setSaid] = useState(props.announcement);
  useEffect(() => setSaid(props.announcement), [props.announcement]);
  const rootRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLButtonElement>(null);
  const trayRef = useRef<HTMLButtonElement>(null);
  const collectionId = collection.context?.collectionId ?? props.collectionId;

  useEffect(() => actions.reportKind(note.kind), [actions, note.kind]);
  useEffect(() => setWriteProblem(null), [notePath]);

  const applyTemplate = useCallback((templateId: TemplateId): void => {
    setChoosing(false);
    void services.writer.write(notePath, [templateKeyPatch(note.record, templateId)]).then((outcome) => {
      setWriteProblem(outcome.conflicts.length ? 'the note\'s template changed meanwhile.' : outcome.problem);
    });
  }, [services, notePath, note.record]);

  const onExit = useCallback((step: 1 | -1): void => {
    (step === 1 ? trayRef.current : templateRef.current)?.focus();
  }, []);
  const onCommitted = useCallback((): void => {
    if (settings && !statblockPaneSettings(settings).hintDismissed) setStatblockPaneSettings(settings, { hintDismissed: true });
  }, [settings]);

  // A Fantasy Statblocks statblock: a frontmatter one is edited right here while the plugin is missing (§6.4).
  const fsKind = note.kind === 'fantasy' ? frontmatterSource(note.record)?.kind ?? 'fs-fence' : null;
  const editsDirectly = paired && fsKind === 'fs-frontmatter' && !isFantasyStatblocksAvailable();
  const writable = paired && (note.kind === 'atlas' || editsDirectly) && paneTemplate.status !== 'loading';
  const adder = useAddField({
    app, notePath, record: note.record, collectionId, writer: services.writer, announce: setSaid, openTemplate: actions.openTemplateAt,
    entry: writable && paneTemplate.status === 'ok' ? paneTemplate.entry : null,
  });
  // Without Fantasy Statblocks its statblocks show with the auto template, which can become a template of their own (§6.4).
  const savable = editsDirectly;
  const fsBar = fsKind !== null && (paired ? (
    <FsStatblockBar
      app={app} notePath={notePath} record={note.record} fence={fsKind === 'fs-fence'} collectionId={collectionId}
      writer={services.writer} onWriteProblem={setWriteProblem}
    />
  ) : <PartnerClosedBar onOpenNote={actions.openNote} />);
  const header = headerTemplate({
    note, paneTemplate, roles: collection.roles, collectionId, actions, app,
    choose: paired ? () => setChoosing(true) : undefined,
  });

  const body = ((): React.ReactNode => {
    switch (note.kind) {
      case 'loading': return <StatblockSkeleton className="atlas-sb-pane-card" />;
      case 'unreadable': return <UnreadableState line={note.snapshot.problem?.line ?? null} onOpenNote={actions.openNote} />;
      case 'fantasy': if (!editsDirectly) return <FantasyState app={app} notePath={notePath} bar={fsBar} />; break;
      case 'none': {
        const create = actions.createStatblock;
        return <NoStatblockState roles={collection.roles} onCreate={create && collectionId ? (roleId) => create(notePath, roleId, collectionId) : undefined} />;
      }
      case 'atlas': case 'deleted': break;
    }
    if (paneTemplate.status === 'loading') return <StatblockSkeleton className="atlas-sb-pane-card" />;
    const bars = (
      <>
        {note.kind === 'deleted' && <NoteDeletedBar />}
        {editsDirectly && fsBar}
        {note.kind === 'atlas' && !paired && <PartnerClosedBar onOpenNote={actions.openNote} />}
        {paneTemplate.status === 'missing' && note.templateId && <TemplateMissingBar templateId={note.templateId} onChoose={paired ? () => setChoosing(true) : undefined} />}
        {paneTemplate.status === 'newer' && <NewerTemplateBar />}
        {writeProblem && <WriteProblemBar problem={writeProblem} />}
      </>
    );
    const hint = writable && settings && !statblockPaneSettings(settings).hintDismissed;
    return (
      <>
        {hint && <p className="atlas-sb-pane-hint-line">Click a value to change it. Tab moves to the next.</p>}
        <PaneCanvas
          // One editing session per note: what was typed for a note is written to that note, never the next one.
          key={notePath}
          app={app}
          services={services}
          notePath={notePath}
          template={paneTemplate.template}
          templateName={paneTemplate.name}
          record={note.record}
          writable={writable}
          pendingCommit={props.pendingCommit}
          header={bars}
          footer={writable && paneTemplate.status === 'ok' && (
            <AddFieldRow
              app={app}
              adder={adder}
              collectionId={collectionId}
              template={paneTemplate.template}
              templateName={paneTemplate.name}
              record={note.record}
            />
          )}
          focusRequest={props.focusRequest}
          onExit={onExit}
          onCommitted={onCommitted}
          onWriteProblem={setWriteProblem}
          announce={setSaid}
        >
          {writable && (
            <MorePropertiesTray
              ref={trayRef}
              record={note.record}
              template={paneTemplate.template}
              onAddToTemplate={actions.openTemplateAt && paneTemplate.status === 'ok' ? (key) => adder.choose(noteKeyChoice(key, note.record), true) : undefined}
            />
          )}
        </PaneCanvas>
      </>
    );
  })();

  return (
    <div ref={rootRef} className="atlas-sb-pane">
      <PaneHeader
        ref={templateRef}
        collection={collection.context}
        onCollectionChange={actions.changeCollection}
        template={header}
        showProperties={paired && note.kind === 'atlas' && !props.propertiesShown ? actions.showProperties : undefined}
        openInNewWindow={actions.openInNewWindow}
        linkToToken={actions.linkToToken && collectionId ? () => actions.linkToToken?.(notePath, collectionId) : undefined}
        saveAsTemplate={savable ? () => { void saveStatblockAsTemplate(app, notePath, note.record, collectionId); } : undefined}
      />
      <div className="atlas-sb-pane-body">{body}</div>
      <div className="atlas-sb-pane-live" role="status" aria-live="polite">{said}</div>
      {choosing && rootRef.current && library && (
        <ChangeTemplateDialog
          app={app}
          anchor={rootRef.current}
          notePath={notePath}
          record={note.record}
          currentId={note.templateId}
          templates={library.templates}
          roles={collection.roles}
          onApply={applyTemplate}
          onClose={() => setChoosing(false)}
        />
      )}
    </div>
  );
}
