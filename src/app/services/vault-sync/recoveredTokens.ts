import type { Asset, AssetMetadata, GroupTokenRef, TokenAsset } from '../AssetService';
import { GLOBAL_ASSETS_DIR } from '../assetPaths';
import { defaultCollectionIdOf } from '../collectionRecords';
import { groupTokenRefs, ownedPaths, primaryPath } from './assetFiles';
import { isRecoveredId, recoveredId, recoveredTokenName, stemOf } from './recoveredIds';
import { prettifyIdentifier } from '../collectionRecords';
import { isReservedCollectionPath } from './reservedPaths';

const COLLECTION_TOKEN = /^atlas-vtt\/collections\/([^/]+)\/(?:.+\/)?tokens\/.+$/i;
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const GROUP_THUMBNAILS = [`${GLOBAL_ASSETS_DIR}/encounter-thumbnails/`, `${GLOBAL_ASSETS_DIR}/player-thumbnails/`];

/** Token art used by encounters and player groups, with the collection of the first group that uses it. */
function groupArtwork(metadata: AssetMetadata): Map<string, string> {
  const art = new Map<string, string>();
  for (const asset of Object.values(metadata.assets)) {
    if (asset.type !== 'encounter' && asset.type !== 'player') continue;
    for (const token of groupTokenRefs(asset)) {
      if (typeof token?.imagePath === 'string' && token.imagePath) art.set(token.imagePath, asset.collection || defaultCollectionIdOf(metadata));
    }
  }
  return art;
}

/**
 * Removes records earlier recoveries made from images that are no token
 * (encounter thumbnails, stray global images) and names recovered tokens nobody
 * renamed after their file without Atlas's suffix. Returns whether anything changed.
 */
export function tidyRecoveredTokens(metadata: AssetMetadata, now: number): boolean {
  const groupArt = groupArtwork(metadata);
  let changed = false;
  for (const [id, asset] of Object.entries(metadata.assets)) {
    if (asset.type !== 'token' || !asset.imagePath) continue;
    const recovered = id.startsWith('token-recovered-');
    const isGroupThumbnail = GROUP_THUMBNAILS.some((prefix) => asset.imagePath.startsWith(prefix));
    if (isGroupThumbnail || (recovered && !COLLECTION_TOKEN.test(asset.imagePath) && !groupArt.has(asset.imagePath))) {
      delete metadata.assets[id];
      changed = true;
      continue;
    }
    // Only a name an earlier recovery took from the file name, suffix and all; a name the user chose stays.
    const stem = stemOf(asset.imagePath);
    const fromFileName = asset.name === stem || asset.name === prettifyIdentifier(stem);
    const name = recovered && fromFileName ? recoveredTokenName(asset.imagePath) : asset.name;
    if (name && name !== asset.name) {
      asset.name = name;
      asset.modifiedAt = now;
      changed = true;
    }
  }
  return changed;
}

/** Fields a record keeps whoever edited it last: who it is and where it lives. */
const IDENTITY_FIELDS = new Set(['id', 'type', 'collection', 'createdAt', 'filePath']);

/** Points every encounter and player group at `to` where it names `from`. */
function moveGroupRefs(metadata: AssetMetadata, from: string, to: string, now: number): void {
  for (const asset of Object.values(metadata.assets)) {
    if (asset.type !== 'encounter' && asset.type !== 'player') continue;
    const lists = [asset.tokens, asset.data?.tokens].filter((list): list is GroupTokenRef[] => Array.isArray(list));
    let moved = false;
    for (const list of lists) {
      for (const [index, ref] of list.entries()) {
        if (ref?.id !== from) continue;
        list[index] = { ...ref, id: to };
        moved = true;
      }
    }
    if (moved) asset.modifiedAt = now;
  }
}

/**
 * Removes records an earlier check rebuilt from a file that a real record now
 * owns: a sync tool delivered the art or map before the record that goes with
 * it, or an older version on another device adopted the same art. What the user
 * did with the rebuilt record is kept: an edit newer than the real record's
 * passes to it, and encounters and player groups that name it name the real
 * record instead. Returns whether anything changed.
 */
export function dropShadowedRecoveries(metadata: AssetMetadata, now: number): boolean {
  const owners = new Map<string, Asset>();
  for (const asset of Object.values(metadata.assets)) {
    if (!isRecoveredId(asset.id)) for (const path of ownedPaths(asset)) owners.set(path, asset);
  }
  let changed = false;
  for (const [id, asset] of Object.entries(metadata.assets)) {
    const primary = primaryPath(asset);
    const owner = primary ? owners.get(primary) : undefined;
    if (!isRecoveredId(id) || !owner) continue;
    if (owner.type === asset.type && asset.modifiedAt !== asset.createdAt && asset.modifiedAt > owner.modifiedAt) {
      const edits = Object.fromEntries(Object.entries(asset).filter(([key]) => !IDENTITY_FIELDS.has(key)));
      Object.assign(owner, edits);
    }
    if (asset.type === 'token') moveGroupRefs(metadata, id, owner.id, now);
    delete metadata.assets[id];
    changed = true;
  }
  return changed;
}

/**
 * Takes token art without a record into the index: images in a collection's
 * tokens folder, and images encounters or player groups use. `owned` holds the
 * paths records already own and grows with every adopted image.
 */
export function adoptTokenArtwork(metadata: AssetMetadata, files: ReadonlySet<string>, owned: Set<string>, now: number): boolean {
  const groupArt = groupArtwork(metadata);
  let changed = false;
  for (const path of [...files].sort()) {
    if (!IMAGE.test(path) || owned.has(path) || isReservedCollectionPath(path)) continue;
    const collection = COLLECTION_TOKEN.exec(path)?.[1] ?? groupArt.get(path);
    const id = recoveredId('token', path);
    if (!collection || metadata.assets[id]) continue;

    const token: TokenAsset = {
      id,
      type: 'token',
      name: recoveredTokenName(path),
      imagePath: path,
      tags: [],
      collection,
      createdAt: now,
      modifiedAt: now,
    };
    metadata.assets[id] = token;
    owned.add(path);
    changed = true;
  }
  return changed;
}
