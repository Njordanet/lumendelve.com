/**
 * Lumendelve Asset Review & Production Workstation — Rig Renderer & Mask Compositor
 *
 * Implements exact Skia-parity `mask_pack.png` compositing matching
 * `buildPackedMaskMatrix` in `apps/mobile/src/rig/RigPartLayers.tsx`,
 * fallback `mask_*.png` tint modulation, hierarchical 200x260 socket rendering,
 * 7x7 Delve tile grid walking stage, Battle-Back Turn-Based Combat VFX & Rift Sentinel,
 * 4-class cross-preview rendering, debug socket/pivot overlays, and PNG sheet export.
 */

export const RIG_WIDTH = 200;
export const RIG_HEIGHT = 260;

/** Milliseconds per walk frame at 1.0x speed (matches `walkPoses.ts`). */
export const WALK_FRAME_MS = 110;
/** Milliseconds per 3D skeletal walk frame (16-frame loop) at 1.0x speed. */
export const WALK_3D_FRAME_MS = 68;
/** Milliseconds per 3D skeletal battle idle frame (8-frame loop). */
export const BATTLE_IDLE_FRAME_MS = 125;
/** Milliseconds per 3D skeletal battle action frame by action type. */
export const BATTLE_ACTION_FRAME_MS = {
  slash: 56,
  skill: 60,
  cast: 66,
  hit: 70,
};

export const BASE_CLASSES = [
  { id: 'squire', name: 'Squire', role: 'Vanguard Plate' },
  { id: 'acolyte', name: 'Acolyte', role: 'Sanctum Cleric' },
  { id: 'scout', name: 'Scout', role: 'Vesper Ranger' },
  { id: 'arcanist', name: 'Arcanist', role: 'Leyline Mage' },
];

export const RARITY_TIERS = {
  common: {
    id: 'common',
    label: 'Common',
    desc: 'Tier I • Standard Forged',
    color: '#94A3B8',
  },
  uncommon: {
    id: 'uncommon',
    label: 'Uncommon',
    desc: 'Tier II • Tempered Delve',
    color: '#10B981',
  },
  rare: {
    id: 'rare',
    label: 'Rare',
    desc: 'Tier III • Arcane Infused',
    color: '#38BDF8',
  },
  epic: {
    id: 'epic',
    label: 'Epic',
    desc: 'Tier IV • Sanctum Relic',
    color: '#A855F7',
  },
  legendary: {
    id: 'legendary',
    label: 'Legendary',
    desc: 'Tier V • Mythic North Star',
    color: '#F59E0B',
  },
};

export const FRONT_WALK_FRAMES = [
  { bobY: 2, lean: -0.035, squash: 0.97, hipX: -3 },
  { bobY: -5, lean: 0, squash: 1.03, hipX: 0 },
  { bobY: 2, lean: 0.035, squash: 0.97, hipX: 3 },
  { bobY: -5, lean: 0, squash: 1.03, hipX: 0 },
];

export const SIDE_WALK_FRAMES = [
  { bobY: 2, lean: 0.06, squash: 0.97, hipX: -2 },
  { bobY: -5, lean: 0.03, squash: 1.03, hipX: 0 },
  { bobY: 2, lean: 0.06, squash: 0.97, hipX: 2 },
  { bobY: -5, lean: 0.03, squash: 1.03, hipX: 0 },
];

export const WALK_POSES = {
  S: { id: 'walk_s', angle: 'front', flipX: false, frames: FRONT_WALK_FRAMES },
  N: { id: 'walk_n', angle: 'battle-back', flipX: false, frames: FRONT_WALK_FRAMES },
  E: { id: 'walk_e', angle: 'front', flipX: false, frames: SIDE_WALK_FRAMES },
  W: { id: 'walk_w', angle: 'front', flipX: true, frames: SIDE_WALK_FRAMES },
};

export const GEAR_SLOTS = [
  'head',
  'chest',
  'shoulders',
  'hands',
  'legs',
  'feet',
  'backpiece',
  'mainhand',
  'offhand',
];

const SOCKET_TIE_BREAK = {
  aura: 5,
  backpiece: 10,
  cape: 10,
  upper_arm_left: 20,
  lower_arm_left: 22,
  hand_left: 24,
  offhand: 25,
  leg_left: 30,
  leg_right: 40,
  torso: 50,
  chest: 50,
  head: 60,
  shoulders: 68,
  upper_arm_right: 70,
  lower_arm_right: 72,
  hand_right: 74,
  mainhand: 75,
};

export function parseHexRgb(hex) {
  if (typeof hex !== 'string') return [1, 1, 1];
  const raw = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return [
      parseInt(raw[0] + raw[0], 16) / 255,
      parseInt(raw[1] + raw[1], 16) / 255,
      parseInt(raw[2] + raw[2], 16) / 255,
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return [
      parseInt(raw.slice(0, 2), 16) / 255,
      parseInt(raw.slice(2, 4), 16) / 255,
      parseInt(raw.slice(4, 6), 16) / 255,
    ];
  }
  return [1, 1, 1];
}

