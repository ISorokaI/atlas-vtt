## New

- Statblocks show without the Fantasy Statblocks plugin: Atlas draws them itself on token hovers, in the DM screen and in the asset manager
- Statblock templates for 5E (2014 and 2024), Cairn, Draw Steel and Fate, and general ones for creatures, NPCs and hazards

## Important changes

- Your library now syncs between devices with Obsidian Sync, Remotely Save and Self-hosted LiveSync. Tokens, encounters, collection settings, game system presets, scene snapshots and loot history used to sit in a hidden folder these tools skip. Each device moves its own once when Atlas starts, so update Atlas on every device before editing your library there
- With Obsidian Sync, turn on "Sync all other types" in its settings: Atlas keeps its library in JSON files, which Obsidian Sync leaves out otherwise
- Atlas' own settings (dice, hotkeys, experimental features) now live with the plugin's settings and sync whenever you sync plugin settings

## Improved

- Number every cell of a square grid, the same way hex grids already could. A new Letters and numbers format (A1, B1, …) is available on square and hex grids alike
- The creature filter Layout is now called Template. Type `template:` in the search; `layout:` still works
- The token creator finds statblock notes without the Fantasy Statblocks plugin too. Its image source is now called Statblock notes
- An open map uses much less graphics memory: 3D dice share one drawing context per window, and with dynamic lighting on the map no longer keeps antialiasing buffers it does not draw into

## Fixed

- Hovering a token whose note holds its statblock in a code block shows the statblock, not the plain note
- Rolls show as result cards when the graphics card cannot draw 3D dice, for example after Obsidian lost or blocked WebGL, instead of an empty white panel. Contributed by ISorokaI
- Corrected the swapped export and import icons in the asset manager's collection header. Contributed by anacletoTM
- Large (2×2) and Gargantuan (4×4) tokens snap to where cells meet, so they cover whole cells: on square grids to the corners where grid lines cross, on hex grids to the corner three hexes share, so a Large creature covers 3 hexes and a Gargantuan one 12 (a Huge one stays on a hex and covers 7). This holds when you drag, place, paste or duplicate them and when an encounter spawns them, and they stay there when a scene loads or its grid is changed or aligned. Before, they snapped to the middle of a cell like Medium tokens. A token you resize keeps the cell its footprint starts from, so it stays on the grid at its new size
- The selection outline around a token follows it when the token is resized, from the resize handles or the size menu. Before, it kept the old size until the token was selected again
- Reloading Atlas no longer leaves the previous 3D dice in graphics memory
- Loading a scene with explored areas no longer keeps a copy of them in graphics memory
