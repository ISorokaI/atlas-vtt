/**
 * The statblock editor's commands and file menu items (§7.3): "New
 * statblock…" and "Edit statblock", "New statblock here" on folders and "Edit
 * statblock in Atlas" on statblock notes. Registered always, offered
 * only while the `statblockEditor` switch is on, so switching it needs no
 * reload.
 */

import { TFile, TFolder, type App, type Menu, type Plugin, type TAbstractFile } from 'obsidian';
import { experimentalFeatureOn } from '../../../experimental/experimentalFeatures';
import { runInBackground } from '../../../utils/backgroundTask';
import { startStatblockCreation } from './createFlow';
import { addLayoutFileMenuItem, registerLayoutImportCommand } from '../fs-import/fsImportCommands';
import { editInStatblockPane, isMarkedStatblockNote } from './entryPoints';

/** Commands and the file menu name no collection: the role menu offers one. */
function newStatblock(app: App, folder?: string): void {
  runInBackground(startStatblockCreation(app, { collectionId: null, folder, from: 'command' }), 'Creating a statblock');
}

function addFileMenuItems(app: App, menu: Menu, file: TAbstractFile): void {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return;
  if (file instanceof TFolder) {
    menu.addItem((item) => item
      .setTitle('New statblock here')
      .setIcon('file-plus')
      .onClick(() => newStatblock(app, file.path)));
  } else if (file instanceof TFile && isMarkedStatblockNote(app, file.path)) {
    menu.addItem((item) => item
      .setTitle('Edit statblock in Atlas')
      .setIcon('scroll-text')
      .onClick(() => { editInStatblockPane(app, file.path, { collectionId: null, from: 'command' }); }));
  }
  addLayoutFileMenuItem(app, menu, file);
}

export function registerStatblockEditorCommands(plugin: Plugin): void {
  const { app } = plugin;

  plugin.addCommand({
    id: 'new-statblock',
    name: 'New statblock…',
    checkCallback: (checking) => {
      if (!experimentalFeatureOn(app, 'statblockEditor')) return false;
      if (!checking) newStatblock(app);
      return true;
    },
  });

  plugin.addCommand({
    id: 'edit-statblock',
    name: 'Edit statblock',
    checkCallback: (checking) => {
      const file = experimentalFeatureOn(app, 'statblockEditor') ? app.workspace.getActiveFile() : null;
      if (!file || !isMarkedStatblockNote(app, file.path)) return false;
      if (!checking) editInStatblockPane(app, file.path, { collectionId: null, from: 'command' });
      return true;
    },
  });

  registerLayoutImportCommand(plugin);
}

/** The file menu's items; Obsidian drops the handler when the plugin unloads. */
export function registerStatblockFileMenu(plugin: Plugin): void {
  const { app } = plugin;
  plugin.registerEvent(app.workspace.on('file-menu', (menu, file) => addFileMenuItems(app, menu, file)));
}
