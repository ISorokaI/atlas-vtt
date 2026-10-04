import { isFiniteNumber, isRecord, isStringArray } from '../services/assetMetadataGuards';
import { LOOT_HISTORY_LIMIT, readLootHistory, type LootRoll } from './lootHistory';

/** Layout of a loot history file; unchanged since rolls were kept in one file per collection. */
export const LOOT_HISTORY_FORMAT = 1;

/**
 * What one device's loot history file holds: the rolls made on that device,
 * newest first, and how that device changed the shared history beyond its own
 * rolls: rolls of other devices it removed, and when it last cleared it all.
 */
export interface DeviceLootHistory {
  rolls: readonly LootRoll[];
  /** Ids of other devices' rolls this device removed. */
  removed: readonly string[];
  /** Unix milliseconds of the last "Clear history" on this device; every roll made until then is gone. 0 when never. */
  clearedAt: number;
}

export const EMPTY_DEVICE_HISTORY: DeviceLootHistory = { rolls: [], removed: [], clearedAt: 0 };

/** A device's history file, which arrives unchecked. */
export function readDeviceLootHistory(value: unknown): DeviceLootHistory {
  if (!isRecord(value)) return EMPTY_DEVICE_HISTORY;
  return {
    rolls: readLootHistory(value),
    removed: isStringArray(value.removed) ? value.removed : [],
    clearedAt: isFiniteNumber(value.clearedAt) ? value.clearedAt : 0,
  };
}

export function serializeDeviceLootHistory({ rolls, removed, clearedAt }: DeviceLootHistory): string {
  return JSON.stringify({
    format: LOOT_HISTORY_FORMAT,
    rolls,
    ...(removed.length > 0 ? { removed } : {}),
    ...(clearedAt > 0 ? { clearedAt } : {}),
  });
}

/**
 * The collection's history as every device sees it: all devices' rolls, each
 * once, without those any device removed or cleared, newest first.
 */
export function mergeLootHistories(histories: readonly DeviceLootHistory[]): LootRoll[] {
  const removed = new Set(histories.flatMap((history) => history.removed));
  const clearedAt = Math.max(0, ...histories.map((history) => history.clearedAt));
  const byId = new Map<string, LootRoll>();
  for (const roll of histories.flatMap((history) => history.rolls)) {
    if (!removed.has(roll.id) && roll.rolledAt > clearedAt && !byId.has(roll.id)) byId.set(roll.id, roll);
  }
  return [...byId.values()].sort((a, b) => b.rolledAt - a.rolledAt).slice(0, LOOT_HISTORY_LIMIT);
}

/** `own` after rolling `roll` on this device. */
export const withRoll = (own: DeviceLootHistory, roll: LootRoll): DeviceLootHistory =>
  ({ ...own, rolls: [roll, ...own.rolls.filter((entry) => entry.id !== roll.id)].slice(0, LOOT_HISTORY_LIMIT) });

/** `own` after removing the roll `rollId`: from its own rolls, or marked removed when another device made it. */
export function withoutRoll(own: DeviceLootHistory, others: readonly DeviceLootHistory[], rollId: string): DeviceLootHistory {
  const elsewhere = others.some((history) => history.rolls.some((roll) => roll.id === rollId));
  return {
    ...own,
    rolls: own.rolls.filter((roll) => roll.id !== rollId),
    removed: elsewhere && !own.removed.includes(rollId) ? [...own.removed, rollId] : own.removed,
  };
}

/** `own` after clearing the whole history at `now`. */
export const clearedHistory = (now: number): DeviceLootHistory => ({ rolls: [], removed: [], clearedAt: now });

/** `own` without removal marks for rolls no other device holds any more, so the file does not grow forever. */
export function prunedHistory(own: DeviceLootHistory, others: readonly DeviceLootHistory[]): DeviceLootHistory {
  const held = new Set(others.flatMap((history) => history.rolls.map((roll) => roll.id)));
  const removed = own.removed.filter((id) => held.has(id));
  return removed.length === own.removed.length ? own : { ...own, removed };
}

/** Rolls of an earlier version's single history file, taken into this device's own. */
export function withLegacyRolls(own: DeviceLootHistory, legacy: readonly LootRoll[]): DeviceLootHistory {
  const known = new Set(own.rolls.map((roll) => roll.id));
  const rolls = [...own.rolls, ...legacy.filter((roll) => !known.has(roll.id))]
    .sort((a, b) => b.rolledAt - a.rolledAt)
    .slice(0, LOOT_HISTORY_LIMIT);
  return { ...own, rolls };
}
