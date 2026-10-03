import { describe, expect, it } from 'vitest';
import { Setting } from 'obsidian';
import { SettingsService } from '../../../../src/app/services/SettingsService';
import { statblockSettingsSections } from '../../../../src/app/settings/statblockSettingsSection';
import { statblockPaneSettings } from '../../../../src/app/statblocks/editor/paneSettings';
import { createInMemoryApp } from '../../../mocks/inMemoryVault';
import { withStatblockEditor } from '../../../mocks/experimentalFeatures';

describe('the statblock settings', () => {
  it('are shown only while the statblock editor is switched on', () => {
    const { app } = createInMemoryApp();
    const settings = new SettingsService(app);
    expect(statblockSettingsSections(settings)).toEqual([]);
    withStatblockEditor(app);
    const [section] = statblockSettingsSections(settings);
    expect(section?.rows.map((row) => row.name)).toContain('Open statblocks from the map in a new window');
  });

  it('store the new-window choice, off by default', async () => {
    const { app } = createInMemoryApp();
    const settings = new SettingsService(app);
    withStatblockEditor(app);
    expect(statblockPaneSettings(settings)).toEqual({ openFromMapInNewWindow: false, hintDismissed: false });

    const container = document.createElement('div');
    const setting = new Setting(container);
    const row = statblockSettingsSections(settings)[0]!.rows.find((candidate) => candidate.name.startsWith('Open statblocks'))!;
    const cleanup = row.render(setting);
    const toggle = container.querySelector('.checkbox-container, div') as HTMLElement;
    expect(toggle).toBeTruthy();
    settings.setSetting('statblockPane', { openFromMapInNewWindow: true, hintDismissed: false });
    expect(statblockPaneSettings(settings).openFromMapInNewWindow).toBe(true);
    if (typeof cleanup === 'function') cleanup();
    await settings.saveSettingsNow();
  });

  it('read anything but true as off', () => {
    const { app } = createInMemoryApp();
    const settings = new SettingsService(app);
    settings.setSetting('statblockPane', { openFromMapInNewWindow: 'yes', hintDismissed: 1 } as never);
    expect(statblockPaneSettings(settings)).toEqual({ openFromMapInNewWindow: false, hintDismissed: false });
    return settings.saveSettingsNow();
  });
});
