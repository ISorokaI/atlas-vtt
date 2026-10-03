import React, { useEffect, useReducer } from 'react';
import { Pencil } from 'lucide-react';
import type { App } from 'obsidian';
import { Button } from '../../packages/components/primitives/button';
import { useExperimentalFeature } from '../../react/hooks/useExperimentalFeature';
import { SettingsService } from '../../services/SettingsService';
import { LinkedStatblock } from './LinkedStatblock';
import { useNativeTemplateId } from './useLinkedStatblock';
import './statblock-fence.scss';

export interface FenceStatblockProps {
  app: App;
  /** The note the fence stands in. */
  path: string;
  /** Opens the statblock editor for the note; the plugin hands it in, so rendering never loads the editor. */
  onEdit?: ((path: string) => void) | undefined;
}

/** Whether the note is a native statblock now; read again whenever the metadata cache reads the note. */
function useNativeNote(app: App, path: string): boolean {
  const [, refresh] = useReducer((count: number): number => count + 1, 0);
  useEffect(() => {
    const ref = app.metadataCache.on('changed', (file) => {
      if (file.path === path) refresh();
    });
    return () => app.metadataCache.offref(ref);
  }, [app, path]);
  return useNativeTemplateId(app, path, undefined) !== null;
}

/**
 * What a note's `atlas-statblock` fence shows (D14): the note's statblock and,
 * above it for a native statblock while the statblock editor is switched on,
 * **Edit statblock**, which opens the pair.
 */
export function FenceStatblock({ app, path, onEdit }: FenceStatblockProps): React.JSX.Element {
  const editorOn = useExperimentalFeature('statblockEditor', SettingsService.forApp(app));
  const native = useNativeNote(app, path);
  return (
    <>
      {onEdit && editorOn && native && (
        <div className="atlas-vtt-plugin atlas-statblock-fence__bar">
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(path)}>
            <Pencil aria-hidden />
            Edit statblock
          </Button>
        </div>
      )}
      <LinkedStatblock app={app} path={path} variant="full" />
    </>
  );
}
