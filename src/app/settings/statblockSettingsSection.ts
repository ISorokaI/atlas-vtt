import type { SettingsService } from '../services/SettingsService';
import { setStatblockPaneSettings, statblockPaneSettings } from '../statblocks/editor/paneSettings';
import type { AtlasSettingSection } from './settingSections';

/** The statblock editor's options; none while its experimental switch is off. */
export function statblockSettingsSections(settings: SettingsService): AtlasSettingSection[] {
  if (!settings.isExperimentalOn('statblockEditor')) return [];
  return [{
    heading: 'Statblocks',
    rows: [{
      name: 'Show statblocks in their notes',
      desc: 'New statblocks get a block at the top of their note that shows the statblock. It holds no values, so deleting it loses nothing.',
      aliases: ['statblock', 'note', 'fence', 'code block', 'preview'],
      render: (setting) => {
        let unsubscribe: (() => void) | undefined;
        setting.addToggle((toggle) => {
          toggle.setValue(settings.getSetting('showStatblocksInNotes'))
            .onChange((enabled) => {
              if (settings.getSetting('showStatblocksInNotes') !== enabled) settings.setSetting('showStatblocksInNotes', enabled);
            });
          unsubscribe = settings.onChange((value) => { toggle.setValue(value.showStatblocksInNotes); });
        });
        return unsubscribe;
      },
    }, {
      name: 'Open statblocks from the map in a new window',
      desc: 'A statblock opened from a map opens with its note in a window of its own, so the map keeps its size.',
      aliases: ['statblock', 'popout', 'window'],
      render: (setting) => {
        let unsubscribe: (() => void) | undefined;
        setting.addToggle((toggle) => {
          toggle
            .setValue(statblockPaneSettings(settings).openFromMapInNewWindow)
            .onChange((on) => setStatblockPaneSettings(settings, { openFromMapInNewWindow: on }));
          unsubscribe = settings.onChange(() => { toggle.setValue(statblockPaneSettings(settings).openFromMapInNewWindow); });
        });
        return unsubscribe;
      },
    }],
  }];
}
