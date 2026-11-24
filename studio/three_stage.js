/**
 * Lumendelve 3D Bento Cockpit — Three.js 60fps Stage Controller
 * Powered by Three.js r170, rigged 17-bone .glb models, inverted-hull outlines,
 * 5 Flyff style presets, Walk/Run animated grid, and dual Battle Modes.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { OrbitControls } from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'https://esm.sh/three@0.170.0/examples/jsm/postprocessing/OutputPass.js';
import { createGroundLootManager } from './modules/ground_loot_3d.js';
import {
  getClassWeaponStyles,
  getStaffElementDef,
  getWeaponStyleDef,
} from './modules/weapon_staging_catalog.js';
import { WeaponVfxEngine } from './modules/weapon_vfx_3d.js';
import {
  TOTK_CLASS_DEFAULT_PALETTES,
  createTotkDyeMaterial,
  setTotkMaterialDye,
  extractTotkChannel,
} from './modules/totk_dye_material.js';
import { ARMOR_SLOTS, ArmorMounter3D } from './modules/armor_mounter_3d.js';
import {
  applyLockedWeaponMaterials,
  resolveWeaponSpecsForLoadout,
} from './modules/weapon_mounter_3d.js';
import { GEAR_BASE_BY_ID, resolveArmorVisualSpec } from './vendor/ld-engine.js';

export { TOTK_CLASS_DEFAULT_PALETTES };

const TOTK_HERO_MESH =
  /^(Body_(Male|Female)|Armor_[a-z0-9_]+|Weapon_[a-z0-9_]+)_(Primary|Secondary|Trim|Glow|Steel|Skin|Fixed|BowString)(?:[._]\d+)?$/i;

export function resolveTotkMesh(mesh) {
  if (!mesh?.name || !mesh.geometry?.attributes?.color) return null;
  if (!TOTK_HERO_MESH.test(mesh.name)) return null;
  const channel = extractTotkChannel(mesh.name);
  if (!channel) return null;
  return { mesh, channel };
}

function isTotkHeroMesh(mesh) {
  return Boolean(resolveTotkMesh(mesh));
}


export const MATERIAL_KEYS = ['Primary', 'Secondary', 'Trim', 'Glow', 'Steel', 'Skin'];

export const CLASS_WEAPON_META = {
  squire: {
    A: { label: 'Sword+Shield', subtypes: ['sword_1h', 'axe_1h', 'shield'] },
    B: { label: '2H Sword', subtypes: ['sword_2h'] },
  },
  scout: {
    A: { label: 'Winged Bow', subtypes: ['bow'] },
    B: { label: 'Fan Daggers', subtypes: ['dagger_dual'] },
  },
  arcanist: {
    A: { label: 'Mage Staff', subtypes: ['staff'] },
    B: { label: 'Wand+Focus', subtypes: ['wand', 'tome'] },
  },
  acolyte: {
    A: { label: 'Dual Stick', subtypes: ['rod', 'tome'] },
    B: { label: 'Gauntlets', subtypes: ['gauntlet'] },
  },
};

export const FACE_PRESETS = [
  {
    id: 'm1',
    code: 'M1',
    label: 'M1 · Heroic',
    gender: 'male',
    irisTop: '#172554',
    irisMid: '#2563EB',
    irisBot: '#60A5FA',
    irisRim: '#1E1B4B',
    browColor: '#2B1E1A',
    browStyle: 'heroic',
    mouthStyle: 'gentle',
    eyeScaleY: 0.9,
    irisScaleY: 0.94,
    outerTilt: 0.14,
    lidDrop: 0.04,
    wingLen: 0.08,
    wingLift: 0.08,
    lashWidth: 7.2,
    blushAlpha: 0.22,
    blushColor: '#F472B6',
    lidShadow: '#C7D2FE',
    sparkle: false,
  },
  {
    id: 'm2',
    code: 'M2',
    label: 'M2 · Fierce',
    gender: 'male',
    irisTop: '#7F1D1D',
    irisMid: '#DC2626',
    irisBot: '#FB923C',
    irisRim: '#450A0A',
    browColor: '#1F1614',
    browStyle: 'fierce',
    mouthStyle: 'smirk',
    eyeScaleY: 0.84,
    irisScaleY: 0.94,
    outerTilt: 0.22,
    lidDrop: 0.12,
    wingLen: 0.1,
    wingLift: 0.12,
    lashWidth: 7.8,
    blushAlpha: 0.12,
    blushColor: '#FB7185',
    lidShadow: '#CBD5E1',
    sparkle: false,
  },
  {
    id: 'm3',
    code: 'M3',
    label: 'M3 · Cool',
    gender: 'male',
    irisTop: '#164E63',
    irisMid: '#0891B2',
    irisBot: '#A5F3FC',
    irisRim: '#083344',
    browColor: '#26202A',
    browStyle: 'cool',
    mouthStyle: 'calm',
    eyeScaleY: 0.84,
    irisScaleY: 0.94,
    outerTilt: 0.1,
    lidDrop: 0.18,
    wingLen: 0.07,
    wingLift: 0.06,
    lashWidth: 6.8,
    blushAlpha: 0.1,
    blushColor: '#F472B6',
    lidShadow: '#94A3B8',
    sparkle: false,
  },
  {
    id: 'm4',
    code: 'M4',
    label: 'M4 · Mystic',
    gender: 'male',
    irisTop: '#3B0764',
    irisMid: '#7C3AED',
    irisBot: '#E879F9',
    irisRim: '#2E1065',
    browColor: '#2D1E36',
    browStyle: 'mystic',
    mouthStyle: 'gentle',
    eyeScaleY: 0.92,
    irisScaleY: 0.96,
    outerTilt: 0.14,
    lidDrop: 0.04,
    wingLen: 0.09,
    wingLift: 0.1,
    lashWidth: 7.0,
    blushAlpha: 0.18,
    blushColor: '#E879F9',
    lidShadow: '#DDD6FE',
    sparkle: true,
  },
  {
    id: 'm5',
    code: 'M5',
    label: 'M5 · Bold',
    gender: 'male',
    irisTop: '#064E3B',
    irisMid: '#059669',
    irisBot: '#A7F3D0',
    irisRim: '#022C22',
    browColor: '#291B14',
    browStyle: 'bold',
    mouthStyle: 'grin',
    eyeScaleY: 0.94,
    irisScaleY: 0.95,
    outerTilt: 0.16,
    lidDrop: 0.02,
    wingLen: 0.08,
    wingLift: 0.09,
    lashWidth: 7.6,
    blushAlpha: 0.25,
    blushColor: '#FB7185',
    lidShadow: '#BAE6FD',
    sparkle: false,
  },
  {
    id: 'f1',
    code: 'F1',
    label: 'F1 · Madrigal',
    gender: 'female',
    irisTop: '#1E3A8A',
    irisMid: '#3B82F6',
    irisBot: '#7DD3FC',
    irisRim: '#1E1B4B',
    browColor: '#3B251E',
    browStyle: 'madrigal',
    mouthStyle: 'gentle',
    eyeScaleY: 0.98,
    irisScaleY: 1.0,
    outerTilt: 0.14,
    lidDrop: 0.0,
    wingLen: 0.15,
    wingLift: 0.14,
    lashWidth: 8.0,
    blushAlpha: 0.36,
    blushColor: '#F472B6',
    lidShadow: '#C7D2FE',
    sparkle: true,
  },
  {
    id: 'f2',
    code: 'F2',
    label: 'F2 · Seraph',
    gender: 'female',
    irisTop: '#78350F',
    irisMid: '#D97706',
    irisBot: '#FDE047',
    irisRim: '#451A03',
    browColor: '#4A3022',
    browStyle: 'seraph',
    mouthStyle: 'calm',
    eyeScaleY: 0.96,
    irisScaleY: 1.0,
    outerTilt: 0.1,
    lidDrop: 0.02,
    wingLen: 0.12,
    wingLift: 0.1,
    lashWidth: 7.4,
    blushAlpha: 0.32,
    blushColor: '#FB7185',
    lidShadow: '#E0E7FF',
    sparkle: true,
  },
  {
    id: 'f3',
    code: 'F3',
    label: 'F3 · Rogue',
    gender: 'female',
    irisTop: '#065F46',
    irisMid: '#10B981',
    irisBot: '#6EE7B7',
    irisRim: '#064E3B',
    browColor: '#2B1E1A',
    browStyle: 'rogue',
    mouthStyle: 'smirk',
    eyeScaleY: 0.92,
    irisScaleY: 0.95,
    outerTilt: 0.24,
    lidDrop: 0.07,
    wingLen: 0.19,
    wingLift: 0.2,
    lashWidth: 8.2,
    blushAlpha: 0.26,
    blushColor: '#FB7185',
    lidShadow: '#CBD5E1',
    sparkle: false,
  },
  {
    id: 'f4',
    code: 'F4',
    label: 'F4 · Arcane',
    gender: 'female',
    irisTop: '#581C87',
    irisMid: '#C026D3',
    irisBot: '#F9A8D4',
    irisRim: '#3B0764',
    browColor: '#2E1C3B',
    browStyle: 'arcane',
    mouthStyle: 'calm',
    eyeScaleY: 0.96,
    irisScaleY: 0.98,
    outerTilt: 0.18,
    lidDrop: 0.06,
    wingLen: 0.17,
    wingLift: 0.16,
    lashWidth: 7.8,
    blushAlpha: 0.24,
    blushColor: '#F472B6',
    lidShadow: '#E9D5FF',
    sparkle: true,
  },
  {
    id: 'f5',
    code: 'F5',
    label: 'F5 · Cheerful',
    gender: 'female',
    irisTop: '#831843',
    irisMid: '#EC4899',
    irisBot: '#FBCFE8',
    irisRim: '#500724',
    browColor: '#3E241C',
    browStyle: 'cheerful',
    mouthStyle: 'cat',
    eyeScaleY: 0.98,
    irisScaleY: 1.0,
    outerTilt: 0.12,
    lidDrop: -0.02,
    wingLen: 0.14,
    wingLift: 0.14,
    lashWidth: 7.8,
    blushAlpha: 0.42,
    blushColor: '#FB7185',
    lidShadow: '#FCE7F3',
    sparkle: true,
  },
];

export function buildFlyffFaceTexture(faceId, skinHex = '#f5c9ad') {
  const preset = FACE_PRESETS.find((f) => f.id === faceId) || FACE_PRESETS.find((f) => f.id === 'f1');
  const size = 1024;
  const px = (v) => v * (size / 512);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 1. Solid skin base across entire 1024x1024 canvas so back/sides of head & UV border (0.02, 0.98) match Skin
  ctx.fillStyle = skinHex || '#f5c9ad';
  ctx.fillRect(0, 0, size, size);

  const uvX = (u) => u * size;
  const uvY = (v) => (1 - v) * size;

  // 1b. Gentle upper-forehead hairline warmth (strictly inside central mask so (0.02, 0.98) stays pure skinHex)
  {
    ctx.save();
    const fhX = uvX(0.5);
    const fhY = uvY(0.84);
    const fhRx = 0.36 * size;
    const fhRy = 0.085 * size;
    ctx.translate(fhX, fhY);
    ctx.scale(1, fhRy / fhRx);
    const fhGrad = ctx.createRadialGradient(0, 0, px(12), 0, 0, fhRx);
    fhGrad.addColorStop(0, 'rgba(196, 128, 102, 0.14)');
    fhGrad.addColorStop(0.6, 'rgba(196, 128, 102, 0.07)');
    fhGrad.addColorStop(1, 'rgba(196, 128, 102, 0)');
    ctx.fillStyle = fhGrad;
    ctx.beginPath();
    ctx.arc(0, 0, fhRx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Soft airbrushed porcelain cheek blush (u = 0.5 ± 0.280, v = 0.305)
  for (const sx of [-1, 1]) {
    const bx = uvX(0.5 + sx * 0.280);
    const by = uvY(0.305);
    const rx = 0.098 * size;
    const ry = 0.048 * size;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, px(4), 0, 0, rx);
    grad.addColorStop(0, preset.blushColor);
    grad.addColorStop(0.52, preset.blushColor);
    grad.addColorStop(1, 'rgba(244, 143, 177, 0)');
    ctx.globalAlpha = Math.min(0.32, (preset.blushAlpha || 0.28) * 0.84);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Semi-Lidded Almond Flyff Eyes & Eyebrows (uc = 0.5 ± 0.230, vc = 0.492)
  for (const sx of [-1, 1]) {
    const ex = uvX(0.5 + sx * 0.230);
    const ey = uvY(0.492);
    const rx = 0.132 * size;
    const clampedEyeScaleY = Math.min(0.98, Math.max(0.84, preset.eyeScaleY || 0.92));
    const ry = 0.092 * size * clampedEyeScaleY;

    // Soft warm eye-socket / upper-lid shading behind each eye
    {
      ctx.save();
      ctx.translate(ex, ey - ry * 0.46);
      ctx.scale(sx, 0.56);
      const sockR = rx * 1.15;
      const sockGrad = ctx.createRadialGradient(0, 0, px(8), 0, 0, sockR);
      sockGrad.addColorStop(0, 'rgba(201, 140, 116, 0.22)');
      sockGrad.addColorStop(0.65, 'rgba(201, 140, 116, 0.08)');
      sockGrad.addColorStop(1, 'rgba(201, 140, 116, 0)');
      ctx.fillStyle = sockGrad;
      ctx.beginPath();
      ctx.arc(0, 0, sockR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const topPeakY = -ry * (0.86 - (preset.lidDrop || 0));
    const outerY = -ry * preset.outerTilt;
    const innerY = ry * 0.14;
    const botY = ry * 0.78;

    // Build sclera almond path in mirrored eye space (local +X = outer corner)
    const traceEyePath = () => {
      ctx.beginPath();
      ctx.moveTo(-rx * 0.94, innerY);
      ctx.bezierCurveTo(
        -rx * 0.52,
        topPeakY * 1.04,
        rx * 0.32,
        topPeakY * 1.02,
        rx * 1.02,
        outerY
      );
      ctx.bezierCurveTo(
        rx * 0.82,
        botY * 0.78,
        rx * 0.34,
        botY,
        -rx * 0.06,
        botY * 0.98
      );
      ctx.bezierCurveTo(
        -rx * 0.48,
        botY * 0.95,
        -rx * 0.82,
        ry * 0.48,
        -rx * 0.94,
        innerY
      );
      ctx.closePath();
    };

    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(sx, 1);

    // Warm ivory-peach sclera (#F2E4DC)
    traceEyePath();
    ctx.fillStyle = '#F2E4DC';
    ctx.fill();

    // Clip interior features to sclera almond
    ctx.save();
    traceEyePath();
    ctx.clip();

    // Soft warm corner shading across outer & inner sclera edges
    for (const cSign of [-1, 1]) {
      const cGrad = ctx.createRadialGradient(cSign * rx * 0.86, 0, px(2), cSign * rx * 0.86, 0, rx * 0.42);
      cGrad.addColorStop(0, 'rgba(104, 68, 56, 0.22)');
      cGrad.addColorStop(1, 'rgba(104, 68, 56, 0)');
      ctx.fillStyle = cGrad;
      ctx.fillRect(-rx * 1.1, -ry * 1.1, rx * 2.2, ry * 2.2);
    }

    // Soft warm airbrushed upper-lid shadow across top 32% of sclera
    const lidSpan = (botY - topPeakY) * 0.36;
    const lidGrad = ctx.createLinearGradient(0, topPeakY, 0, topPeakY + lidSpan);
    lidGrad.addColorStop(0, 'rgba(104, 68, 56, 0.36)');
    lidGrad.addColorStop(0.55, 'rgba(104, 68, 56, 0.16)');
    lidGrad.addColorStop(1, 'rgba(104, 68, 56, 0)');
    ctx.fillStyle = lidGrad;
    ctx.fillRect(-rx * 1.1, topPeakY - px(4), rx * 2.2, lidSpan + px(8));

    // Semi-lidded Flyff iris: shifted upward (`iy = -0.008 * size`) so zero white shows above/below
    const ix = -0.004 * size;
    const iy = -0.008 * size;
    const irisRx = 0.090 * size;
    const irisRy = 0.100 * size;

    const irisGrad = ctx.createLinearGradient(ix, iy - irisRy, ix, iy + irisRy);
    irisGrad.addColorStop(0, preset.irisTop);
    irisGrad.addColorStop(0.38, preset.irisTop);
    irisGrad.addColorStop(0.58, preset.irisMid);
    irisGrad.addColorStop(1, preset.irisBot);

    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(ix, iy, irisRx, irisRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Luminous inner jewel glow ring
    const ringGrad = ctx.createRadialGradient(ix, iy + irisRy * 0.12, irisRx * 0.34, ix, iy, irisRx * 0.92);
    ringGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    ringGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.20)');
    ringGrad.addColorStop(0.82, 'rgba(191, 219, 254, 0.12)');
    ringGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.ellipse(ix, iy, irisRx * 0.94, irisRy * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();

    // Luminous lower iris bounce crescent
    const bounceGrad = ctx.createRadialGradient(ix, iy + irisRy * 0.44, px(2), ix, iy + irisRy * 0.36, irisRx * 0.84);
    bounceGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    bounceGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.12)');
    bounceGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bounceGrad;
    ctx.beginPath();
    ctx.ellipse(ix, iy, irisRx * 0.90, irisRy * 0.90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp limbal rim
    ctx.strokeStyle = preset.irisRim;
    ctx.lineWidth = px(3.2);
    ctx.globalAlpha = 0.86;
    ctx.beginPath();
    ctx.ellipse(ix, iy, irisRx * 0.96, irisRy * 0.96, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Velvety deep pupil
    const pupilRx = 0.044 * size;
    const pupilRy = 0.052 * size;
    ctx.fillStyle = '#0E1324';
    ctx.beginPath();
    ctx.ellipse(ix, iy + px(1), pupilRx, pupilRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Softened porcelain catchlights (`0.018` upper-outer, `0.009` lower-inner)
    const keyX = ix + sx * (0.032 * size);
    const keyY = iy - 0.034 * size;
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.ellipse(keyX, keyY, 0.018 * size, 0.020 * size, 0, 0, Math.PI * 2);
    ctx.fill();

    const subX = ix - sx * (0.026 * size);
    const subY = iy + 0.034 * size;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.ellipse(subX, subY, 0.009 * size, 0.010 * size, 0, 0, Math.PI * 2);
    ctx.fill();

    if (preset.sparkle) {
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.arc(ix + sx * (0.005 * size), iy - 0.046 * size, px(2.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    ctx.restore(); // end sclera clip

    // Soft feathered lower lash rim
    ctx.strokeStyle = '#4E3128';
    ctx.lineWidth = px(1.5);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.56, botY * 0.92);
    ctx.quadraticCurveTo(0, botY * 1.04, rx * 0.70, botY * 0.80);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Feathered warm-espresso (#2A1812 + #5C382C halo) arched upper lash resting gently across top ~24% of iris
    const wingTipX = rx * (1.02 + preset.wingLen);
    const wingTipY = outerY - ry * preset.wingLift;
    const lashThick = px((preset.lashWidth || 7.6) * 1.32);
    const lashTopY = topPeakY + px(2.0);
    ctx.save();
    ctx.strokeStyle = '#5C382C';
    ctx.globalAlpha = 0.46;
    ctx.lineWidth = lashThick * 1.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-rx * 0.95, innerY + px(1.5));
    ctx.bezierCurveTo(-rx * 0.54, lashTopY - lashThick * 0.25, rx * 0.34, lashTopY - lashThick * 0.25, wingTipX, wingTipY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#2A1812';
    ctx.beginPath();
    ctx.moveTo(-rx * 0.98, innerY + px(1.8));
    ctx.bezierCurveTo(
      -rx * 0.54,
      lashTopY - lashThick * 0.85,
      rx * 0.34,
      lashTopY - lashThick * 0.92,
      wingTipX,
      wingTipY
    );
    ctx.quadraticCurveTo(rx * 1.02, outerY + px(2.8), rx * 0.90, outerY + px(3.2));
    ctx.bezierCurveTo(
      rx * 0.30,
      lashTopY + lashThick * 0.48,
      -rx * 0.48,
      lashTopY + lashThick * 0.46,
      -rx * 0.92,
      innerY + px(3.0)
    );
    ctx.closePath();
    ctx.fill();

    if (preset.gender === 'female') {
      ctx.strokeStyle = '#331F19';
      ctx.lineWidth = px(1.85);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rx * 0.86, outerY + px(1.0));
      ctx.lineTo(rx * (1.05 + preset.wingLen * 0.50), outerY - ry * (preset.wingLift * 0.40));
      ctx.stroke();
    }

    // Soft double-lid crease fold
    ctx.strokeStyle = '#94604E';
    ctx.lineWidth = px(1.55);
    ctx.globalAlpha = 0.36;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.66, topPeakY - px(10));
    ctx.quadraticCurveTo(rx * 0.12, topPeakY - px(16), rx * 0.82, outerY - px(10));
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    ctx.restore();

    // Soft tapered eyebrows lowered slightly (vc = 0.638 -> Z = 1.332m)
    const browY = uvY(0.638);
    ctx.save();
    ctx.translate(ex, browY);
    ctx.scale(sx, 1);
    ctx.fillStyle = preset.gender === 'male' && preset.browStyle !== 'cool' ? '#2D1C17' : '#38231C';
    const bw = 0.112 * size;

    const drawTaperedBrow = (x0, y0, cx, cy, x1, y1, hStart, hMid, hEnd) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0 - hStart * 0.5);
      ctx.quadraticCurveTo(cx, cy - hMid * 0.5, x1, y1 - hEnd * 0.5);
      ctx.lineTo(x1, y1 + hEnd * 0.5);
      ctx.quadraticCurveTo(cx, cy + hMid * 0.5, x0, y0 + hStart * 0.5);
      ctx.closePath();
      ctx.fill();
    };

    if (preset.browStyle === 'fierce') {
      drawTaperedBrow(-bw * 0.90, px(8), 0, px(-3), bw * 1.02, px(-12), px(12.2), px(9.2), px(3.0));
    } else if (preset.browStyle === 'cool') {
      drawTaperedBrow(-bw * 0.90, px(2), 0, px(-2), bw * 0.94, px(-2), px(10.8), px(8.2), px(2.8));
    } else if (preset.browStyle === 'bold') {
      drawTaperedBrow(-bw * 0.92, px(3), bw * 0.08, px(-10), bw * 1.00, px(-4), px(13.2), px(10.4), px(3.6));
    } else if (preset.browStyle === 'rogue') {
      drawTaperedBrow(-bw * 0.86, px(5), bw * 0.12, px(-8), bw * 1.02, px(-9), px(9.8), px(7.6), px(2.6));
    } else if (preset.browStyle === 'cheerful') {
      drawTaperedBrow(-bw * 0.84, px(1), 0, px(-13), bw * 0.90, px(2), px(9.0), px(7.2), px(2.6));
    } else if (preset.browStyle === 'arcane' || preset.browStyle === 'mystic') {
      const wBase = preset.gender === 'female' ? 8.8 : 10.6;
      drawTaperedBrow(-bw * 0.88, px(2), bw * 0.15, px(-9), bw * 0.96, px(1), px(wBase), px(wBase * 0.78), px(2.6));
    } else {
      const wBase = preset.gender === 'female' ? 9.0 : 11.2;
      drawTaperedBrow(-bw * 0.90, px(4), bw * 0.05, px(-10), bw * 0.96, px(-1), px(wBase), px(wBase * 0.80), px(2.6));
    }
    ctx.restore();
  }

  // 4. Sculpted bilateral nose-bridge contour shadows + upturned nose-tip shading (vc = 0.328)
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(uvX(0.500 + sx * 0.032), uvY(0.422));
    ctx.scale(0.66, 2.2);
    const nbGrad = ctx.createRadialGradient(0, 0, px(1), 0, 0, px(11));
    nbGrad.addColorStop(0, 'rgba(182, 115, 93, 0.20)');
    nbGrad.addColorStop(0.65, 'rgba(182, 115, 93, 0.08)');
    nbGrad.addColorStop(1, 'rgba(182, 115, 93, 0)');
    ctx.fillStyle = nbGrad;
    ctx.beginPath();
    ctx.arc(0, 0, px(11), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  {
    const nx = uvX(0.502);
    const ny = uvY(0.328);
    ctx.save();
    ctx.translate(nx, ny);
    ctx.scale(1.42, 0.86);
    const nGrad = ctx.createRadialGradient(0, 0, px(0.5), 0, 0, px(5.8));
    nGrad.addColorStop(0, 'rgba(168, 98, 77, 0.36)');
    nGrad.addColorStop(0.65, 'rgba(168, 98, 77, 0.13)');
    nGrad.addColorStop(1, 'rgba(168, 98, 77, 0)');
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(0, 0, px(5.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const hx = uvX(0.499);
    const hy = uvY(0.362);
    ctx.translate(hx, hy);
    ctx.scale(0.85, 1.8);
    const hGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, px(5.4));
    hGrad.addColorStop(0, 'rgba(255, 249, 244, 0.40)');
    hGrad.addColorStop(1, 'rgba(255, 249, 244, 0)');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(0, 0, px(5.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. Soft warm rose-terracotta M-lip cushions + delicate smile (vc = 0.206 -> Z = 1.245m)
  const mx = uvX(0.500);
  const my = uvY(0.206);
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(mx + sx * px(5.6), my - px(2.6));
    ctx.scale(1.5, 0.88);
    const upGrad = ctx.createRadialGradient(0, 0, px(0.8), 0, 0, px(7.2));
    upGrad.addColorStop(0, 'rgba(156, 82, 72, 0.34)');
    upGrad.addColorStop(0.65, 'rgba(156, 82, 72, 0.12)');
    upGrad.addColorStop(1, 'rgba(156, 82, 72, 0)');
    ctx.fillStyle = upGrad;
    ctx.beginPath();
    ctx.arc(0, 0, px(7.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  {
    ctx.save();
    ctx.translate(mx, my + px(4.6));
    ctx.scale(2.1, 0.96);
    const lipGrad = ctx.createRadialGradient(0, 0, px(1), 0, 0, px(10.2));
    lipGrad.addColorStop(0, 'rgba(217, 123, 112, 0.38)');
    lipGrad.addColorStop(0.65, 'rgba(217, 123, 112, 0.14)');
    lipGrad.addColorStop(1, 'rgba(217, 123, 112, 0)');
    ctx.fillStyle = lipGrad;
    ctx.beginPath();
    ctx.arc(0, 0, px(10.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(mx, my + px(5.5));
    ctx.scale(1.8, 0.76);
    const lhiGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, px(5.0));
    lhiGrad.addColorStop(0, 'rgba(255, 242, 236, 0.26)');
    lhiGrad.addColorStop(1, 'rgba(255, 242, 236, 0)');
    ctx.fillStyle = lhiGrad;
    ctx.beginPath();
    ctx.arc(0, 0, px(5.0), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const cy = uvY(0.140);
    ctx.translate(mx, cy);
    ctx.scale(1.5, 0.85);
    const cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, px(6.8));
    cGrad.addColorStop(0, 'rgba(201, 133, 112, 0.14)');
    cGrad.addColorStop(1, 'rgba(201, 133, 112, 0)');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(0, 0, px(6.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  const mouthGrad = ctx.createLinearGradient(mx - px(20), my, mx + px(20), my);
  mouthGrad.addColorStop(0, 'rgba(156, 82, 72, 0.14)');
  mouthGrad.addColorStop(0.24, 'rgba(156, 82, 72, 0.68)');
  mouthGrad.addColorStop(0.76, 'rgba(156, 82, 72, 0.68)');
  mouthGrad.addColorStop(1, 'rgba(156, 82, 72, 0.14)');
  ctx.strokeStyle = mouthGrad;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (preset.mouthStyle === 'smirk') {
    ctx.lineWidth = px(2.45);
    ctx.beginPath();
    ctx.moveTo(mx - px(19), my + px(0.8));
    ctx.quadraticCurveTo(mx + px(2), my + px(3.4), mx + px(20), my - px(3.6));
    ctx.stroke();
  } else if (preset.mouthStyle === 'calm') {
    ctx.lineWidth = px(2.35);
    ctx.beginPath();
    ctx.moveTo(mx - px(18), my - px(0.5));
    ctx.quadraticCurveTo(mx, my + px(2.8), mx + px(18), my - px(0.5));
    ctx.stroke();
  } else if (preset.mouthStyle === 'grin') {
    ctx.beginPath();
    ctx.moveTo(mx - px(19), my - px(1.4));
    ctx.quadraticCurveTo(mx, my + px(1.4), mx + px(19), my - px(1.4));
    ctx.quadraticCurveTo(mx + px(12), my + px(9.8), mx, my + px(9.8));
    ctx.quadraticCurveTo(mx - px(12), my + px(9.8), mx - px(19), my - px(1.4));
    ctx.closePath();
    ctx.fillStyle = '#C9686D';
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#F6EEE8';
    ctx.fillRect(mx - px(18), my - px(1.6), px(36), px(3.6));
    ctx.fillStyle = '#F48FB1';
    ctx.beginPath();
    ctx.ellipse(mx, my + px(7.2), px(10.5), px(4.0), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = px(1.85);
    ctx.stroke();
  } else if (preset.mouthStyle === 'cat') {
    ctx.lineWidth = px(2.35);
    ctx.beginPath();
    ctx.moveTo(mx - px(19), my - px(1.2));
    ctx.quadraticCurveTo(mx - px(9.5), my + px(5.0), mx, my);
    ctx.quadraticCurveTo(mx + px(9.5), my + px(5.0), mx + px(19), my - px(1.2));
    ctx.stroke();
  } else {
    // Delicate porcelain rosebud gentle anime smile
    ctx.lineWidth = px(2.45);
    ctx.beginPath();
    ctx.moveTo(mx - px(20), my - px(1.2));
    ctx.quadraticCurveTo(mx, my + px(5.2), mx + px(20), my - px(1.2));
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // glTF TEXCOORD_0 uses v=0 top, v=1 bottom
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export const CLASS_DEFAULT_PALETTES = TOTK_CLASS_DEFAULT_PALETTES;

const TIER_TO_SILHOUETTE = {
  Tier_Lv1: 't1',
  Tier_Lv15: 't2',
  Tier_Lv30: 't3',
  Tier_Lv50: 't4',
};

export const FLYFF_STYLES = [
  {
    id: 'universe-pbr',
    name: 'Flyff Universe',
    shortTag: 'Universe',
    image: '/styles/2_flyff_universe_pbr.png',
    notes: 'Warm Half-Lambert anime shading, crisp #2B1E1A thin outlines, sunny sky fill & soft bloom.',
    outline: true,
    outlineWidth: 0.0085,
    outlineColor: '#2B1E1A',
    bloom: true,
    toneMapping: THREE.NoToneMapping,
    bgTop: '#3b6ea8',
    bgBottom: '#182b49',
  },
];

export const GRIND_MOBS_CONFIG = [
  { id: 'slime', name: 'Rift Slime', level: 10, maxHp: 140, pos: [-2.35, 0, -1.65], color: '#22d3ee', height: 1.05 },
  { id: 'wisp', name: 'Iron Wisp', level: 14, maxHp: 175, pos: [0.05, 0, -2.85], color: '#a855f7', height: 1.55 },
  { id: 'golem', name: 'Stone Golem', level: 18, maxHp: 225, pos: [2.45, 0, -1.5], color: '#f59e0b', height: 1.85 },
];

const TIER_NAMES = ['Tier_Lv1', 'Tier_Lv15', 'Tier_Lv30', 'Tier_Lv50'];

function createFlyffUniverseRamp() {
  const count = 64;
  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const smooth = Math.max(0, Math.min(1, (t - 0.42) / 0.22));
    const s = smooth * smooth * (3 - 2 * smooth);
    const v = Math.round(166 + (255 - 166) * s); // minimum shadow brightness ~0.65 (166/255)
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createPlinthTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  // Radial grassland-to-stone dungeon medallion
  const grad = ctx.createRadialGradient(size / 2, size / 2, 24, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#2a394e');
  grad.addColorStop(0.42, '#223142');
  grad.addColorStop(0.76, '#2a4a3a');
  grad.addColorStop(0.95, '#3b5c42');
  grad.addColorStop(1, '#26332c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle concentric stone runes
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.14)';
  ctx.lineWidth = 2;
  for (const r of [90, 145, 200, 236]) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Compass ticks
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size / 2 + Math.cos(a) * 145, size / 2 + Math.sin(a) * 145);
    ctx.lineTo(size / 2 + Math.cos(a) * 200, size / 2 + Math.sin(a) * 200);
    ctx.stroke();
  }

  // Grass tufts speckles near outer ring
  for (let i = 0; i < 180; i += 1) {
    const a = (i * 137.5 * Math.PI) / 180;
    const rad = 165 + (i % 78);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(134, 239, 172, 0.14)' : 'rgba(22, 101, 52, 0.25)';
    ctx.fillRect(size / 2 + Math.cos(a) * rad, size / 2 + Math.sin(a) * rad, 4, 4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createScrollingGridTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.36)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 32; i < size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function ensureOutlineNormalAttribute(geom, scale = 1.0) {
  if (!geom || geom.getAttribute('aOutlineNormal')) return;
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  if (!pos || !norm) return;

  const buckets = new Map();
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    let acc = buckets.get(key);
    if (!acc) {
      acc = [0, 0, 0];
      buckets.set(key, acc);
    }
    acc[0] += norm.getX(i);
    acc[1] += norm.getY(i);
    acc[2] += norm.getZ(i);
  }

  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    const acc = buckets.get(key);
    const len = Math.hypot(acc[0], acc[1], acc[2]) || 1;
    out[i * 3] = (acc[0] / len) * scale;
    out[i * 3 + 1] = (acc[1] / len) * scale;
    out[i * 3 + 2] = (acc[2] / len) * scale;
  }
  geom.setAttribute('aOutlineNormal', new THREE.BufferAttribute(out, 3));
}

function shortestAngleDiff(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export class ThreeStageController {
  constructor({
    canvas,
    markersLayer,
    damageLayer,
    onMobHit,
    onMobDeath,
    onDropPicked,
    onGrindStateChange,
    onHeroLoaded,
    onLoadingChange,
    onJumpStateChange,
  }) {
    this.canvas = canvas;
    this.markersLayer = markersLayer;
    this.damageLayer = damageLayer;
    this.onMobHit = onMobHit || (() => {});
    this.onMobDeath = onMobDeath || (() => {});
    this.onDropPicked = onDropPicked || (() => {});
    this.onGrindStateChange = onGrindStateChange || (() => {});
    this.onHeroLoaded = onHeroLoaded || (() => {});
    this.onLoadingChange = onLoadingChange || (() => {});
    this.onJumpStateChange = onJumpStateChange || (() => {});

    this.baseClass = 'acolyte';
    this.gender = 'female';
    this.faceId = 'f1';
    this.weaponVariant = 'A';
    this.weaponStyle = 'stick_2h';
    this.reaverPairing = 'swd_axe';
    this.staffElement = 'arcane';
    this.stagingData = null;
    this.stagingPromise = null;
    this.weaponGlbCache = new Map();
    this.mountedWeaponEntries = [];
    this.stickSpinPivot = null;
    this.stickSpinMeta = null;
    this.primaryWeaponMountNode = null;
    this.primaryWeaponMountKey = null;
    this.bowMountNode = null;
    this.weaponMountTicket = 0;
    this.stagingTimers = [];
    this.walkAutoStep = 0;
    this.walkAutoElapsed = 0;
    this.walkAutoHitFired = false;
    this.activeGlyphTier = 5;
    this.activeBossSkillDef = null;
    this.stanceMode = 'peace'; // 'peace' | 'combat'
    this.activeTier = 'Tier_Lv50';
    this.styleId = 'universe-pbr';
    this.mode = 'character-select';
    this.battleSubMode = 'grinding';
    this.palette = { ...CLASS_DEFAULT_PALETTES.acolyte };
    this.outlineEnabled = true;
    this.wireframeEnabled = false;
    this.autoRotate = false;
    this.walkClip = 'Walk';
    this.walkSpeed = 1.0;
    this.floorGridVisible = true;
    this.isJumping = false;
    this.keysDown = new Set();
    this.walkPhysics = {
      velY: 0,
      grounded: true,
      moveTarget: null,
      wasClickMove: false,
      ringAge: 0,
      airVx: 0,
      airVz: 0,
    };
    this.walkComboState = {
      lastFrame: -1,
      cycleIdx: 0,
      firedMask: 0,
    };

    this.heroRoot = new THREE.Group();
    this.heroRoot.name = 'HeroRoot';
    this.modelGroup = null;
    this.mixer = null;
    this.actions = {};
    this.currentClipName = 'Idle';
    this.headBone = null;
    this.pelvisBone = null;
    this.chestBone = null;
    this.handLBone = null;
    this.handRBone = null;
    this.bowMeshesByTier = {};
    this.bowStringMeshesByTier = {};
    this.totkBowStringMeshes = [];
    this.bowEndpointsByTier = {};
    this.castOriginMeshesByTier = {};
    this.bodyGroups = { male: null, female: null };
    this.tierGroups = {};
    this.genderSubgroups = { male: [], female: [] };
    this.weaponSubgroups = { A: [], B: [] };
    this.heroMeshesByMat = new Map();
    this.faceMeshes = [];
    this.faceTexture = null;
    this.fixedEyeMeshes = [];
    this.totkMeshes = [];
    this.outlineMeshes = [];
    this.glbBufferCache = new Map();
    this.loadTicket = 0;
    this.armorMounter = new ArmorMounter3D({ wireframe: this.wireframeEnabled });
    this.equippedBySlot = {};
    this.equippedWeaponItems = { main_hand: null, off_hand: null };
    this.armorStripped = false;
    this.dyeTarget = 'all';
    this.slotDyeOverrides = {};
    this.globalArmorOverride = null;
    this.resolvedSlotSpecs = {};

    this.celRampUniverse = createFlyffUniverseRamp();
    this.outlineUniform = { value: 0.0085 };
    this.outlineMaterial = this._createOutlineMaterial();

    this.vfxGroup = new THREE.Group();
    this.vfxItems = [];
    this.projectiles = [];
    this.weaponVfx = new WeaponVfxEngine(this.vfxGroup, this.scene);
    this.bossTimers = [];
    this.shakeTime = 0;
    this.shakeAmp = 0;
    this.hitStopTimer = 0;

    // Grinding state
    this.mobs = [];
    this.mobHitTargets = [];
    this.hoveredMobId = null;
    this.grindState = {
      targetMobId: null,
      kiteTarget: null,
      phase: 'idle', // 'idle' | 'running' | 'attacking' | 'kiting'
      attackTimer: 0,
      comboStep: 0,
      cooldown: 0,
      impactFired: false,
      kills: 0,
      totalDamage: 0,
    };

    // Turn-based Boss state
    this.bossGroup = null;
    this.bossCoreMesh = null;
    this.bossOrbitRings = [];
    this.bossShieldMesh = null;
    this.heroWardDome = null;
    this.bossAnim = {
      heroPosZ: 1.75,
      heroDashTargetZ: 1.75,
      heroFlash: 0,
      bossFlash: 0,
      bossLunge: 0,
      wardActive: false,
    };

    this._initRendererAndScene();
    this._initLightingAndEnv();
    this._initArena();
    this._initGrindMobs();
    this._initRiftBoss();
    this.arenaLightingPreset = 'day';
    this.groundLoot = createGroundLootManager({
      scene: this.scene,
      onDropPicked: (picked) => this.onDropPicked(picked),
    });
    this._bindEvents();

    this._clock = new THREE.Clock();
    this._rafId = 0;
    this._disposed = false;
    this.applyStyle('universe-pbr');
    this.setMode('character-select');
    this._animate();
  }

  _initRendererAndScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.add(this.heroRoot);
    this.scene.add(this.vfxGroup);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 2.05, 5.1);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.85, 0);
    this.controls.minDistance = 0.75;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(800, 600), 0.65, 0.45, 0.72);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    this._resize();
  }

  _initLightingAndEnv() {
    this.hemiLight = new THREE.HemisphereLight('#cde7ff', '#273b2c', 0.9);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#fff6e5', 1.8);
    this.keyLight.position.set(3.8, 6.2, 4.4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 22;
    const d = 5.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight('#7dd3fc', 0.85);
    this.rimLight.position.set(-4.2, 3.6, -4.5);
    this.scene.add(this.rimLight);

    // Procedural studio reflection texture for Soft-PBR steel & gold
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(10, 16, 12);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vPos;
        void main(){
          float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
          vec3 bot = vec3(0.08, 0.12, 0.18);
          vec3 mid = vec3(0.42, 0.54, 0.72);
          vec3 top = vec3(0.95, 0.97, 1.0);
          vec3 col = mix(bot, mid, smoothstep(0.0, 0.52, h));
          col = mix(col, top, smoothstep(0.55, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    this.envTarget = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();
    envGeo.dispose();
    envMat.dispose();
  }

  _initArena() {
    this.arenaGroup = new THREE.Group();
    this.scene.add(this.arenaGroup);

    // Main Plinth (serves showcase + expanded arena)
    const plinthTex = createPlinthTexture();
    const topGeo = new THREE.CylinderGeometry(5.6, 5.85, 0.28, 64);
    this.plinthTopMat = new THREE.MeshStandardMaterial({
      map: plinthTex,
      roughness: 0.86,
      metalness: 0.08,
    });
    this.plinthMesh = new THREE.Mesh(topGeo, this.plinthTopMat);
    this.plinthMesh.position.y = -0.14;
    this.plinthMesh.receiveShadow = true;
    this.arenaGroup.add(this.plinthMesh);

    const rimGeo = new THREE.TorusGeometry(5.72, 0.08, 12, 72);
    this.plinthRimMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      metalness: 0.7,
      roughness: 0.35,
    });
    const rimMesh = new THREE.Mesh(rimGeo, this.plinthRimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.0;
    this.arenaGroup.add(rimMesh);

    // Animated Floor Grid for Walk / Run
    this.gridTex = createScrollingGridTexture();
    const gridGeo = new THREE.CircleGeometry(5.52, 64);
    const gridMat = new THREE.MeshBasicMaterial({
      map: this.gridTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.walkGridMesh = new THREE.Mesh(gridGeo, gridMat);
    this.walkGridMesh.rotation.x = -Math.PI / 2;
    this.walkGridMesh.position.y = 0.012;
    this.walkGridMesh.visible = false;
    this.arenaGroup.add(this.walkGridMesh);

    // Click-to-Move pulsing target ring on plinth
    this.walkMoveRingGroup = new THREE.Group();
    const moveRingOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.32, 32),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })
    );
    moveRingOuter.rotation.x = -Math.PI / 2;
    const moveRingInner = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.14, 24),
      new THREE.MeshBasicMaterial({ color: '#2dd4bf', side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
    );
    moveRingInner.rotation.x = -Math.PI / 2;
    this.walkMoveRingGroup.add(moveRingOuter, moveRingInner);
    this.walkMoveRingGroup.position.y = 0.022;
    this.walkMoveRingGroup.visible = false;
    this.arenaGroup.add(this.walkMoveRingGroup);

    // Dynamic elastic bowstring + 3D nocked arrow rig (Scout Weapon_A draw frames)
    this.dynamicBowGroup = new THREE.Group();
    this.dynamicBowGroup.visible = false;
    const strMat = new THREE.MeshBasicMaterial({ color: '#a5f3fc', toneMapped: false });
    const strGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 1.0, 6);
    this.bowUpperStrMesh = new THREE.Mesh(strGeo, strMat);
    this.bowLowerStrMesh = new THREE.Mesh(strGeo, strMat);
    this.nockedArrowMesh = this._createProjectileMesh('arrow', '#2dd4bf', false, false);
    this.dynamicBowGroup.add(this.bowUpperStrMesh, this.bowLowerStrMesh, this.nockedArrowMesh);
    this.vfxGroup.add(this.dynamicBowGroup);

    // Hero Ward Dome (for Turn-Based Boss Guard action)
    this.heroWardDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 24, 18),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        wireframe: true,
        transparent: true,
        opacity: 0.42,
      })
    );
    this.heroWardDome.position.y = 1.05;
    this.heroWardDome.visible = false;
    this.heroRoot.add(this.heroWardDome);
  }

  _initGrindMobs() {
    this.grindGroup = new THREE.Group();
    this.grindGroup.visible = false;
    this.scene.add(this.grindGroup);

    for (const cfg of GRIND_MOBS_CONFIG) {
      const root = new THREE.Group();
      root.position.set(cfg.pos[0], 0, cfg.pos[2]);

      const visual = new THREE.Group();
      root.add(visual);

      // Build distinct stylized 3D mob geometry
      if (cfg.id === 'slime') {
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.56, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
          new THREE.MeshStandardMaterial({
            color: '#06b6d4',
            emissive: '#0891b2',
            emissiveIntensity: 0.35,
            roughness: 0.22,
            transparent: true,
            opacity: 0.88,
          })
        );
        body.scale.set(1.12, 0.92, 1.12);
        body.position.y = 0.08;
        body.castShadow = true;
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22, 0),
          new THREE.MeshStandardMaterial({ color: '#67e8f9', emissive: '#22d3ee', emissiveIntensity: 1.3 })
        );
        core.position.y = 0.32;
        const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.17, 0.34, 0.46);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.17, 0.34, 0.46);
        visual.add(body, core, eyeL, eyeR);
      } else if (cfg.id === 'wisp') {
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.36, 0),
          new THREE.MeshStandardMaterial({
            color: '#9333ea',
            emissive: '#a855f7',
            emissiveIntensity: 0.9,
            metalness: 0.55,
            roughness: 0.25,
          })
        );
        core.position.y = 1.02;
        core.castShadow = true;
        const halo1 = new THREE.Mesh(
          new THREE.TorusGeometry(0.56, 0.045, 8, 28),
          new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.25 })
        );
        halo1.position.y = 1.02;
        const halo2 = new THREE.Mesh(
          new THREE.TorusGeometry(0.45, 0.035, 8, 24),
          new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.45 })
        );
        halo2.position.y = 1.02;
        halo2.rotation.x = Math.PI / 3;
        visual.add(core, halo1, halo2);
        visual.userData.halo1 = halo1;
        visual.userData.halo2 = halo2;
      } else {
        // Stone Golem
        const stoneMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.88, metalness: 0.12 });
        const runeMat = new THREE.MeshStandardMaterial({
          color: '#fbbf24',
          emissive: '#f59e0b',
          emissiveIntensity: 1.4,
          roughness: 0.2,
        });
        const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), stoneMat);
        torso.position.y = 0.95;
        torso.scale.set(1.1, 1.15, 0.9);
        torso.castShadow = true;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.38), stoneMat);
        head.position.y = 1.56;
        head.castShadow = true;
        const chestGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), runeMat);
        chestGem.position.set(0, 0.98, 0.46);
        const fistL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), stoneMat);
        fistL.position.set(-0.75, 0.72, 0.15);
        const fistR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), stoneMat);
        fistR.position.set(0.75, 0.72, 0.15);
        visual.add(torso, head, chestGem, fistL, fistR);
      }

      // 3D Target Ring beneath mob
      const targetRing = new THREE.Mesh(
        new THREE.RingGeometry(0.68, 0.84, 36),
        new THREE.MeshBasicMaterial({
          color: cfg.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.3,
        })
      );
      targetRing.rotation.x = -Math.PI / 2;
      targetRing.position.y = 0.03;
      root.add(targetRing);

      // Generous invisible raycast collider for effortless clicking/tapping
      const hitMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 1.9, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.y = 0.95;
      hitMesh.userData.mobId = cfg.id;
      root.add(hitMesh);
      this.mobHitTargets.push(hitMesh);

      const mob = {
        ...cfg,
        hp: cfg.maxHp,
        dead: false,
        respawnTimer: 0,
        hitFlash: 0,
        root,
        visual,
        targetRing,
        basePos: new THREE.Vector3(cfg.pos[0], 0, cfg.pos[2]),
      };
      this.mobs.push(mob);
      this.grindGroup.add(root);
    }
  }

  _initRiftBoss() {
    this.bossArenaGroup = new THREE.Group();
    this.bossArenaGroup.visible = false;
    this.scene.add(this.bossArenaGroup);

    // Raised Boss Dais at far edge (z = -3.55)
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 2.0, 0.34, 36),
      new THREE.MeshStandardMaterial({ color: '#1e1b2e', roughness: 0.68, metalness: 0.32 })
    );
    dais.position.set(0, 0.17, -3.55);
    dais.receiveShadow = true;
    const daisGlow = new THREE.Mesh(
      new THREE.RingGeometry(1.52, 1.66, 48),
      new THREE.MeshBasicMaterial({ color: '#f43f5e', side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
    );
    daisGlow.rotation.x = -Math.PI / 2;
    daisGlow.position.set(0, 0.35, -3.55);
    this.bossArenaGroup.add(dais, daisGlow);

    // Giant 3D Rift Boss ("Archon of the Rift")
    this.bossGroup = new THREE.Group();
    this.bossGroup.position.set(0, 0.34, -3.55);

    const armorMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.75, roughness: 0.28 });
    const veinMat = new THREE.MeshStandardMaterial({
      color: '#fb7185',
      emissive: '#e11d48',
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.48, 1.55, 8), armorMat);
    torso.position.y = 1.45;
    torso.castShadow = true;

    this.bossCoreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), veinMat);
    this.bossCoreMesh.position.set(0, 1.55, 0.52);

    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), armorMat);
    head.position.y = 2.48;
    head.castShadow = true;

    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 6), veinMat);
    hornL.position.set(-0.42, 2.86, 0);
    hornL.rotation.z = 0.45;
    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 6), veinMat);
    hornR.position.set(0.42, 2.86, 0);
    hornR.rotation.z = -0.45;

    const pauldronL = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 5), armorMat);
    pauldronL.position.set(-0.98, 2.02, 0);
    pauldronL.rotation.z = 0.7;
    const pauldronR = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 5), armorMat);
    pauldronR.position.set(0.98, 2.02, 0);
    pauldronR.rotation.z = -0.7;

    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.05, 8, 36), veinMat);
    ringA.position.y = 1.55;
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.04, 8, 36), armorMat);
    ringB.position.y = 1.55;
    ringB.rotation.x = Math.PI / 3;
    this.bossOrbitRings = [ringA, ringB];

    this.bossGroup.add(torso, this.bossCoreMesh, head, hornL, hornR, pauldronL, pauldronR, ringA, ringB);
    this.bossArenaGroup.add(this.bossGroup);
  }

  _createOutlineMaterial() {
    const mat = new THREE.MeshToonMaterial({
      color: 0x000000,
      emissive: new THREE.Color('#1A1512'),
      emissiveIntensity: 1.0,
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const outlineUniform = this.outlineUniform;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOutlineWidth = outlineUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uOutlineWidth;\nattribute vec3 aOutlineNormal;')
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(aOutlineNormal);')
        .replace(
          '#include <project_vertex>',
          'transformed += objectNormal * uOutlineWidth;\n#include <project_vertex>'
        );
    };
    mat.customProgramCacheKey = () => 'lumendelve-inverted-hull-v2';
    return mat;
  }

  _bindEvents() {
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this.canvas.parentElement);
    }

    this._pointerDownPos = null;
    this._onPointerDown = (e) => {
      this._pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    this._onPointerMove = (e) => {
      if (this.mode !== 'battle-mode' || this.battleSubMode !== 'grinding') {
        this.canvas.style.cursor = '';
        return;
      }
      const mob = this._raycastMob(e);
      this.hoveredMobId = mob && !mob.dead ? mob.id : null;
      this.canvas.style.cursor = this.hoveredMobId ? 'pointer' : '';
    };
    this._onPointerUp = (e) => {
      if (!this._pointerDownPos) return;
      const dist = Math.hypot(e.clientX - this._pointerDownPos.x, e.clientY - this._pointerDownPos.y);
      this._pointerDownPos = null;
      if (dist > 6) return; // user was orbiting camera
      if (this.mode === 'battle-mode' && this.battleSubMode === 'grinding') {
        const mob = this._raycastMob(e);
        if (mob && !mob.dead) {
          this.grindState.kiteTarget = null;
          if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;
          this.targetMob(mob.id);
        } else {
          const drop = this._raycastLootDrop(e);
          const pt = drop ? new THREE.Vector3(drop.x, 0, drop.z) : this._raycastPlinth(e);
          if (pt) {
            const r = Math.hypot(pt.x, pt.z);
            if (r > 4.85) {
              pt.x *= 4.85 / r;
              pt.z *= 4.85 / r;
            }
            this.grindState.targetMobId = null;
            this.grindState.kiteTarget = new THREE.Vector3(pt.x, 0, pt.z);
            this.grindState.phase = 'kiting';
            this.grindState.attackTimer = 0;
            this.grindState.comboStep = 0;
            this.grindState.impactFired = false;
            this.walkPhysics.ringAge = 0;
            if (this.walkMoveRingGroup) {
              this.walkMoveRingGroup.position.set(pt.x, 0.024, pt.z);
              this.walkMoveRingGroup.visible = true;
            }
            this._playClip('Run', 0.08);
            this._emitGrindState();
          }
        }
      } else if (this.mode === 'walking') {
        const pt = this._raycastPlinth(e);
        if (pt) {
          const r = Math.hypot(pt.x, pt.z);
          if (r > 4.95) {
            pt.x *= 4.95 / r;
            pt.z *= 4.95 / r;
          }
          this.walkPhysics.moveTarget = new THREE.Vector3(pt.x, 0, pt.z);
          this.walkPhysics.wasClickMove = true;
          this.walkPhysics.ringAge = 0;
          if (this.walkMoveRingGroup) {
            this.walkMoveRingGroup.position.set(pt.x, 0.024, pt.z);
            this.walkMoveRingGroup.visible = true;
          }
        }
      }
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);

    this._onKeyDown = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName) && e.target.type !== 'range') return;
      this.keysDown.add(e.code);
      if (this.mode === 'walking' && e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        this.triggerJump();
      }
    };
    this._onKeyUp = (e) => {
      this.keysDown.delete(e.code);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _raycastPlinth(event) {
    if (!this.plinthMesh) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hits = raycaster.intersectObject(this.plinthMesh, false);
    if (hits.length) return hits[0].point.clone();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, out) ? out : null;
  }

  _raycastLootDrop(event) {
    if (!this.groundLoot) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    return this.groundLoot.raycast(raycaster);
  }

  _raycastMob(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hits = raycaster.intersectObjects(this.mobHitTargets, false);
    if (!hits.length) return null;
    const mobId = hits[0].object.userData.mobId;
    return this.mobs.find((m) => m.id === mobId) || null;
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = Math.max(200, parent.clientWidth);
    const h = Math.max(200, parent.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
  }

  async _ensureStagingManifest() {
    if (this.stagingData) return this.stagingData;
    if (!this.stagingPromise) {
      this.stagingPromise = fetch('/api/staging/weapons', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((data) => {
          this.stagingData = data || { staging: false, heroModels: [], weaponModels: [], mounts: {}, clipsManifest: { clips: {} } };
          return this.stagingData;
        });
    }
    return this.stagingPromise;
  }

  async _loadWeaponGlbScene(file) {
    const url = `/models/weapons/${encodeURIComponent(file)}`;
    let buffer = this.glbBufferCache.get(url);
    if (!buffer) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
      buffer = await res.arrayBuffer();
      this.glbBufferCache.set(url, buffer);
    }
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(buffer.slice(0), '', resolve, reject);
    });
    return gltf.scene;
  }

  _clearMountedWeapons() {
    for (const entry of this.mountedWeaponEntries) {
      if (entry.node?.parent) entry.node.parent.remove(entry.node);
      this._disposeObject(entry.node);
    }
    this.mountedWeaponEntries = [];
    this.totkBowStringMeshes = [];
    this.stickSpinPivot = null;
    this.stickSpinMeta = null;
    this.primaryWeaponMountNode = null;
    this.primaryWeaponMountKey = null;
    this.bowMountNode = null;
  }

  setEquippedWeapons(equippedBySlot, { remount = true } = {}) {
    this.equippedWeaponItems = {
      main_hand: equippedBySlot?.main_hand || null,
      off_hand: equippedBySlot?.off_hand || null,
    };
    if (!remount || !this.modelGroup || this._disposed) return Promise.resolve();
    return this.setWeaponStyle(this.weaponStyle, {
      reaverPairing: this.reaverPairing,
      staffElement: this.staffElement,
    });
  }

  async setWeaponStyle(styleId, opts = {}) {
    if (opts.reaverPairing) this.reaverPairing = opts.reaverPairing;
    if (opts.staffElement) this.staffElement = opts.staffElement;
    if (opts.equippedBySlot) {
      this.equippedWeaponItems = {
        main_hand: opts.equippedBySlot.main_hand || null,
        off_hand: opts.equippedBySlot.off_hand || null,
      };
    }
    const validForClass = getClassWeaponStyles(this.baseClass);
    const chosen =
      validForClass.find((s) => s.id === styleId) ||
      validForClass[0] ||
      getWeaponStyleDef(styleId, this.baseClass);
    this.weaponStyle = chosen.id;
    this.weaponVariant = chosen.id === validForClass[0]?.id ? 'A' : 'B';

    for (const obj of this.weaponSubgroups.A) obj.visible = this.weaponVariant === 'A';
    for (const obj of this.weaponSubgroups.B) obj.visible = this.weaponVariant === 'B';

    const ticket = ++this.weaponMountTicket;
    const staging = await this._ensureStagingManifest();
    if (ticket !== this.weaponMountTicket || this._disposed || !this.modelGroup) return;

    this._clearMountedWeapons();
    const mountsMap = staging?.mounts || {};
    const specs = resolveWeaponSpecsForLoadout(chosen.id, this.reaverPairing, this.equippedWeaponItems);
    const hasTotkBones = Object.keys(this.bonesByName || {}).length > 0;
    if (hasTotkBones && Object.keys(mountsMap).length > 0 && specs.length > 0) {
      for (const spec of specs) {
        const m = mountsMap[spec.key];
        const cleanBoneName = m?.bone ? m.bone.replace(/\.([LR])$/i, '$1') : '';
        const bone = m ? (this.bonesByName[m.bone] || this.bonesByName[cleanBoneName]) : null;
        if (!m || !bone) {
          console.warn(`[ld-studio] missing bone mount target ${spec.key} -> ${m?.bone}`, Object.keys(this.bonesByName));
          continue;
        }
        try {
          const weaponScene = await this._loadWeaponGlbScene(spec.file);
          if (ticket !== this.weaponMountTicket || this._disposed || !this.modelGroup) {
            this._disposeObject(weaponScene);
            return;
          }
          const mountNode = new THREE.Group();
          mountNode.name = `Mount_${spec.key}`;
          mountNode.position.set(m.position[0], m.position[1], m.position[2]);
          mountNode.quaternion.set(m.quaternion[0], m.quaternion[1], m.quaternion[2], m.quaternion[3]);
          mountNode.scale.set(m.scale[0], m.scale[1], m.scale[2]);
          mountNode.userData.weaponVisual = spec.weaponVisual;

          let attachTarget = mountNode;
          if (chosen.id === 'stick_2h' && spec.key === 'stick_2h') {
            this.stickSpinPivot = new THREE.Group();
            this.stickSpinPivot.name = 'StickSpinPivot';
            mountNode.add(this.stickSpinPivot);
            attachTarget = this.stickSpinPivot;
          }

          applyLockedWeaponMaterials(weaponScene, spec.weaponVisual, {
            wireframe: this.wireframeEnabled,
            onBowString: (mesh) => this.totkBowStringMeshes.push(mesh),
          });

          attachTarget.add(weaponScene);
          bone.add(mountNode);
          this.mountedWeaponEntries.push({
            node: mountNode,
            slot: spec.slot,
            key: spec.key,
            meta: m,
            weaponVisual: spec.weaponVisual,
            file: spec.file,
            itemId: spec.itemId,
          });

          if (spec.slot === 'main_hand' || spec.slot === 'two_hand') {
            this.primaryWeaponMountNode = mountNode;
            this.primaryWeaponMountKey = spec.key;
          }
          if (spec.key === 'bow') {
            this.bowMountNode = mountNode;
          }
        } catch (err) {
          console.warn(`[ld-studio] failed to mount modular weapon ${spec.file}:`, err);
        }
      }
      this._extractBowRestEndpoints();
    }

    if (!this.isJumping && (this.mode !== 'battle-mode' || this.grindState.phase === 'idle')) {
      this._syncClipForMode(false);
    }
  }

  setReaverPairing(pairingId) {
    this.reaverPairing = pairingId || 'swd_axe';
    if (this.weaponStyle === 'dual_1h') {
      return this.setWeaponStyle('dual_1h', { reaverPairing: this.reaverPairing });
    }
    return Promise.resolve();
  }

  setStaffElement(elementId) {
    this.staffElement = elementId || 'arcane';
  }

  setGlyphTier(tier) {
    this.activeGlyphTier = Math.max(1, Math.min(5, Number(tier) || 5));
  }

  async loadClassModel(baseClass) {
    const ticket = ++this.loadTicket;
    this.baseClass = baseClass;
    this.onLoadingChange(true);

    try {
      const staging = await this._ensureStagingManifest();
      const hasTotkHero = (staging?.heroModels || []).includes(`${baseClass}.glb`);
      const urls = hasTotkHero
        ? [`/models/totk/${encodeURIComponent(baseClass)}.glb`, `/models/${encodeURIComponent(baseClass)}.glb`]
        : [`/models/${encodeURIComponent(baseClass)}.glb`];
      let buffer = null;
      for (const url of urls) {
        buffer = this.glbBufferCache.get(url);
        if (!buffer) {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            buffer = await res.arrayBuffer();
            this.glbBufferCache.set(url, buffer);
          }
        }
        if (buffer) break;
      }
      if (!buffer) throw new Error(`Failed to fetch model for ${baseClass}`);

      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.parse(buffer.slice(0), '', resolve, reject);
      });

      if (ticket !== this.loadTicket || this._disposed) return;

      this._teardownCurrentModel();
      this.modelGroup = gltf.scene;
      this.heroRoot.add(this.modelGroup);

      // Index body groups, tier groups, subgroups, bones, face meshes, and meshes by material name
      this.bodyGroups = { male: null, female: null };
      this.tierGroups = {};
      this.genderSubgroups = { male: [], female: [] };
      this.weaponSubgroups = { A: [], B: [] };
      this.heroMeshesByMat.clear();
      for (const k of MATERIAL_KEYS) this.heroMeshesByMat.set(k, []);
      this.faceMeshes = [];
      this.fixedEyeMeshes = [];
      this.totkMeshes = [];
      this.outlineMeshes = [];
      this.bonesByName = {};
      this.headBone = null;
      this.pelvisBone = null;
      this.chestBone = null;
      this.handLBone = null;
      this.handRBone = null;
      this.bowMeshesByTier = {};
      this.bowStringMeshesByTier = {};
      this.totkBowStringMeshes = [];
      this.bowEndpointsByTier = {};
      this.castOriginMeshesByTier = {};

      const meshNodes = [];
      this.modelGroup.traverse((obj) => {
        if (obj.isBone) {
          this.bonesByName[obj.name] = obj;
          if (obj.userData?.name) this.bonesByName[obj.userData.name] = obj;
          const dotMatch = obj.name.match(/^(hand|forearm|upper_arm|foot|shin|thigh)([LR])$/);
          if (dotMatch) this.bonesByName[`${dotMatch[1]}.${dotMatch[2]}`] = obj;
          if (obj.name === 'head') this.headBone = obj;
          else if (obj.name === 'pelvis') this.pelvisBone = obj;
          else if (obj.name === 'chest') this.chestBone = obj;
          else if (obj.name === 'hand.L' || obj.name === 'handL' || obj.userData?.name === 'hand.L') this.handLBone = obj;
          else if (obj.name === 'hand.R' || obj.name === 'handR' || obj.userData?.name === 'hand.R') this.handRBone = obj;
        }
        if (/^Body_(Male|Female)_BowString$/i.test(obj.name) && obj.isMesh && !obj.userData.isOutline) {
          this.totkBowStringMeshes.push(obj);
        }
        const tierMatch = obj.name.match(/(Tier_Lv\d+)/);
        if (tierMatch && obj.isMesh && !obj.userData.isOutline) {
          const tKey = tierMatch[1];
          const wVar = /_WB_/i.test(obj.name) ? 'B' : 'A';
          if (/_WingedBow$/i.test(obj.name)) this.bowMeshesByTier[tKey] = obj;
          else if (/_BowString$/i.test(obj.name)) this.bowStringMeshesByTier[tKey] = obj;
          else if (/_(StickBell_Plus|StickCrystal_Plus|StickSolarCrystal_Plus|StaffCrystal|WandCrystal)$/i.test(obj.name)) {
            this.castOriginMeshesByTier[`${tKey}:${wVar}`] = obj;
            if (!this.castOriginMeshesByTier[tKey]) this.castOriginMeshesByTier[tKey] = obj;
          }
        }
        if (obj.name === 'Base_Body') {
          obj.visible = true;
        } else if (obj.name === 'Body_Male') {
          this.bodyGroups.male = obj;
        } else if (obj.name === 'Body_Female') {
          this.bodyGroups.female = obj;
        }
        if (TIER_NAMES.includes(obj.name)) {
          this.tierGroups[obj.name] = obj;
        } else if (/^Tier_Lv\d+_Gender_Male$/i.test(obj.name)) {
          this.genderSubgroups.male.push(obj);
        } else if (/^Tier_Lv\d+_Gender_Female$/i.test(obj.name)) {
          this.genderSubgroups.female.push(obj);
        } else if (/^Tier_Lv\d+_Weapon_A$/i.test(obj.name)) {
          this.weaponSubgroups.A.push(obj);
        } else if (/^Tier_Lv\d+_Weapon_B$/i.test(obj.name)) {
          this.weaponSubgroups.B.push(obj);
        } else if (/^Tier_Lv\d+_Shared$/i.test(obj.name)) {
          obj.visible = true;
        }
        if (obj.isMesh && !obj.userData.isOutline) {
          meshNodes.push(obj);
        }
      });

      for (const mesh of meshNodes) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;

        const rawMatName = mesh.material?.name || '';
        const totkInfo = resolveTotkMesh(mesh);
        if (totkInfo) {
          // TOTK-style hero (export_totk_heroes.py): colours baked into COLOR_0, soft 2-tone cel, HSV dye shader.
          const oldMat = mesh.material;
          const channel = totkInfo.channel;
          mesh.userData.totkChannel = channel;
          mesh.material = createTotkDyeMaterial({
            channel,
            classId: baseClass,
            dyeHex: this.palette[channel] || null,
          });
          mesh.material.wireframe = this.wireframeEnabled;
          if (oldMat && oldMat !== mesh.material) oldMat.dispose();
          this.totkMeshes.push(mesh);
          continue;
        }
        const isSclera = /^EyeSclera$/i.test(rawMatName) || /EyeSclera|EyeGlint/i.test(mesh.name);
        const isEyeDark = /^EyeDark$/i.test(rawMatName) || /EyeDark|EyeLash|EyeBrow|EyePupil/i.test(mesh.name);
        const isFaceSkin = /^FaceSkin$/i.test(rawMatName) || /_Head$/i.test(mesh.name);

        if (isFaceSkin || /_Neck|_Ear/i.test(mesh.name)) {
          mesh.receiveShadow = false;
        }
        if (
          /_Hair|Hat|Cap|Brim|Cone|Helm|Circlet|Coronet|Hood|Visor|Pillbox|BrowGuard|SkullPlate|Diadem|Bandana|Goggle|Plume|Halo/i.test(
            mesh.name
          )
        ) {
          mesh.castShadow = false;
        }

        if (isSclera || isEyeDark) {
          mesh.castShadow = false;
          mesh.userData.fixedEyeKind = isSclera ? 'sclera' : 'dark';
          const oldEyeMat = mesh.material;
          mesh.material = new THREE.MeshBasicMaterial({
            name: isSclera ? 'EyeSclera' : 'EyeDark',
            color: isSclera ? '#FFFDF9' : '#231715',
            toneMapped: false,
          });
          if (oldEyeMat && oldEyeMat !== mesh.material) oldEyeMat.dispose();
          this.fixedEyeMeshes.push(mesh);
          continue;
        }

        if (isFaceSkin) {
          mesh.userData.isFaceMesh = true;
          this.faceMeshes.push(mesh);
        } else {
          const matName = this._normalizeMatKey(rawMatName);
          mesh.userData.matKey = matName;
          this.heroMeshesByMat.get(matName).push(mesh);
        }

        // Compute seamless corner normals (scaled delicately to 0.52x on head/hair/ears) & attach inverted-hull outline
        const outlineScale = /_Head$|_Hair$|_Ear_/i.test(mesh.name) ? 0.52 : 1.0;
        ensureOutlineNormalAttribute(mesh.geometry, outlineScale);
        const skipOutline = /EyeIris|EyeGlint|EyeLash|EyeBrow|EyeSclera|EyePupil/i.test(mesh.name);
        if (!skipOutline && mesh.parent) {
          const outMesh = mesh.isSkinnedMesh
            ? new THREE.SkinnedMesh(mesh.geometry, this.outlineMaterial)
            : new THREE.Mesh(mesh.geometry, this.outlineMaterial);
          outMesh.name = `${mesh.name}__outline`;
          outMesh.userData.isOutline = true;
          outMesh.castShadow = false;
          outMesh.receiveShadow = false;
          outMesh.frustumCulled = false;
          if (mesh.isSkinnedMesh && mesh.skeleton) {
            outMesh.bind(mesh.skeleton, mesh.bindMatrix);
          }
          mesh.parent.add(outMesh);
          this.outlineMeshes.push(outMesh);
        }
      }

      // Setup AnimationMixer & 7 Flyff clips (Idle, Idle_B, Walk, Run, Jump, BattleAttack, BattleAttack_B)
      this.mixer = new THREE.AnimationMixer(this.modelGroup);
      this.actions = {};
      this.isJumping = false;
      for (const clip of gltf.animations || []) {
        const action = this.mixer.clipAction(clip);
        const isOneShot =
          clip.name === 'BattleAttack' ||
          clip.name === 'BattleAttack_B' ||
          clip.name === 'Cast' ||
          clip.name === 'Cast_B' ||
          clip.name === 'Jump' ||
          (clip.name.startsWith('Wep_') &&
            !/_(Idle|CombatIdle|Walk|Run|Guard)$/.test(clip.name));
        if (isOneShot) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = false;
        }
        this.actions[clip.name] = action;
      }
      this.mixer.addEventListener('finished', (ev) => {
        const finishedName = ev?.action?.getClip?.()?.name;
        if (finishedName === 'Jump' && this.isJumping && (this.mode !== 'walking' || this.walkPhysics.grounded)) {
          this.isJumping = false;
          this.onJumpStateChange(false);
          this._syncClipForMode(false);
        }
      });

      this.armorMounter.retarget(this.modelGroup, this.bonesByName);
      this._extractBowRestEndpoints();
      this._refreshFaceTexture();
      this._rebuildMaterialsForStyle();
      this.setTier(this.activeTier, { unstrip: false, deferArmorSync: true });
      this.setGender(this.gender, { deferArmorSync: true });
      await this._syncArmorMounts();
      if (ticket !== this.loadTicket || this._disposed) return;
      const validStyles = getClassWeaponStyles(baseClass);
      const nextStyle = validStyles.some((s) => s.id === this.weaponStyle)
        ? this.weaponStyle
        : validStyles[0]?.id || this.weaponStyle;
      await this.setWeaponStyle(nextStyle, {
        reaverPairing: this.reaverPairing,
        staffElement: this.staffElement,
      });
      if (ticket !== this.loadTicket || this._disposed) return;
      this.setOutlineEnabled(this.outlineEnabled);
      this.setWireframe(this.wireframeEnabled);
      this._syncClipForMode(true);

      this.onHeroLoaded({
        baseClass,
        meshCount: meshNodes.length,
        clips: Object.keys(this.actions),
      });
    } finally {
      if (ticket === this.loadTicket) {
        this.onLoadingChange(false);
      }
    }
  }

  _normalizeMatKey(rawName) {
    if (!rawName) return 'Primary';
    const found = MATERIAL_KEYS.find((k) => k.toLowerCase() === rawName.toLowerCase());
    return found || 'Primary';
  }

  _teardownCurrentModel() {
    this.armorMounter?.clear();
    this._clearMountedWeapons();
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.actions = {};
    this.bonesByName = {};
    this.bodyGroups = { male: null, female: null };
    this.tierGroups = {};
    this.genderSubgroups = { male: [], female: [] };
    this.weaponSubgroups = { A: [], B: [] };
    this.faceMeshes = [];
    this.fixedEyeMeshes = [];
    this.totkMeshes = [];
    this.outlineMeshes = [];
    this.headBone = null;
    this.pelvisBone = null;
    this.chestBone = null;
    this.handLBone = null;
    this.handRBone = null;
    this.bowMeshesByTier = {};
    this.bowStringMeshesByTier = {};
    this.totkBowStringMeshes = [];
    this.bowEndpointsByTier = {};
    this.castOriginMeshesByTier = {};
    this.isJumping = false;
    if (this.dynamicBowGroup) this.dynamicBowGroup.visible = false;
    if (this.modelGroup) {
      this.modelGroup.traverse((obj) => {
        if (obj.isMesh && obj.userData.isOutline) return;
        if (obj.geometry && !obj.userData.isOutline) obj.geometry.dispose();
        if (obj.material && obj.material !== this.outlineMaterial) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      this.heroRoot.remove(this.modelGroup);
      this.modelGroup = null;
    }
  }

  _refreshFaceTexture() {
    const nextTex = buildFlyffFaceTexture(this.faceId, this.palette.Skin || '#f5c9ad');
    const prevTex = this.faceTexture;
    this.faceTexture = nextTex;
    for (const mesh of this.faceMeshes) {
      const mat = mesh.material;
      if (!mat) continue;
      mat.map = nextTex;
      mat.needsUpdate = true;
    }
    if (prevTex && prevTex !== nextTex) {
      prevTex.dispose();
    }
    return nextTex;
  }

  _resolveItemArmorSpec(item) {
    if (!item || !ARMOR_SLOTS.includes(item.slot)) return null;
    if (item.visualModelKey) {
      return {
        modelKey: item.visualModelKey,
        silhouetteTier: item.silhouetteTier || null,
        nativePalette: item.nativePalette || null,
      };
    }
    const base = GEAR_BASE_BY_ID?.[item.id];
    if (base) {
      const spec = resolveArmorVisualSpec(base);
      if (spec) return spec;
    }
    const shimSpec = resolveArmorVisualSpec({
      baseId: item.id || 'studio_armor',
      name: item.name || 'Armor',
      slot: item.slot,
      subtype: item.subtype || 'heavy',
      levelReq: Number(item.levelReq) || 1,
      classLock: Array.isArray(item.classReq) && item.classReq.length ? item.classReq : [this.baseClass],
      genderLock: item.gender || this.gender,
      setId: item.setId || undefined,
      specLock: Array.isArray(item.specReq) && item.specReq.length ? item.specReq : undefined,
      wiki: {
        tags: item.isFlyffNonSet ? ['flyff_nonset', item.rarity || 'common'] : [item.rarity || 'common'],
      },
    });
    if (shimSpec) return shimSpec;
    const sil = TIER_TO_SILHOUETTE[this.activeTier] || 't1';
    const gCode = this.gender === 'female' ? 'f' : 'm';
    return {
      modelKey: `${this.baseClass}_${gCode}_${item.slot}_${sil}`,
      silhouetteTier: sil,
      nativePalette: item.nativePalette || null,
    };
  }

  _buildSlotSpecs() {
    const hasAnyArmor = ARMOR_SLOTS.some((s) => Boolean(this.equippedBySlot?.[s]));
    const sil = TIER_TO_SILHOUETTE[this.activeTier] || 't1';
    const gCode = this.gender === 'female' ? 'f' : 'm';
    const slotSpecs = {};
    for (const slot of ARMOR_SLOTS) {
      const item = this.equippedBySlot?.[slot];
      if (item) {
        slotSpecs[slot] = this._resolveItemArmorSpec(item);
      } else if (!hasAnyArmor && !this.armorStripped) {
        slotSpecs[slot] = {
          modelKey: `${this.baseClass}_${gCode}_${slot}_${sil}`,
          silhouetteTier: sil,
          nativePalette: null,
        };
      } else {
        slotSpecs[slot] = null;
      }
    }
    this.resolvedSlotSpecs = slotSpecs;
    return slotSpecs;
  }

  async _syncArmorMounts() {
    if (!this.modelGroup || this._disposed || !this.armorMounter) return;
    const slotSpecs = this._buildSlotSpecs();
    await Promise.all(
      ARMOR_SLOTS.map((slot) =>
        this.armorMounter.mountSlot(slot, slotSpecs[slot], {
          classId: this.baseClass,
          slotDyeOverrides: this.slotDyeOverrides?.[slot] || null,
          globalOverride: this.globalArmorOverride,
        })
      )
    );
  }

  _refreshArmorMaterials() {
    if (!this.armorMounter || this._disposed) return;
    this.armorMounter.refreshAllMaterials({
      classId: this.baseClass,
      slotSpecs: this.resolvedSlotSpecs,
      slotDyeOverrides: this.slotDyeOverrides,
      globalOverride: this.globalArmorOverride,
    });
  }

  setEquippedArmor(equippedBySlot, { stripped = null, deferSync = false } = {}) {
    this.equippedBySlot = { ...(equippedBySlot || {}) };
    if (typeof stripped === 'boolean') {
      this.armorStripped = stripped;
    } else if (ARMOR_SLOTS.some((s) => Boolean(this.equippedBySlot[s]))) {
      this.armorStripped = false;
    }
    if (deferSync) return Promise.resolve();
    return this._syncArmorMounts();
  }

  setArmorStripped(stripped, { deferSync = false } = {}) {
    this.armorStripped = Boolean(stripped);
    if (deferSync) return Promise.resolve();
    return this._syncArmorMounts();
  }

  setSlotDyeTarget(target) {
    this.dyeTarget = ARMOR_SLOTS.includes(target) ? target : 'all';
  }

  setSlotDye(slot, matKey, hex) {
    if (!ARMOR_SLOTS.includes(slot) || !MATERIAL_KEYS.includes(matKey)) return;
    if (!hex) {
      if (this.slotDyeOverrides[slot]) {
        delete this.slotDyeOverrides[slot][matKey];
        if (!Object.keys(this.slotDyeOverrides[slot]).length) delete this.slotDyeOverrides[slot];
      }
    } else {
      this.slotDyeOverrides[slot] = { ...(this.slotDyeOverrides[slot] || {}), [matKey]: hex };
    }
    this._refreshArmorMaterials();
  }

  applyPaletteToAllSlots(paletteObj) {
    if (paletteObj) {
      this.setPalette(paletteObj, { updateArmorOverride: false });
    }
    this.slotDyeOverrides = {};
    this.globalArmorOverride = { ...this.palette };
    this._refreshArmorMaterials();
  }

  clearSlotDyes(slot = 'all', { clearGlobal = true, deferSync = false } = {}) {
    if (slot === 'all') {
      this.slotDyeOverrides = {};
      if (clearGlobal) this.globalArmorOverride = null;
    } else if (ARMOR_SLOTS.includes(slot)) {
      delete this.slotDyeOverrides[slot];
    }
    if (!deferSync) this._refreshArmorMaterials();
  }

  setTier(tierKey, opts = {}) {
    if (!TIER_NAMES.includes(tierKey)) return Promise.resolve();
    this.activeTier = tierKey;
    for (const key of TIER_NAMES) {
      if (this.tierGroups[key]) {
        this.tierGroups[key].visible = key === tierKey;
      }
    }
    const hasAnyArmor = ARMOR_SLOTS.some((s) => Boolean(this.equippedBySlot?.[s]));
    if (opts.unstrip !== false && !hasAnyArmor) {
      this.armorStripped = false;
    }
    if (!opts.deferArmorSync && this.modelGroup && !this._disposed) {
      return this._syncArmorMounts();
    }
    return Promise.resolve();
  }

  setGender(gender, opts = {}) {
    const g = gender === 'male' ? 'male' : 'female';
    this.gender = g;
    if (this.bodyGroups.male) this.bodyGroups.male.visible = g === 'male';
    if (this.bodyGroups.female) this.bodyGroups.female.visible = g === 'female';
    for (const obj of this.genderSubgroups.male) obj.visible = g === 'male';
    for (const obj of this.genderSubgroups.female) obj.visible = g === 'female';
    if (g === 'female') this.heroRoot.scale.set(0.985, 0.995, 0.985);
    else this.heroRoot.scale.set(1.015, 1.010, 1.015);
    if (!opts.deferArmorSync && this.modelGroup && !this._disposed) {
      return this._syncArmorMounts();
    }
    return Promise.resolve();
  }

  setFace(faceId) {
    const preset = FACE_PRESETS.find((f) => f.id === faceId);
    if (!preset) return;
    this.faceId = preset.id;
    this._refreshFaceTexture();
  }

  setWeaponVariant(variant) {
    const v = String(variant).toUpperCase() === 'B' ? 'B' : 'A';
    const styles = getClassWeaponStyles(this.baseClass);
    const chosen = v === 'B' ? (styles[1] || styles[0]) : styles[0];
    if (chosen) {
      return this.setWeaponStyle(chosen.id, { reaverPairing: this.reaverPairing, staffElement: this.staffElement });
    }
    return Promise.resolve();
  }

  setMaterialColor(matKey, hex, opts = {}) {
    if (!MATERIAL_KEYS.includes(matKey)) return;
    this.palette[matKey] = hex;

    for (const mesh of this.heroMeshesByMat.get(matNameFallback(matKey)) || []) {
      const mat = mesh.material;
      if (!mat) continue;
      mat.color.set(hex);
      if (matKey === 'Glow' && mat.emissive) {
        mat.emissive.set(hex);
      }
    }

    for (const mesh of this.totkMeshes) {
      if (mesh.userData?.totkChannel === matKey && mesh.material && !mesh.material.userData?.lockedWeaponMaterial) {
        setTotkMaterialDye(mesh.material, hex, this.baseClass);
      }
    }

    for (const entry of this.mountedWeaponEntries) {
      entry.node?.traverse((child) => {
        if (
          child.isMesh &&
          child.userData?.totkChannel === matKey &&
          child.material &&
          !child.material.userData?.lockedWeaponMaterial
        ) {
          setTotkMaterialDye(child.material, hex, this.baseClass);
        }
      });
    }

    if (matKey === 'Skin') {
      this._refreshFaceTexture();
      for (const mesh of this.faceMeshes) {
        if (mesh.material) {
          mesh.material.color.setScalar(1.0);
        }
      }
    }

    if (opts.updateArmorOverride !== false && matKey !== 'Skin') {
      this.globalArmorOverride = { ...(this.globalArmorOverride || {}), [matKey]: hex };
      this._refreshArmorMaterials();
    }
  }

  setPalette(paletteObj, opts = {}) {
    for (const key of MATERIAL_KEYS) {
      if (paletteObj?.[key]) {
        this.setMaterialColor(key, paletteObj[key], { ...opts, updateArmorOverride: false });
      }
    }
    if (opts.updateArmorOverride !== false) {
      const nextGlobal = { ...(this.globalArmorOverride || {}) };
      for (const key of MATERIAL_KEYS) {
        if (key !== 'Skin' && paletteObj?.[key]) {
          nextGlobal[key] = paletteObj[key];
        }
      }
      this.globalArmorOverride = nextGlobal;
      this._refreshArmorMaterials();
    }
  }

  setStyle(styleId) {
    this.applyStyle(styleId);
  }

  applyStyle(_styleId) {
    const style = FLYFF_STYLES[0];
    this.styleId = style.id;
    this.outlineEnabled = style.outline;
    this.outlineUniform.value = style.outlineWidth;
    this.outlineMaterial.emissive.set(style.outlineColor);

    this.renderer.toneMapping = style.toneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Flyff Universe lighting & atmosphere
    this.hemiLight.color.set('#e0f2fe');
    this.hemiLight.groundColor.set('#65a30d');
    this.hemiLight.intensity = 1.15;
    this.keyLight.color.set('#fffaf0');
    this.keyLight.intensity = 1.75;
    this.rimLight.color.set('#bae6fd');
    this.rimLight.intensity = 0.95;
    this.scene.environmentIntensity = 0.35;
    this.bloomPass.strength = 0.28;
    this.bloomPass.radius = 0.42;
    this.bloomPass.threshold = 0.88;

    // Heroic Proportions (preserving subtle Male/Female stance scale)
    if (this.gender === 'female') {
      this.heroRoot.scale.set(0.985, 0.995, 0.985);
    } else {
      this.heroRoot.scale.set(1.015, 1.010, 1.015);
    }

    if (this.headBone) {
      this.headBone.scale.set(1, 1, 1);
    }

    this.heroRoot.position.y = this._isArcanistHovering() ? 0.14 : 0;

    if (this.canvas.parentElement) {
      this.canvas.parentElement.style.background = `radial-gradient(circle at 50% 42%, ${style.bgTop} 0%, ${style.bgBottom} 82%)`;
    }

    if (this.arenaLightingPreset && this.arenaLightingPreset !== 'day') {
      this.setArenaLightingPreset(this.arenaLightingPreset);
    }

    this._rebuildMaterialsForStyle();
    this.setOutlineEnabled(this.outlineEnabled);
    this.setWireframe(this.wireframeEnabled);
    return style;
  }

  setArenaLightingPreset(preset = 'day') {
    const p = preset === 'night' ? 'night' : preset === 'dusk' ? 'dusk' : 'day';
    this.arenaLightingPreset = p;
    if (p === 'night') {
      this.hemiLight.color.set('#7aa2d4');
      this.hemiLight.groundColor.set('#141c2c');
      this.hemiLight.intensity = 0.65;
      this.keyLight.color.set('#b8d4ff');
      this.keyLight.intensity = 1.05;
      this.rimLight.color.set('#60a5fa');
      this.rimLight.intensity = 1.15;
      this.plinthTopMat?.color.set('#7d8aa8');
      this.bloomPass.strength = 0.42;
      this.bloomPass.threshold = 0.78;
      if (this.canvas.parentElement) {
        this.canvas.parentElement.style.background = 'radial-gradient(circle at 50% 42%, #111b33 0%, #050811 84%)';
      }
    } else if (p === 'dusk') {
      this.hemiLight.color.set('#c4b5fd');
      this.hemiLight.groundColor.set('#2b213a');
      this.hemiLight.intensity = 0.85;
      this.keyLight.color.set('#fdba74');
      this.keyLight.intensity = 1.35;
      this.rimLight.color.set('#818cf8');
      this.rimLight.intensity = 1.05;
      this.plinthTopMat?.color.set('#b8b0cc');
      this.bloomPass.strength = 0.35;
      this.bloomPass.threshold = 0.82;
      if (this.canvas.parentElement) {
        this.canvas.parentElement.style.background = 'radial-gradient(circle at 50% 42%, #2c2448 0%, #0d1122 82%)';
      }
    } else {
      const style = FLYFF_STYLES[0];
      this.hemiLight.color.set('#e0f2fe');
      this.hemiLight.groundColor.set('#65a30d');
      this.hemiLight.intensity = 1.15;
      this.keyLight.color.set('#fffaf0');
      this.keyLight.intensity = 1.75;
      this.rimLight.color.set('#bae6fd');
      this.rimLight.intensity = 0.95;
      this.plinthTopMat?.color.set('#ffffff');
      this.bloomPass.strength = 0.28;
      this.bloomPass.threshold = 0.88;
      if (this.canvas.parentElement) {
        this.canvas.parentElement.style.background = `radial-gradient(circle at 50% 42%, ${style.bgTop} 0%, ${style.bgBottom} 82%)`;
      }
    }
  }

  spawnGroundDrops(drops) {
    return this.groundLoot?.spawnDrops(drops) || [];
  }

  spawnPresetRarity(rarity) {
    return this.groundLoot?.spawnPresetRarity(rarity, this.heroRoot.position) || [];
  }

  spawnBossBurst() {
    return this.groundLoot?.spawnBossBurst(this.heroRoot.position) || [];
  }

  spawn12MeshLineup() {
    return this.groundLoot?.spawn12MeshLineup(this.heroRoot.position) || [];
  }

  lootAllGroundDrops() {
    return this.groundLoot?.lootAll() || [];
  }

  clearGroundDrops() {
    this.groundLoot?.clearAll();
  }

  setLootBeamScale(h, g) {
    this.groundLoot?.setBeamScale(h, g);
  }

  setLootAutoPickup(on) {
    this.groundLoot?.setAutoPickupEnabled(on);
  }

  getGroundDrops() {
    return this.groundLoot?.getDrops() || [];
  }

  _buildStyleMaterial(matKey, hex, { map = null, forceWhiteTint = false } = {}) {
    const baseCol = forceWhiteTint ? new THREE.Color(1, 1, 1) : new THREE.Color(hex);
    const isGlow = matKey === 'Glow';
    const isSkin = matKey === 'Skin';
    const isFaceMap = Boolean(map);

    const mat = new THREE.MeshToonMaterial({
      name: map ? 'FaceSkin' : matKey,
      color: baseCol,
      map: map || null,
      gradientMap: this.celRampUniverse,
      emissive: isGlow ? new THREE.Color(hex) : new THREE.Color('#000000'),
      emissiveIntensity: isGlow ? 1.35 : 0,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uShadowTint = {
        value: new THREE.Color(isSkin ? '#f4c7bc' : '#b8b6d6'),
      };
      shader.uniforms.uRimStrength = {
        value: isFaceMap ? 0.08 : isSkin ? 0.14 : matKey === 'Steel' || matKey === 'Trim' ? 0.30 : 0.24,
      };
      shader.uniforms.uWarmFloorScale = {
        value: isFaceMap ? new THREE.Vector3(0.92, 0.90, 0.90) : new THREE.Vector3(0.72, 0.72, 0.72),
      };
      shader.uniforms.uIsFaceMap = { value: isFaceMap ? 1.0 : 0.0 };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 uShadowTint;\nuniform float uRimStrength;\nuniform vec3 uWarmFloorScale;\nuniform float uIsFaceMap;'
        )
        .replace(
          '#include <dithering_fragment>',
          `
          vec3 viewDirF = normalize(vViewPosition);
          float fresnelRim = pow(1.0 - clamp(abs(dot(normalize(vNormal), viewDirF)), 0.0, 1.0), 3.0);
          vec3 warmFloor = mix(diffuseColor.rgb * uShadowTint * 0.72, diffuseColor.rgb * uWarmFloorScale, uIsFaceMap);
          gl_FragColor.rgb = max(gl_FragColor.rgb, warmFloor);
          gl_FragColor.rgb += vec3(0.96, 0.99, 1.0) * fresnelRim * uRimStrength * diffuseColor.rgb;
          #include <dithering_fragment>
          `
        );
    };
    mat.customProgramCacheKey = () =>
      `lumendelve-flyff-universe-${map ? 'faceskin-v2' : isSkin ? 'skin' : matKey}`;
    mat.wireframe = this.wireframeEnabled;
    return mat;
  }

  _rebuildMaterialsForStyle() {
    const staleMats = new Set();

    for (const matKey of MATERIAL_KEYS) {
      const hex = this.palette[matKey] || '#ffffff';
      const meshes = this.heroMeshesByMat.get(matKey) || [];
      if (!meshes.length) continue;

      const mat = this._buildStyleMaterial(matKey, hex);
      for (const mesh of meshes) {
        const old = mesh.material;
        mesh.material = mat;
        if (old && old !== this.outlineMaterial && old !== mat) {
          staleMats.add(old);
        }
      }
    }

    if (this.faceMeshes.length) {
      const faceTex = this.faceTexture || this._refreshFaceTexture();
      const faceMat = this._buildStyleMaterial('Skin', this.palette.Skin || '#f5c9ad', {
        map: faceTex,
        forceWhiteTint: true,
      });
      for (const mesh of this.faceMeshes) {
        const old = mesh.material;
        mesh.material = faceMat;
        if (old && old !== this.outlineMaterial && old !== faceMat) {
          staleMats.add(old);
        }
      }
    }

    for (const old of staleMats) {
      old.dispose();
    }
  }

  setOutlineEnabled(enabled) {
    this.outlineEnabled = Boolean(enabled);
    for (const m of this.outlineMeshes) {
      m.visible = this.outlineEnabled;
    }
  }

  setWireframe(enabled) {
    this.wireframeEnabled = Boolean(enabled);
    for (const meshes of this.heroMeshesByMat.values()) {
      for (const m of meshes) {
        if (m.material) m.material.wireframe = this.wireframeEnabled;
      }
    }
    for (const m of this.faceMeshes) {
      if (m.material) m.material.wireframe = this.wireframeEnabled;
    }
    for (const m of this.totkMeshes) {
      if (m.material) m.material.wireframe = this.wireframeEnabled;
    }
    for (const entry of this.mountedWeaponEntries) {
      entry.node?.traverse((child) => {
        if (child.isMesh && child.material) child.material.wireframe = this.wireframeEnabled;
      });
    }
    this.armorMounter?.setWireframe(this.wireframeEnabled);
  }

  setAutoRotate(enabled) {
    this.autoRotate = Boolean(enabled);
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 2.0;
  }

  _getActiveStyleDef() {
    return getWeaponStyleDef(this.weaponStyle, this.baseClass);
  }

  _getClipMeta(resolvedClipName) {
    return this.stagingData?.clipsManifest?.clips?.[resolvedClipName] || null;
  }

  _resolveClipName(clipName) {
    if (!clipName) return 'Idle';
    if (clipName.startsWith('Wep_') && this.actions[clipName]) return clipName;

    const styleDef = this._getActiveStyleDef();
    const cs = styleDef.clipStyle;
    const base = clipName === 'Combo' ? 'Auto1' : clipName;
    if (base === 'Idle') {
      const useCombat = this.mode === 'battle-mode' || this.stanceMode === 'combat';
      if (useCombat && this.actions[`Wep_${cs}_CombatIdle`]) return `Wep_${cs}_CombatIdle`;
      if (this.actions[`Wep_${cs}_Idle`]) return `Wep_${cs}_Idle`;
      if (useCombat) {
        if (this.weaponVariant === 'B' && this.actions.CombatIdle_B) return 'CombatIdle_B';
        if (this.actions.CombatIdle) return 'CombatIdle';
      }
      if (this.weaponVariant === 'B' && this.actions.Idle_B) return 'Idle_B';
      return 'Idle';
    }
    if (base === 'CombatIdle' && this.actions[`Wep_${cs}_CombatIdle`]) return `Wep_${cs}_CombatIdle`;
    if (base === 'Walk' && this.actions[`Wep_${cs}_Walk`]) return `Wep_${cs}_Walk`;
    if (base === 'Run' && this.actions[`Wep_${cs}_Run`]) return `Wep_${cs}_Run`;
    if (base === 'Guard' || base === 'Guard_Stance') {
      if (this.actions[`Wep_${cs}_Guard`]) return `Wep_${cs}_Guard`;
      if (this.actions[`Wep_${cs}_Evade`]) return `Wep_${cs}_Evade`;
    }
    if (base === 'Auto1' || base === 'Auto2' || base === 'Auto3') {
      const c = `Wep_${cs}_${base}`;
      if (this.actions[c]) return c;
    }
    if (base === 'Cast') {
      if (this.actions[`Wep_${cs}_ElemBolt`]) return `Wep_${cs}_ElemBolt`;
      if (this.actions[`Wep_${cs}_MentalBolt`]) return `Wep_${cs}_MentalBolt`;
      if (this.weaponVariant === 'B' && this.actions.Cast_B) return 'Cast_B';
      return this.actions.Cast ? 'Cast' : 'BattleAttack';
    }
    if (base === 'BattleAttack') {
      if (this.actions[`Wep_${cs}_Auto1`]) return `Wep_${cs}_Auto1`;
      if (this.weaponVariant === 'B' && this.actions.BattleAttack_B) return 'BattleAttack_B';
      return 'BattleAttack';
    }
    if (this.weaponVariant === 'B' && this.actions[`${base}_B`]) {
      return `${base}_B`;
    }
    if (this.actions[clipName]) return clipName;
    return base;
  }

  _getWeaponCombatProfile() {
    const def = this._getActiveStyleDef();
    if (def?.combatProfile) {
      return {
        ...def.combatProfile,
        trailVariant:
          def.id === 'gauntlet'
            ? 'punch'
            : def.id === 'sword_2h'
              ? '2h'
              : def.id === 'razor_fans' || def.id === 'dual_1h'
                ? 'daggers'
                : def.rangeMode === 'ranged'
                  ? def.id
                  : '1h',
      };
    }
    return { timeScale: 1.15, hitStopSec: 0, shakeAmp: 0.05, slashColor: '#38bdf8', slashScale: 1.1, trailVariant: '1h' };
  }

  _isArcanistHovering() {
    return this.baseClass === 'arcanist' && (this.stanceMode === 'combat' || this.mode === 'battle-mode');
  }

  _resolveProjectileKind() {
    const def = this._getActiveStyleDef();
    if (def.id === 'bow') return 'arrow';
    if (def.id === 'stick_2h') return 'moonbeam';
    if (def.id === 'staff') return 'elemental';
    if (def.id === 'wand') return 'mental';
    return null;
  }

  _isRangedLoadout() {
    return this._getActiveStyleDef().rangeMode === 'ranged';
  }

  _isSkillOrStageClip(name) {
    if (!name) return false;
    return (
      name === 'AutoChain' ||
      name.startsWith('Wep_') ||
      name.startsWith('Skill_') ||
      name.startsWith('Attack_Step') ||
      name === 'Guard_Stance' ||
      name === 'Hit_React' ||
      name === 'Die'
    );
  }

  setWalkClip(clipName) {
    this.walkClip = clipName;
    this.isJumping = false;
    this.onJumpStateChange(false);
    this._clearStagingTimers();
    this.walkComboState.lastFrame = -1;
    this.walkComboState.firedMask = 0;
    this.walkAutoStep = 0;
    this.walkAutoElapsed = 0;
    this.walkAutoHitFired = false;
    if (this.mode === 'walking') {
      if (clipName === 'AutoChain' || clipName === 'Combo') {
        const auto1 = `Wep_${this._getActiveStyleDef().clipStyle}_Auto1`;
        this._playClip(auto1, 0.12, true);
        const resolved = this._resolveClipName(auto1);
        if (this.actions[resolved]) {
          this.actions[resolved].setLoop(THREE.LoopOnce, 1);
          this.actions[resolved].clampWhenFinished = false;
          this.actions[resolved].timeScale = this.walkSpeed * this._getWeaponCombatProfile().timeScale;
        }
        return;
      }
      const force = clipName === 'BattleAttack' || this._isSkillOrStageClip(clipName);
      this._playClip(clipName, 0.16, force);
      const resolved = this._resolveClipName(clipName);
      if (this.actions[resolved]) {
        const isAtk = this._isSkillOrStageClip(resolved);
        this.actions[resolved].timeScale = isAtk ? this.walkSpeed * this._getWeaponCombatProfile().timeScale : this.walkSpeed;
      }
    }
  }

  triggerJump() {
    if (!this.mixer || !this.actions.Jump) return;
    const jumpAct = this.actions.Jump;
    jumpAct.setLoop(THREE.LoopOnce, 1);
    jumpAct.clampWhenFinished = false;
    jumpAct.timeScale = this.mode === 'walking' ? Math.max(0.85, this.walkSpeed) : 1.0;
    this.isJumping = true;
    this.onJumpStateChange(true);
    if (this.mode === 'walking' && this.walkPhysics.grounded) {
      this.walkPhysics.velY = 4.4;
      this.walkPhysics.grounded = false;
    }
    this._playClip('Jump', 0.08, true);
  }

  setWalkSpeed(speed) {
    this.walkSpeed = Number(speed) || 1;
    if (this.mode === 'walking' && this.actions[this.currentClipName]) {
      const isCombo =
        this.walkClip === 'Combo' ||
        this.currentClipName === 'BattleAttack' ||
        this.currentClipName === 'BattleAttack_B';
      const aspdScale = isCombo ? this._getWeaponCombatProfile().timeScale : 1.0;
      this.actions[this.currentClipName].timeScale = this.walkSpeed * aspdScale;
    }
  }

  setFloorGridVisible(visible) {
    this.floorGridVisible = Boolean(visible);
    this.walkGridMesh.visible = this.mode === 'walking' && this.floorGridVisible;
  }

  setMode(mode, subMode = this.battleSubMode) {
    this.mode = mode;
    if (subMode) this.battleSubMode = subMode;
    this.isJumping = false;
    this.onJumpStateChange(false);
    this.walkPhysics.velY = 0;
    this.walkPhysics.grounded = true;
    this.walkPhysics.moveTarget = null;
    this.walkPhysics.wasClickMove = false;
    this.walkPhysics.airVx = 0;
    this.walkPhysics.airVz = 0;
    this.walkComboState.lastFrame = -1;
    this.walkComboState.firedMask = 0;
    if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;
    if (this.dynamicBowGroup) this.dynamicBowGroup.visible = false;
    this._clearBossTimers();
    this._clearProjectiles();

    // Reset hero position & rotation cleanly when leaving battle
    this.hitStopTimer = 0;
    this.grindState.kiteTarget = null;
    if (this.modelGroup) this.modelGroup.rotation.x = 0;
    if (mode !== 'battle-mode') {
      this.heroRoot.position.set(0, 0, 0);
      this.heroRoot.rotation.set(0, 0, 0);
      this.heroWardDome.visible = false;
      this.grindState.targetMobId = null;
      this.grindState.phase = 'idle';
      this.grindState.comboStep = 0;
    } else if (this.battleSubMode === 'boss') {
      this.heroRoot.position.set(0, 0, 1.75);
      this.heroRoot.rotation.set(0, Math.PI, 0);
      this.bossAnim.heroPosZ = 1.75;
      this.bossAnim.heroDashTargetZ = 1.75;
    } else {
      this.heroRoot.position.set(0, 0, 1.35);
      this.heroRoot.rotation.set(0, Math.PI, 0);
      this.grindState.phase = 'idle';
      this.grindState.targetMobId = null;
      this.grindState.comboStep = 0;
    }

    this.walkGridMesh.visible = mode === 'walking' && this.floorGridVisible;
    this.grindGroup.visible = mode === 'battle-mode' && this.battleSubMode === 'grinding';
    this.bossArenaGroup.visible = mode === 'battle-mode' && this.battleSubMode === 'boss';
    if (this.groundLoot) {
      this.groundLoot.setVisible(mode === 'battle-mode');
    }
    this.heroRoot.position.y = this._isArcanistHovering() ? 0.14 : 0;

    if (mode !== 'battle-mode' || this.battleSubMode !== 'grinding') {
      this.markersLayer.innerHTML = '';
    }

    this._syncClipForMode(true);
    this.resetCamera();
  }

  _syncClipForMode(immediate = false) {
    if (!this.mixer) return;
    if (this.mode === 'walking') {
      this._playClip(this.walkClip, immediate ? 0.05 : 0.22);
      const resolved = this._resolveClipName(this.walkClip);
      if (this.actions[resolved]) {
        const isCombo = this.walkClip === 'Combo' || this.walkClip === 'BattleAttack';
        this.actions[resolved].timeScale = isCombo ? this.walkSpeed * this._getWeaponCombatProfile().timeScale : this.walkSpeed;
      }
    } else {
      this._playClip('Idle', immediate ? 0.05 : 0.22);
      const resolved = this._resolveClipName('Idle');
      if (this.actions[resolved]) this.actions[resolved].timeScale = 1;
    }
  }

  _playClip(clipName, fadeSec = 0.2, forceRestart = false) {
    const resolved = this._resolveClipName(clipName);
    const next = this.actions[resolved];
    if (!next) return;
    if (!forceRestart && this.currentClipName === resolved && next.isRunning()) return;

    const isSkillClip = resolved.startsWith('Skill_') || resolved.startsWith('Attack_Step') || resolved === 'Hit_React' || resolved === 'Die' || resolved === 'Guard_Stance';
    if (resolved === 'BattleAttack' || resolved === 'BattleAttack_B' || resolved === 'Cast' || resolved === 'Cast_B' || isSkillClip) {
      if (this.mode === 'walking') {
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = false;
      } else {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = false;
      }
    }

    const prev = this.actions[this.currentClipName];
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (prev && prev !== next) {
      next.crossFadeFrom(prev, fadeSec, true);
    }
    this.currentClipName = resolved;
  }

  resetCamera() {
    this.setCameraPreset('default');
  }

  setCameraPreset(preset) {
    if (preset === 'face') {
      this.camera.position.set(0, 1.335, 0.96);
      this.controls.target.set(0, 1.325, 0);
    } else if (preset === 'front') {
      this.camera.position.set(0, 1.40, 4.08);
      this.controls.target.set(0, 0.86, 0);
    } else if (preset === 'hero') {
      this.camera.position.set(2.15, 1.64, 3.58);
      this.controls.target.set(0, 0.85, 0);
    } else if (preset === 'side') {
      this.camera.position.set(3.85, 1.36, 0.18);
      this.controls.target.set(0, 0.85, 0);
    } else if (preset === 'back') {
      this.camera.position.set(0.75, 1.78, -3.88);
      this.controls.target.set(0, 0.85, 0);
    } else {
      // Mode-aware default cockpit framing for ~1.56m (~4.3-head) stature
      if (this.mode === 'character-select') {
        this.camera.position.set(1.05, 1.56, 4.05);
        this.controls.target.set(0, 0.50, 0);
      } else if (this.mode === 'character-sheet') {
        this.camera.position.set(-0.35, 1.48, 4.08);
        this.controls.target.set(1.05, 0.84, 0);
      } else if (this.mode === 'battle-mode' && this.battleSubMode === 'grinding') {
        this.camera.position.set(0, 5.4, 7.6);
        this.controls.target.set(0, 0.65, -1.0);
      } else if (this.mode === 'battle-mode' && this.battleSubMode === 'boss') {
        this.camera.position.set(2.95, 3.35, 5.95);
        this.controls.target.set(0, 1.45, -1.25);
      } else if (this.mode === 'walking') {
        this.camera.position.set(1.9, 1.85, 3.95);
        this.controls.target.set(0, 0.84, 0);
      } else {
        this.camera.position.set(1.38, 1.56, 3.78);
        this.controls.target.set(0, 0.85, 0);
      }
    }
    this.controls.update();
  }

  // --- Battle Sub-mode 4A: Tap-to-Target Grinding & HnR Kiting ---
  targetMob(mobId) {
    if (this.mode !== 'battle-mode' || this.battleSubMode !== 'grinding') return;
    const mob = this.mobs.find((m) => m.id === mobId);
    if (!mob || mob.dead) return;

    this.grindState.kiteTarget = null;
    if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;
    this.grindState.targetMobId = mob.id;
    this.grindState.phase = 'running';
    this.grindState.impactFired = false;
    this.grindState.attackTimer = 0;
    this._playClip('Run', 0.14);
    this._emitGrindState();
  }

  resetGrindingMobs() {
    for (const mob of this.mobs) {
      mob.hp = mob.maxHp;
      mob.dead = false;
      mob.respawnTimer = 0;
      mob.hitFlash = 0;
      mob.visual.visible = true;
      mob.visual.scale.set(1, 1, 1);
    }
    this.grindState.targetMobId = null;
    this.grindState.kiteTarget = null;
    if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;
    this.grindState.phase = 'idle';
    this.heroRoot.position.set(0, this._isArcanistHovering() ? 0.14 : 0, 1.35);
    this.heroRoot.rotation.set(0, Math.PI, 0);
    this._playClip('Idle', 0.18);
    this._emitGrindState();
  }

  _emitGrindState() {
    const target = this.mobs.find((m) => m.id === this.grindState.targetMobId) || null;
    this.onGrindStateChange({
      targetId: target ? target.id : null,
      targetName: target ? target.name : 'None (Tap a Mob)',
      phase: this.grindState.phase,
      kills: this.grindState.kills,
      totalDamage: this.grindState.totalDamage,
    });
  }

  // --- Battle Sub-mode 4B: Turn-Based Boss ---
  _clearBossTimers() {
    for (const id of this.bossTimers) clearTimeout(id);
    this.bossTimers.length = 0;
  }

  setStanceMode(stance) {
    this.stanceMode = stance === 'combat' ? 'combat' : 'peace';
    if (!this.isJumping && this.mode !== 'battle-mode') {
      this._syncClipForMode(false);
    }
    if (this.walkPhysics.grounded && !this._isArcanistHovering()) {
      this.heroRoot.position.y = 0;
      if (this.modelGroup) this.modelGroup.rotation.x = 0;
    }
  }

  _clearStagingTimers() {
    for (const id of this.stagingTimers) clearTimeout(id);
    this.stagingTimers.length = 0;
  }

  _getPreviewTargetPos(distance = null) {
    if (this.mode === 'battle-mode' && this.battleSubMode === 'boss') {
      return new THREE.Vector3(0, 1.55, -3.35);
    }
    if (this.mode === 'battle-mode' && this.battleSubMode === 'grinding') {
      const target = this.mobs.find((m) => m.id === this.grindState.targetMobId && !m.dead) || this.mobs.find((m) => !m.dead);
      if (target) return target.basePos.clone().add(new THREE.Vector3(0, target.height * 0.62, 0));
    }
    const def = this._getActiveStyleDef();
    const d = distance ?? (def.rangeMode === 'ranged' ? 3.2 : 1.45);
    const yaw = this.heroRoot.rotation.y;
    return this.heroRoot.position.clone().add(new THREE.Vector3(Math.sin(yaw) * d, 1.05, Math.cos(yaw) * d));
  }

  _clearProjectiles() {
    this._clearStagingTimers();
    this.weaponVfx?.clear();
    for (const p of this.projectiles) {
      this.vfxGroup.remove(p.mesh);
      this._disposeObject(p.mesh);
    }
    this.projectiles.length = 0;
    for (const item of this.vfxItems) {
      this.vfxGroup.remove(item.mesh);
      this._disposeObject(item.mesh);
    }
    this.vfxItems.length = 0;
  }

  _disposeObject(obj) {
    if (!obj) return;
    obj.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material.dispose();
      }
    });
  }

  _getWeaponTipWorld() {
    this.heroRoot.updateMatrixWorld(true);
    const def = this._getActiveStyleDef();
    if (def.id === 'bow' && this.bowMountNode) {
      const tips = this.stagingData?.mounts?.bow?.bowTipsLocal;
      if (Array.isArray(tips) && tips[2]) {
        return new THREE.Vector3(tips[2][0], tips[2][1], tips[2][2]).applyMatrix4(this.bowMountNode.matrixWorld);
      }
    }
    if (this.primaryWeaponMountNode && this.primaryWeaponMountKey) {
      const meta = this.stagingData?.mounts?.[this.primaryWeaponMountKey];
      const localTip = meta?.tipLocal || meta?.tipPlusLocal;
      if (Array.isArray(localTip) && localTip.length === 3) {
        return new THREE.Vector3(localTip[0], localTip[1], localTip[2]).applyMatrix4(this.primaryWeaponMountNode.matrixWorld);
      }
      const box = new THREE.Box3().setFromObject(this.primaryWeaponMountNode);
      if (!box.isEmpty()) return box.getCenter(new THREE.Vector3());
    }
    return this._getRangedCastOriginWorld();
  }

  _triggerClipEffects(clipName, { glyphDef = null, tier = this.activeGlyphTier, autoStep = null, targetPos = null, onImpact = null } = {}) {
    const resolved = this._resolveClipName(clipName);
    const meta = this._getClipMeta(resolved);
    const act = this.actions[resolved];
    const timeScale = act ? Math.max(0.25, act.timeScale) : 1.0;
    const hitSec = (meta?.hitSec ?? 0.34) / timeScale;
    const tPos = targetPos ? targetPos.clone() : this._getPreviewTargetPos();
    const def = this._getActiveStyleDef();

    const id = setTimeout(() => {
      if (this._disposed) return;
      const originPos = this._getWeaponTipWorld();
      const heroPos = this.heroRoot.position.clone();
      const heroYaw = this.heroRoot.rotation.y;
      const impactCb = () => {
        if (this._disposed) return;
        if ((meta?.hitstopMs || 0) > 0) this.hitStopTimer = meta.hitstopMs / 1000;
        if ((meta?.cameraShake || 0) > 0) {
          this.shakeAmp = meta.cameraShake;
          this.shakeTime = 0.22;
        }
        if (typeof onImpact === 'function') onImpact();
      };

      if (autoStep !== null) {
        this.weaponVfx.spawnAutoVfx({
          weaponStyle: def.id,
          step: autoStep,
          heroPos,
          heroYaw,
          originPos,
          targetPos: tPos,
          staffElement: this.staffElement,
          onImpact: impactCb,
        });
      } else {
        this.weaponVfx.spawnGlyphVfx({
          weaponStyle: def.id,
          glyph: glyphDef || { role: resolved.includes('Heal') ? 'heal' : resolved.includes('Guard') || resolved.includes('Evade') ? 'block' : 'move' },
          tier,
          heroPos,
          heroYaw,
          originPos,
          targetPos: tPos,
          staffElement: this.staffElement,
          onImpact: impactCb,
        });
      }
    }, Math.max(20, Math.round(hitSec * 1000)));
    this.stagingTimers.push(id);
  }

  playStagingAutoChain({ targetPos = null, onStepImpact = null, onComplete = null, repeat = false } = {}) {
    if (!this.mixer) return;
    this._clearBossTimers();
    this._clearStagingTimers();
    const def = this._getActiveStyleDef();
    const profile = this._getWeaponCombatProfile();
    const chain = def.autoChain || [
      { step: 1, clip: `Wep_${def.clipStyle}_Auto1` },
      { step: 2, clip: `Wep_${def.clipStyle}_Auto2` },
      { step: 3, clip: `Wep_${def.clipStyle}_Auto3` },
    ];
    let offsetMs = 0;
    const speedScale = (this.mode === 'walking' ? this.walkSpeed : 1.0) * profile.timeScale;

    chain.forEach((stepDef, idx) => {
      const startId = setTimeout(() => {
        if (this._disposed) return;
        const resolved = this._resolveClipName(stepDef.clip);
        const act = this.actions[resolved];
        if (!act) return;
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = false;
        this._playClip(resolved, 0.08, true);
        act.timeScale = speedScale;
        const tPos = targetPos ? targetPos.clone() : this._getPreviewTargetPos();
        this._triggerClipEffects(resolved, {
          autoStep: stepDef.step || idx + 1,
          targetPos: tPos,
          onImpact: () => onStepImpact?.(stepDef, idx),
        });
      }, offsetMs);
      this.stagingTimers.push(startId);

      const resolved = this._resolveClipName(stepDef.clip);
      const meta = this._getClipMeta(resolved);
      const clipDurSec = meta?.durationSec || this.actions[resolved]?.getClip?.()?.duration || 0.75;
      offsetMs += Math.round((clipDurSec / Math.max(0.25, speedScale)) * 1000);
    });

    const endId = setTimeout(() => {
      if (this._disposed) return;
      if (typeof onComplete === 'function') onComplete();
      if (repeat && this.mode === 'walking' && this.walkClip === 'AutoChain') {
        this.playStagingAutoChain({ targetPos, onStepImpact, onComplete, repeat: true });
      } else if (this.mode === 'walking') {
        this._playClip(this.walkClip === 'AutoChain' ? 'Idle' : this.walkClip, 0.18);
      } else if (this.mode === 'battle-mode') {
        this._playClip('Idle', 0.2);
      }
    }, offsetMs + 90);
    this.stagingTimers.push(endId);
  }

  playStagingGlyph(glyphDef, tier = this.activeGlyphTier, { targetPos = null, onImpact = null, onComplete = null } = {}) {
    if (!this.mixer || !glyphDef) return;
    this._clearBossTimers();
    this._clearStagingTimers();
    const resolved = this._resolveClipName(glyphDef.clip);
    const act = this.actions[resolved];
    if (!act) return;
    const isGuard = glyphDef.role === 'block' || resolved.endsWith('_Guard');
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = false;
    this._playClip(resolved, 0.10, true);
    const tScale = this.mode === 'walking' ? this.walkSpeed : 1.0;
    act.timeScale = tScale;
    if (isGuard && this.heroWardDome) this.heroWardDome.visible = true;

    const tPos = targetPos ? targetPos.clone() : this._getPreviewTargetPos();
    this._triggerClipEffects(resolved, {
      glyphDef,
      tier,
      targetPos: tPos,
      onImpact,
    });

    const meta = this._getClipMeta(resolved);
    const clipDurSec = meta?.durationSec || act.getClip()?.duration || 0.95;
    const durMs = Math.max(500, Math.round((clipDurSec / Math.max(0.25, tScale)) * 1000));
    const endId = setTimeout(() => {
      if (this._disposed) return;
      if (this.heroWardDome && !this.bossAnim?.wardActive) this.heroWardDome.visible = false;
      if (typeof onComplete === 'function') onComplete();
      if (this.mode === 'battle-mode') {
        this._playClip('Idle', 0.2);
      } else if (this.mode === 'walking') {
        this._playClip(this.walkClip === 'AutoChain' ? 'Idle' : this.walkClip, 0.2);
      } else {
        this._playClip('Idle', 0.2);
      }
    }, durMs + 60);
    this.stagingTimers.push(endId);
  }

  playBattlePreviewClip(clipName, glyphDef = null, tier = this.activeGlyphTier) {
    if (!this.mixer || !clipName) return;
    if (clipName === 'AutoChain') {
      this.playStagingAutoChain({ repeat: false });
      return;
    }
    if (glyphDef) {
      this.playStagingGlyph(glyphDef, tier);
      return;
    }
    const def = this._getActiveStyleDef();
    const matchedGlyph = (def.glyphs || []).find((g) => g.clip === clipName);
    if (matchedGlyph) {
      this.playStagingGlyph(matchedGlyph, tier);
      return;
    }
    const resolved = this._resolveClipName(clipName);
    const act = this.actions[resolved];
    if (!act) return;
    if (resolved.startsWith('Wep_') && /_Auto[123]$/.test(resolved)) {
      const stepNum = Number(resolved.slice(-1)) || 1;
      this._clearStagingTimers();
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = false;
      this._playClip(resolved, 0.1, true);
      act.timeScale = this.walkSpeed || 1.0;
      this._triggerClipEffects(resolved, { autoStep: stepNum });
      const durMs = Math.max(450, Math.round(((act.getClip()?.duration || 0.8) / Math.max(0.25, act.timeScale)) * 1000));
      this.stagingTimers.push(setTimeout(() => {
        if (!this._disposed && this.mode === 'battle-mode') this._playClip('Idle', 0.2);
      }, durMs));
      return;
    }

    const colorMap = {
      squire: '#38bdf8',
      scout: '#34d399',
      arcanist: '#e879f9',
      acolyte: '#fde047',
    };
    const vfxColor = colorMap[this.baseClass] || '#38bdf8';
    this._clearBossTimers();
    this._clearStagingTimers();
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = false;
    this._playClip(clipName, 0.12, true);
    act.timeScale = this.walkSpeed || 1.0;

    if (resolved.startsWith('Wep_')) {
      const inferredRole = resolved.endsWith('_Heal') ? 'heal' : (resolved.endsWith('_Guard') || resolved.endsWith('_Evade')) ? 'block' : resolved.includes('_Buff') ? 'buff' : 'move';
      this._triggerClipEffects(resolved, { glyphDef: { clip: resolved, role: inferredRole }, tier });
      if (inferredRole === 'block') this.heroWardDome.visible = true;
    } else {
      const pos = this.heroRoot.position.clone();
      if (resolved.startsWith('Skill_Cast') || resolved.startsWith('Skill_Channel')) {
        this._spawnMoonbeamCastSeal(pos.clone().add(new THREE.Vector3(0, 0.04, -0.35)), vfxColor);
      } else if (resolved.startsWith('Skill_Buff') || resolved.startsWith('Skill_Heal')) {
        this._spawnRingBurst(pos.clone().add(new THREE.Vector3(0, 0.1, 0)), vfxColor, 1.8);
      } else if (resolved.startsWith('Guard_')) {
        this.heroWardDome.visible = true;
        this._spawnRingBurst(pos.clone().add(new THREE.Vector3(0, 0.1, 0)), '#38bdf8', 1.5);
      } else {
        this._spawnRingBurst(pos.clone().add(new THREE.Vector3(0, 0.1, -0.7)), vfxColor, 1.4);
      }
    }

    const durMs = Math.max(450, Math.round(((act.getClip()?.duration || 0.9) / Math.max(0.25, act.timeScale)) * 1000));
    this.bossTimers.push(
      setTimeout(() => {
        if (this._disposed) return;
        this.heroWardDome.visible = false;
        if (this.mode === 'battle-mode') {
          this._playClip('Idle', 0.2);
        }
      }, durMs)
    );
  }

  playBossHeroAction(actionType, { damage = 0, crit = false, ward = 0, classId = 'squire', glyphDef = null, tier = this.activeGlyphTier } = {}) {
    if (this.mode !== 'battle-mode' || this.battleSubMode !== 'boss') return;
    this._clearBossTimers();
    this._clearStagingTimers();
    const def = this._getActiveStyleDef();

    if (actionType === 'guard') {
      this.bossAnim.wardActive = true;
      const guardGlyph = (def.glyphs || []).find((g) => g.role === 'block') || { clip: 'Guard', role: 'block' };
      this.playStagingGlyph(guardGlyph, Math.max(2, tier), {
        onImpact: () => {
          this.spawnWorldPopup(this.heroRoot.position.clone().add(new THREE.Vector3(0, 2.2, 0)), `+${ward} Ward`, 'ward');
        },
      });
      return;
    }

    const profile = this._getWeaponCombatProfile();
    const isRanged = def.rangeMode === 'ranged';
    const bossHitPos = new THREE.Vector3(0, 1.7, -3.3);
    const dashTargetZ = isRanged ? 0.55 : -1.65;
    const runDelayMs = isRanged ? 200 : 240;

    this.bossAnim.heroDashTargetZ = dashTargetZ;
    this._playClip('Run', 0.1);

    this.bossTimers.push(
      setTimeout(() => {
        if (this._disposed || this.mode !== 'battle-mode' || this.battleSubMode !== 'boss') return;
        if (actionType === 'skill' || actionType === 'burst') {
          const moveGlyphs = (def.glyphs || []).filter((g) => g.role === 'move');
          const picked = glyphDef || (actionType === 'burst' ? moveGlyphs[moveGlyphs.length - 1] : moveGlyphs[0]) || def.glyphs?.[0];
          const useTier = actionType === 'burst' ? 5 : tier;
          this.playStagingGlyph(picked, useTier, {
            targetPos: bossHitPos,
            onImpact: () => {
              this.bossAnim.bossFlash = 1.0;
              this.shakeAmp = Math.max(profile.shakeAmp, actionType === 'burst' ? 0.14 : 0.08);
              this.shakeTime = 0.25;
              this.spawnWorldPopup(
                new THREE.Vector3(0, 3.1, -3.55),
                crit ? `CRIT -${damage}!` : `-${damage}`,
                crit ? 'crit' : 'player'
              );
            },
            onComplete: () => {
              this.bossAnim.heroDashTargetZ = 1.75;
            },
          });
        } else {
          const stepShares = [0.26, 0.30, 0.44];
          this.playStagingAutoChain({
            targetPos: bossHitPos,
            onStepImpact: (_stepDef, idx) => {
              const isFinisher = idx === 2;
              const stepDmg = Math.max(12, Math.round(damage * (stepShares[idx] || 0.33)));
              this.bossAnim.bossFlash = isFinisher ? 1.0 : 0.55;
              this.spawnWorldPopup(
                new THREE.Vector3(0, 2.9 + idx * 0.16, -3.55),
                isFinisher && crit ? `CRIT -${stepDmg}!` : `-${stepDmg}`,
                isFinisher && crit ? 'crit' : 'player'
              );
            },
            onComplete: () => {
              this.bossAnim.heroDashTargetZ = 1.75;
            },
          });
        }
      }, runDelayMs)
    );
  }

  playBossEnemyStrike({ damage = 0, absorbed = 0, wardBroken = false } = {}) {
    if (this.mode !== 'battle-mode' || this.battleSubMode !== 'boss') return;
    this.bossAnim.bossLunge = 1.0;
    this._spawnRingBurst(new THREE.Vector3(0, 0.2, -3.2), '#f43f5e', 2.4);

    setTimeout(() => {
      if (this._disposed || this.mode !== 'battle-mode') return;
      this.bossAnim.heroFlash = 1.0;
      this.shakeAmp = 0.11;
      this.shakeTime = 0.22;
      this._spawnRingBurst(this.heroRoot.position.clone().add(new THREE.Vector3(0, 0.15, 0)), '#fb7185', 1.5);
      if (wardBroken) {
        this.bossAnim.wardActive = false;
        this.heroWardDome.visible = false;
      }
      const label = absorbed > 0 && damage === 0 ? `WARDED (${absorbed})` : `-${damage}`;
      this.spawnWorldPopup(
        this.heroRoot.position.clone().add(new THREE.Vector3(0, 2.25, 0)),
        label,
        damage === 0 ? 'ward' : 'boss-hit'
      );
    }, 300);
  }

  resetBossVisuals() {
    this.bossAnim.heroPosZ = 1.75;
    this.bossAnim.heroDashTargetZ = 1.75;
    this.bossAnim.wardActive = false;
    this.heroWardDome.visible = false;
    if (this.mode === 'battle-mode' && this.battleSubMode === 'boss') {
      this.heroRoot.position.set(0, 0, 1.75);
      this.heroRoot.rotation.set(0, Math.PI, 0);
      this._playClip('Idle', 0.15);
    }
  }

  _spawnBladeTrail(worldPos, yaw = 0, colorHex = '#38bdf8', scale = 1.1, variant = '1h', isFinisher = false, stepIdx = 0) {
    if (variant === 'punch') {
      const shock = new THREE.Mesh(
        new THREE.RingGeometry(0.12 * scale, 0.22 * scale, 24),
        new THREE.MeshBasicMaterial({ color: isFinisher ? '#fde047' : colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false })
      );
      shock.position.copy(worldPos);
      shock.rotation.y = yaw;
      if (isFinisher) shock.rotation.x = Math.PI * 0.28;
      this.vfxGroup.add(shock);
      this.vfxItems.push({ mesh: shock, age: 0, life: 0.34, kind: 'ring', maxScale: isFinisher ? 1.35 : 1.05 });
      return;
    }

    // Build tapered horizontal/diagonal swing-plane RingGeometry crescent ribbon (`radius ~0.58..0.82m`)
    const makeTaperedArcMesh = (arcRadius, ribbonW, arcLen, col, baseOpacity = 0.95) => {
      const nSeg = 26;
      const rMid = arcRadius * scale;
      const wMax = ribbonW * scale;
      const thetaStart = -Math.PI * 0.5 - arcLen * 0.5;
      const geo = new THREE.RingGeometry(Math.max(0.05, rMid - wMax * 0.5), rMid + wMax * 0.5, nSeg, 1, thetaStart, arcLen);
      const pos = geo.attributes.position;
      const stride = nSeg + 1;
      for (let row = 0; row < 2; row += 1) {
        const sign = row === 0 ? -1 : 1;
        for (let colIdx = 0; colIdx <= nSeg; colIdx += 1) {
          const vIdx = row * stride + colIdx;
          const x = pos.getX(vIdx);
          const y = pos.getY(vIdx);
          const ang = Math.atan2(y, x);
          const t = colIdx / nSeg;
          const taper = Math.sin(t * Math.PI) ** 0.72;
          const rNew = rMid + sign * 0.5 * wMax * taper;
          pos.setXYZ(vIdx, Math.cos(ang) * rNew, Math.sin(ang) * rNew, 0);
        }
      }
      pos.needsUpdate = true;
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: col,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: baseOpacity,
          toneMapped: false,
          depthWrite: false,
        })
      );
      mesh.userData.baseOpacity = baseOpacity;
      mesh.rotation.x = -Math.PI * 0.5;
      return mesh;
    };

    const spawnSwingPlaneArc = (arcRadius, ribbonW, arcLen, bankRad, col, sweepDir = 1) => {
      const pivot = new THREE.Group();
      pivot.position.copy(worldPos);
      pivot.rotation.order = 'YXZ';
      pivot.rotation.y = yaw;
      pivot.rotation.z = bankRad;

      const sweepGroup = new THREE.Group();
      const outerArc = makeTaperedArcMesh(arcRadius, ribbonW, arcLen, col, 0.94);
      const coreArc = makeTaperedArcMesh(arcRadius + ribbonW * 0.14, ribbonW * 0.36, arcLen * 0.92, '#f8fafc', 0.88);
      coreArc.position.y = 0.008;
      sweepGroup.add(outerArc, coreArc);
      pivot.add(sweepGroup);

      this.vfxGroup.add(pivot);
      this.vfxItems.push({
        mesh: pivot,
        sweepGroup,
        sweepDir,
        age: 0,
        life: variant === '2h' ? 0.48 : 0.38,
        kind: 'swing-slash',
      });
    };

    if (variant === 'daggers') {
      if (stepIdx === 2) {
        spawnSwingPlaneArc(0.58, 0.14, Math.PI * 0.96, 0.52, isFinisher ? '#fde047' : colorHex, 1);
        spawnSwingPlaneArc(0.58, 0.14, Math.PI * 0.96, -0.52, '#a7f3d0', -1);
      } else {
        const bank = stepIdx === 0 ? -0.48 : 0.48;
        spawnSwingPlaneArc(0.60, 0.14, Math.PI * 0.96, bank, colorHex, stepIdx === 0 ? 1 : -1);
      }
    } else if (variant === '2h') {
      const bank = stepIdx === 0 ? -0.18 : stepIdx === 1 ? 0.20 : -0.95;
      const rad = stepIdx === 2 ? 0.82 : 0.78;
      spawnSwingPlaneArc(rad, 0.20, Math.PI * 1.18, bank, isFinisher ? '#fbbf24' : colorHex, stepIdx === 1 ? -1 : 1);
    } else {
      const bank = stepIdx === 0 ? -0.42 : stepIdx === 1 ? 0.40 : -0.95;
      const rad = stepIdx === 2 ? 0.72 : 0.68;
      spawnSwingPlaneArc(rad, 0.17, Math.PI * 1.05, bank, isFinisher ? '#fde047' : colorHex, stepIdx === 1 ? -1 : 1);
    }
  }

  _spawnSlashVfx(worldPos, colorHex, scale = 1.2) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.75 * scale, 0.06 * scale, 8, 24, Math.PI * 1.15),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95, toneMapped: false })
    );
    arc.position.copy(worldPos);
    arc.rotation.set(Math.random() * 0.7 - 0.35, Math.random() * 0.8, Math.random() * Math.PI);
    this.vfxGroup.add(arc);
    this.vfxItems.push({ mesh: arc, age: 0, life: 0.34, kind: 'slash' });
  }

  _spawnRingBurst(worldPos, colorHex, maxScale = 1.8) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.52, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(worldPos);
    this.vfxGroup.add(ring);
    this.vfxItems.push({ mesh: ring, age: 0, life: 0.42, kind: 'ring', maxScale });
  }

  spawnWorldPopup(worldPos, text, kind = 'player') {
    if (!this.damageLayer) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;

    const proj = worldPos.clone().project(this.camera);
    if (proj.z > 1) return;
    const x = (proj.x * 0.5 + 0.5) * w;
    const y = (-proj.y * 0.5 + 0.5) * h;

    const el = document.createElement('div');
    el.className = `damage-popup ${kind}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = text;
    this.damageLayer.appendChild(el);
    setTimeout(() => el.remove(), 920);
  }

  captureSnapshotPng() {
    return this.canvas.toDataURL('image/png');
  }

  _updateGrinding(dt, elapsed) {
    // Animate 3 mobs & handle respawn
    for (const mob of this.mobs) {
      if (mob.dead) {
        mob.respawnTimer -= dt;
        if (mob.respawnTimer <= 0) {
          mob.dead = false;
          mob.hp = mob.maxHp;
          mob.visual.visible = true;
          mob.visual.scale.set(0.2, 0.2, 0.2);
          this._spawnRingBurst(mob.basePos.clone().add(new THREE.Vector3(0, 0.08, 0)), mob.color, 1.5);
        }
      } else {
        mob.visual.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 8));
        if (mob.id === 'slime') {
          const bounce = Math.abs(Math.sin(elapsed * 3.1)) * 0.14;
          mob.visual.position.y = bounce;
          mob.visual.scale.y = 1 + Math.sin(elapsed * 6.2) * 0.08;
        } else if (mob.id === 'wisp') {
          mob.visual.position.y = Math.sin(elapsed * 2.4) * 0.15;
          if (mob.visual.userData.halo1) mob.visual.userData.halo1.rotation.y += dt * 1.9;
          if (mob.visual.userData.halo2) mob.visual.userData.halo2.rotation.z -= dt * 2.4;
        } else {
          mob.visual.position.y = Math.sin(elapsed * 1.6) * 0.04;
          mob.visual.rotation.y = Math.sin(elapsed * 0.9) * 0.18;
        }

        if (mob.hitFlash > 0) {
          mob.hitFlash = Math.max(0, mob.hitFlash - dt * 5);
          mob.visual.position.z = Math.sin(elapsed * 45) * 0.08 * mob.hitFlash;
        } else {
          mob.visual.position.z = 0;
        }
      }

      const isTarget = this.grindState.targetMobId === mob.id && !mob.dead;
      const isHover = this.hoveredMobId === mob.id && !mob.dead;
      mob.targetRing.material.opacity = isTarget ? 0.92 : isHover ? 0.65 : mob.dead ? 0.08 : 0.25;
      const ringScale = isTarget ? 1.15 + Math.sin(elapsed * 6) * 0.07 : 1.0;
      mob.targetRing.scale.set(ringScale, ringScale, 1);
    }

    // Check Hit-and-Run manual WASD kiting in Grinding (cancels attack recovery instantly!)
    let kDx = 0;
    let kDz = 0;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) kDz -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) kDz += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) kDx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) kDx += 1;

    if (kDx !== 0 || kDz !== 0) {
      const { dirX, dirZ } = this._getCameraRelativeMoveDir(kDx, kDz);
      this.grindState.targetMobId = null;
      this.grindState.kiteTarget = null;
      if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;
      this.grindState.phase = 'kiting';
      this.grindState.attackTimer = 0;
      this.grindState.comboStep = 0;
      this.grindState.impactFired = false;

      const yaw = Math.atan2(dirX, dirZ);
      this.heroRoot.rotation.y += shortestAngleDiff(this.heroRoot.rotation.y, yaw) * Math.min(1, dt * 20);
      this.heroRoot.position.x += dirX * 4.6 * dt;
      this.heroRoot.position.z += dirZ * 4.6 * dt;
      const rKite = Math.hypot(this.heroRoot.position.x, this.heroRoot.position.z);
      if (rKite > 4.85) {
        this.heroRoot.position.x *= 4.85 / rKite;
        this.heroRoot.position.z *= 4.85 / rKite;
      }
      this._playClip('Run', 0.08);
      this._emitGrindState();
      this._updateMobMarkers();
      return;
    }

    if (this.grindState.kiteTarget) {
      if (this.walkMoveRingGroup && this.walkMoveRingGroup.visible) {
        const pulse = 1 + Math.sin(elapsed * 8) * 0.16;
        this.walkMoveRingGroup.scale.set(pulse, 1, pulse);
        this.walkMoveRingGroup.rotation.y += dt * 2.2;
      }
      const toKite = new THREE.Vector3().subVectors(this.grindState.kiteTarget, this.heroRoot.position);
      toKite.y = 0;
      const kDist = toKite.length();
      if (kDist > 0.14) {
        toKite.normalize();
        const yaw = Math.atan2(toKite.x, toKite.z);
        this.heroRoot.rotation.y += shortestAngleDiff(this.heroRoot.rotation.y, yaw) * Math.min(1, dt * 20);
        this.heroRoot.position.addScaledVector(toKite, Math.min(kDist, 4.6 * dt));
        this._playClip('Run', 0.08);
      } else {
        this.grindState.kiteTarget = null;
        if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;
        this.grindState.phase = 'idle';
        this._playClip('Idle', 0.18);
        this._emitGrindState();
      }
      this._updateMobMarkers();
      return;
    }

    // Hero live-action state machine
    const target = this.mobs.find((m) => m.id === this.grindState.targetMobId);
    if (!target || target.dead) {
      if (this.grindState.phase !== 'idle') {
        this.grindState.phase = 'idle';
        this.grindState.targetMobId = null;
        this._playClip('Idle', 0.2);
        this._emitGrindState();
      }
    } else {
      const toMob = new THREE.Vector3().subVectors(target.basePos, this.heroRoot.position);
      toMob.y = 0;
      const dist = toMob.length();
      const desiredYaw = Math.atan2(toMob.x, toMob.z);
      this.heroRoot.rotation.y += shortestAngleDiff(this.heroRoot.rotation.y, desiredYaw) * Math.min(1, dt * 12);

      const styleDef = this._getActiveStyleDef();
      const profile = this._getWeaponCombatProfile();
      const isRanged = styleDef.rangeMode === 'ranged';
      const attackRange = styleDef.attackRange || (isRanged ? 4.25 : 1.48);
      const stopRange = Math.max(1.25, attackRange - 0.18);

      if (this.grindState.phase === 'running') {
        if (dist > attackRange) {
          const step = Math.min(dist - stopRange, dt * 4.6);
          toMob.normalize();
          this.heroRoot.position.addScaledVector(toMob, step);
        } else {
          this.grindState.phase = 'attacking';
          this.grindState.attackTimer = 0;
          this.grindState.comboStep = 0;
          this.grindState.impactFired = false;
          const auto1 = this._resolveClipName('Auto1');
          this._playClip(auto1, 0.08, true);
          if (this.actions[auto1]) {
            this.actions[auto1].setLoop(THREE.LoopOnce, 1);
            this.actions[auto1].clampWhenFinished = false;
            this.actions[auto1].timeScale = profile.timeScale;
          }
          this._emitGrindState();
        }
      } else if (this.grindState.phase === 'attacking') {
        this.grindState.attackTimer += dt;
        const stepIdx = this.grindState.comboStep % 3;
        const stepClip = this._resolveClipName(`Auto${stepIdx + 1}`);
        const stepMeta = this._getClipMeta(stepClip);
        const stepAct = this.actions[stepClip];
        const hitSec = (stepMeta?.hitSec ?? 0.34) / profile.timeScale;
        const durSec = (stepMeta?.durationSec ?? stepAct?.getClip?.()?.duration ?? 0.78) / profile.timeScale;

        if (!this.grindState.impactFired && this.grindState.attackTimer >= hitSec) {
          const isFinisher = stepIdx === 2;
          this.grindState.impactFired = true;

          const applyHit = () => {
            if (this._disposed || target.dead) return;
            const hitResult = this.onMobHit(target);
            const baseDmg = hitResult?.damage ?? 55;
            const dmgMul = stepIdx === 0 ? 0.85 : stepIdx === 1 ? 0.96 : 1.32;
            const dmg = Math.max(18, Math.round(baseDmg * dmgMul));
            const crit = isFinisher || Boolean(hitResult?.crit);
            target.hp = Math.max(0, target.hp - dmg);
            target.hitFlash = isFinisher ? 1.2 : 0.85;
            this.grindState.totalDamage += dmg;

            if ((stepMeta?.hitstopMs || 0) > 0) {
              this.hitStopTimer = stepMeta.hitstopMs / 1000;
            }
            if (isFinisher) {
              this.shakeAmp = Math.max(profile.shakeAmp, stepMeta?.cameraShake || 0.06);
              this.shakeTime = 0.18;
            }
            this.spawnWorldPopup(
              target.basePos.clone().add(new THREE.Vector3(0, target.height + (isFinisher ? 0.96 : 0.78), 0)),
              isFinisher ? `FINISHER -${dmg}!` : crit ? `CRIT -${dmg}!` : `-${dmg}`,
              crit ? 'crit' : 'player'
            );

            if (target.hp <= 0) {
              target.dead = true;
              target.respawnTimer = 2.4;
              target.visual.visible = false;
              this.grindState.kills += 1;
              this._spawnRingBurst(target.basePos.clone().add(new THREE.Vector3(0, 0.1, 0)), '#fb923c', 2.0);
              this.onMobDeath(target);
              this.grindState.phase = 'idle';
              this.grindState.targetMobId = null;
              this.grindState.comboStep = 0;
              this._playClip('Idle', 0.22);
            }
            this._emitGrindState();
          };

          const originPos = this._getWeaponTipWorld();
          const mobTargetPos = target.basePos.clone().add(new THREE.Vector3(0, target.height * 0.62, 0));
          this.weaponVfx.spawnAutoVfx({
            weaponStyle: styleDef.id,
            step: stepIdx + 1,
            heroPos: this.heroRoot.position.clone(),
            heroYaw: desiredYaw,
            originPos,
            targetPos: mobTargetPos,
            staffElement: this.staffElement,
            onImpact: applyHit,
          });
        } else if (this.grindState.attackTimer >= durSec) {
          this.grindState.comboStep = (stepIdx + 1) % 3;
          this.grindState.attackTimer = 0;
          this.grindState.impactFired = false;
          const nextClip = this._resolveClipName(`Auto${this.grindState.comboStep + 1}`);
          this._playClip(nextClip, 0.06, true);
          if (this.actions[nextClip]) {
            this.actions[nextClip].setLoop(THREE.LoopOnce, 1);
            this.actions[nextClip].clampWhenFinished = false;
            this.actions[nextClip].timeScale = profile.timeScale;
          }
        }
      }
    }

    this._updateMobMarkers();
  }

  _updateMobMarkers() {
    if (!this.markersLayer) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;

    if (this.markersLayer.childElementCount !== this.mobs.length) {
      this.markersLayer.innerHTML = '';
      for (const mob of this.mobs) {
        const card = document.createElement('div');
        card.className = 'mob-hud-marker';
        card.dataset.mobId = mob.id;
        card.innerHTML = `
          <div class="mob-marker-head">
            <span>${mob.name}</span>
            <span class="mob-lv">Lv.${mob.level}</span>
          </div>
          <div class="mob-marker-bar"><div class="mob-marker-fill"></div></div>
        `;
        this.markersLayer.appendChild(card);
      }
    }

    for (const mob of this.mobs) {
      const card = this.markersLayer.querySelector(`[data-mob-id="${mob.id}"]`);
      if (!card) continue;
      const worldTop = mob.basePos.clone().add(new THREE.Vector3(0, mob.height + 0.3, 0));
      const proj = worldTop.project(this.camera);
      if (proj.z > 1) {
        card.style.display = 'none';
        continue;
      }
      card.style.display = '';
      card.style.left = `${(proj.x * 0.5 + 0.5) * w}px`;
      card.style.top = `${(-proj.y * 0.5 + 0.5) * h}px`;
      card.classList.toggle('targeted', this.grindState.targetMobId === mob.id && !mob.dead);
      card.classList.toggle('dead', mob.dead);

      const pct = Math.max(0, Math.round((mob.hp / mob.maxHp) * 100));
      const fill = card.querySelector('.mob-marker-fill');
      const lv = card.querySelector('.mob-lv');
      if (fill) fill.style.width = `${pct}%`;
      if (lv) lv.textContent = mob.dead ? `${Math.ceil(mob.respawnTimer)}s` : `${mob.hp} HP`;
    }
  }

  _getCameraRelativeMoveDir(dx, dz) {
    // Project active OrbitControls view forward onto XZ so WASD follows camera orbit naturally
    let fwdX = 0;
    let fwdZ = -1;
    if (this.controls && this.camera) {
      const vx = this.controls.target.x - this.camera.position.x;
      const vz = this.controls.target.z - this.camera.position.z;
      const vLen = Math.hypot(vx, vz);
      if (vLen > 1e-4) {
        fwdX = vx / vLen;
        fwdZ = vz / vLen;
      }
    }
    const rightX = -fwdZ;
    const rightZ = fwdX;
    const rawX = rightX * dx + fwdX * (-dz);
    const rawZ = rightZ * dx + fwdZ * (-dz);
    const len = Math.hypot(rawX, rawZ) || 1;
    return { dirX: rawX / len, dirZ: rawZ / len };
  }

  _updateWalkSteering(dt, elapsed = 0) {
    if (this.mode !== 'walking') return;
    const groundBaseY = 0;

    let dx = 0;
    let dz = 0;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) dz -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) dz += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) dx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) dx += 1;

    let moveVx = 0;
    let moveVz = 0;
    let scrollGridSpeed = 0;
    let scrollDirX = 0;
    let scrollDirZ = 1;

    if (dx !== 0 || dz !== 0) {
      // Zero-inertia WASD steering cancels Click-to-Move immediately
      this.walkPhysics.moveTarget = null;
      this.walkPhysics.wasClickMove = false;
      if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;

      const { dirX, dirZ } = this._getCameraRelativeMoveDir(dx, dz);
      const yaw = Math.atan2(dirX, dirZ);
      this.heroRoot.rotation.y += shortestAngleDiff(this.heroRoot.rotation.y, yaw) * Math.min(1, dt * 22);

      const activeClip = this.walkClip === 'Walk' ? 'Walk' : 'Run';
      const moveSpeed = (activeClip === 'Run' ? 4.2 : 2.1) * this.walkSpeed;
      moveVx = dirX * moveSpeed;
      moveVz = dirZ * moveSpeed;
      this.walkPhysics.airVx = moveVx;
      this.walkPhysics.airVz = moveVz;

      if (!this.isJumping && this.walkPhysics.grounded) {
        this._playClip(activeClip, 0.10);
        const resolved = this._resolveClipName(activeClip);
        if (this.actions[resolved]) {
          this.actions[resolved].timeScale = this.walkSpeed * (this.gender === 'female' ? 1.03 : 1.0);
        }
      }
    } else if (this.walkPhysics.moveTarget) {
      // Click-to-Move traversal toward plinth ring
      const toX = this.walkPhysics.moveTarget.x - this.heroRoot.position.x;
      const toZ = this.walkPhysics.moveTarget.z - this.heroRoot.position.z;
      const dist = Math.hypot(toX, toZ);

      if (this.walkMoveRingGroup && this.walkMoveRingGroup.visible) {
        this.walkPhysics.ringAge += dt;
        const pulse = 1 + Math.sin(elapsed * 8) * 0.16;
        this.walkMoveRingGroup.scale.set(pulse, 1, pulse);
        this.walkMoveRingGroup.rotation.y += dt * 2.2;
      }

      if (dist > 0.14) {
        const dirX = toX / dist;
        const dirZ = toZ / dist;
        const yaw = Math.atan2(dirX, dirZ);
        this.heroRoot.rotation.y += shortestAngleDiff(this.heroRoot.rotation.y, yaw) * Math.min(1, dt * 22);

        const activeClip = this.walkClip === 'Walk' ? 'Walk' : 'Run';
        const moveSpeed = (activeClip === 'Run' ? 4.2 : 2.1) * this.walkSpeed;
        const stepSpeed = Math.min(moveSpeed, dist / Math.max(dt, 0.001));
        moveVx = dirX * stepSpeed;
        moveVz = dirZ * stepSpeed;
        this.walkPhysics.airVx = dirX * moveSpeed;
        this.walkPhysics.airVz = dirZ * moveSpeed;

        if (!this.isJumping && this.walkPhysics.grounded) {
          this._playClip(activeClip, 0.10);
          const resolved = this._resolveClipName(activeClip);
          if (this.actions[resolved]) {
            this.actions[resolved].timeScale = this.walkSpeed * (this.gender === 'female' ? 1.03 : 1.0);
          }
        }
      } else {
        this.walkPhysics.moveTarget = null;
        this.walkPhysics.wasClickMove = false;
        this.walkPhysics.airVx = 0;
        this.walkPhysics.airVz = 0;
        if (this.walkMoveRingGroup) this.walkMoveRingGroup.visible = false;
        if (!this.isJumping && this.walkPhysics.grounded) {
          const restClip = (this.walkClip === 'Combo' || this._isSkillOrStageClip(this.walkClip)) ? this.walkClip : 'Idle';
          if (this.walkClip === 'Walk' || this.walkClip === 'Run') {
            this.walkClip = 'Idle';
          }
          this._playClip(restClip, 0.16);
        }
      }
    } else if (!this.walkPhysics.grounded) {
      // Preserve 100% horizontal momentum across mid-air jump arc
      moveVx = this.walkPhysics.airVx;
      moveVz = this.walkPhysics.airVz;
    } else {
      // Stationary UI showcase loop (`Idle` | `Walk` | `Run` | `AutoChain` | `Wep_*`)
      this.walkPhysics.airVx = 0;
      this.walkPhysics.airVz = 0;
      if (!this.isJumping) {
        if (this.walkClip === 'AutoChain' || this.walkClip === 'Combo') {
          const styleDef = this._getActiveStyleDef();
          const profile = this._getWeaponCombatProfile();
          const scale = this.walkSpeed * profile.timeScale;
          const stepIdx = this.walkAutoStep % 3;
          const stepClip = this._resolveClipName(`Auto${stepIdx + 1}`);
          const stepMeta = this._getClipMeta(stepClip);
          const stepAct = this.actions[stepClip];
          const hitSec = (stepMeta?.hitSec ?? 0.34) / Math.max(0.25, scale);
          const durSec = (stepMeta?.durationSec ?? stepAct?.getClip?.()?.duration ?? 0.78) / Math.max(0.25, scale);

          if (this.currentClipName !== stepClip || !stepAct?.isRunning?.()) {
            if (this.walkAutoElapsed === 0) {
              this._playClip(stepClip, 0.08, true);
              if (this.actions[stepClip]) {
                this.actions[stepClip].setLoop(THREE.LoopOnce, 1);
                this.actions[stepClip].clampWhenFinished = false;
                this.actions[stepClip].timeScale = scale;
              }
            }
          }
          this.walkAutoElapsed += dt;
          if (!this.walkAutoHitFired && this.walkAutoElapsed >= hitSec) {
            this.walkAutoHitFired = true;
            this.weaponVfx.spawnAutoVfx({
              weaponStyle: styleDef.id,
              step: stepIdx + 1,
              heroPos: this.heroRoot.position.clone(),
              heroYaw: this.heroRoot.rotation.y,
              originPos: this._getWeaponTipWorld(),
              targetPos: this._getPreviewTargetPos(),
              staffElement: this.staffElement,
            });
          } else if (this.walkAutoElapsed >= durSec) {
            this.walkAutoStep = (stepIdx + 1) % 3;
            this.walkAutoElapsed = 0;
            this.walkAutoHitFired = false;
            const nextClip = this._resolveClipName(`Auto${this.walkAutoStep + 1}`);
            this._playClip(nextClip, 0.06, true);
            if (this.actions[nextClip]) {
              this.actions[nextClip].setLoop(THREE.LoopOnce, 1);
              this.actions[nextClip].clampWhenFinished = false;
              this.actions[nextClip].timeScale = scale;
            }
          }
        } else if (this.walkClip.startsWith('Wep_') && !/_(Idle|CombatIdle|Walk|Run|Guard)$/.test(this.walkClip)) {
          // One-shot skill clip selected in Walk/Run bar — let playStagingGlyph handle playback cleanly without restarting every frame
        } else {
          this._playClip(this.walkClip, 0.18);
          const resolved = this._resolveClipName(this.walkClip);
          const profile = this._getWeaponCombatProfile();
          if (this.actions[resolved]) {
            this.actions[resolved].timeScale = this.walkSpeed * (this.gender === 'female' ? 1.03 : 1.0);
          }
          const yaw = this.heroRoot.rotation.y;
          scrollDirX = Math.sin(yaw);
          scrollDirZ = Math.cos(yaw);
          scrollGridSpeed = this.walkClip === 'Run' ? 1.85 * this.walkSpeed : this.walkClip === 'Walk' ? 0.95 * this.walkSpeed : 0;
        }
      }
    }

    const hoverY = this._isArcanistHovering() ? 0.14 + Math.sin(elapsed * 3.4) * 0.032 : 0;
    const effectiveFloorY = groundBaseY + hoverY;

    // Apply horizontal traversal on circular plinth (r <= 4.95m) + camera tracking
    if (moveVx !== 0 || moveVz !== 0) {
      const prevX = this.heroRoot.position.x;
      const prevZ = this.heroRoot.position.z;
      let nextX = prevX + moveVx * dt;
      let nextZ = prevZ + moveVz * dt;
      const rad = Math.hypot(nextX, nextZ);
      if (rad > 4.95) {
        nextX *= 4.95 / rad;
        nextZ *= 4.95 / rad;
      }
      this.heroRoot.position.x = nextX;
      this.heroRoot.position.z = nextZ;
      const actualDx = nextX - prevX;
      const actualDz = nextZ - prevZ;
      this.camera.position.x += actualDx;
      this.camera.position.z += actualDz;
      this.controls.target.x += actualDx;
      this.controls.target.z += actualDz;
    } else if (this.gridTex && scrollGridSpeed > 0) {
      this.gridTex.offset.x = (this.gridTex.offset.x - scrollDirX * scrollGridSpeed * dt * 0.35) % 1;
      this.gridTex.offset.y = (this.gridTex.offset.y + scrollDirZ * scrollGridSpeed * dt * 0.35) % 1;
    }

    // Ballistic Flyff Bunny-Hop vertical physics (v_y = +4.4, g = -13.5) + Arcanist combat hover-glide
    if (!this.walkPhysics.grounded) {
      this.walkPhysics.velY += -13.5 * dt;
      this.heroRoot.position.y += this.walkPhysics.velY * dt;
      if (this.heroRoot.position.y <= effectiveFloorY) {
        this.heroRoot.position.y = effectiveFloorY;
        this.walkPhysics.velY = 0;
        this.walkPhysics.grounded = true;
        this.walkPhysics.airVx = 0;
        this.walkPhysics.airVz = 0;
        if (this.isJumping) {
          this.isJumping = false;
          this.onJumpStateChange(false);
          this._syncClipForMode(false);
        }
      }
    } else {
      this.heroRoot.position.y += (effectiveFloorY - this.heroRoot.position.y) * Math.min(1, dt * 10);
    }

    if (this.modelGroup) {
      const hoverMoving = this._isArcanistHovering() && (moveVx !== 0 || moveVz !== 0 || this.walkClip === 'Walk' || this.walkClip === 'Run');
      const targetTiltX = hoverMoving ? 0.11 : 0;
      this.modelGroup.rotation.x += (targetTiltX - this.modelGroup.rotation.x) * Math.min(1, dt * 10);
    }
  }

  _updateBossVisuals(dt, elapsed) {
    if (this.mode !== 'battle-mode' || this.battleSubMode !== 'boss' || !this.bossGroup) return;

    this.bossAnim.heroPosZ += (this.bossAnim.heroDashTargetZ - this.bossAnim.heroPosZ) * Math.min(1, dt * 11);
    this.heroRoot.position.z = this.bossAnim.heroPosZ;
    this.heroRoot.rotation.y = Math.PI;

    // Boss idle hover & orbital rings
    this.bossGroup.position.y = 0.34 + Math.sin(elapsed * 2.1) * 0.08;
    if (this.bossOrbitRings[0]) this.bossOrbitRings[0].rotation.y += dt * 1.1;
    if (this.bossOrbitRings[1]) this.bossOrbitRings[1].rotation.z -= dt * 1.4;

    if (this.bossAnim.bossLunge > 0) {
      this.bossAnim.bossLunge = Math.max(0, this.bossAnim.bossLunge - dt * 2.8);
      this.bossGroup.position.z = -3.55 + Math.sin(this.bossAnim.bossLunge * Math.PI) * 0.9;
    } else {
      this.bossGroup.position.z = -3.55;
    }

    if (this.bossAnim.bossFlash > 0) {
      this.bossAnim.bossFlash = Math.max(0, this.bossAnim.bossFlash - dt * 4.5);
      this.bossGroup.position.x = Math.sin(elapsed * 55) * 0.09 * this.bossAnim.bossFlash;
    } else {
      this.bossGroup.position.x = 0;
    }

    if (this.heroWardDome && this.heroWardDome.visible) {
      this.heroWardDome.rotation.y += dt * 0.9;
    }
  }

  _checkWalkComboVisuals(resolvedClip) {
    const act = this.actions[resolvedClip];
    if (!act || !act.isRunning()) return;
    const frame = ((act.time * 24) % 36 + 36) % 36;
    if (frame < this.walkComboState.lastFrame - 6) {
      this.walkComboState.firedMask = 0;
    }
    this.walkComboState.lastFrame = frame;

    const hitFrames = [8, 19, 30];
    const yaw = this.heroRoot.rotation.y;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const profile = this._getWeaponCombatProfile();
    const projKind = this._resolveProjectileKind();
    const projColor = projKind === 'arrow' ? '#2dd4bf' : projKind === 'moonbeam' ? '#fde047' : '#e879f9';

    if ((projKind === 'moonbeam' || projKind === 'arcane') && frame < 1.8 && (this.walkComboState.firedMask & 8) === 0) {
      this.walkComboState.firedMask |= 8;
      this._spawnMoonbeamCastSeal(
        this.heroRoot.position.clone().add(new THREE.Vector3(fwdX * 0.32, 0.04, fwdZ * 0.32)),
        projColor
      );
    }

    for (let idx = 0; idx < hitFrames.length; idx += 1) {
      const bit = 1 << idx;
      if ((this.walkComboState.firedMask & bit) === 0 && frame >= hitFrames[idx]) {
        this.walkComboState.firedMask |= bit;
        const isFinisher = idx === 2;
        if (projKind) {
          const origin = this._getRangedCastOriginWorld();
          const target = origin.clone().add(new THREE.Vector3(fwdX * 9.5, -0.10, fwdZ * 9.5));
          this._spawnProjectile(projKind, origin, target, projColor, isFinisher, () => {
            this._spawnRingBurst(target.clone().setY(0.08), projColor, isFinisher ? 1.4 : 0.9);
          });
        } else {
          const strikePos = this.heroRoot.position.clone().add(new THREE.Vector3(fwdX * 0.72, 1.02 + idx * 0.12, fwdZ * 0.72));
          this._spawnBladeTrail(strikePos, yaw, profile.slashColor, profile.slashScale * (isFinisher ? 1.25 : 0.92), profile.trailVariant, isFinisher, idx);
          if (profile.hitStopSec > 0 && (isFinisher || profile.trailVariant === '2h')) {
            this.hitStopTimer = profile.hitStopSec;
          }
          if (isFinisher) {
            this._spawnRingBurst(this.heroRoot.position.clone().add(new THREE.Vector3(fwdX * 0.65, 0.08, fwdZ * 0.65)), profile.slashColor, 1.4);
          }
        }
      }
    }
  }

  _extractBowRestEndpoints() {
    this.bowEndpointsByTier = {};
    if (!this.modelGroup || !this.handLBone) return;
    this.modelGroup.updateMatrixWorld(true);

    const bowTipsLocal = this.stagingData?.mounts?.bow?.bowTipsLocal;
    if (this.bowMountNode && Array.isArray(bowTipsLocal) && bowTipsLocal.length === 3) {
      this.bowMountNode.updateMatrix();
      const botLocal = new THREE.Vector3(...bowTipsLocal[0]).applyMatrix4(this.bowMountNode.matrix);
      const topLocal = new THREE.Vector3(...bowTipsLocal[1]).applyMatrix4(this.bowMountNode.matrix);
      const restLocal = new THREE.Vector3(...bowTipsLocal[2]).applyMatrix4(this.bowMountNode.matrix);
      for (const tKey of TIER_NAMES) {
        this.bowEndpointsByTier[tKey] = { topLocal: topLocal.clone(), botLocal: botLocal.clone(), restLocal: restLocal.clone() };
      }
      return;
    }

    for (const [tierKey, bowStrMesh] of Object.entries(this.bowStringMeshesByTier)) {
      if (!bowStrMesh?.geometry?.attributes?.position || !bowStrMesh.skeleton) continue;
      const skel = bowStrMesh.skeleton;
      const handIdx = skel.bones.indexOf(this.handLBone);
      if (handIdx < 0) continue;
      const invBind = skel.boneInverses[handIdx];
      const posAttr = bowStrMesh.geometry.attributes.position;

      let minY = Infinity;
      let maxY = -Infinity;
      const botLocal = new THREE.Vector3();
      const topLocal = new THREE.Vector3();
      const tmp = new THREE.Vector3();

      for (let i = 0; i < posAttr.count; i += 1) {
        tmp.fromBufferAttribute(posAttr, i);
        if (tmp.y < minY) {
          minY = tmp.y;
          botLocal.copy(tmp);
        }
        if (tmp.y > maxY) {
          maxY = tmp.y;
          topLocal.copy(tmp);
        }
      }
      topLocal.applyMatrix4(bowStrMesh.bindMatrix).applyMatrix4(invBind);
      botLocal.applyMatrix4(bowStrMesh.bindMatrix).applyMatrix4(invBind);

      const midStrLocal = new THREE.Vector3().addVectors(topLocal, botLocal).multiplyScalar(0.5);
      let restLocal = midStrLocal.clone();
      const bowMesh = this.bowMeshesByTier[tierKey];
      if (bowMesh?.geometry?.attributes?.position && bowMesh.skeleton) {
        const bPos = bowMesh.geometry.attributes.position;
        const bHandIdx = bowMesh.skeleton.bones.indexOf(this.handLBone);
        const bInvBind = bHandIdx >= 0 ? bowMesh.skeleton.boneInverses[bHandIdx] : invBind;
        const strMidY = 0.5 * (minY + maxY);
        const gripAvg = new THREE.Vector3();
        let count = 0;
        for (let i = 0; i < bPos.count; i += 1) {
          tmp.fromBufferAttribute(bPos, i);
          if (Math.abs(tmp.y - strMidY) < 0.045) {
            gripAvg.add(tmp);
            count += 1;
          }
        }
        if (count > 0) {
          gripAvg.divideScalar(count).applyMatrix4(bowMesh.bindMatrix).applyMatrix4(bInvBind);
          const dirToBow = new THREE.Vector3().subVectors(gripAvg, midStrLocal);
          restLocal = midStrLocal.clone().addScaledVector(dirToBow, 1.38);
        }
      }
      this.bowEndpointsByTier[tierKey] = { topLocal, botLocal, restLocal };
    }

    if (Object.keys(this.bowEndpointsByTier).length === 0 && this.totkMeshes.length > 0) {
      let rawAxes = this.modelGroup.getObjectByName('Armature')?.userData?.bow_rest_axes;
      if (!Array.isArray(rawAxes)) {
        this.modelGroup.traverse((o) => {
          if (!rawAxes && Array.isArray(o.userData?.bow_rest_axes)) rawAxes = o.userData.bow_rest_axes;
        });
      }
      const skMesh = this.totkBowStringMeshes[0] || this.totkMeshes[0];
      let handIdx = skMesh?.skeleton ? skMesh.skeleton.bones.indexOf(this.handLBone) : -1;
      if (handIdx < 0 && skMesh?.skeleton) {
        handIdx = skMesh.skeleton.bones.findIndex(
          (b) => b.name === 'hand.L' || b.name === 'handL' || b.userData?.name === 'hand.L'
        );
      }
      if (Array.isArray(rawAxes) && rawAxes.length === 9 && handIdx >= 0) {
        const invBind = skMesh.skeleton.boneInverses[handIdx];
        const bindMat = skMesh.bindMatrix;
        const botLocal = new THREE.Vector3(rawAxes[0], rawAxes[2], -rawAxes[1]).applyMatrix4(bindMat).applyMatrix4(invBind);
        const topLocal = new THREE.Vector3(rawAxes[3], rawAxes[5], -rawAxes[4]).applyMatrix4(bindMat).applyMatrix4(invBind);
        const restLocal = new THREE.Vector3(rawAxes[6], rawAxes[8], -rawAxes[7]).applyMatrix4(bindMat).applyMatrix4(invBind);
        for (const tKey of TIER_NAMES) {
          this.bowEndpointsByTier[tKey] = { topLocal, botLocal, restLocal };
        }
      }
    }
  }

  _getRangedCastOriginWorld() {
    this.heroRoot.updateMatrixWorld(true);
    if (this.baseClass === 'scout' && this.weaponVariant === 'A') {
      const eps = this.bowEndpointsByTier[this.activeTier];
      if (eps && this.handLBone) {
        return eps.restLocal.clone().applyMatrix4(this.handLBone.matrixWorld);
      }
      if (this.handLBone) {
        const out = new THREE.Vector3();
        this.handLBone.getWorldPosition(out);
        return out;
      }
    }
    const tipMesh =
      this.castOriginMeshesByTier[`${this.activeTier}:${this.weaponVariant}`] ||
      this.castOriginMeshesByTier[this.activeTier];
    if (tipMesh && this.handRBone) {
      const box = new THREE.Box3().setFromObject(tipMesh);
      if (!box.isEmpty()) {
        return box.getCenter(new THREE.Vector3());
      }
    }
    if (this.handRBone) {
      const out = new THREE.Vector3();
      this.handRBone.getWorldPosition(out);
      const yaw = this.heroRoot.rotation.y;
      return out.add(new THREE.Vector3(Math.sin(yaw) * 0.25, 0.06, Math.cos(yaw) * 0.25));
    }
    const yaw = this.heroRoot.rotation.y;
    return this.heroRoot.position.clone().add(new THREE.Vector3(Math.sin(yaw) * 0.55, 1.05, Math.cos(yaw) * 0.55));
  }

  _createProjectileMesh(kind, colorHex = '#2dd4bf', isFinisher = false, includeTrail = true) {
    const group = new THREE.Group();
    if (kind === 'arrow') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.68, 6),
        new THREE.MeshBasicMaterial({ color: '#facc15', toneMapped: false })
      );
      shaft.rotation.x = Math.PI / 2;

      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.036, 0.14, 6),
        new THREE.MeshBasicMaterial({ color: isFinisher ? '#fde047' : '#6ee7b7', toneMapped: false })
      );
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.37;

      const tipHalo = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 8),
        new THREE.MeshBasicMaterial({ color: isFinisher ? '#fef08a' : '#2dd4bf', transparent: true, opacity: 0.72, toneMapped: false })
      );
      tipHalo.position.z = 0.34;

      const fletchMat = new THREE.MeshBasicMaterial({ color: isFinisher ? '#fef08a' : '#5eead4', toneMapped: false });
      for (let f = 0; f < 3; f += 1) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.005, 0.14), fletchMat);
        fin.position.z = -0.26;
        fin.rotation.z = (f * Math.PI) / 3;
        group.add(fin);
      }
      group.add(shaft, head, tipHalo);
      if (includeTrail) {
        const trail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.004, 0.95, 8),
          new THREE.MeshBasicMaterial({ color: isFinisher ? '#fde047' : colorHex, transparent: true, opacity: 0.80, toneMapped: false })
        );
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.74;
        group.add(trail);
      }
      return group;
    }

    if (kind === 'moonbeam') {
      const cres = new THREE.Mesh(
        new THREE.TorusGeometry(isFinisher ? 0.30 : 0.24, isFinisher ? 0.054 : 0.044, 8, 24, Math.PI * 1.18),
        new THREE.MeshBasicMaterial({ color: '#fde047', toneMapped: false })
      );
      cres.rotation.x = Math.PI / 2;
      cres.rotation.z = -Math.PI * 0.59;

      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(isFinisher ? 0.13 : 0.10, 0),
        new THREE.MeshBasicMaterial({ color: '#ecfeff', toneMapped: false })
      );
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(0.16, isFinisher ? 0.34 : 0.27, 22),
        new THREE.MeshBasicMaterial({ color: '#fef08a', side: THREE.DoubleSide, transparent: true, opacity: 0.82, toneMapped: false })
      );
      aura.rotation.x = Math.PI / 2;
      for (let m = 0; m < 3; m += 1) {
        const mote = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.044, 0),
          new THREE.MeshBasicMaterial({ color: m % 2 === 0 ? '#fde047' : '#67e8f9', toneMapped: false })
        );
        const a = (m * Math.PI * 2) / 3;
        mote.position.set(Math.cos(a) * 0.24, 0.04, Math.sin(a) * 0.24);
        group.add(mote);
      }
      group.add(cres, core, aura);
      if (includeTrail) {
        const wake = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.008, 0.82, 8),
          new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.72, toneMapped: false })
        );
        wake.rotation.x = Math.PI / 2;
        wake.position.z = -0.48;
        group.add(wake);
      }
      return group;
    }

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(isFinisher ? 0.165 : 0.13, 1),
      new THREE.MeshBasicMaterial({ color: isFinisher ? '#f0abfc' : colorHex, toneMapped: false })
    );
    const haloA = new THREE.Mesh(
      new THREE.TorusGeometry(isFinisher ? 0.26 : 0.21, 0.026, 6, 22),
      new THREE.MeshBasicMaterial({ color: '#67e8f9', toneMapped: false })
    );
    const haloB = new THREE.Mesh(
      new THREE.TorusGeometry(isFinisher ? 0.23 : 0.18, 0.022, 6, 22),
      new THREE.MeshBasicMaterial({ color: '#e879f9', toneMapped: false })
    );
    haloB.rotation.x = Math.PI / 2;
    group.add(orb, haloA, haloB);
    if (includeTrail) {
      const wake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.006, 0.68, 8),
        new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.68, toneMapped: false })
      );
      wake.rotation.x = Math.PI / 2;
      wake.position.z = -0.40;
      group.add(wake);
    }
    return group;
  }

  _spawnProjectile(kind, startPos, targetPos, colorHex, isFinisher = false, onArrive = null) {
    const mesh = this._createProjectileMesh(kind, colorHex, isFinisher, true);
    mesh.position.copy(startPos);
    mesh.lookAt(targetPos);
    this.vfxGroup.add(mesh);

    const dist = Math.max(0.5, startPos.distanceTo(targetPos));
    const speed = kind === 'arrow' ? 13.5 : 11.2;
    this.projectiles.push({
      kind,
      mesh,
      startPos: startPos.clone(),
      targetPos: targetPos.clone(),
      age: 0,
      life: dist / speed,
      isFinisher,
      onArrive,
    });
  }

  _spawnMoonbeamCastSeal(worldPos, colorHex = '#fde047') {
    const grp = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.56, 36),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false })
    );
    outer.rotation.x = -Math.PI / 2;
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: '#67e8f9', side: THREE.DoubleSide, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.01;
    grp.add(outer, inner);
    grp.position.copy(worldPos);
    grp.position.y = Math.max(0.03, worldPos.y);
    this.vfxGroup.add(grp);
    this.vfxItems.push({ kind: 'cast-seal', mesh: grp, age: 0, life: 1.65, maxScale: 0.45 });
  }

  _updateBowDrawAndProjectiles(dt, elapsed) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      p.age += dt;
      const t = Math.min(1, p.age / Math.max(0.05, p.life));
      p.mesh.position.lerpVectors(p.startPos, p.targetPos, t);
      if (p.kind === 'arrow') {
        p.mesh.position.y += Math.sin(t * Math.PI) * 0.06;
        p.mesh.lookAt(p.targetPos);
      } else {
        p.mesh.rotation.y += dt * 11;
        p.mesh.rotation.z += dt * 7;
      }
      if (t >= 1) {
        if (typeof p.onArrive === 'function') p.onArrive();
        this.vfxGroup.remove(p.mesh);
        this._disposeObject(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    const BOW_SHOT_WINDOWS = {
      Wep_bow_Auto1: [[0.8, 4.0, 6.8]],
      Wep_bow_Auto2: [[0.8, 4.0, 6.8]],
      Wep_bow_Auto3: [[1.2, 6.0, 10.8]],
      Wep_bow_PowerShot: [[1.5, 9.0, 12.8]],
      Wep_bow_Volley: [[1.5, 8.0, 11.8], [13.5, 18.0, 21.8]],
      Wep_bow_Railshot: [[1.5, 10.0, 14.8]],
      BattleAttack: [[0.8, 4.0, 7.65], [10.8, 14.0, 18.65], [21.6, 25.0, 29.65]],
    };
    const activeBowWindows = BOW_SHOT_WINDOWS[this.currentClipName] || null;
    const isScoutAttack =
      this._getActiveStyleDef().id === 'bow' &&
      activeBowWindows &&
      this.actions[this.currentClipName]?.isRunning();

    let showingDynamic = false;
    if (isScoutAttack && this.handLBone && this.handRBone) {
      const clipAct = this.actions[this.currentClipName];
      const clipFrames = Math.max(12, Math.round((clipAct?.getClip?.()?.duration || 1.5) * 24));
      const frame = (((clipAct.time * 24) % clipFrames) + clipFrames) % clipFrames;
      let drawAlpha = 0;
      for (const [fStart, fPeak, fRel] of activeBowWindows) {
        if (frame >= fStart && frame < fRel) {
          drawAlpha = frame <= fPeak ? (frame - fStart) / Math.max(0.5, fPeak - fStart) : 1.0;
          break;
        }
      }

      const eps = this.bowEndpointsByTier[this.activeTier];
      if (drawAlpha > 0.05 && eps && this.dynamicBowGroup) {
        this.heroRoot.updateMatrixWorld(true);
        const topW = eps.topLocal.clone().applyMatrix4(this.handLBone.matrixWorld);
        const botW = eps.botLocal.clone().applyMatrix4(this.handLBone.matrixWorld);
        const restW = eps.restLocal.clone().applyMatrix4(this.handLBone.matrixWorld);
        const midStrW = new THREE.Vector3().addVectors(topW, botW).multiplyScalar(0.5);
        const handRW = new THREE.Vector3();
        if (this.totkMeshes.length > 0 || this.mountedWeaponEntries.length > 0) {
          handRW.set(0, 0.0495, 0).applyMatrix4(this.handRBone.matrixWorld);
        } else {
          this.handRBone.getWorldPosition(handRW);
        }
        const pullRatio = (this.totkMeshes.length > 0 || this.mountedWeaponEntries.length > 0)
          ? Math.min(1.0, drawAlpha)
          : Math.min(1.0, drawAlpha * 0.96);
        const pullW = midStrW.clone().lerp(handRW, pullRatio);

        const up = new THREE.Vector3(0, 1, 0);
        const placeSeg = (segMesh, a, b) => {
          const d = new THREE.Vector3().subVectors(b, a);
          const len = Math.max(0.01, d.length());
          segMesh.position.addVectors(a, b).multiplyScalar(0.5);
          segMesh.scale.set(1, len, 1);
          segMesh.quaternion.setFromUnitVectors(up, d.normalize());
        };
        placeSeg(this.bowUpperStrMesh, topW, pullW);
        placeSeg(this.bowLowerStrMesh, pullW, botW);

        const aimDir = new THREE.Vector3().subVectors(restW, pullW);
        if (aimDir.lengthSq() > 1e-4) {
          aimDir.normalize();
          this.nockedArrowMesh.position.copy(pullW).addScaledVector(aimDir, 0.28);
          this.nockedArrowMesh.lookAt(pullW.clone().addScaledVector(aimDir, 2.0));
          this.nockedArrowMesh.visible = true;
        } else {
          this.nockedArrowMesh.visible = false;
        }

        const staticStr = this.bowStringMeshesByTier[this.activeTier];
        if (staticStr) staticStr.visible = false;
        for (const strMesh of this.totkBowStringMeshes) {
          if (strMesh) strMesh.visible = false;
        }
        this.dynamicBowGroup.visible = true;
        showingDynamic = true;
      }
    }

    if (!showingDynamic) {
      if (this.dynamicBowGroup) this.dynamicBowGroup.visible = false;
      for (const strMesh of Object.values(this.bowStringMeshesByTier)) {
        if (strMesh) strMesh.visible = true;
      }
      for (const strMesh of this.totkBowStringMeshes) {
        if (strMesh) strMesh.visible = true;
      }
    }
  }

  _updateVfx(dt) {
    for (let i = this.vfxItems.length - 1; i >= 0; i -= 1) {
      const item = this.vfxItems[i];
      item.age += dt;
      const t = Math.min(1, item.age / item.life);
      if (item.kind === 'swing-slash') {
        item.mesh.scale.setScalar(1 + t * 0.24);
        if (item.sweepGroup) {
          item.sweepGroup.rotation.y += (item.sweepDir || 1) * dt * 3.8;
        }
        item.mesh.traverse((c) => {
          if (c.material) c.material.opacity = Math.max(0, (1 - t) * (c.userData.baseOpacity ?? 0.95));
        });
      } else if (item.kind === 'slash') {
        item.mesh.scale.setScalar(1 + t * 0.55);
        item.mesh.rotation.z += dt * 6;
        item.mesh.material.opacity = 1 - t;
      } else if (item.kind === 'cast-seal') {
        const s = 0.85 + Math.sin(t * Math.PI * 0.5) * (item.maxScale || 0.45);
        item.mesh.scale.set(s, 1, s);
        item.mesh.rotation.y += dt * 4.2;
        item.mesh.traverse((c) => {
          if (c.material) c.material.opacity = Math.max(0, (1 - t) * 0.9);
        });
      } else {
        const s = 1 + t * (item.maxScale || 1.8);
        item.mesh.scale.set(s, s, 1);
        item.mesh.material.opacity = 1 - t;
      }
      if (t >= 1) {
        this.vfxGroup.remove(item.mesh);
        this._disposeObject(item.mesh);
        this.vfxItems.splice(i, 1);
      }
    }
  }

  _animate() {
    if (this._disposed) return;
    this._rafId = requestAnimationFrame(() => this._animate());

    const dt = Math.min(0.05, this._clock.getDelta());
    const elapsed = this._clock.elapsedTime;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    } else if (this.mixer) {
      this.mixer.update(dt);
      // Subtle Male vs Female posture/stride feel
      if (this.pelvisBone && (this.currentClipName === 'Idle' || this.currentClipName === 'Walk')) {
        if (this.gender === 'female') {
          this.pelvisBone.rotation.z += Math.sin(elapsed * 3.2) * 0.022;
        } else if (this.chestBone) {
          this.chestBone.rotation.x -= 0.018;
        }
      }
    }

    this._updateWalkSteering(dt, elapsed);
    if (this.mode === 'battle-mode' && this.battleSubMode === 'grinding') {
      this._updateGrinding(dt, elapsed);
    } else if (this.mode === 'battle-mode' && this.battleSubMode === 'boss') {
      this._updateBossVisuals(dt, elapsed);
    }
    if (this.mode !== 'walking' && this.walkPhysics.grounded) {
      const hoverY = this._isArcanistHovering() ? 0.14 + Math.sin(elapsed * 3.4) * 0.032 : 0;
      const baseFloor = 0;
      this.heroRoot.position.y += (baseFloor + hoverY - this.heroRoot.position.y) * Math.min(1, dt * 10);
      if (this.modelGroup) {
        const hoverMoving =
          this._isArcanistHovering() &&
          (this.grindState.phase === 'running' || this.grindState.phase === 'kiting' || (this.mode === 'battle-mode' && this.battleSubMode === 'boss' && Math.abs(this.bossAnim.heroPosZ - this.bossAnim.heroDashTargetZ) > 0.15));
        const targetTilt = hoverMoving ? 0.11 : 0;
        this.modelGroup.rotation.x += (targetTilt - this.modelGroup.rotation.x) * Math.min(1, dt * 10);
      }
    }
    if (this.stickSpinPivot) {
      const act = this.actions[this.currentClipName];
      const meta = this._getClipMeta(this.currentClipName);
      if (act?.isRunning?.() && Array.isArray(meta?.spinWindow)) {
        const [tStart, tEnd, turns = 1] = meta.spinWindow;
        const dur = Math.max(0.05, act.getClip()?.duration || 0.75);
        const u = Math.max(0, Math.min(1, act.time / dur));
        if (u >= tStart && u <= tEnd) {
          const p = (u - tStart) / Math.max(0.01, tEnd - tStart);
          const ease = p * p * (3 - 2 * p);
          this.stickSpinPivot.rotation.z = ease * Math.PI * 2 * turns;
        } else {
          this.stickSpinPivot.rotation.z = 0;
        }
      } else {
        this.stickSpinPivot.rotation.z = 0;
      }
    }
    this._updateBowDrawAndProjectiles(dt, elapsed);
    this._updateVfx(dt);
    this.weaponVfx?.update(dt);
    if (this.groundLoot) {
      this.groundLoot.update(dt, elapsed, this.heroRoot.position, this.mode === 'battle-mode');
    }

    this.controls.update();

    // Optional impact micro-shake
    let savedCamPos = null;
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      savedCamPos = this.camera.position.clone();
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmp;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp;
    }

    const activeStyle = FLYFF_STYLES.find((s) => s.id === this.styleId) || FLYFF_STYLES[0];
    if (activeStyle?.bloom) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (savedCamPos) {
      this.camera.position.copy(savedCamPos);
    }
  }

  dispose() {
    this._disposed = true;
    cancelAnimationFrame(this._rafId);
    this._clearBossTimers();
    this._clearProjectiles();
    if (this.dynamicBowGroup) this._disposeObject(this.dynamicBowGroup);
    if (this.walkMoveRingGroup) this._disposeObject(this.walkMoveRingGroup);
    this.groundLoot?.dispose();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this._teardownCurrentModel();
    this.armorMounter?.dispose();
    if (this.faceTexture) {
      this.faceTexture.dispose();
      this.faceTexture = null;
    }
    this.celRampUniverse.dispose();
    this.outlineMaterial.dispose();
    if (this.gridTex) this.gridTex.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

function matNameFallback(matKey) {
  return MATERIAL_KEYS.includes(matKey) ? matKey : 'Primary';
}
