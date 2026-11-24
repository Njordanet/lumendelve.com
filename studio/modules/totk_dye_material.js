/**
 * @file totk_dye_material.js
 * Three.js MeshToonMaterial with 1:1 Godot `totk_hero.gdshader` sRGB-HSV dye shifting.
 * Uniforms (`uDyeColor`, `uDyeRef`, `uUseDye`) update at 60 FPS with zero shader recompilation.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';

export const TOTK_CLASS_DEFAULT_PALETTES = {
  squire: {
    Primary: '#56677D',
    Secondary: '#D9CFBB',
    Trim: '#71829A',
    Glow: '#38BDF8',
    Steel: '#A9B0B5',
    Skin: '#EFC4A2',
  },
  scout: {
    Primary: '#5C6B45',
    Secondary: '#DDD1B3',
    Trim: '#77865B',
    Glow: '#2DD4BF',
    Steel: '#B99459',
    Skin: '#EFC4A2',
  },
  arcanist: {
    Primary: '#484D72',
    Secondary: '#DDD2BB',
    Trim: '#666B92',
    Glow: '#9FB6E8',
    Steel: '#B99459',
    Skin: '#EFC4A2',
  },
  acolyte: {
    Primary: '#B07A7C',
    Secondary: '#E4D9C3',
    Trim: '#D6AEA6',
    Glow: '#E7B3BD',
    Steel: '#B99459',
    Skin: '#EFC4A2',
  },
};

export const TOTK_WEAPON_DEFAULT_PALETTE = {
  Primary: '#6E7A8A',
  Secondary: '#4A3A2E',
  Trim: '#C59D5C',
  Glow: '#80D4FF',
  Steel: '#B4BCC2',
};

export const TOTK_CHANNELS = ['Primary', 'Secondary', 'Trim', 'Glow', 'Steel', 'Skin', 'Fixed', 'BowString'];

const CHANNEL_BY_LOWER = new Map(TOTK_CHANNELS.map((c) => [c.toLowerCase(), c]));
const CHANNEL_SUFFIX_RE = /(?:^|_)(Primary|Secondary|Trim|Glow|Steel|Skin|Fixed|BowString)(?:[._]\d+)?$/i;
const FIXED_CHANNELS = new Set(['Fixed', 'BowString']);

let sharedTotkGradient = null;

function getTotkGradientMap() {
  if (!sharedTotkGradient) {
    sharedTotkGradient = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]), 2, 1);
    sharedTotkGradient.minFilter = THREE.LinearFilter;
    sharedTotkGradient.magFilter = THREE.LinearFilter;
    sharedTotkGradient.needsUpdate = true;
  }
  return sharedTotkGradient;
}

export function extractTotkChannel(meshName) {
  if (!meshName) return null;
  const match = String(meshName).match(CHANNEL_SUFFIX_RE);
  if (!match) return null;
  return CHANNEL_BY_LOWER.get(match[1].toLowerCase()) || null;
}

function normalizeClassId(classId, fallback = 'squire') {
  if (classId === 'weapon' || TOTK_CLASS_DEFAULT_PALETTES[classId]) return classId;
  return fallback;
}

function resolveRefHex(classId, channel, refHexOverride = null) {
  if (refHexOverride) return refHexOverride;
  const pal =
    classId === 'weapon'
      ? TOTK_WEAPON_DEFAULT_PALETTE
      : TOTK_CLASS_DEFAULT_PALETTES[classId] || TOTK_CLASS_DEFAULT_PALETTES.squire;
  return pal[channel] || '#FFFFFF';
}

function colorsApproxEqual(a, b) {
  return Math.abs(a.r - b.r) < 0.002 && Math.abs(a.g - b.g) < 0.002 && Math.abs(a.b - b.b) < 0.002;
}

const TOTK_DYE_GLSL_HELPERS = /* glsl */ `
#include <common>
uniform vec3 uDyeColor;
uniform vec3 uDyeRef;
uniform float uUseDye;

vec3 totkRgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 totkHsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec3 totkApplyDye(vec3 lin, vec3 dyeColor, vec3 dyeRef) {
  vec3 d = totkRgb2hsv(pow(max(dyeColor, vec3(1e-7)), vec3(1.0 / 2.2)));
  vec3 r = totkRgb2hsv(pow(max(dyeRef, vec3(1e-7)), vec3(1.0 / 2.2)));
  vec3 b = totkRgb2hsv(pow(max(lin, vec3(1e-7)), vec3(1.0 / 2.2)));
  b.x = fract(b.x + (d.x - r.x));
  b.y = clamp(b.y * (d.y + 0.05) / (r.y + 0.05), 0.0, 1.0);
  b.z = clamp(b.z * clamp((d.z + 0.05) / (r.z + 0.05), 0.3, 1.8), 0.0, 1.0);
  return pow(max(totkHsv2rgb(b), vec3(0.0)), vec3(2.2));
}
`;

