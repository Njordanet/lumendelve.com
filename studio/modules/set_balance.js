/**
 * @file set_balance.js
 * Balance math for class armor sets, using the real engine formulas bundled in ../vendor/ld-engine.js
 * (deriveCombatStats + computeActiveGearSetBonuses + resolveArmorSetVisual).
 */

import {
  STAT_POINTS_PER_LEVEL,
  computeActiveGearSetBonuses,
  deriveCombatStats,
  getActiveGearSetStates,
  resolveArmorSetVisual,
} from '../vendor/ld-engine.js';

const HAND_SLOTS = new Set(['main_hand', 'off_hand']);

/** Set stats stored on the sets but not yet read by combat (shown separately in the panel). */
export const DATA_ONLY_STATS = {
  cooldownReductionPct: 'Cooldown Reduction',
  castSpeedPct: 'Cast Speed',
  skillDmgPct: 'Skill Damage',
  blockChance: 'Block',
  critResist: 'Crit Resist',
  reflectPct: 'Reflect',
  moveSpeedPct: 'Move Speed',
  damagePct: 'Damage',
  damageReductionPct: 'Damage Reduction',
};

let visualConfig = null;

/** Loads the set -> look config from the engine data file. */
export async function loadVisualConfig() {
  const res = await fetch('/api/data/gear-set-visuals');
  if (!res.ok) throw new Error(`set visuals HTTP ${res.status}`);
  visualConfig = (await res.json()).data;
  return visualConfig;
}

export function getVisualConfig() {
  return visualConfig;
}

/** Saves the look config back to set-visuals.data.json (also re-syncs Studio catalog + Godot data). */
export async function saveVisualConfig(next) {
  const res = await fetch('/api/data/gear-set-visuals', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: next }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) throw new Error(body.error || `save failed (HTTP ${res.status})`);
  visualConfig = next;
  return next;
}

/** 3D tier key for a catalog item, or null when the item is not a set piece. */
export function visualTierForItem(item) {
  if (!item?.setId || !visualConfig) return null;
  return resolveArmorSetVisual(item.setId, visualConfig).tierKey;
}

export function visualForSet(setId) {
  return visualConfig ? resolveArmorSetVisual(setId, visualConfig) : null;
}

/** Class sets the current class + body type can wear, sorted by level then name. */
export function setsForHero(catalog, classId, gender) {
  return (catalog?.gearSets?.classSets || [])
    .filter((s) => s.classLock?.includes(classId) && (!s.gender || s.gender === gender))
    .sort((a, b) => a.levelRange[0] - b.levelRange[0] || a.name.localeCompare(b.name));
}

function pickWeaponPath(cls, mainHand) {
  const paths = cls?.weaponPaths || [];
  return paths.find((p) => mainHand && p.weapons.includes(mainHand.subtype)) || paths[0] || null;
}

/** Allocates (level - 1) x points-per-level along the weapon path's recommended stat split. */
export function allocateCoreStats(level, split) {
  const points = Math.max(0, (level - 1) * STAT_POINTS_PER_LEVEL);
  const s = split || { str: 1, int: 1, dex: 1, sta: 1 };
  const total = (s.str || 0) + (s.int || 0) + (s.dex || 0) + (s.sta || 0) || 1;
  const out = { str: 0, int: 0, dex: 0, sta: 0 };
  let given = 0;
  for (const k of ['str', 'int', 'dex', 'sta']) {
    out[k] = Math.floor((points * (s[k] || 0)) / total);
    given += out[k];
  }
  const top = Object.keys(s).sort((a, b) => (s[b] || 0) - (s[a] || 0))[0] || 'sta';
  out[top] += points - given;
  return out;
}

function toItemDef(item, slot) {
  if (!item) return null;
  const isOff = slot === 'off_hand';
  return {
    definitionId: item.id,
    name: item.name,
    category: item.category,
    baseStats: item.baseStats || {},
    ...(isOff ? { offhandSubtype: item.subtype } : { weaponSubtype: item.subtype }),
    ...(item.handedness ? { weaponHandedness: item.handedness } : {}),
  };
}

function sumBlocks(...blocks) {
  const acc = {};
  for (const b of blocks) {
    for (const [k, v] of Object.entries(b || {})) if (typeof v === 'number') acc[k] = (acc[k] || 0) + v;
  }
  return acc;
}

/**
 * Engine-accurate stats for the Studio loadout.
 * @returns {{ derived, naked, setStates, setBonuses, dataOnly, coreStats, path }}
 */
