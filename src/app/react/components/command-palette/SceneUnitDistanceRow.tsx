import React from 'react';
import { SettingRow } from './SettingRows';
import type { AtlasView } from '../../../atlas-view';
import { sceneUnitDistance, unitLabelFor } from '../../../grid/measurementFormat';
import { AssetService } from '../../../services/AssetService';
import { mapMeasurementSettings } from '../../../services/mapMeasurementSettings';
import type { GridState } from '../../../services/MapPersistence';

function withoutOverride({ unitDistanceOverride: _override, ...grid }: GridState): GridState {
  return grid;
}

/**
 * How far one cell of this scene reaches, when its map is drawn at another scale than the
 * rest of its collection. Empty follows the collection. Written when the field is left, so
 * typing a number is one undo step.
 */
export function SceneUnitDistanceRow({ view }: { view: AtlasView | null }): React.ReactElement | null {
  const store = view?.atlasStore;
  const state = store?.getState();
  // Held locally: the palette does not re-render when the store's grid changes
  const [text, setText] = React.useState(() => String(sceneUnitDistance(state?.grid) ?? ''));
  if (!view || !store || !state?.grid) return null;

  const collection = mapMeasurementSettings(AssetService.getInstance(view.app), {
    mapPath: state.mapPath,
    grid: withoutOverride(state.grid),
  });
  // Range bands name distances; there is no distance per cell to change.
  if (collection.mode === 'abstract') return null;
  const unit = unitLabelFor(collection.unitType);

  const commit = (): void => {
    const grid = store.getState().grid;
    if (!grid) return;
    const value = Number(text.replace(',', '.'));
    const override = text.trim() && Number.isFinite(value) && value > 0 ? value : undefined;
    setText(override === undefined ? '' : String(override));
    if (override === sceneUnitDistance(grid)) return;
    const rest = withoutOverride(grid);
    store.getState().setGrid(override === undefined ? rest : { ...rest, unitDistanceOverride: override });
  };

  return (
    <SettingRow label="Distance per cell" hint={`Empty uses the collection's ${collection.unitDistance}${unit ? ` ${unit}` : ''}`}>
      <input
        type="text"
        inputMode="decimal"
        className="atlas-setting-input atlas-setting-input--sm"
        value={text}
        placeholder={String(collection.unitDistance)}
        aria-label={`Distance per cell${unit ? ` in ${unit}` : ''}`}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </SettingRow>
  );
}
