import { useEffect, useMemo, useState } from 'react';
import { TFile, type App } from 'obsidian';
import { sampleRecord } from '../../model/sampleValues';
import type { StatblockTemplate } from '../../model/templateTypes';
import { cachedFrontmatter } from '../../notes/statblockSource';
import type { FieldRecord } from '../../values/fieldValues';

export interface PreviewRecord {
  /** What the canvas shows the template with. */
  record: FieldRecord;
  /** The note it comes from, which links and art resolve from; unset for sample values. */
  sourcePath: string | undefined;
  /** The note asked for is gone or not read yet: sample values stand in. */
  missing: boolean;
}

/** A note's frontmatter as the metadata cache holds it now; undefined where it holds none. */
function readNote(app: App, path: string): FieldRecord | undefined {
  const file = app.vault.getAbstractFileByPath(path);
  return file instanceof TFile ? cachedFrontmatter(app, file) : undefined;
}

/**
 * The values the canvas previews the template with (§7.4, §7.9): sample
 * values, or a statblock's own, read-only, followed as its note changes.
 */
export function usePreviewRecord(app: App | undefined, template: StatblockTemplate, previewPath: string | null): PreviewRecord {
  const samples = useMemo(() => sampleRecord(template), [template]);
  const [note, setNote] = useState<FieldRecord | undefined>(() => (app && previewPath ? readNote(app, previewPath) : undefined));

  useEffect(() => {
    if (!app || !previewPath) {
      setNote(undefined);
      return undefined;
    }
    setNote(readNote(app, previewPath));
    const ref = app.metadataCache.on('changed', (file: TFile) => {
      if (file.path === previewPath) setNote(readNote(app, previewPath));
    });
    return () => app.metadataCache.offref(ref);
  }, [app, previewPath]);

  return useMemo((): PreviewRecord => {
    if (!previewPath || !note) return { record: samples, sourcePath: undefined, missing: previewPath !== null };
    return { record: note, sourcePath: previewPath, missing: false };
  }, [samples, note, previewPath]);
}
