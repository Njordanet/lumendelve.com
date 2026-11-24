/**
 * @file weapon_mounter_3d.js
 * Progressive 3D Weapon & Shield Mounter with Locked Iconic Palettes.
 * Resolves exact staged `.glb` filenames (`t1`–`m100`, dual-hand `_r`/`_l`, `quiver.glb`),
 * attaches `weaponVisual` metadata, and locks weapon materials against armor dye sliders.
 */

import { resolveStyleMounts } from './weapon_staging_catalog.js';
import {
  TOTK_WEAPON_DEFAULT_PALETTE,
  createTotkDyeMaterial,
  extractTotkChannel,
} from './totk_dye_material.js';

export const WEAPON_STAGE_KEYS = Object.freeze([
  't1',
  't2',
  't3',
  't4',
  'u15',
  'u30',
  'u50',
  'u75',
  'u90',
  'm100',
]);

const VALID_STAGE_SET = new Set(WEAPON_STAGE_KEYS);

const MOUNT_TO_FILE_BASE = {
  sword_1h: 'sword_1h',
  sword_1h_l: 'sword_1h',
  axe_1h: 'axe_1h',
  axe_1h_l: 'axe_1h',
  shield: 'shield',
  sword_2h: 'sword_2h',
  bow: 'bow',
  quiver: 'quiver',
  razor_fan_r: 'razor_fan_r',
  razor_fan_l: 'razor_fan_l',
  wand: 'wand',
  staff: 'staff',
  stick_2h: 'stick_2h',
  gauntlet_r: 'gauntlet_r',
  gauntlet_l: 'gauntlet_l',
};

const MOUNT_TO_ARCHETYPE = {
  sword_1h: 'sword_1h',
  sword_1h_l: 'sword_1h',
  axe_1h: 'axe_1h',
  axe_1h_l: 'axe_1h',
  shield: 'shield',
  sword_2h: 'sword_2h',
  bow: 'bow',
  quiver: 'bow',
  razor_fan_r: 'razor_fans',
  razor_fan_l: 'razor_fans',
  wand: 'wand',
  staff: 'staff',
  stick_2h: 'stick_2h',
  gauntlet_r: 'gauntlet',
  gauntlet_l: 'gauntlet',
};

function normalizeItemArchetype(item) {
  if (!item) return '';
  const raw = String(item.archetype || item.subtype || '').toLowerCase();
  if (raw === 'rod') return 'stick_2h';
  if (raw === 'dagger_dual') return 'razor_fans';
  return raw;
}

function normalizeStageKey(stageKey) {
  if (!stageKey) return null;
  const low = String(stageKey).toLowerCase();
  return VALID_STAGE_SET.has(low) ? low : null;
}

/**
 * Resolves the exact exported `.glb` filename for a weapon mount key and stage key.
 * Dual-hand mounts map `razor_fan_r`/`_l` and `gauntlet_r`/`_l` to staged variants,
 * left-hand Reaver mounts (`sword_1h_l`/`axe_1h_l`) share `sword_1h`/`axe_1h` GLBs,
 * and `quiver` always resolves to `quiver.glb`. Falls back to `${fileBase}.glb` if unstaged.
 */
export function resolveWeaponGlbFilename(mountKey, stageKey = null) {
  const fileBase = MOUNT_TO_FILE_BASE[mountKey] || String(mountKey || 'sword_1h');
  if (fileBase === 'quiver') return 'quiver.glb';
  const safeStage = normalizeStageKey(stageKey);
  return safeStage ? `${fileBase}_${safeStage}.glb` : `${fileBase}.glb`;
}

function buildWeaponVisualSpec(item, mountKey) {
  const isQuiver = mountKey === 'quiver';
  const wv = item?.weaponVisual || null;
  const stageKey = isQuiver ? null : normalizeStageKey(wv?.stageKey) || 't1';
  const nativePalette = {
    ...TOTK_WEAPON_DEFAULT_PALETTE,
    ...(wv?.nativePalette || item?.nativePalette || {}),
  };
  const emissiveBase = Number.isFinite(Number(wv?.emissiveBase)) ? Number(wv.emissiveBase) : 0.15;
  const rarityLabel = wv?.rarityLabel || item?.rarityLabel || 'Common';
  const archetype = MOUNT_TO_ARCHETYPE[mountKey] || mountKey;

  return {
    modelKey: isQuiver ? 'quiver' : wv?.modelKey || `${archetype}_${stageKey}`,
    stageKey,
    nativePalette,
    emissiveBase,
    rarityLabel,
  };
}

