/**
 * Opening the template gallery outside a dialog of Atlas (the command "New
 * statblock template…"): for the collection named, else the default one. The
 * new template opens in the template editor; "Use for" writes the role into
 * the collection's settings. Behind the `statblockEditor` switch.
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence } from 'framer-motion';
import type { App } from 'obsidian';
import { experimentalFeatureOn } from '../../../experimental/experimentalFeatures';
import { AssetService } from '../../../services/AssetService';
import { systemPresetsOf } from '../../../services/mapCollectionRules';
import { collectionStatblockRoles } from '../../roles/collectionStatblockRoles';
import { openCreatedTemplate } from './galleryActions';
import { systemTemplateIds } from './gallerySources';
import { TemplateGallery, type TemplateGalleryProps } from './TemplateGallery';

type HostedGallery = Omit<TemplateGalleryProps, 'onClose'>;

/** The gallery and its way out: it leaves with its exit motion, then the host goes. */
function GalleryHost({ gallery, onGone }: { gallery: HostedGallery; onGone: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <AnimatePresence onExitComplete={onGone}>
      {open && <TemplateGallery key="gallery" {...gallery} onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}

/** Shows the gallery in `gallery.doc`; focus goes back where it was once it closes. */
export function showTemplateGallery(gallery: HostedGallery): void {
  const { doc } = gallery;
  const previous = doc.activeElement;
  const container = doc.body.createDiv({ cls: 'atlas-te-gallery-host' });
  const root = createRoot(container);
  const onGone = (): void => {
    // Never inside React's own commit.
    queueMicrotask(() => {
      root.unmount();
      container.remove();
      if (previous?.instanceOf(HTMLElement) && previous.isConnected) previous.focus({ preventScroll: true });
    });
  };
  root.render(<GalleryHost gallery={gallery} onGone={onGone} />);
}

/** "New statblock template…": the gallery for a collection, whose new template opens in the template editor. */
export async function openTemplateGallery(app: App, collectionId: string | null = null): Promise<void> {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return;
  const assets = AssetService.getInstance(app);
  const known = await assets.getCollections();
  const id = collectionId !== null && known.some((collection) => collection.id === collectionId) ? collectionId : assets.getDefaultCollectionId();
  const settings = assets.getCollectionSettings(id);
  const presets = systemPresetsOf(app);
  const system = presets.find((preset) => preset.id === settings.systemPresetId)?.rules.statblockRoles;
  showTemplateGallery({
    app,
    doc: activeDocument,
    roles: collectionStatblockRoles(settings, presets),
    systemTemplateIds: systemTemplateIds(system),
    onCreated: (created, roleId) => openCreatedTemplate(app, created, id, roleId),
  });
}