export function computeBalance({ catalog, classId, level, equippedBySlot }) {
  const cls = catalog?.baseClasses?.find((c) => c.id === classId);
  const itemsById = new Map((catalog?.items || []).map((i) => [i.id, i]));
  const mainHand = equippedBySlot.main_hand || null;
  const path = pickWeaponPath(cls, mainHand);
  const weapon = mainHand || itemsById.get(path?.starterLoadout?.mainHandId) || null;
  const offhand = equippedBySlot.off_hand || itemsById.get(path?.starterLoadout?.offHandId) || null;
  const coreStats = allocateCoreStats(level, path?.recommendedStatSplit);

  const armor = Object.entries(equippedBySlot).filter(([slot]) => !HAND_SLOTS.has(slot)).map(([, it]) => it);
  const sets = catalog?.gearSets?.classSets || [];
  const pieces = armor.filter((it) => it.setId).map((it) => ({ setId: it.setId }));
  const setBonuses = computeActiveGearSetBonuses(pieces, sets);
  const gearBonuses = sumBlocks(...armor.map((it) => it.baseStats), setBonuses);

  const base = { classId, level, coreStats, weapon: toItemDef(weapon, 'main_hand'), offhand: toItemDef(offhand, 'off_hand') };
  const derived = deriveCombatStats({ ...base, gearBonuses });
  const naked = deriveCombatStats({ ...base, gearBonuses: {} });
  const dataOnly = Object.entries(DATA_ONLY_STATS)
    .filter(([k]) => setBonuses[k])
    .map(([k, label]) => ({ key: k, label, value: setBonuses[k] }));
  const setStates = getActiveGearSetStates(pieces, sets).map((st) => ({
    ...st,
    def: sets.find((s) => s.setId === st.setId),
  }));
  return { derived, naked, setStates, setBonuses, dataOnly, coreStats, path, weapon, offhand };
}

function nearestArmorLinePieces(catalog, classId, gender, level, predicate) {
  const candidates = (catalog?.items || []).filter(
    (it) =>
      it.category === 'armor' &&
      (!it.classReq?.length || it.classReq.includes(classId)) &&
      (!it.gender || it.gender === gender) &&
      predicate(it)
  );
  if (!candidates.length) return null;
  const groups = new Map();
  for (const it of candidates) {
    const key = it.setId ? `set::${it.setId}` : `nonset::${it.levelReq}::${it.lineName || it.rarity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const fullGroups = [...groups.values()].filter((arr) => arr.length >= 4);
  const pool = fullGroups.length ? fullGroups : [...groups.values()];
  pool.sort(
    (a, b) =>
      Math.abs((a[0].levelReq || 1) - level) - Math.abs((b[0].levelReq || 1) - level) ||
      (b[0].levelReq || 1) - (a[0].levelReq || 1)
  );
  const picked = pool[0];
  const bySlot = {};
  for (const p of picked) bySlot[p.slot] = p;
  return {
    label: picked[0].lineName || picked[0].setId || picked[0].name,
    levelReq: picked[0].levelReq || 1,
    bySlot,
  };
}

/**
 * Compares currently equipped armor vs nearest-level Common, Uncommon, and Class Set 6pc lines.
 */
export function computeTierBenchmarks({ catalog, classId, gender, level, equippedBySlot }) {
  const cur = computeBalance({ catalog, classId, level, equippedBySlot });
  const weaponsOnly = {
    ...(equippedBySlot.main_hand ? { main_hand: equippedBySlot.main_hand } : {}),
    ...(equippedBySlot.off_hand ? { off_hand: equippedBySlot.off_hand } : {}),
  };

  const evalBench = (kindLabel, line) => {
    if (!line) return null;
    const res = computeBalance({ catalog, classId, level, equippedBySlot: { ...weaponsOnly, ...line.bySlot } });
    return {
      kind: kindLabel,
      label: line.label,
      levelReq: line.levelReq,
      maxHp: Math.round(res.derived.maxHp),
      atk: Math.round(Math.max(res.derived.physAtk, res.derived.elemAtk)),
      def: Math.round(res.derived.physDef),
      dHp: Math.round(res.derived.maxHp - cur.derived.maxHp),
      dAtk: Math.round(Math.max(res.derived.physAtk, res.derived.elemAtk) - Math.max(cur.derived.physAtk, cur.derived.elemAtk)),
      dDef: Math.round(res.derived.physDef - cur.derived.physDef),
    };
  };

  return {
    current: {
      maxHp: Math.round(cur.derived.maxHp),
      atk: Math.round(Math.max(cur.derived.physAtk, cur.derived.elemAtk)),
      def: Math.round(cur.derived.physDef),
    },
    common: evalBench('Common', nearestArmorLinePieces(catalog, classId, gender, level, (i) => i.isFlyffNonSet && i.rarity === 'common')),
    uncommon: evalBench('Uncommon', nearestArmorLinePieces(catalog, classId, gender, level, (i) => i.isFlyffNonSet && i.rarity === 'uncommon')),
    classSet: evalBench('Class Set', nearestArmorLinePieces(catalog, classId, gender, level, (i) => Boolean(i.setId))),
  };
}