function pickCandidateItemForMount(styleId, mount, equippedBySlot) {
  if (!equippedBySlot || typeof equippedBySlot !== 'object') return null;
  if (mount.key === 'shield') {
    return equippedBySlot.off_hand || null;
  }
  if (styleId === 'dual_1h' && mount.slot === 'off_hand') {
    return equippedBySlot.off_hand || null;
  }
  return equippedBySlot.main_hand || null;
}

/**
 * Resolves mounted 3D weapon specs (GLB filename + locked weaponVisual palette) for the active
 * weapon style, Reaver pairing, and equipped `main_hand` / `off_hand` catalog items.
 */
export function resolveWeaponSpecsForLoadout(styleId, reaverPairing = 'swd_axe', equippedBySlot = {}) {
  const mounts = resolveStyleMounts(styleId, reaverPairing);
  return mounts.map((mount) => {
    const expectedArch = MOUNT_TO_ARCHETYPE[mount.key] || mount.key;
    const candidate = pickCandidateItemForMount(styleId, mount, equippedBySlot);
    const matchedItem = candidate && normalizeItemArchetype(candidate) === expectedArch ? candidate : null;
    const weaponVisual = buildWeaponVisualSpec(matchedItem, mount.key);
    const file = resolveWeaponGlbFilename(mount.key, weaponVisual.stageKey);

    return {
      key: mount.key,
      slot: mount.slot,
      file,
      archetype: expectedArch,
      itemId: matchedItem?.id || null,
      itemName: matchedItem?.name || null,
      isDefaultFallback: !matchedItem,
      weaponVisual,
    };
  });
}

/**
 * Replaces GLB materials on a mounted weapon scene with locked TOTK weapon dye materials.
 * Uses `TOTK_WEAPON_DEFAULT_PALETTE` as reference and tags `userData.lockedWeaponMaterial = true`
 * so Right Rail armor dye controls never overwrite weapon finishes.
 */
export function applyLockedWeaponMaterials(
  weaponScene,
  weaponVisual,
  { wireframe = false, onBowString = null } = {}
) {
  if (!weaponScene) return;
  const nativePalette = weaponVisual?.nativePalette || TOTK_WEAPON_DEFAULT_PALETTE;
  const emissiveBase = Number(weaponVisual?.emissiveBase) || 0.15;

  weaponScene.traverse((child) => {
    if (!child.isMesh || child.userData?.isOutline) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;

    const channel =
      extractTotkChannel(child.name) ||
      (child.geometry?.attributes?.color ? 'Fixed' : null);

    if (channel) {
      const oldMat = child.material;
      const dyeHex = nativePalette[channel] || null;
      const emissiveStrength = channel === 'Glow' ? Math.max(0.25, emissiveBase) : 0;
      const mat = createTotkDyeMaterial({
        channel,
        classId: 'weapon',
        dyeHex,
        emissiveStrength,
        vertexColors: Boolean(child.geometry?.attributes?.color),
      });
      mat.wireframe = Boolean(wireframe);
      mat.userData.lockedWeaponMaterial = true;
      mat.userData.weaponVisual = weaponVisual;

      child.userData.totkChannel = channel;
      child.userData.weaponVisual = weaponVisual;
      child.material = mat;

      if (oldMat && oldMat !== mat) {
        if (Array.isArray(oldMat)) oldMat.forEach((m) => m.dispose());
        else oldMat.dispose();
      }
    } else if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        m.userData = m.userData || {};
        m.userData.lockedWeaponMaterial = true;
        m.userData.weaponVisual = weaponVisual;
      }
    }

    if (/BowString/i.test(child.name) && typeof onBowString === 'function') {
      onBowString(child);
    }
  });
}