export function hexToRgb255(hex) {
  const [r, g, b] = parseHexRgb(hex);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Matches `sampleWalkCycleFrame` in `apps/mobile/src/rig/walkPoses.ts`.
 */
export function sampleWalkFrame(dir, stridePhase, idlePhase, speedRatio = 1) {
  const pose = WALK_POSES[dir] ?? WALK_POSES.S;
  const frames = pose.frames;
  const sIdle = Math.sin(idlePhase * Math.PI * 2);
  const idle = {
    bobY: -0.8 * (sIdle + 1),
    lean: 0,
    squash: 1 + 0.015 * sIdle,
    hipX: 0,
  };
  const r = Math.max(0, Math.min(1, speedRatio));
  if (r <= 0.01) return idle;

  const wrapped = ((stridePhase % 4) + 4) % 4;
  const idx = Math.floor(wrapped) % 4;
  const nxt = (idx + 1) % 4;
  const u = (1 - Math.cos((wrapped - Math.floor(wrapped)) * Math.PI)) * 0.5;
  const a = frames[idx];
  const b = frames[nxt];
  const walk = {
    bobY: a.bobY + (b.bobY - a.bobY) * u,
    lean: a.lean + (b.lean - a.lean) * u,
    squash: a.squash + (b.squash - a.squash) * u,
    hipX: a.hipX + (b.hipX - a.hipX) * u,
  };

  return {
    bobY: idle.bobY + (walk.bobY - idle.bobY) * r,
    lean: idle.lean + (walk.lean - idle.lean) * r,
    squash: idle.squash + (walk.squash - idle.squash) * r,
    hipX: idle.hipX + (walk.hipX - idle.hipX) * r,
  };
}

/**
 * Computes per-socket pivot rotations & offsets for walk animation.
 */
export function computeWalkSocketTransforms(dir, stridePhase, isPlaying) {
  if (!isPlaying) return {};
  const swing = Math.sin(stridePhase * Math.PI * 0.5);
  const counter = -swing;
  const isSide = dir === 'E' || dir === 'W';
  const armAmp = isSide ? 0.22 : 0.14;
  const legAmp = isSide ? 0.12 : 0.06;

  return {
    cape: { rot: Math.sin(stridePhase * Math.PI * 0.5 + 0.6) * 0.06 },
    backpiece: { rot: Math.sin(stridePhase * Math.PI * 0.5 + 0.6) * 0.06 },
    head: { ty: Math.abs(swing) * -0.8, rot: swing * 0.018 },
    torso: { ty: Math.abs(swing) * -0.6 },
    chest: { ty: Math.abs(swing) * -0.6 },
    shoulders: { ty: Math.abs(swing) * -0.6, rot: swing * 0.02 },
    upper_arm_left: { rot: swing * armAmp },
    lower_arm_left: { rot: swing * armAmp * 0.35 },
    hand_left: { rot: swing * armAmp * 0.2 },
    offhand: { rot: swing * 0.05 },
    upper_arm_right: { rot: counter * armAmp },
    lower_arm_right: { rot: counter * armAmp * 0.35 },
    hand_right: { rot: counter * armAmp * 0.2 },
    mainhand: { rot: counter * 0.08 },
    leg_left: { rot: counter * legAmp, ty: Math.max(0, -swing) * -1.4 },
    leg_right: { rot: swing * legAmp, ty: Math.max(0, swing) * -1.4 },
  };
}

/**
 * Computes idle breathing and expressive 2D combat action poses (`slash`, `skill`, `cast`, `hit`).
 */
export function computeCombatFrameState(nowMs, attackState, angle) {
  const breath = (Math.sin((nowMs / 1800) * Math.PI) + 1) * 0.5;
  const sway = Math.sin((nowMs / 1800) * Math.PI);
  const isBack = angle === 'battle-back';

  let bodyTx = sway * 1.4;
  let bodyTy = 0;
  let bodyRot = 0;
  let armRightRot = -sway * 0.03;
  let lowerRightRot = 0;
  let handRightRot = 0;
  let armLeftRot = sway * 0.03;
  let weaponRot = 0;
  let slashProgress = -1;
  let smiteProgress = -1;
  let castProgress = -1;
  let enemyStrikeProgress = -1;
  let hitFlash = 0;
  let heroHitFlash = 0;
  let shakeX = 0;
  let shakeY = 0;
  let phaseLabel = 'Battle Ready';

  if (attackState && attackState.active) {
    const type = attackState.type || 'slash';
    const durations = { slash: 660, skill: 760, cast: 700, hit: 580 };
    const total = durations[type] ?? 660;
    const elapsed =
      attackState.manualProgress !== undefined
        ? attackState.manualProgress * total
        : nowMs - attackState.startMs;

    if (elapsed >= total && attackState.manualProgress === undefined) {
      attackState.active = false;
    } else if (type === 'slash') {
      if (elapsed < 130) {
        const p = easeOutQuad(elapsed / 130);
        phaseLabel = 'Slash Windup';
        bodyTx += (isBack ? -6 : -8) * p;
        bodyTy += 2 * p;
        bodyRot = -0.06 * p;
        armRightRot = (isBack ? -0.22 : -1.05) * p;
        lowerRightRot = -0.28 * p;
        handRightRot = -0.16 * p;
        armLeftRot = 0.25 * p;
      } else if (elapsed < 290) {
        const p = easeOutQuad((elapsed - 130) / 160);
        phaseLabel = 'Sword Slash!';
        bodyTx += lerp(isBack ? -6 : -8, isBack ? 28 : 40, p);
        bodyTy += lerp(2, -10, p);
        bodyRot = lerp(-0.06, 0.1, p);
        armRightRot = lerp(isBack ? -0.22 : -1.05, isBack ? 0.36 : 0.92, p);
        lowerRightRot = lerp(-0.28, 0.26, p);
        handRightRot = lerp(-0.16, 0.22, p);
        armLeftRot = lerp(0.25, -0.12, p);
        weaponRot = lerp(-0.2, 0.38, p);
        slashProgress = Math.min(1, Math.max(0, (elapsed - 145) / 190));
        if (elapsed > 210) {
          hitFlash = Math.min(1, (elapsed - 210) / 70);
          shakeX = Math.sin(elapsed * 0.9) * 2.4;
          shakeY = Math.cos(elapsed * 1.1) * 1.6;
        }
      } else if (elapsed < 400) {
        const p = (elapsed - 290) / 110;
        phaseLabel = 'Slash Impact!';
        bodyTx += isBack ? 28 : 40;
        bodyTy += -10;
        bodyRot = 0.1;
        armRightRot = isBack ? 0.36 : 0.92;
        lowerRightRot = 0.26;
        handRightRot = 0.22;
        armLeftRot = -0.12;
        weaponRot = 0.38;
        slashProgress = Math.min(1, (elapsed - 145) / 230);
        hitFlash = Math.max(0, 1 - p * 0.85);
        shakeX = Math.sin(elapsed * 1.2) * (1 - p) * 2.2;
        shakeY = Math.cos(elapsed * 1.4) * (1 - p) * 1.4;
      } else {
        const p = easeInOutQuad((elapsed - 400) / (total - 400));
        phaseLabel = 'Recover';
        bodyTx += lerp(isBack ? 28 : 40, 0, p);
        bodyTy += lerp(-10, 0, p);
        bodyRot = lerp(0.1, 0, p);
        armRightRot = lerp(isBack ? 0.36 : 0.92, 0, p);
        lowerRightRot = lerp(0.26, 0, p);
        handRightRot = lerp(0.22, 0, p);
        armLeftRot = lerp(-0.12, 0, p);
        weaponRot = lerp(0.38, 0, p);
        hitFlash = Math.max(0, 0.18 * (1 - p * 2));
      }
    } else if (type === 'skill') {
      if (elapsed < 220) {
        const p = easeOutQuad(elapsed / 220);
        phaseLabel = 'Paladin Smite Charge';
        bodyTx += -6 * p;
        bodyTy += -12 * p;
        bodyRot = -0.09 * p;
        armRightRot = -0.65 * p;
        lowerRightRot = -0.35 * p;
        weaponRot = -0.32 * p;
        armLeftRot = -0.25 * p;
      } else if (elapsed < 420) {
        const p = easeOutQuad((elapsed - 220) / 200);
        phaseLabel = 'Paladin Smite!';
        bodyTx += lerp(-6, 36, p);
        bodyTy += lerp(-12, -16, p);
        bodyRot = lerp(-0.09, 0.14, p);
        armRightRot = lerp(-0.65, 0.48, p);
        lowerRightRot = lerp(-0.35, 0.28, p);
        weaponRot = lerp(-0.32, 0.45, p);
        smiteProgress = Math.min(1, Math.max(0, (elapsed - 240) / 260));
        if (elapsed > 270) {
          hitFlash = Math.min(1, (elapsed - 270) / 90);
          shakeX = Math.sin(elapsed * 1.1) * 4.2;
          shakeY = Math.cos(elapsed * 1.3) * 3.1;
        }
      } else {
        const p = easeInOutQuad((elapsed - 420) / (total - 420));
        phaseLabel = 'Smite Radiance';
        bodyTx += lerp(36, 0, p);
        bodyTy += lerp(-16, 0, p);
        bodyRot = lerp(0.14, 0, p);
        armRightRot = lerp(0.48, 0, p);
        lowerRightRot = lerp(0.28, 0, p);
        weaponRot = lerp(0.45, 0, p);
        smiteProgress = elapsed < 580 ? Math.min(1, (elapsed - 240) / 340) : -1;
        hitFlash = Math.max(0, 1 - p * 1.6);
        shakeX = Math.sin(elapsed * 1.2) * (1 - p) * 2.5;
        shakeY = Math.cos(elapsed * 1.4) * (1 - p) * 1.8;
      }
    } else if (type === 'cast') {
      const p = Math.min(1, elapsed / total);
      const pulse = Math.sin(p * Math.PI);
      phaseLabel = p < 0.35 ? 'Channeling Aegis' : p < 0.78 ? 'Aegis Guard Active' : 'Ward Anchored';
      bodyTy += -4 * pulse;
      bodyRot = -0.04 * pulse;
      armLeftRot = -0.58 * pulse;
      armRightRot = -0.32 * pulse;
      weaponRot = -0.22 * pulse;
      castProgress = p;
    } else if (type === 'hit') {
      const p = Math.min(1, elapsed / total);
      enemyStrikeProgress = p < 0.65 ? p / 0.65 : -1;
      if (p < 0.28) {
        phaseLabel = 'Sentinel Strikes!';
      } else if (p < 0.68) {
        const rec = Math.sin(((p - 0.28) / 0.4) * Math.PI);
        phaseLabel = 'Hero Hit React!';
        bodyTx += -18 * rec;
        bodyTy += 5 * rec;
        bodyRot = -0.13 * rec;
        armLeftRot = 0.35 * rec;
        armRightRot = -0.28 * rec;
        heroHitFlash = rec;
        shakeX = Math.sin(elapsed * 1.4) * 3.8 * rec;
        shakeY = Math.cos(elapsed * 1.6) * 2.4 * rec;
      } else {
        const rec = 1 - (p - 0.68) / 0.32;
        phaseLabel = 'Guard Recover';
        bodyTx += -6 * rec;
        bodyRot = -0.04 * rec;
      }
    }
  }

  const torsoScaleY = 1 + (breath * 2 - 1) * 0.015;
  const socketTransforms = {
    cape: { rot: sway * 0.05 },
    backpiece: { rot: sway * 0.05 },
    head: { ty: -2.0 * (breath - 0.5) },
    torso: { ty: -1.5 * (breath - 0.5), sy: torsoScaleY },
    chest: { ty: -1.5 * (breath - 0.5), sy: torsoScaleY },
    shoulders: { ty: -1.5 * (breath - 0.5) },
    upper_arm_left: { rot: armLeftRot },
    lower_arm_left: { rot: armLeftRot * 0.3 },
    hand_left: { rot: armLeftRot * 0.2 },
    upper_arm_right: { rot: armRightRot },
    lower_arm_right: { rot: lowerRightRot },
    hand_right: { rot: handRightRot },
    mainhand: { rot: weaponRot },
  };

  return {
    bodyTransform: { tx: bodyTx, ty: bodyTy, rot: bodyRot },
    socketTransforms,
    slashProgress,
    smiteProgress,
    castProgress,
    enemyStrikeProgress,
    hitFlash,
    heroHitFlash,
    shakeX,
    shakeY,
    phaseLabel,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutQuad(t) {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c);
}

function easeInOutQuad(t) {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

function makeOffscreenCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

function tileHash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Loads, caches, composites, and renders Lumendelve layered sprite rigs.
 */
export class CharacterRigRenderer {
  constructor({ onAssetLoaded } = {}) {
    this.onAssetLoaded = onAssetLoaded ?? (() => {});
    this.imageCache = new Map();
    this.rawDataCache = new Map();
    this.partCanvasCache = new Map();
    this.animationImages = new Map();
    this.pendingComposite = new Set();
    this.maxPartCacheEntries = 512;
  }

  loadImage(url) {
    if (!url) return Promise.resolve(null);
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url);
    }
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {}).finally(() => resolve(img));
        } else {
          resolve(img);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    }).catch((err) => {
      console.warn('[StudioRenderer] Failed to load sprite image:', url, err);
      return null;
    });
    this.imageCache.set(url, promise);
    return promise;
  }

  getRawImageData(url, img) {
    if (!url || !img) return null;
    if (this.rawDataCache.has(url)) {
      return this.rawDataCache.get(url);
    }
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const c = makeOffscreenCanvas(w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let hasVisiblePixels = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        hasVisiblePixels = true;
        break;
      }
    }

    const entry = { width: w, height: h, data, hasVisiblePixels };
    this.rawDataCache.set(url, entry);
    return entry;
  }

  getCacheKey(urls, palette, skinHex) {
    const fileEntries = Object.keys(urls)
      .sort()
      .map((k) => `${k}=${urls[k]}`)
      .join('&');
    return `${fileEntries}|${palette.primary},${palette.secondary},${palette.trim},${palette.glow}|${skinHex}`;
  }

  getOrBuildPartCanvas(urls, palette, skinHex) {
    if (!urls || !urls['base.png']) return null;
    const key = this.getCacheKey(urls, palette, skinHex);
    if (this.partCanvasCache.has(key)) {
      const hit = this.partCanvasCache.get(key);
      this.partCanvasCache.delete(key);
      this.partCanvasCache.set(key, hit);
      return hit;
    }

    if (!this.pendingComposite.has(key)) {
      this.pendingComposite.add(key);
      this.buildPartCanvasAsync(urls, palette, skinHex, key).finally(() => {
        this.pendingComposite.delete(key);
      });
    }
    return null;
  }

  async buildPartCanvasAsync(urls, palette, skinHex, cacheKey = null) {
    const key = cacheKey ?? this.getCacheKey(urls, palette, skinHex);
    if (this.partCanvasCache.has(key)) {
      return this.partCanvasCache.get(key);
    }

    const layerNames = [
      'base.png',
      'mask_pack.png',
      'mask_primary.png',
      'mask_secondary.png',
      'mask_trim.png',
      'mask_glow.png',
      'mask_skin.png',
    ];
    const toLoad = layerNames.filter((name) => Boolean(urls[name]));
    const loadedImgs = await Promise.all(toLoad.map((name) => this.loadImage(urls[name])));
    const imgByName = {};
    toLoad.forEach((name, idx) => {
      if (loadedImgs[idx]) imgByName[name] = loadedImgs[idx];
    });

    const baseImg = imgByName['base.png'];
    if (!baseImg) return null;

    const baseRaw = this.getRawImageData(urls['base.png'], baseImg);
    const width = baseImg.naturalWidth || 400;
    const height = baseImg.naturalHeight || 520;

    const outCanvas = makeOffscreenCanvas(width, height);
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    outCtx.imageSmoothingEnabled = false;
    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(baseImg, 0, 0, width, height);

    let hasVisiblePixels = Boolean(baseRaw?.hasVisiblePixels);

    if (imgByName['mask_pack.png']) {
      const packRaw = this.getRawImageData(urls['mask_pack.png'], imgByName['mask_pack.png']);
      if (packRaw && packRaw.hasVisiblePixels) {
        hasVisiblePixels = true;
        const packCanvas = this.compositePackedMask(packRaw, palette);
        outCtx.drawImage(packCanvas, 0, 0, width, height);
      }
    }

    const individualMasks = [
      ['mask_primary.png', palette.primary],
      ['mask_secondary.png', palette.secondary],
      ['mask_trim.png', palette.trim],
      ['mask_glow.png', palette.glow],
      ['mask_skin.png', skinHex || '#E6B89C'],
    ];

    for (const [maskFile, tintHex] of individualMasks) {
      const maskImg = imgByName[maskFile];
      if (!maskImg) continue;
      const maskRaw = this.getRawImageData(urls[maskFile], maskImg);
      if (!maskRaw || !maskRaw.hasVisiblePixels) continue;
      hasVisiblePixels = true;
      const tintedCanvas = this.compositeModulatedMask(maskRaw, tintHex);
      outCtx.drawImage(tintedCanvas, 0, 0, width, height);
    }

    let bbox = null;
    if (hasVisiblePixels) {
      const finalData = outCtx.getImageData(0, 0, width, height).data;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        const rowOff = y * width * 4;
        for (let x = 0; x < width; x += 1) {
          if (finalData[rowOff + x * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= minX && maxY >= minY) {
        bbox = {
          minX,
          minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
        };
      }
    }

    const result = { canvas: outCanvas, width, height, bbox, isBlank: !hasVisiblePixels };
    if (this.partCanvasCache.size >= this.maxPartCacheEntries) {
      const oldestKey = this.partCanvasCache.keys().next().value;
      if (oldestKey !== undefined) this.partCanvasCache.delete(oldestKey);
    }
    this.partCanvasCache.set(key, result);
    this.onAssetLoaded();
    return result;
  }

  compositePackedMask(packRaw, palette) {
    const { width, height, data: src } = packRaw;
    const [pr, pg, pb] = parseHexRgb(palette.primary);
    const [sr, sg, sb] = parseHexRgb(palette.secondary);
    const [tr, tg, tb] = parseHexRgb(palette.trim);
    const [gr, gg, gb] = parseHexRgb(palette.glow);

    const S = 255 / 128;
    const temp = makeOffscreenCanvas(width, height);
    const ctx = temp.getContext('2d');
    const outImgData = ctx.createImageData(width, height);
    const dst = outImgData.data;

    for (let i = 0; i < src.length; i += 4) {
      const A = src[i + 3];
      if (A === 0) continue;

      const r = src[i] / 255;
      const g = src[i + 1] / 255;
      const b = src[i + 2] / 255;
      const a = A / 255;

      const glowAmt = A > 128 ? (A - 128) / 127 : 0;

      const outR = pr * S * r + sr * S * g + tr * S * b + gr * glowAmt;
      const outG = pg * S * r + sg * S * g + tg * S * b + gg * glowAmt;
      const outB = pb * S * r + sb * S * g + tb * S * b + gb * glowAmt;
      const outA = A >= 128 ? 1 : S * a;

      dst[i] = outR >= 1 ? 255 : outR <= 0 ? 0 : Math.round(outR * 255);
      dst[i + 1] = outG >= 1 ? 255 : outG <= 0 ? 0 : Math.round(outG * 255);
      dst[i + 2] = outB >= 1 ? 255 : outB <= 0 ? 0 : Math.round(outB * 255);
      dst[i + 3] = outA >= 1 ? 255 : outA <= 0 ? 0 : Math.round(outA * 255);
    }

    ctx.putImageData(outImgData, 0, 0);
    return temp;
  }

  compositeModulatedMask(maskRaw, tintHex) {
    const { width, height, data: src } = maskRaw;
    const [tr, tg, tb] = parseHexRgb(tintHex);

    const temp = makeOffscreenCanvas(width, height);
    const ctx = temp.getContext('2d');
    const outImgData = ctx.createImageData(width, height);
    const dst = outImgData.data;

    for (let i = 0; i < src.length; i += 4) {
      const A = src[i + 3];
      if (A === 0) continue;

      dst[i] = Math.round(src[i] * tr);
      dst[i + 1] = Math.round(src[i + 1] * tg);
      dst[i + 2] = Math.round(src[i + 2] * tb);
      dst[i + 3] = A;
    }

    ctx.putImageData(outImgData, 0, 0);
    return temp;
  }

  resolveRigSockets({ baseClass, angle, equipment, assetsByKey, mobileById, palette, skinHex }) {
    const sockets = {};
    const getMobile = (id) => mobileById.get(id) ?? null;

    const assignBaseSocket = (socket, assetId, slotName = null) => {
      const asset = getMobile(assetId);
      const angleData = asset?.angles?.[angle];
      if (!angleData?.urls) return;
      sockets[socket] = {
        socket,
        slotName,
        asset,
        urls: angleData.urls,
        isBase: true,
      };
    };

    if (angle === 'front') {
      assignBaseSocket('head', `base-${baseClass}-head`, 'head');
      assignBaseSocket('torso', `base-${baseClass}-torso`, 'chest');
      assignBaseSocket('leg_left', `base-${baseClass}-legs`, 'legs');
      assignBaseSocket('upper_arm_left', `base-${baseClass}-arm-left`, 'shoulders');
      assignBaseSocket('upper_arm_right', `base-${baseClass}-arm-right`, 'hands');
      assignBaseSocket('mainhand', `base-${baseClass}-weapon`, 'mainhand');
    } else {
      assignBaseSocket('head', `base-${baseClass}-head`, 'head');
      assignBaseSocket('torso', `base-${baseClass}-torso`, 'chest');
      assignBaseSocket('leg_left', `base-${baseClass}-leg-far`, 'legs');
      assignBaseSocket('leg_right', `base-${baseClass}-leg-near`, 'feet');
      assignBaseSocket('upper_arm_left', `base-${baseClass}-arm-far-upper`, 'shoulders');
      assignBaseSocket('lower_arm_left', `base-${baseClass}-arm-far-lower`, 'shoulders');
      assignBaseSocket('hand_left', `base-${baseClass}-arm-far-hand`, 'shoulders');
      assignBaseSocket('upper_arm_right', `base-${baseClass}-arm-near-upper`, 'hands');
      assignBaseSocket('lower_arm_right', `base-${baseClass}-arm-near-lower`, 'hands');
      assignBaseSocket('hand_right', `base-${baseClass}-arm-near-hand`, 'hands');
      assignBaseSocket('mainhand', `base-${baseClass}-weapon`, 'mainhand');
    }

    const equipSlotToSocket = (slot, targetSocket, options = {}) => {
      const selectedKey = equipment?.[slot];
      if (!selectedKey) return null;
      const asset = assetsByKey.get(selectedKey);
      const angleData = asset?.angles?.[angle];
      if (!angleData?.urls) return null;

      const built = this.getOrBuildPartCanvas(angleData.urls, palette, skinHex);
      if (built && built.isBlank && sockets[targetSocket]) {
        return null;
      }

      const prev = sockets[targetSocket] ?? null;
      sockets[targetSocket] = {
        socket: targetSocket,
        slotName: slot,
        asset,
        urls: angleData.urls,
        isBase: false,
        underlay:
          options.preserveFaceUnderlay && asset.source === 'workshop' && angle === 'front'
            ? getMobile(`base-${baseClass}-face-1`)?.angles?.front?.urls ?? null
            : null,
      };
      return { asset, prev };
    };

    equipSlotToSocket('head', 'head', { preserveFaceUnderlay: true });
    equipSlotToSocket('chest', 'torso');
    const shouldersRes = equipSlotToSocket('shoulders', 'shoulders');

    const handsRes = equipSlotToSocket('hands', 'upper_arm_right');
    if (handsRes) {
      const isBilateralHands =
        handsRes.asset.source === 'workshop' || handsRes.asset.id.startsWith('lv50-');
      if (angle === 'front' && isBilateralHands) {
        delete sockets.upper_arm_left;
      }
      if (angle === 'battle-back') {
        delete sockets.lower_arm_right;
        delete sockets.hand_right;
        if (handsRes.asset.source === 'workshop') {
          delete sockets.upper_arm_left;
          delete sockets.lower_arm_left;
          delete sockets.hand_left;
        }
      }
    } else if (shouldersRes?.asset?.source === 'workshop' && angle === 'battle-back') {
      delete sockets.upper_arm_left;
    }

    equipSlotToSocket('legs', 'leg_left');
    equipSlotToSocket('feet', 'leg_right');
    equipSlotToSocket('backpiece', 'backpiece');
    equipSlotToSocket('mainhand', 'mainhand');
    equipSlotToSocket('offhand', 'offhand');
    equipSlotToSocket('aura', 'aura');

    return sockets;
  }

  async preloadSockets(sockets, palette, skinHex) {
    const tasks = [];
    for (const entry of Object.values(sockets)) {
      if (entry.urls) tasks.push(this.buildPartCanvasAsync(entry.urls, palette, skinHex));
      if (entry.underlay) tasks.push(this.buildPartCanvasAsync(entry.underlay, palette, skinHex));
    }
    await Promise.all(tasks);
  }

  /**
   * Preloads all 3D Blender-rendered animation frame PNGs across all animation tracks.
   */
  async preloadAnimationFrames(animations) {
    const urls = Object.values(animations ?? {}).flat().filter(Boolean);
    await Promise.all(
      urls.map((url) =>
        this.loadImage(url).then((img) => {
          if (img) this.animationImages.set(url, img);
        })
      )
    );
  }

  getAnimationFrameImage(url) {
    if (!url) return null;
    if (this.animationImages.has(url)) {
      return this.animationImages.get(url);
    }
    if (!this.imageCache.has(url)) {
      this.loadImage(url).then((img) => {
        if (img) {
          this.animationImages.set(url, img);
          this.onAssetLoaded();
        }
      });
    }
    return null;
  }

  draw3dAnimationFrame({ ctx, frameImg, flipX = false, showShadow = true, hitFlash = 0 }) {
    ctx.save();
    if (flipX) {
      ctx.translate(RIG_WIDTH * 0.5, 0);
      ctx.scale(-1, 1);
      ctx.translate(-RIG_WIDTH * 0.5, 0);
    }

    if (showShadow) {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 10, 20, 0.52)';
      ctx.beginPath();
      ctx.ellipse(100, 226, 38, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, RIG_WIDTH, RIG_HEIGHT);
      if (hitFlash > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255, 110, 120, ${Math.min(0.65, hitFlash * 0.65)})`;
        ctx.fillRect(0, 0, RIG_WIDTH, RIG_HEIGHT);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawRig({
    ctx,
    rigSpec,
    sockets,
    angle,
    palette,
    skinHex,
    flipX = false,
    walkFrame = null,
    bodyTransform = null,
    socketTransforms = {},
    soloSlot = null,
    highlightSlot = null,
    debugSockets = false,
    showShadow = true,
    opacity = 1,
  }) {
    const specSockets = rigSpec?.sockets?.[angle] ?? {};
    const pivotOf = (socket) =>
      specSockets[socket]?.pivot ??
      (socket === 'backpiece' ? specSockets.cape?.pivot : null) ??
      (socket === 'chest' ? specSockets.torso?.pivot : null) ?? { x: 100, y: 130 };

    const zOf = (socket) =>
      specSockets[socket]?.zIndex ??
      SOCKET_TIE_BREAK[socket] ??
      50;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (flipX) {
      ctx.translate(RIG_WIDTH * 0.5, 0);
      ctx.scale(-1, 1);
      ctx.translate(-RIG_WIDTH * 0.5, 0);
    }

    if (showShadow) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 12, 28, 0.45)';
      ctx.beginPath();
      ctx.ellipse(52 + 96 * 0.5, 238 + 18 * 0.5, 96 * 0.5, 18 * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    if (bodyTransform) {
      ctx.translate(100 + (bodyTransform.tx || 0), 240 + (bodyTransform.ty || 0));
      if (bodyTransform.rot) ctx.rotate(bodyTransform.rot);
      ctx.translate(-100, -240);
    }
    if (walkFrame) {
      ctx.translate(100, 240 + (walkFrame.bobY || 0));
      ctx.translate(walkFrame.hipX || 0, 0);
      if (walkFrame.lean) ctx.rotate(walkFrame.lean);
      const sq = walkFrame.squash ?? 1;
      ctx.scale(2 - sq, sq);
      ctx.translate(-100, -240);
    }

    const applySocketPivotTransform = (socket) => {
      const tf = socketTransforms[socket];
      if (!tf) return;
      const p = pivotOf(socket);
      ctx.translate(p.x + (tf.tx || 0), p.y + (tf.ty || 0));
      if (tf.rot) ctx.rotate(tf.rot);
      if (tf.sx !== undefined || tf.sy !== undefined) {
        ctx.scale(tf.sx ?? 1, tf.sy ?? 1);
      }
      ctx.translate(-p.x, -p.y);
    };

    const drawEntry = (entry) => {
      if (!entry) return;
      const matchesSolo = soloSlot && entry.slotName === soloSlot;
      if (soloSlot && !matchesSolo) return;

      let alphaMul = 1;
      if (highlightSlot && entry.slotName !== highlightSlot) {
        alphaMul = 0.24;
      }

      ctx.save();
      ctx.globalAlpha *= alphaMul;

      if (entry.underlay) {
        const underRes = this.getOrBuildPartCanvas(entry.underlay, palette, skinHex);
        if (underRes && !underRes.isBlank) {
          ctx.drawImage(underRes.canvas, 0, 0, RIG_WIDTH, RIG_HEIGHT);
        }
      }

      const partRes = this.getOrBuildPartCanvas(entry.urls, palette, skinHex);
      if (partRes && !partRes.isBlank) {
        ctx.drawImage(partRes.canvas, 0, 0, RIG_WIDTH, RIG_HEIGHT);
      }

      ctx.restore();
    };

    const leftChainSockets = ['upper_arm_left', 'lower_arm_left', 'hand_left', 'offhand'];
    const rightChainSockets = ['upper_arm_right', 'lower_arm_right', 'hand_right', 'mainhand'];
    const standaloneSockets = Object.keys(sockets).filter(
      (s) => !leftChainSockets.includes(s) && !rightChainSockets.includes(s)
    );

    const renderNodes = standaloneSockets.map((s) => ({
      kind: 'single',
      socket: s,
      z: zOf(s),
      tie: SOCKET_TIE_BREAK[s] ?? 50,
    }));

    if (leftChainSockets.some((s) => sockets[s])) {
      renderNodes.push({
        kind: 'chain',
        sockets: leftChainSockets,
        z: zOf('upper_arm_left'),
        tie: SOCKET_TIE_BREAK.upper_arm_left,
      });
    }

    if (rightChainSockets.some((s) => sockets[s])) {
      renderNodes.push({
        kind: 'chain',
        sockets: rightChainSockets,
        z: zOf('upper_arm_right'),
        tie: SOCKET_TIE_BREAK.upper_arm_right,
      });
    }

    renderNodes.sort((a, b) => (a.z !== b.z ? a.z - b.z : a.tie - b.tie));

    for (const node of renderNodes) {
      if (node.kind === 'single') {
        ctx.save();
        applySocketPivotTransform(node.socket);
        drawEntry(sockets[node.socket]);
        ctx.restore();
      } else {
        ctx.save();
        for (const s of node.sockets) {
          applySocketPivotTransform(s);
          if (sockets[s]) drawEntry(sockets[s]);
        }
        ctx.restore();
      }
    }

    if (highlightSlot) {
      const highlightEntries = Object.values(sockets).filter((e) => e.slotName === highlightSlot);
      for (const e of highlightEntries) {
        const s = e.socket;
        const b =
          (!e.isBase ? specSockets[highlightSlot]?.bounds : null) ??
          specSockets[s]?.bounds ??
          (s === 'backpiece' ? specSockets.cape?.bounds : null);
        if (!b) continue;
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.restore();
      }
    }

    ctx.restore(); // bodyTransform + walkFrame

    if (debugSockets) {
      this.drawDebugOverlay(ctx, rigSpec, sockets, angle);
    }

    ctx.restore(); // flipX + opacity
  }

  drawDebugOverlay(ctx, rigSpec, sockets, angle) {
    const specSockets = rigSpec?.sockets?.[angle] ?? {};
    const seenBounds = new Set();

    ctx.save();
    for (const [socket, spec] of Object.entries(specSockets)) {
      const isEquippedSocket = Boolean(sockets[socket]);
      const isCoreSocket = [
        'head',
        'torso',
        'leg_left',
        'leg_right',
        'upper_arm_left',
        'upper_arm_right',
        'mainhand',
        'offhand',
        'shoulders',
        'backpiece',
      ].includes(socket);
      if (!isEquippedSocket && !isCoreSocket) continue;

      const { bounds, pivot, zIndex } = spec;
      const boundsKey = bounds ? `${bounds.x},${bounds.y},${bounds.width},${bounds.height}` : '';

      if (bounds && !seenBounds.has(boundsKey)) {
        seenBounds.add(boundsKey);
        ctx.strokeStyle = isEquippedSocket ? 'rgba(56, 189, 248, 0.85)' : 'rgba(56, 189, 248, 0.32)';
        ctx.lineWidth = isEquippedSocket ? 0.85 : 0.55;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }

      if (pivot) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(pivot.x - 4, pivot.y);
        ctx.lineTo(pivot.x + 4, pivot.y);
        ctx.moveTo(pivot.x, pivot.y - 4);
        ctx.lineTo(pivot.x, pivot.y + 4);
        ctx.stroke();

        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isEquippedSocket && bounds) {
        const label = `${socket}:z${zIndex}`;
        ctx.font = '600 6px ui-monospace, SFMono-Regular, Menlo, monospace';
        const textW = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(11, 16, 27, 0.78)';
        ctx.fillRect(bounds.x + 1, bounds.y + 1, textW + 4, 8);
        ctx.fillStyle = '#FEF08A';
        ctx.fillText(label, bounds.x + 3, bounds.y + 7);
      }
    }
    ctx.restore();
  }

  /**
   * Renders a full studio stage frame (`armor-page`, `walking`, or `battle-mode`).
   */
  renderStage(canvas, state) {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.drawStageBackdrop(ctx, cssW, cssH, state);

    const isBattle = state.mode === 'battle-mode';
    const isWalking = state.mode === 'walking';

    const baseScale = isBattle
      ? Math.min((cssW * 0.36) / RIG_WIDTH, (cssH * 0.46) / RIG_HEIGHT)
      : isWalking
        ? Math.min((cssW * 0.68) / RIG_WIDTH, (cssH * 0.62) / RIG_HEIGHT)
        : Math.min((cssW * 0.76) / RIG_WIDTH, (cssH * 0.82) / RIG_HEIGHT);

    const zoom = isBattle ? 1 : state.zoom ?? 1;
    const scale = baseScale * zoom;

    const shakeX = state.combatState?.shakeX ?? 0;
    const shakeY = state.combatState?.shakeY ?? 0;

    let centerX = cssW * 0.5 + (isBattle ? 0 : state.panX ?? 0) + shakeX;
    let centerY =
      (isWalking ? cssH * 0.42 : cssH * 0.5) + (isBattle ? 0 : state.panY ?? 0) + shakeY;

    if (isBattle) {
      centerX = cssW * 0.28 + shakeX;
      centerY = cssH * 0.51 + shakeY;
      this.drawHeroBattleDais(ctx, centerX, centerY + RIG_HEIGHT * 0.41 * scale, state.palette, scale, state.combatState);
      this.drawEnemyCombatDais(ctx, cssW, cssH, state.combatState, state.palette, scale);
    } else if (isWalking) {
      this.drawDelveTileGrid(
        ctx,
        cssW,
        cssH,
        centerX,
        centerY + RIG_HEIGHT * 0.41 * scale,
        state.walkScrollX ?? 0,
        state.walkScrollY ?? 0,
        state.walkDir ?? 'S',
        state.palette,
        scale
      );
    }

    // Hero Rig (3D Skeletal frame or 2D Paper-Doll rig)
    ctx.save();
    ctx.translate(centerX - (RIG_WIDTH * scale) * 0.5, centerY - (RIG_HEIGHT * scale) * 0.5);
    ctx.scale(scale, scale);

    if (state.use3dAnim && state.animFrameImg) {
      this.draw3dAnimationFrame({
        ctx,
        frameImg: state.animFrameImg,
        flipX: state.flipX,
        showShadow: true,
        hitFlash: state.combatState?.heroHitFlash ?? 0,
      });
    } else {
      this.drawRig({
        ctx,
        rigSpec: state.rigSpec,
        sockets: state.sockets,
        angle: state.angle,
        palette: state.palette,
        skinHex: state.skinHex,
        flipX: state.flipX,
        walkFrame: state.walkFrame,
        bodyTransform: state.combatState?.bodyTransform ?? null,
        socketTransforms: state.socketTransforms ?? {},
        soloSlot: state.soloSlot,
        highlightSlot: state.highlightSlot,
        debugSockets: state.debugSockets,
        showShadow: true,
      });
    }
    ctx.restore();

    // Combat VFX Layers in Battle Mode
    if (isBattle && state.combatState) {
      const cs = state.combatState;
      if (cs.slashProgress >= 0 && cs.slashProgress <= 1) {
        this.drawSlashArcVfx(ctx, cssW, cssH, cs.slashProgress, state.palette.glow, scale);
      }
      if (cs.smiteProgress >= 0 && cs.smiteProgress <= 1) {
        this.drawSmiteBurstVfx(ctx, cssW, cssH, cs.smiteProgress, state.palette.trim || '#FDE047', scale);
      }
      if (cs.castProgress >= 0 && cs.castProgress <= 1) {
        this.drawAegisGuardVfx(
          ctx,
          centerX,
          centerY,
          cs.castProgress,
          state.palette.glow || '#38BDF8',
          scale
        );
      }
      if (cs.enemyStrikeProgress >= 0 && cs.enemyStrikeProgress <= 1) {
        this.drawEnemyStrikeVfx(ctx, cssW, cssH, centerX, centerY, cs.enemyStrikeProgress, scale);
      }
    }

    if (isBattle && Array.isArray(state.battlePopups) && state.battlePopups.length > 0) {
      this.drawBattlePopups(ctx, cssW, cssH, centerX, centerY, state.battlePopups, state.nowMs ?? performance.now());
    }

    this.lastViewport = {
      originX: centerX - (RIG_WIDTH * scale) * 0.5,
      originY: centerY - (RIG_HEIGHT * scale) * 0.5,
      scale,
    };
  }

  screenToLogical(clientX, clientY, canvas) {
    if (!this.lastViewport) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const lx = (x - this.lastViewport.originX) / this.lastViewport.scale;
    const ly = (y - this.lastViewport.originY) / this.lastViewport.scale;
    if (lx < 0 || lx > RIG_WIDTH || ly < 0 || ly > RIG_HEIGHT) return null;
    return { x: lx, y: ly };
  }

  drawStageBackdrop(ctx, w, h, state) {
    const style = state.backdrop || 'slate';
    if (style === 'checker') {
      ctx.fillStyle = '#182132';
      ctx.fillRect(0, 0, w, h);
      const tile = 18;
      ctx.fillStyle = '#1E293B';
      for (let y = 0; y < h; y += tile) {
        for (let x = ((y / tile) % 2) * tile; x < w; x += tile * 2) {
          ctx.fillRect(x, y, tile, tile);
        }
      }
      return;
    }

    if (style === 'parchment') {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      grad.addColorStop(0, '#CBD5E1');
      grad.addColorStop(1, '#94A3B8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    if (state.mode === 'battle-mode') {
      // Lumendelve Rift Cavern Stage Backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0D1528');
      bg.addColorStop(0.48, '#17233B');
      bg.addColorStop(1, '#0F1522');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Cavern arch & distant Rift Portal (matching Lumendelve_Battle_Screen_Mockup)
      const px = w * 0.48;
      const py = h * 0.34;
      const pr = Math.min(w, h) * 0.14;

      const portalAura = ctx.createRadialGradient(px, py, pr * 0.1, px, py, pr * 1.9);
      portalAura.addColorStop(0, 'rgba(56, 189, 248, 0.38)');
      portalAura.addColorStop(0.55, 'rgba(56, 189, 248, 0.1)');
      portalAura.addColorStop(1, 'rgba(13, 21, 40, 0)');
      ctx.fillStyle = portalAura;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.strokeStyle = '#1A1512';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#25324B';
      ctx.beginPath();
      ctx.moveTo(px - pr * 0.85, py + pr * 1.05);
      ctx.lineTo(px - pr * 0.72, py - pr * 0.35);
      ctx.quadraticCurveTo(px, py - pr * 1.28, px + pr * 0.72, py - pr * 0.35);
      ctx.lineTo(px + pr * 0.85, py + pr * 1.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const coreGrad = ctx.createRadialGradient(px, py + pr * 0.1, 4, px, py + pr * 0.1, pr * 0.85);
      coreGrad.addColorStop(0, '#E0F2FE');
      coreGrad.addColorStop(0.45, '#38BDF8');
      coreGrad.addColorStop(1, '#0C4A6E');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.ellipse(px, py + pr * 0.12, pr * 0.48, pr * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Subtle floor stone horizon lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i += 1) {
        const yLine = h * (0.48 + i * 0.09);
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.lineTo(w, yLine);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const grad = ctx.createRadialGradient(w * 0.5, h * 0.46, 16, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    grad.addColorStop(0, '#293549');
    grad.addColorStop(0.55, '#192233');
    grad.addColorStop(1, '#0D1320');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = (w * 0.5) % step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = (h * 0.5) % step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Renders a 7x7 Lumendelve Delve Tile Grid beneath the walking character
   * with #1A1512 North Star stone joints, 2-tone cel lighting, sparse cracks,
   * and subtle fog-of-war vignette on the outer perimeter tiles.
   */
  drawDelveTileGrid(ctx, w, h, cx, footY, scrollX, scrollY, dir, palette, scale) {
    const availH = Math.max(120, h - footY - 46);
    const maxTileWByW = (w * 0.74) / 7;
    const maxTileWByH = (availH * 1.75) / (7 * 0.46);
    const tileW = Math.max(32, Math.min(58, maxTileWByW, maxTileWByH, 34 * Math.max(0.95, scale * 0.75)));
    const tileH = tileW * 0.46;
    const cols = 7;
    const rows = 7;
    const halfCols = Math.floor(cols / 2);
    const halfRows = Math.floor(rows / 2);

    const gridW = cols * tileW;
    const gridH = rows * tileH;
    const originX = cx - gridW * 0.5;
    const rawOriginY = footY - gridH * 0.34;
    const originY = Math.min(rawOriginY, h - gridH - 44);

    ctx.save();

    // Base stone slab drop-shadow
    ctx.fillStyle = 'rgba(8, 10, 18, 0.65)';
    ctx.beginPath();
    ctx.roundRect(originX - 8, originY - 6, gridW + 16, gridH + 16, 12);
    ctx.fill();

    // Clip to 7x7 Delve Chamber grid
    ctx.beginPath();
    ctx.roundRect(originX, originY, gridW, gridH, 8);
    ctx.clip();

    const baseCol = Math.floor(scrollX);
    const baseRow = Math.floor(scrollY);
    const fracX = (scrollX - baseCol) * tileW;
    const fracY = (scrollY - baseRow) * tileH;

    for (let r = -1; r <= rows; r += 1) {
      for (let c = -1; c <= cols; c += 1) {
        const worldCol = baseCol + (c - halfCols);
        const worldRow = baseRow + (r - halfRows);
        const tx = originX + c * tileW - fracX;
        const ty = originY + r * tileH - fracY;
        const hVal = tileHash(worldCol, worldRow);

        // 2-tone cel stone flagstone base
        const isDarkSlab = (worldCol + worldRow) % 2 === 0;
        ctx.fillStyle = isDarkSlab ? '#434B5B' : '#4E576A';
        ctx.fillRect(tx, ty, tileW, tileH);

        // Top-left directional key light bevel (-45 deg)
        ctx.fillStyle = 'rgba(226, 232, 240, 0.08)';
        ctx.fillRect(tx + 1, ty + 1, tileW - 2, 3);
        ctx.fillRect(tx + 1, ty + 1, 3, tileH - 2);

        // Bottom-right hard cel shadow edge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.fillRect(tx + 1, ty + tileH - 4, tileW - 2, 3);
        ctx.fillRect(tx + tileW - 4, ty + 1, 3, tileH - 2);

        // Sparse deterministic Delve stone decals (<= 1 per 3 tiles)
        if (hVal < 0.22) {
          ctx.strokeStyle = '#1A1512';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tx + tileW * 0.25, ty + tileH * 0.35);
          ctx.lineTo(tx + tileW * 0.48, ty + tileH * 0.56);
          ctx.lineTo(tx + tileW * 0.66, ty + tileH * 0.48);
          ctx.stroke();
        } else if (hVal > 0.86) {
          // Subtle rune pebble / moss speckle
          ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
          ctx.fillRect(tx + tileW * 0.18, ty + tileH * 0.64, 5, 3);
        }

        // #1A1512 North Star mortar line
        ctx.strokeStyle = '#1A1512';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx, ty, tileW, tileH);
      }
    }

    // Center hero occupied tile highlight
    const centerTileX = originX + halfCols * tileW;
    const centerTileY = originY + halfRows * tileH;
    ctx.strokeStyle = palette?.glow ? `${palette.glow}AA` : 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(centerTileX + 2, centerTileY + 2, tileW - 4, tileH - 4);

    // Subtle Fog-of-War Vignette across the outer ring tiles of the 7x7 grid
    const fogGrad = ctx.createRadialGradient(
      cx,
      originY + gridH * 0.5,
      Math.min(gridW, gridH) * 0.26,
      cx,
      originY + gridH * 0.5,
      Math.max(gridW, gridH) * 0.58
    );
    fogGrad.addColorStop(0, 'rgba(11, 15, 24, 0)');
    fogGrad.addColorStop(0.62, 'rgba(11, 15, 24, 0.36)');
    fogGrad.addColorStop(1, 'rgba(10, 14, 22, 0.92)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(originX, originY, gridW, gridH);

    ctx.restore();

    // Crisp outer #1A1512 frame & subtle Delve 7x7 directional badge
    ctx.save();
    ctx.strokeStyle = '#1A1512';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(originX, originY, gridW, gridH, 8);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
    ctx.textAlign = 'center';
    ctx.fillText(`DELVE 7×7 CHAMBER • FACING ${dir}`, originX + gridW * 0.5, originY + gridH + 15);
    ctx.restore();
  }

  drawHeroBattleDais(ctx, cx, footY, palette, scale, combatState) {
    const rx = Math.max(66, 78 * scale);
    const ry = rx * 0.3;
    const isCast = (combatState?.castProgress ?? -1) >= 0;

    ctx.save();
    ctx.translate(cx, footY);

    ctx.fillStyle = 'rgba(8, 12, 22, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 6, rx * 1.04, ry * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone dais slab
    ctx.fillStyle = '#243044';
    ctx.strokeStyle = '#1A1512';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inscribed glowing runic ring
    ctx.strokeStyle = isCast
      ? '#38BDF8'
      : palette?.glow
        ? `${palette.glow}88`
        : 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = isCast ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.8, ry * 0.76, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawEnemyCombatDais(ctx, w, h, combatState, palette, scale) {
    const ex = w * 0.72;
    const ey = h * 0.45;
    const s = Math.max(0.75, Math.min(1.35, scale * 0.92));
    const flash = combatState?.hitFlash ?? 0;
    const strike = combatState?.enemyStrikeProgress ?? -1;
    const lungeX = strike >= 0 ? -Math.sin(strike * Math.PI) * 32 : 0;
    const lungeY = strike >= 0 ? Math.sin(strike * Math.PI) * 16 : 0;
    const idleBob = Math.sin(performance.now() / 700) * 2.5;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(s, s);

    // Stone dais platform
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#1A1512';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 62, 86, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rift rune circle
    ctx.strokeStyle = flash > 0.1 ? '#FDE047' : 'rgba(244, 63, 94, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 62, 68, 17, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Enemy shadow
    ctx.fillStyle = 'rgba(8, 10, 18, 0.58)';
    ctx.beginPath();
    ctx.ellipse(0, 56, 46, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rift Sentinel (recoil on hit flash, lunge on enemy strike)
    const recoil = flash * 10;
    ctx.translate(recoil + lungeX, -flash * 4 + lungeY + idleBob);

    const armorLit = '#525E72';
    const armorShadow = '#2D3546';
    ctx.strokeStyle = flash > 0.2 ? '#FEF08A' : '#1A1512';
    ctx.lineWidth = 2.6;

    // Legs
    ctx.fillStyle = armorShadow;
    ctx.fillRect(-26, 20, 18, 36);
    ctx.strokeRect(-26, 20, 18, 36);
    ctx.fillRect(8, 20, 18, 36);
    ctx.strokeRect(8, 20, 18, 36);

    // Torso / Stone Golem Plate
    ctx.fillStyle = armorLit;
    ctx.beginPath();
    ctx.moveTo(-36, 24);
    ctx.lineTo(-42, -32);
    ctx.lineTo(-18, -56);
    ctx.lineTo(18, -56);
    ctx.lineTo(42, -32);
    ctx.lineTo(34, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cel shadow side on right half
    ctx.fillStyle = armorShadow;
    ctx.beginPath();
    ctx.moveTo(4, -54);
    ctx.lineTo(18, -56);
    ctx.lineTo(42, -32);
    ctx.lineTo(34, 24);
    ctx.lineTo(4, 24);
    ctx.closePath();
    ctx.fill();

    // Left/Right Heavy Pauldron Arms
    ctx.fillStyle = armorLit;
    ctx.beginPath();
    ctx.roundRect(-58, -44, 22, 54, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = armorShadow;
    ctx.beginPath();
    ctx.roundRect(36, -44, 22, 54, 6);
    ctx.fill();
    ctx.stroke();

    // Glowing magma/rift chest cracks
    ctx.strokeStyle = flash > 0.2 ? '#FFFFFF' : '#F59E0B';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-14, -36);
    ctx.lineTo(0, -18);
    ctx.lineTo(14, -32);
    ctx.moveTo(0, -18);
    ctx.lineTo(-4, 6);
    ctx.stroke();

    // Horned Sentinel Head
    ctx.fillStyle = armorLit;
    ctx.strokeStyle = flash > 0.2 ? '#FEF08A' : '#1A1512';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, -70, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-14, -84);
    ctx.lineTo(-32, -108);
    ctx.lineTo(-6, -90);
    ctx.moveTo(14, -84);
    ctx.lineTo(32, -108);
    ctx.lineTo(6, -90);
    ctx.fill();
    ctx.stroke();

    // Glowing Sentinel Eyes
    ctx.fillStyle = flash > 0.2 ? '#FFFFFF' : '#FB7185';
    ctx.beginPath();
    ctx.ellipse(-7, -70, 4.5, 2.2, 0.18, 0, Math.PI * 2);
    ctx.ellipse(7, -70, 4.5, 2.2, -0.18, 0, Math.PI * 2);
    ctx.fill();

    // Translucent hit-flash sheen preserving silhouette & magma lines
    if (flash > 0.08) {
      ctx.fillStyle = `rgba(255, 248, 200, ${Math.min(0.42, flash * 0.42)})`;
      ctx.beginPath();
      ctx.arc(0, -24, 54, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawSlashArcVfx(ctx, w, h, progress, glowHex, scale) {
    const ex = w * 0.72;
    const ey = h * 0.43;
    const r = 74 * Math.max(0.75, Math.min(1.4, scale * 0.85));
    const alpha = Math.sin(progress * Math.PI);
    const startAngle = -Math.PI * 0.85 + progress * 0.4;
    const endAngle = startAngle + Math.PI * 0.78;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(-0.25);

    ctx.strokeStyle = glowHex || '#38BDF8';
    ctx.globalAlpha = alpha * 0.88;
    ctx.lineWidth = 14 * (1 - progress * 0.38);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r, startAngle, endAngle);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 4.5 * (1 - progress * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.98, startAngle + 0.08, endAngle - 0.05);
    ctx.stroke();

    for (let i = 0; i < 7; i += 1) {
      const a = endAngle - 0.3 + (i - 3) * 0.26;
      const dist = r * (0.82 + progress * 0.55);
      ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : glowHex || '#FACC15';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, (1 - progress) * 3.8 + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawSmiteBurstVfx(ctx, w, h, progress, trimHex, scale) {
    const ex = w * 0.72;
    const ey = h * 0.45;
    const alpha = Math.sin(progress * Math.PI);
    const s = Math.max(0.8, scale * 0.85);

    ctx.save();
    ctx.translate(ex, ey);

    // Radiant descending Smite beam
    const beamW = 54 * s * (1 - progress * 0.35);
    const beamGrad = ctx.createLinearGradient(-beamW * 0.5, 0, beamW * 0.5, 0);
    beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0)');
    beamGrad.addColorStop(0.5, `rgba(255, 251, 235, ${alpha * 0.9})`);
    beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(-beamW, -280, beamW * 2, 330);

    // Expanding holy shockwave ring
    ctx.strokeStyle = trimHex || '#FDE047';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 6 * (1 - progress * 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 56 * s, (30 + progress * 92) * s, (10 + progress * 26) * s, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Starburst rays
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + progress * 0.5;
      const len = (24 + progress * 68) * s;
      ctx.strokeStyle = i % 2 === 0 ? '#FFFFFF' : '#F59E0B';
      ctx.lineWidth = 3 * (1 - progress * 0.4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawAegisGuardVfx(ctx, cx, cy, progress, glowHex, scale) {
    const alpha = Math.sin(progress * Math.PI);
    const r = 108 * Math.max(0.8, scale * 0.92);

    ctx.save();
    ctx.translate(cx, cy - 10);

    const domeGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    domeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.02)');
    domeGrad.addColorStop(0.75, `rgba(56, 189, 248, ${alpha * 0.22})`);
    domeGrad.addColorStop(1, `rgba(253, 224, 71, ${alpha * 0.48})`);
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = glowHex || '#38BDF8';
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Hexagonal Aegis crest
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + progress * 0.4;
      const px = Math.cos(a) * r * 0.72;
      const py = Math.sin(a) * r * 0.72;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();
  }

  drawEnemyStrikeVfx(ctx, w, h, hx, hy, progress, scale) {
    const ex = w * 0.7;
    const ey = h * 0.44;
    const bx = lerp(ex, hx, Math.min(1, progress * 1.15));
    const by = lerp(ey, hy, Math.min(1, progress * 1.15));
    const alpha = Math.sin(Math.min(1, progress) * Math.PI);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 10 * Math.max(0.7, scale * 0.8);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.strokeStyle = '#FFE4E6';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(bx - 22, by - 18);
    ctx.lineTo(bx + 22, by + 18);
    ctx.moveTo(bx + 20, by - 16);
    ctx.lineTo(bx - 20, by + 16);
    ctx.stroke();
    ctx.restore();
  }

  drawBattlePopups(ctx, w, h, hx, hy, popups, nowMs) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const pop of popups) {
      const age = nowMs - pop.createdAt;
      const life = 1150;
      if (age < 0 || age > life) continue;
      const t = age / life;
      const alpha = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.8);
      const baseX = pop.target === 'enemy' ? w * 0.72 : hx;
      const baseY = (pop.target === 'enemy' ? h * 0.42 : hy - 78) - t * 34;

      ctx.globalAlpha = alpha;
      ctx.font = '800 18px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0A0F1A';
      ctx.strokeText(pop.text, baseX, baseY);
      ctx.fillStyle = pop.color || '#F8FAFC';
      ctx.fillText(pop.text, baseX, baseY);
    }
    ctx.restore();
  }

  /**
   * Renders a class card canvas for Character Select & Character Sheets Cross-Check.
   */
  renderClassPreviewCanvas(
    canvas,
    { rigSpec, baseClass, equipment, assetsByKey, mobileById, angle, palette, skinHex, debugSockets, backdrop }
  ) {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.drawStageBackdrop(ctx, cssW, cssH, { backdrop: backdrop || 'slate', mode: 'character-select' });

    const sockets = this.resolveRigSockets({
      baseClass,
      angle,
      equipment,
      assetsByKey,
      mobileById,
      palette,
      skinHex,
    });

    const scale = Math.min((cssW * 0.9) / RIG_WIDTH, (cssH * 0.9) / RIG_HEIGHT);
    ctx.save();
    ctx.translate((cssW - RIG_WIDTH * scale) * 0.5, (cssH - RIG_HEIGHT * scale) * 0.5);
    ctx.scale(scale, scale);

    this.drawRig({
      ctx,
      rigSpec,
      sockets,
      angle,
      palette,
      skinHex,
      debugSockets,
      showShadow: true,
    });

    ctx.restore();
  }

  renderTurnaroundCanvas(canvas, { rigSpec, sockets, angle, palette, skinHex, debugSockets }) {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const grad = ctx.createRadialGradient(cssW * 0.5, cssH * 0.45, 10, cssW * 0.5, cssH * 0.5, Math.max(cssW, cssH) * 0.72);
    grad.addColorStop(0, '#273449');
    grad.addColorStop(1, '#111827');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssW, cssH);

    const scale = Math.min((cssW * 0.9) / RIG_WIDTH, (cssH * 0.9) / RIG_HEIGHT);
    ctx.save();
    ctx.translate((cssW - RIG_WIDTH * scale) * 0.5, (cssH - RIG_HEIGHT * scale) * 0.5);
    ctx.scale(scale, scale);

    this.drawRig({
      ctx,
      rigSpec,
      sockets,
      angle,
      palette,
      skinHex,
      debugSockets,
      showShadow: true,
    });

    ctx.restore();
  }

  renderIsolatedPartCanvas(canvas, urls, palette, skinHex) {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, cssW, cssH);

    if (!urls) return;
    const partRes = this.getOrBuildPartCanvas(urls, palette, skinHex);
    if (!partRes || partRes.isBlank) return;

    const pad = 10;
    if (partRes.bbox && partRes.bbox.w > 4 && partRes.bbox.h > 4) {
      const { minX, minY, w: bw, h: bh } = partRes.bbox;
      const scale = Math.min((cssW - pad * 2) / bw, (cssH - pad * 2) / bh);
      const dw = bw * scale;
      const dh = bh * scale;
      ctx.drawImage(
        partRes.canvas,
        minX,
        minY,
        bw,
        bh,
        (cssW - dw) * 0.5,
        (cssH - dh) * 0.5,
        dw,
        dh
      );
      return;
    }

    const scale = Math.min((cssW - pad) / RIG_WIDTH, (cssH - pad) / RIG_HEIGHT);
    ctx.save();
    ctx.translate((cssW - RIG_WIDTH * scale) * 0.5, (cssH - RIG_HEIGHT * scale) * 0.5);
    ctx.scale(scale, scale);
    ctx.drawImage(partRes.canvas, 0, 0, RIG_WIDTH, RIG_HEIGHT);
    ctx.restore();
  }

  /**
   * Exports a high-resolution (1600x1280) multi-panel Character Production Sheet PNG
   * including Front + Battle-Back Turnaround, 4-Class Cross-Check Strip, Swatches, and 9-Slot Parts Grid.
   */
  async exportCharacterSheetPng({
    rigSpec,
    baseClass,
    paletteName,
    palette,
    skinHex,
    frontSockets,
    backSockets,
    equippedItems,
    equipment,
    assetsByKey,
    mobileById,
    sheetAngle = 'front',
  }) {
    const crossClassSockets = BASE_CLASSES.map((cls) => ({
      cls,
      sockets: this.resolveRigSockets({
        baseClass: cls.id,
        angle: sheetAngle,
        equipment,
        assetsByKey,
        mobileById,
        palette,
        skinHex,
      }),
    }));

    await Promise.all([
      this.preloadSockets(frontSockets, palette, skinHex),
      this.preloadSockets(backSockets, palette, skinHex),
      ...crossClassSockets.map((c) => this.preloadSockets(c.sockets, palette, skinHex)),
    ]);

    const W = 1600;
    const H = 1320;
    const sheet = makeOffscreenCanvas(W, H);
    const ctx = sheet.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#0B101B';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#24324A';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, W - 36, H - 36);

    ctx.fillStyle = '#121A2A';
    ctx.fillRect(20, 20, W - 40, 76);
    ctx.fillStyle = '#F59E0B';
    ctx.font = '700 24px system-ui, -apple-system, sans-serif';
    ctx.fillText('LUMENDELVE // CHARACTER PRODUCTION SHEET', 44, 58);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 14px ui-monospace, SFMono-Regular, Menlo, monospace';
    const meta = `CLASS: ${baseClass.toUpperCase()}   •   PALETTE: ${paletteName.toUpperCase()}   •   RIG: ${rigSpec?.version ?? '1.0.0'} (200x260)`;
    ctx.fillText(meta, 44, 82);

    ctx.textAlign = 'right';
    ctx.fillText(new Date().toISOString().slice(0, 10), W - 44, 64);
    ctx.textAlign = 'left';

    const drawTurnaroundPanel = (x, y, pw, ph, label, angle, sockets) => {
      const grad = ctx.createRadialGradient(x + pw * 0.5, y + ph * 0.45, 20, x + pw * 0.5, y + ph * 0.5, pw * 0.8);
      grad.addColorStop(0, '#273449');
      grad.addColorStop(1, '#111827');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = '#2A3954';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, pw, ph);

      ctx.fillStyle = 'rgba(11, 16, 27, 0.82)';
      ctx.fillRect(x + 12, y + 12, 160, 28);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(label, x + 22, y + 31);

      const scale = Math.min((pw - 40) / RIG_WIDTH, (ph - 60) / RIG_HEIGHT);
      ctx.save();
      ctx.translate(x + (pw - RIG_WIDTH * scale) * 0.5, y + 20 + (ph - 40 - RIG_HEIGHT * scale) * 0.5);
      ctx.scale(scale, scale);
      this.drawRig({
        ctx,
        rigSpec,
        sockets,
        angle,
        palette,
        skinHex,
        showShadow: true,
      });
      ctx.restore();
    };

    drawTurnaroundPanel(40, 118, 390, 560, 'FRONT (200x260)', 'front', frontSockets);
    drawTurnaroundPanel(450, 118, 390, 560, 'BATTLE-BACK (200x260)', 'battle-back', backSockets);

    // Dye Palette Swatches
    ctx.fillStyle = '#121A2A';
    ctx.fillRect(40, 700, 800, 300);
    ctx.strokeStyle = '#2A3954';
    ctx.strokeRect(40, 700, 800, 300);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('DYE PALETTE & SKIN SWATCHES', 64, 734);

    const swatches = [
      ['PRIMARY', palette.primary],
      ['SECONDARY', palette.secondary],
      ['TRIM', palette.trim],
      ['GLOW', palette.glow],
      ['SKIN', skinHex],
    ];
    swatches.forEach(([name, hex], idx) => {
      const sx = 64 + idx * 150;
      const sy = 762;
      ctx.fillStyle = '#182235';
      ctx.fillRect(sx, sy, 136, 206);
      ctx.strokeStyle = '#2A3954';
      ctx.strokeRect(sx, sy, 136, 206);

      ctx.fillStyle = hex;
      ctx.fillRect(sx + 12, sy + 12, 112, 112);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.strokeRect(sx + 12, sy + 12, 112, 112);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(name, sx + 12, sy + 150);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(hex.toUpperCase(), sx + 12, sy + 172);
      const [r, g, b] = hexToRgb255(hex);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`rgb(${r},${g},${b})`, sx + 12, sy + 192);
    });

    // Right Panel: 9-Slot Isolated Equipped Parts Grid
    ctx.fillStyle = '#121A2A';
    ctx.fillRect(862, 118, 698, 882);
    ctx.strokeStyle = '#2A3954';
    ctx.strokeRect(862, 118, 698, 882);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(`ISOLATED EQUIPPED PARTS GRID (${sheetAngle.toUpperCase()})`, 886, 152);

    const cols = 3;
    const cardW = 208;
    const cardH = 264;
    equippedItems.slice(0, 9).forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = 886 + col * (cardW + 14);
      const cy = 172 + row * (cardH + 14);

      ctx.fillStyle = '#182235';
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.strokeStyle = item.source === 'workshop' ? '#F59E0B' : '#2A3954';
      ctx.lineWidth = item.source === 'workshop' ? 2 : 1;
      ctx.strokeRect(cx, cy, cardW, cardH);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(item.slot.toUpperCase(), cx + 12, cy + 22);

      if (item.source === 'workshop') {
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(cx + cardW - 82, cy + 9, 72, 18);
        ctx.fillStyle = '#0B101B';
        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText('WORKSHOP', cx + cardW - 76, cy + 22);
      }

      if (item.urls) {
        const partRes = this.getOrBuildPartCanvas(item.urls, palette, skinHex);
        if (partRes && !partRes.isBlank) {
          if (partRes.bbox && partRes.bbox.w > 4 && partRes.bbox.h > 4) {
            const { minX, minY, w: bw, h: bh } = partRes.bbox;
            const ps = Math.min((cardW - 36) / bw, (cardH - 80) / bh);
            const dw = bw * ps;
            const dh = bh * ps;
            ctx.drawImage(
              partRes.canvas,
              minX,
              minY,
              bw,
              bh,
              cx + (cardW - dw) * 0.5,
              cy + 32 + (cardH - 72 - dh) * 0.5,
              dw,
              dh
            );
          } else {
            const ps = Math.min((cardW - 24) / RIG_WIDTH, (cardH - 72) / RIG_HEIGHT);
            ctx.save();
            ctx.translate(cx + (cardW - RIG_WIDTH * ps) * 0.5, cy + 28 + (cardH - 64 - RIG_HEIGHT * ps) * 0.5);
            ctx.scale(ps, ps);
            ctx.drawImage(partRes.canvas, 0, 0, RIG_WIDTH, RIG_HEIGHT);
            ctx.restore();
          }
        }
      } else {
        ctx.fillStyle = '#475569';
        ctx.font = '500 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('(Empty Slot)', cx + cardW * 0.5, cy + cardH * 0.5);
        ctx.textAlign = 'left';
      }

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      const label = item.label.length > 23 ? `${item.label.slice(0, 22)}…` : item.label;
      ctx.fillText(label, cx + 12, cy + cardH - 14);
    });

    // Bottom Strip: 4-Class Cross-Check Strip
    ctx.fillStyle = '#121A2A';
    ctx.fillRect(40, 1020, 1520, 260);
    ctx.strokeStyle = '#2A3954';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 1020, 1520, 260);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(`4-CLASS CROSS-CHECK STRIP (${sheetAngle.toUpperCase()})`, 64, 1052);

    const stripW = 352;
    const stripH = 196;
    crossClassSockets.forEach(({ cls, sockets }, idx) => {
      const bx = 64 + idx * (stripW + 18);
      const by = 1068;
      ctx.fillStyle = '#182235';
      ctx.fillRect(bx, by, stripW, stripH);
      ctx.strokeStyle = cls.id === baseClass ? '#38BDF8' : '#2A3954';
      ctx.lineWidth = cls.id === baseClass ? 2 : 1;
      ctx.strokeRect(bx, by, stripW, stripH);

      ctx.fillStyle = cls.id === baseClass ? '#38BDF8' : '#E2E8F0';
      ctx.font = '700 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(cls.name.toUpperCase(), bx + 14, by + 24);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(cls.role, bx + 14, by + 42);

      const cs = Math.min(132 / RIG_WIDTH, 174 / RIG_HEIGHT);
      ctx.save();
      ctx.translate(bx + stripW - RIG_WIDTH * cs - 28, by + (stripH - RIG_HEIGHT * cs) * 0.5);
      ctx.scale(cs, cs);
      this.drawRig({
        ctx,
        rigSpec,
        sockets,
        angle: sheetAngle,
        palette,
        skinHex,
        showShadow: true,
      });
      ctx.restore();
    });

    return sheet.toDataURL('image/png');
  }
}
