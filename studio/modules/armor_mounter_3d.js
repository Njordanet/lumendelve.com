/**
 * @file armor_mounter_3d.js
 * Modular Skinned 3D Armor Mounter for TOTK hero GLBs.
 * Fetches & caches `/models/armor/${modelKey}.glb` ArrayBuffers, remaps SkinnedMesh
 * skeletons onto the active hero's 17-bone Armature, and applies per-slot HSV dye materials.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import {
  TOTK_CLASS_DEFAULT_PALETTES,
  createTotkDyeMaterial,
  extractTotkChannel,
  setTotkMaterialDye,
} from './totk_dye_material.js';

export const ARMOR_SLOTS = ['helmet', 'shoulders', 'chest', 'gloves', 'legs', 'boots'];

function normalizeBoneLookup(bonesByName, bone) {
  if (!bone || !bonesByName) return null;
  const raw = bone.name || '';
  const udName = bone.userData?.name || '';
  const noDot = raw.replace(/\.([LR])$/i, '$1');
  const withDot = raw.replace(/^(hand|forearm|upper_arm|foot|shin|thigh)([LR])$/i, '$1.$2');
  return (
    bonesByName[raw] ||
    bonesByName[udName] ||
    bonesByName[noDot] ||
    bonesByName[withDot] ||
    null
  );
}

function resolveSlotOverrideMap(slot, slotDyeOverrides) {
  if (!slotDyeOverrides || typeof slotDyeOverrides !== 'object') return null;
  if (slotDyeOverrides[slot] && typeof slotDyeOverrides[slot] === 'object') {
    return slotDyeOverrides[slot];
  }
  return slotDyeOverrides;
}

export function resolveEffectiveChannelColor(channel, {
  classId = 'squire',
  spec = null,
  slot = null,
  slotDyeOverrides = null,
  globalOverride = null,
} = {}) {
  if (channel === 'Fixed' || channel === 'BowString') return null;
  const perSlot = slot ? resolveSlotOverrideMap(slot, slotDyeOverrides) : slotDyeOverrides;
  const defaults = TOTK_CLASS_DEFAULT_PALETTES[classId] || TOTK_CLASS_DEFAULT_PALETTES.squire;
  return (
    perSlot?.[channel] ??
    globalOverride?.[channel] ??
    spec?.nativePalette?.[channel] ??
    defaults[channel] ??
    '#FFFFFF'
  );
}

export class ArmorMounter3D {
  constructor({ modelGroup = null, bonesByName = null, wireframe = false } = {}) {
    this.modelGroup = modelGroup;
    this.bonesByName = bonesByName || {};
    this.wireframe = Boolean(wireframe);
    this.disposed = false;

    this.mountedBySlot = new Map();
    this.slotTickets = new Map();
    this.bufferCache = new Map();
    this.inflightFetches = new Map();
    this.warnedMissing = new Set();
  }

  retarget(modelGroup, bonesByName) {
    this.clear();
    this.modelGroup = modelGroup || null;
    this.bonesByName = bonesByName || {};
  }

  setWireframe(enabled) {
    this.wireframe = Boolean(enabled);
    for (const entry of this.mountedBySlot.values()) {
      for (const mesh of entry.meshes) {
        if (mesh.material) mesh.material.wireframe = this.wireframe;
      }
    }
  }

  async _fetchArmorBuffer(modelKey) {
    const url = `/models/armor/${encodeURIComponent(modelKey)}.glb`;
    if (this.bufferCache.has(url)) return this.bufferCache.get(url);
    if (this.inflightFetches.has(url)) return this.inflightFetches.get(url);

    const req = fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          if (!this.warnedMissing.has(url)) {
            this.warnedMissing.add(url);
            console.debug(`[armor-mounter] optional modular GLB not present (${res.status}): ${url}`);
          }
          return null;
        }
        const buf = await res.arrayBuffer();
        this.bufferCache.set(url, buf);
        return buf;
      })
      .catch((err) => {
        if (!this.warnedMissing.has(url)) {
          this.warnedMissing.add(url);
          console.debug(`[armor-mounter] failed to fetch ${url}:`, err);
        }
        return null;
      })
      .finally(() => {
        this.inflightFetches.delete(url);
      });

    this.inflightFetches.set(url, req);
    return req;
  }

  async _parseArmorScene(buffer) {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(buffer.slice(0), '', resolve, reject);
    });
    return gltf.scene;
  }

  _disposeDetachedNode(root) {
    if (!root) return;
    const disposedGeos = new Set();
    root.traverse((obj) => {
      if (obj.geometry && !disposedGeos.has(obj.geometry)) {
        disposedGeos.add(obj.geometry);
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  unmountSlot(slot) {
    const entry = this.mountedBySlot.get(slot);
    if (!entry) return;
    this.mountedBySlot.delete(slot);

    const disposedGeos = new Set();
    for (const mesh of entry.meshes) {
      if (mesh.parent) mesh.parent.remove(mesh);
      if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
        disposedGeos.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
    }
  }

  _applyEntryMaterials(entry, classId, slotDyeOverrides, globalOverride) {
    if (!entry) return;
    for (const mesh of entry.meshes) {
      const channel = mesh.userData?.totkChannel || 'Primary';
      const hex = resolveEffectiveChannelColor(channel, {
        classId,
        spec: entry.spec,
        slot: entry.slot,
        slotDyeOverrides,
        globalOverride,
      });
      setTotkMaterialDye(mesh.material, hex, classId);
    }
  }

  async mountSlot(slot, spec, { classId = 'squire', slotDyeOverrides = null, globalOverride = null } = {}) {
    if (!ARMOR_SLOTS.includes(slot)) return;
    const ticket = (this.slotTickets.get(slot) || 0) + 1;
    this.slotTickets.set(slot, ticket);

    const targetModelGroup = this.modelGroup;
    if (this.disposed || !targetModelGroup || !spec?.modelKey) {
      this.unmountSlot(slot);
      return;
    }

    const existing = this.mountedBySlot.get(slot);
    if (
      existing &&
      existing.modelKey === spec.modelKey &&
      existing.modelGroup === targetModelGroup &&
      existing.meshes.length > 0
    ) {
      existing.spec = spec;
      this._applyEntryMaterials(existing, classId, slotDyeOverrides, globalOverride);
      return;
    }

    const buffer = await this._fetchArmorBuffer(spec.modelKey);
    if (ticket !== this.slotTickets.get(slot) || this.disposed || this.modelGroup !== targetModelGroup) {
      return;
    }
    if (!buffer) {
      this.unmountSlot(slot);
      return;
    }

    let armorScene = null;
    try {
      armorScene = await this._parseArmorScene(buffer);
    } catch (err) {
      console.warn(`[armor-mounter] failed to parse ${spec.modelKey}.glb:`, err);
      this.unmountSlot(slot);
      return;
    }

    if (ticket !== this.slotTickets.get(slot) || this.disposed || this.modelGroup !== targetModelGroup) {
      this._disposeDetachedNode(armorScene);
      return;
    }

    this.unmountSlot(slot);

    const allMeshes = [];
    const armorNamedMeshes = [];
    armorScene.traverse((obj) => {
      if (!obj.isMesh || obj.userData?.isOutline) return;
      allMeshes.push(obj);
      if (/^Armor_/i.test(obj.name) || extractTotkChannel(obj.name)) {
        armorNamedMeshes.push(obj);
      }
    });
    const sourceMeshes = armorNamedMeshes.length ? armorNamedMeshes : allMeshes;
    const mountedMeshes = [];

    for (const srcMesh of sourceMeshes) {
      const channel = extractTotkChannel(srcMesh.name) || 'Primary';
      const effectiveHex = resolveEffectiveChannelColor(channel, {
        classId,
        spec,
        slot,
        slotDyeOverrides,
        globalOverride,
      });

      let remappedSkeleton = null;
      if (srcMesh.isSkinnedMesh && srcMesh.skeleton?.bones?.length) {
        const mappedBones = srcMesh.skeleton.bones.map((b) => normalizeBoneLookup(this.bonesByName, b) || b);
        const clonedInverses = (srcMesh.skeleton.boneInverses || []).map((m) => m.clone());
        remappedSkeleton = new THREE.Skeleton(mappedBones, clonedInverses);
      }

      if (srcMesh.parent) srcMesh.parent.remove(srcMesh);
      targetModelGroup.add(srcMesh);

      srcMesh.castShadow = true;
      srcMesh.receiveShadow = true;
      srcMesh.frustumCulled = false;

      if (srcMesh.isSkinnedMesh && remappedSkeleton) {
        srcMesh.bind(remappedSkeleton, srcMesh.bindMatrix);
      }

      const oldMat = srcMesh.material;
      const mat = createTotkDyeMaterial({
        channel,
        classId,
        dyeHex: effectiveHex,
        vertexColors: Boolean(srcMesh.geometry?.attributes?.color),
      });
      mat.wireframe = this.wireframe;
      srcMesh.material = mat;
      if (oldMat && oldMat !== mat) {
        if (Array.isArray(oldMat)) oldMat.forEach((m) => m.dispose());
        else oldMat.dispose();
      }

      srcMesh.userData.totkChannel = channel;
      srcMesh.userData.armorSlot = slot;
      srcMesh.userData.armorModelKey = spec.modelKey;
      mountedMeshes.push(srcMesh);
    }

    this._disposeDetachedNode(armorScene);

    this.mountedBySlot.set(slot, {
      slot,
      modelKey: spec.modelKey,
      modelGroup: targetModelGroup,
      spec,
      meshes: mountedMeshes,
    });
  }

  refreshAllMaterials({ classId = 'squire', slotSpecs = {}, slotDyeOverrides = {}, globalOverride = null } = {}) {
    for (const [slot, entry] of this.mountedBySlot.entries()) {
      const nextSpec = slotSpecs?.[slot] ?? entry.spec;
      entry.spec = nextSpec;
      const perSlot = resolveSlotOverrideMap(slot, slotDyeOverrides);
      this._applyEntryMaterials(entry, classId, perSlot, globalOverride);
    }
  }

  clear() {
    for (const slot of ARMOR_SLOTS) {
      this.slotTickets.set(slot, (this.slotTickets.get(slot) || 0) + 1);
      this.unmountSlot(slot);
    }
  }

  dispose() {
    this.clear();
    this.bufferCache.clear();
    this.inflightFetches.clear();
    this.modelGroup = null;
    this.bonesByName = {};
    this.disposed = true;
  }
}