export function createTotkDyeMaterial({
  channel = 'Primary',
  classId = 'squire',
  dyeHex = null,
  refHex = null,
  emissiveStrength = 0,
  vertexColors = true,
} = {}) {
  const safeChannel = CHANNEL_BY_LOWER.get(String(channel).toLowerCase()) || 'Primary';
  const safeClass = normalizeClassId(classId, 'squire');
  const resolvedRefHex = resolveRefHex(safeClass, safeChannel, refHex);
  const isFixed = FIXED_CHANNELS.has(safeChannel);

  const refColor = new THREE.Color(resolvedRefHex);
  const dyeColor = new THREE.Color(!isFixed && dyeHex ? dyeHex : resolvedRefHex);
  const useDye = !isFixed && Boolean(dyeHex) && !colorsApproxEqual(dyeColor, refColor);

  const uniforms = {
    uDyeColor: { value: dyeColor },
    uDyeRef: { value: refColor },
    uUseDye: { value: useDye ? 1.0 : 0.0 },
  };

  const isGlow = safeChannel === 'Glow';
  const activeEmissive = isGlow && (useDye || emissiveStrength > 0);
  const mat = new THREE.MeshToonMaterial({
    name: `TotkHero_${safeChannel}`,
    color: vertexColors ? 0xffffff : new THREE.Color(resolvedRefHex),
    vertexColors: Boolean(vertexColors),
    gradientMap: getTotkGradientMap(),
    emissive: new THREE.Color(activeEmissive ? (dyeHex || resolvedRefHex) : '#000000'),
    emissiveIntensity: activeEmissive ? (emissiveStrength || 0.25) : 0,
  });

  mat.userData.totkUniforms = uniforms;
  mat.userData.channel = safeChannel;
  mat.userData.classId = safeClass;
  mat.userData.refHexOverride = refHex || null;
  mat.userData.emissiveStrength = Number(emissiveStrength) || 0;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDyeColor = uniforms.uDyeColor;
    shader.uniforms.uDyeRef = uniforms.uDyeRef;
    shader.uniforms.uUseDye = uniforms.uUseDye;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', TOTK_DYE_GLSL_HELPERS)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (uUseDye > 0.5) {
          diffuseColor.rgb = totkApplyDye(diffuseColor.rgb, uDyeColor, uDyeRef);
        }`
      );
  };
  mat.customProgramCacheKey = () => 'totk-hero-hsv-dye-v1';

  return mat;
}

export function setTotkMaterialDye(mat, hex, classId = null, refHexOverride = null) {
  if (!mat?.userData?.totkUniforms || mat.userData.lockedWeaponMaterial) return false;
  const { totkUniforms, channel } = mat.userData;
  const nextClass = normalizeClassId(classId, mat.userData.classId || 'squire');
  mat.userData.classId = nextClass;
  if (refHexOverride !== undefined && refHexOverride !== null) {
    mat.userData.refHexOverride = refHexOverride;
  }

  const refHex = resolveRefHex(nextClass, channel, mat.userData.refHexOverride);
  totkUniforms.uDyeRef.value.set(refHex);
  if (!mat.vertexColors) {
    mat.color.set(refHex);
  }

  if (FIXED_CHANNELS.has(channel)) {
    totkUniforms.uDyeColor.value.set(refHex);
    totkUniforms.uUseDye.value = 0.0;
    return true;
  }

  const nextHex = hex || refHex;
  totkUniforms.uDyeColor.value.set(nextHex);
  const useDye = Boolean(hex) && !colorsApproxEqual(totkUniforms.uDyeColor.value, totkUniforms.uDyeRef.value);
  totkUniforms.uUseDye.value = useDye ? 1.0 : 0.0;

  if (channel === 'Glow') {
    const customEmissive = mat.userData.emissiveStrength || 0;
    if (useDye || customEmissive > 0) {
      mat.emissive.set(nextHex);
      mat.emissiveIntensity = customEmissive || 0.25;
    } else {
      mat.emissive.set('#000000');
      mat.emissiveIntensity = 0;
    }
  }
  return true;
}
