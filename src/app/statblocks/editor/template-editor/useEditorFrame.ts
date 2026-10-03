/** Where the template editor stands: its collection context and how wide its view is. */

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type { App } from 'obsidian';
import { AssetService } from '../../../services/AssetService';
import { observeResize } from '../../../utils/observeResize';
import type { CollectionChoice, CollectionContext } from '../collectionContext';
import { NARROW_EDITOR_WIDTH } from './editorContext';

/**
 * The collection the editor works for (§7.1): the one it was opened for,
 * else the default collection. The header's chip switches it where there is
 * more than one.
 */
export function useEditorCollection(app: App | undefined, requested: string | null): CollectionContext | null {
  const [collections, setCollections] = useState<readonly CollectionChoice[] | null>(null);
  useEffect(() => {
    if (!app) return undefined;
    let current = true;
    AssetService.getInstance(app).getCollections().then(
      (list) => { if (current) setCollections(list.map(({ id, name }) => ({ id, name }))); },
      (error: unknown) => console.error('[Atlas] Reading the collections failed:', error),
    );
    return () => { current = false; };
  }, [app]);
  if (!app || !collections) return null;
  const known = requested !== null && collections.some((collection) => collection.id === requested);
  const collectionId = known ? requested : AssetService.getInstance(app).getDefaultCollectionId();
  return { collectionId, collections, linking: [], switchable: collections.length > 1 };
}

/** `narrow` while the editor is less than `NARROW_EDITOR_WIDTH` wide (§7.4). */
export function useEditorLayout(ref: RefObject<HTMLElement | null>): 'wide' | 'narrow' {
  const [layout, setLayout] = useState<'wide' | 'narrow'>('wide');
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = (): void => setLayout(element.offsetWidth > 0 && element.offsetWidth < NARROW_EDITOR_WIDTH ? 'narrow' : 'wide');
    measure();
    return observeResize([element], measure);
  }, [ref]);
  return layout;
}
