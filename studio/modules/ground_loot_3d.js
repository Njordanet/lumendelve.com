/**
 * @file ground_loot_3d.js
 * Three.js r170 ground loot drop visualizer for LD Studio Battle Mode.
 * Matches Godot GroundLootHelper.gd + loot_beam.gdshader rarity pillars,
 * 12 cel-shaded slot silhouettes, 450ms parabolic bounce, and walk-over pickup.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';

export const RARITY_PROFILES = {
  common:    { label: 'Common',   hex: '#8FB2D9', core: '#E2EFFC', height: 0.0, width: 0.0,  intensity: 0.0,  ringR: 0.24, dual: 0.0  },
  uncommon:  { label: 'Uncommon', hex: '#C8834B', core: '#FFE2BF', height: 1.4, width: 0.34, intensity: 1.15, ringR: 0.36, dual: 0.12 },
  rare:      { label: 'Rare',     hex: '#2EE86C', core: '#E4FFE9', height: 4.5, width: 0.48, intensity: 1.85, ringR: 0.50, dual: 0.32 },
  epic:      { label: 'Unique',   hex: '#FF3B4E', core: '#FFD8DC', height: 6.5, width: 0.60, intensity: 2.20, ringR: 0.62, dual: 0.45 },
  mythic:    { label: 'Ultimate', hex: '#C06CFF', core: '#FFD15C', height: 8.0, width: 0.72, intensity: 2.55, ringR: 0.74, dual: 0.88 },
  legendary: { label: 'Ultimate', hex: '#C06CFF', core: '#FFD15C', height: 8.0, width: 0.72, intensity: 2.55, ringR: 0.74, dual: 0.88 },
};

export const ALL_12_MESH_KINDS = [
  'helmet', 'shoulders', 'chest', 'gloves', 'legs', 'boots',
  'weapon', 'shield', 'accessory', 'glyph', 'coin', 'ore',
];

const BOUNCE_SEC = 0.45;
const PICKUP_RADIUS_M = 1.45;
const MAX_PLINTH_R = 4.45;
const INK_HEX = '#1A1512';

const BEAM_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BEAM_FRAGMENT_SHADER = `
  uniform vec3 uBeamColor;
  uniform vec3 uCoreColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uScrollSpeed;
  uniform float uDualCore;
  varying vec2 vUv;
  void main() {
    float u = clamp(vUv.x, 0.0, 1.0);
    float v = clamp(vUv.y, 0.0, 1.0);
    float centerDist = abs(u - 0.5) * 2.0;
    float radial = pow(clamp(1.0 - centerDist, 0.0, 1.0), 1.85);
    float spine = exp(-pow(centerDist / 0.22, 2.0));
    float baseGlow = smoothstep(0.0, 0.14, v) * 0.42 + smoothstep(1.0, 0.06, v) * 0.58;
    float topFade = pow(smoothstep(1.0, 0.06, v), 1.5);
    float t = uTime * uScrollSpeed;
    float wispA = 0.5 + 0.5 * sin(v * 14.0 - t + u * 6.2831853);
    float wispB = 0.5 + 0.5 * sin(v * 27.0 - t * 1.45 - u * 12.56637);
    float wisps = 0.68 + 0.32 * (wispA * 0.6 + wispB * 0.4);
    float pulse = 0.88 + 0.12 * sin(uTime * 3.4);
    float alpha = clamp((radial * 0.72 + spine * 0.55) * topFade * baseGlow * wisps * pulse, 0.0, 1.0);
    float coreMix = clamp(spine * (0.35 + uDualCore * 0.65) + (1.0 - topFade) * 0.15, 0.0, 1.0);
    vec3 col = mix(uBeamColor, uCoreColor, coreMix) * uIntensity;
    gl_FragColor = vec4(col, alpha * 0.85);
  }
`;

function normRarity(r) {
  const s = String(r || 'common').trim().toLowerCase();
  return RARITY_PROFILES[s] ? (s === 'legendary' ? 'mythic' : s) : 'common';
}

function clampPlinthXZ(x, z) {
  const r = Math.hypot(x, z);
  if (r <= MAX_PLINTH_R || r < 1e-4) return [x, z];
  return [(x * MAX_PLINTH_R) / r, (z * MAX_PLINTH_R) / r];
}

function makeToonGradient() {
  const tex = new THREE.DataTexture(new Uint8Array([155, 155, 155, 255, 255, 255, 255, 255]), 2, 1);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function makeLabelTexture(text, rarityHex, rarityLabel) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 112;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  const padX = 24;
  const r = 22;
  ctx.fillStyle = 'rgba(9, 14, 26, 0.88)';
  ctx.strokeStyle = rarityHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(padX, 14, c.width - padX * 2, 84, r);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rarityHex;
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.fillText(rarityLabel.toUpperCase(), c.width / 2, 36);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 28px Inter, system-ui, sans-serif';
  const trimmed = text.length > 26 ? `${text.slice(0, 24)}…` : text;
  ctx.fillText(trimmed, c.width / 2, 70);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildSilhouetteGroup(meshKind, rarity, prof, gradientMap, outlineMat) {
  const kind = String(meshKind || 'chest').toLowerCase();
  const group = new THREE.Group();
  let mainColor = new THREE.Color(prof.hex);
  let emissive = new THREE.Color(prof.hex);
  let emissiveIntensity = ['rare', 'epic', 'mythic'].includes(rarity) ? 0.55 : rarity === 'uncommon' ? 0.25 : 0.1;

  if (kind === 'coin') {
    mainColor = new THREE.Color('#F4C542');
    emissive = new THREE.Color('#DFB44D');
    emissiveIntensity = 0.28;
  } else if (kind === 'ore') {
    mainColor = new THREE.Color('#38BDF8');
    emissive = new THREE.Color('#38BDF8');
    emissiveIntensity = 0.45;
  }

  const mat = new THREE.MeshToonMaterial({
    color: mainColor,
    gradientMap,
    emissive,
    emissiveIntensity,
  });

  const addPart = (geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    group.add(mesh);

    const hull = new THREE.Mesh(geo, outlineMat);
    hull.position.copy(mesh.position);
    hull.rotation.copy(mesh.rotation);
    hull.scale.set(scale[0] * 1.12, scale[1] * 1.12, scale[2] * 1.12);
    group.add(hull);
  };

  if (kind === 'weapon') {
    addPart(new THREE.BoxGeometry(0.065, 0.42, 0.03), [0, 0.08, 0], [0.21, 0, -0.49]);
    addPart(new THREE.BoxGeometry(0.18, 0.04, 0.05), [-0.04, -0.02, 0], [0.21, 0, -0.49]);
  } else if (kind === 'gloves' || kind === 'boots' || kind === 'legs') {
    const geo =
      kind === 'legs'
        ? new THREE.CylinderGeometry(0.065, 0.055, 0.24, 8)
        : kind === 'boots'
          ? new THREE.BoxGeometry(0.11, 0.14, 0.20)
          : new THREE.BoxGeometry(0.11, 0.18, 0.11);
    addPart(geo, [-0.09, 0, 0]);
    addPart(geo, [0.09, 0, 0]);
  } else if (kind === 'shoulders') {
    addPart(new THREE.BoxGeometry(0.16, 0.13, 0.17), [-0.11, 0, 0], [0, 0, 0.22]);
    addPart(new THREE.BoxGeometry(0.16, 0.13, 0.17), [0.11, 0, 0], [0, 0, -0.22]);
  } else if (kind === 'chest') {
    addPart(new THREE.BoxGeometry(0.28, 0.30, 0.16), [0, 0, 0]);
    addPart(new THREE.BoxGeometry(0.30, 0.10, 0.15), [0, 0.11, 0]);
  } else if (kind === 'helmet') {
    addPart(new THREE.SphereGeometry(0.16, 12, 8), [0, 0, 0]);
    addPart(new THREE.BoxGeometry(0.05, 0.08, 0.22), [0, 0.13, 0]);
  } else if (kind === 'shield') {
    addPart(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 8), [0, 0, 0], [1.18, 0, 0]);
  } else if (kind === 'accessory') {
    addPart(new THREE.TorusGeometry(0.12, 0.038, 8, 18), [0, 0, 0], [1.0, 0, 0]);
  } else if (kind === 'coin') {
    const cg = new THREE.CylinderGeometry(0.14, 0.15, 0.07, 10);
    addPart(cg, [-0.04, 0, 0]);
    addPart(cg, [0.05, 0.06, 0.03], [0, 0, 0], [0.85, 0.85, 0.85]);
  } else if (kind === 'ore') {
    addPart(new THREE.ConeGeometry(0.13, 0.30, 6), [0, 0.02, 0]);
  } else if (kind === 'glyph') {
    addPart(new THREE.OctahedronGeometry(0.16, 0), [0, 0.02, 0], [0, 0.3, 0], [0.85, 1.25, 0.6]);
  } else {
    addPart(new THREE.BoxGeometry(0.24, 0.24, 0.16), [0, 0, 0]);
  }

  return group;
}

export function createGroundLootManager({ scene, onDropPicked }) {
  const root = new THREE.Group();
  root.name = 'GroundLootRoot';
  scene.add(root);

  const gradientMap = makeToonGradient();
  const outlineMat = new THREE.MeshBasicMaterial({ color: INK_HEX, side: THREE.BackSide });
  const drops = [];
  const hitTargets = [];
  let seq = 1;
  let simClock = 0;
  let beamHeightScale = 1.0;
  let beamGlowScale = 1.0;
  let autoPickupEnabled = true;

  function buildDropEntity(spec) {
    const rarity = normRarity(spec.rarity);
    const prof = RARITY_PROFILES[rarity];
    const kind = String(spec.kind || 'gear').toLowerCase();
    const meshKind = String(spec.meshKind || 'chest').toLowerCase();
    const [tx, tz] = clampPlinthXZ(Number(spec.x) || 0, Number(spec.z) || 0);
    const [ox, oz] = clampPlinthXZ(Number(spec.originX ?? tx) || 0, Number(spec.originZ ?? tz) || 0);

    const dropGroup = new THREE.Group();
    dropGroup.position.set(tx, 0, tz);

    // Subtle ground glow disc (every rarity)
    const discGeo = new THREE.CircleGeometry(prof.ringR * 0.9, 24);
    const discMat = new THREE.MeshBasicMaterial({
      color: prof.hex,
      transparent: true,
      opacity: rarity === 'common' ? 0.35 : 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = -Math.PI / 2;
    discMesh.position.y = 0.015;
    dropGroup.add(discMesh);

    // Pulsing floor ring (uncommon+)
    let ringMesh = null;
    let ringMat = null;
    let secondRingMesh = null;
    if (rarity !== 'common') {
      ringMat = new THREE.MeshBasicMaterial({
        color: prof.hex,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      ringMesh = new THREE.Mesh(new THREE.RingGeometry(prof.ringR * 0.8, prof.ringR, 32), ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.022;
      dropGroup.add(ringMesh);

      if (rarity === 'mythic') {
        secondRingMesh = new THREE.Mesh(
          new THREE.RingGeometry(prof.ringR * 0.5, prof.ringR * 0.66, 32),
          new THREE.MeshBasicMaterial({
            color: '#FFD15C',
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          })
        );
        secondRingMesh.rotation.x = -Math.PI / 2;
        secondRingMesh.position.y = 0.026;
        dropGroup.add(secondRingMesh);
      }
    }

    // Light pillar beam (uncommon+)
    let beamGroup = null;
    let beamUniforms = null;
    if (prof.height > 0) {
      beamGroup = new THREE.Group();
      beamUniforms = {
        uBeamColor: { value: new THREE.Color(prof.hex) },
        uCoreColor: { value: new THREE.Color(prof.core) },
        uIntensity: { value: prof.intensity * beamGlowScale },
        uTime: { value: simClock },
        uScrollSpeed: { value: rarity === 'mythic' ? 2.4 : 1.65 },
        uDualCore: { value: prof.dual },
      };
      const beamMat = new THREE.ShaderMaterial({
        uniforms: beamUniforms,
        vertexShader: BEAM_VERTEX_SHADER,
        fragmentShader: BEAM_FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const planeGeo = new THREE.PlaneGeometry(prof.width, prof.height, 1, 1);
      planeGeo.translate(0, prof.height / 2, 0);
      const planeA = new THREE.Mesh(planeGeo, beamMat);
      const planeB = new THREE.Mesh(planeGeo, beamMat);
      planeB.rotation.y = Math.PI / 2;
      beamGroup.add(planeA, planeB);
      beamGroup.scale.y = beamHeightScale;
      dropGroup.add(beamGroup);
    }

    // Rising embers / motes for epic & mythic
    const motes = [];
    if (rarity === 'epic' || rarity === 'mythic') {
      const moteCount = rarity === 'mythic' ? 10 : 6;
      const moteGeo = new THREE.SphereGeometry(0.036, 8, 8);
      for (let i = 0; i < moteCount; i++) {
        const moteMat = new THREE.MeshBasicMaterial({
          color: rarity === 'mythic' && i % 2 === 0 ? '#FFD15C' : prof.hex,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        });
        const m = new THREE.Mesh(moteGeo, moteMat);
        dropGroup.add(m);
        motes.push({
          mesh: m,
          phase: (i / moteCount) * Math.PI * 2,
          radius: 0.14 + (i % 3) * 0.1,
          speed: 0.75 + (i % 4) * 0.22,
          maxH: rarity === 'mythic' ? 4.2 : 2.8,
        });
      }
    }

    // 3D cel-shaded item mesh (bounces during first 450ms)
    const visualHolder = buildSilhouetteGroup(meshKind, rarity, prof, gradientMap, outlineMat);
    visualHolder.position.set(ox - tx, 0.22, oz - tz);
    dropGroup.add(visualHolder);

    // Compact label sprite (gear & glyphs only; coin & ore stay clean like Godot)
    let labelSprite = null;
    if (kind !== 'gold' && meshKind !== 'coin' && meshKind !== 'ore') {
      const displayName = String(spec.displayName || `${prof.label} ${meshKind}`);
      const labelMat = new THREE.SpriteMaterial({
        map: makeLabelTexture(displayName, prof.hex, prof.label),
        transparent: true,
        depthWrite: false,
      });
      labelSprite = new THREE.Sprite(labelMat);
      labelSprite.scale.set(1.16, 0.26, 1);
      labelSprite.position.set(0, 0.72, 0);
      labelSprite.visible = false;
      dropGroup.add(labelSprite);
    }

    // Invisible click hit sphere for click-to-walk/loot
    const hitGeo = new THREE.SphereGeometry(0.45, 10, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.set(0, 0.38, 0);
    hitMesh.userData.dropId = spec.dropId;
    dropGroup.add(hitMesh);
    hitTargets.push(hitMesh);

    root.add(dropGroup);

    return {
      ...spec,
      dropId: spec.dropId,
      rarity,
      kind,
      meshKind,
      x: tx,
      z: tz,
      originX: ox,
      originZ: oz,
      age: 0,
      picked: false,
      baseIntensity: prof.intensity,
      group: dropGroup,
      visualHolder,
      beamGroup,
      beamUniforms,
      discMat,
      ringMesh,
      ringMat,
      secondRingMesh,
      motes,
      labelSprite,
      hitMesh,
    };
  }

  function spawnDrops(list = []) {
    const out = [];
    for (const raw of list) {
      const id = raw.dropId || `studio_drop_${Date.now()}_${seq++}`;
      if (drops.some((d) => d.dropId === id)) continue;
      const entity = buildDropEntity({ ...raw, dropId: id });
      drops.push(entity);
      out.push(entity);
    }
    return out;
  }

  function spawnArcPoint(idx, total, origin = [0, 0], minR = 1.9, maxR = 3.4) {
    const t = total <= 1 ? 0.5 : idx / (total - 1);
    const angle = -Math.PI * 0.8 + t * Math.PI * 1.6;
    const rad = minR + ((idx % 3) / 2) * (maxR - minR);
    return [
      origin[0] + Math.cos(angle) * rad,
      origin[1] + Math.sin(angle) * rad * 0.85,
    ];
  }

  function keepClearOfHero(x, z, heroPos) {
    const [cx, cz] = clampPlinthXZ(x, z);
    if (!heroPos) return [cx, cz];
    const dx = cx - heroPos.x;
    const dz = cz - heroPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= 1.85) return [cx, cz];
    const nx = dist > 0.05 ? dx / dist : 0.4;
    const nz = dist > 0.05 ? dz / dist : -1.0;
    return clampPlinthXZ(heroPos.x + nx * 1.95, heroPos.z + nz * 1.95 - 0.6);
  }

  function spawnPresetRarity(rarity, heroPos = new THREE.Vector3(0, 0, 1.35)) {
    const r = normRarity(rarity);
    const angle = (Math.random() - 0.5) * Math.PI * 0.8 - Math.PI / 2;
    const dist = 1.9 + Math.random() * 1.1;
    const tx = Math.cos(angle) * dist;
    const tz = Math.sin(angle) * dist * 0.75 - 0.9;
    const meshKind =
      r === 'common' ? 'chest'
      : r === 'uncommon' ? 'helmet'
      : r === 'rare' ? 'shoulders'
      : r === 'epic' ? 'weapon'
      : 'accessory';
    const labelMap = {
      common: 'Steel Watch Cuirass',
      uncommon: 'Sluice Rivet Helm',
      rare: 'Riveta Cuirass',
      epic: 'Lumenbrand Edge',
      mythic: 'Solstice Sovereign Ring',
    };
    const [cx, cz] = keepClearOfHero(tx, tz, heroPos);
    const ox = heroPos?.x ?? 0;
    const oz = (heroPos?.z ?? 0) - 0.5;
    return spawnDrops([{
      dropId: `preset_${r}_${Date.now()}_${seq++}`,
      kind: 'gear',
      meshKind,
      rarity: r,
      displayName: labelMap[r] || 'Drop',
      x: cx,
      z: cz,
      originX: ox,
      originZ: oz,
    }]);
  }

  function spawnBossBurst(heroPos = new THREE.Vector3(0, 0, 1.35)) {
    clearAll();
    const specs = [
      { kind: 'gold', meshKind: 'coin', rarity: 'common', displayName: '240g', goldAmount: 240 },
      { kind: 'material', meshKind: 'ore', rarity: 'common', displayName: '3 Ore', oreCount: 3 },
      { kind: 'gear', meshKind: 'boots', rarity: 'common', displayName: 'Slateforged Greaves' },
      { kind: 'gear', meshKind: 'gloves', rarity: 'uncommon', displayName: 'Brinehammer Gauntlets' },
      { kind: 'glyph', meshKind: 'glyph', rarity: 'rare', displayName: 'Radiant Chorus Glyph' },
      { kind: 'gear', meshKind: 'chest', rarity: 'rare', displayName: 'Riveta Breastplate' },
      { kind: 'gear', meshKind: 'weapon', rarity: 'epic', displayName: 'Solaris Edge' },
      { kind: 'gear', meshKind: 'accessory', rarity: 'mythic', displayName: 'Crown of Solstice' },
    ];
    const items = specs.map((s, i) => {
      const t = i / (specs.length - 1);
      const angle = -Math.PI * 0.92 + t * Math.PI * 0.84;
      const rad = 2.0 + (i % 2) * 1.15;
      const rawX = Math.cos(angle) * rad;
      const rawZ = -0.65 + Math.sin(angle) * rad * 0.85;
      const [x, z] = keepClearOfHero(rawX, rawZ, heroPos);
      return {
        ...s,
        dropId: `burst_${Date.now()}_${seq++}`,
        x,
        z,
        originX: 0,
        originZ: -1.6,
      };
    });
    return spawnDrops(items);
  }

  function spawn12MeshLineup(heroPos = new THREE.Vector3(0, 0, 1.35)) {
    clearAll();
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'mythic'];
    const items = ALL_12_MESH_KINDS.map((mk, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const rawX = (col - 2.5) * 0.86;
      const rawZ = row === 0 ? -0.95 : -2.35;
      const [x, z] = keepClearOfHero(rawX, rawZ, heroPos);
      const rarity = mk === 'coin' ? 'common' : mk === 'ore' ? 'uncommon' : rarities[i % rarities.length];
      return {
        dropId: `mesh12_${mk}_${Date.now()}_${seq++}`,
        kind: mk === 'coin' ? 'gold' : mk === 'ore' ? 'material' : mk === 'glyph' ? 'glyph' : 'gear',
        meshKind: mk,
        rarity,
        displayName: `${mk.toUpperCase()} (${RARITY_PROFILES[rarity].label})`,
        x,
        z,
        originX: 0,
        originZ: -1.65,
      };
    });
    return spawnDrops(items);
  }

  function removeEntity(idx) {
    const entity = drops[idx];
    if (!entity) return;
    root.remove(entity.group);
    const hitIdx = hitTargets.indexOf(entity.hitMesh);
    if (hitIdx !== -1) hitTargets.splice(hitIdx, 1);
    entity.group.traverse((obj) => {
      if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
      if (obj.material && obj.material !== outlineMat) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    drops.splice(idx, 1);
  }

  function pickAtIndices(indices) {
    if (!indices.length) return [];
    const sorted = [...indices].sort((a, b) => b - a);
    const picked = [];
    for (const idx of sorted) {
      const entity = drops[idx];
      if (!entity) continue;
      picked.push(entity);
      removeEntity(idx);
    }
    if (picked.length && typeof onDropPicked === 'function') {
      onDropPicked(picked);
    }
    return picked;
  }

  function lootAll() {
    if (!drops.length) return [];
    const allIdx = drops.map((_, i) => i);
    return pickAtIndices(allIdx);
  }

  function clearAll() {
    for (let i = drops.length - 1; i >= 0; i--) removeEntity(i);
  }

  function raycast(raycaster) {
    if (!hitTargets.length) return null;
    const hits = raycaster.intersectObjects(hitTargets, false);
    if (!hits.length) return null;
    const dropId = hits[0].object.userData.dropId;
    return drops.find((d) => d.dropId === dropId) || null;
  }

  function setBeamScale(heightMult = 1.0, glowMult = 1.0) {
    beamHeightScale = Math.max(0.3, Math.min(1.6, Number(heightMult) || 1.0));
    beamGlowScale = Math.max(0.25, Math.min(2.0, Number(glowMult) || 1.0));
    for (const d of drops) {
      if (d.beamGroup) d.beamGroup.scale.y = beamHeightScale;
      if (d.beamUniforms) d.beamUniforms.uIntensity.value = d.baseIntensity * beamGlowScale;
    }
  }

  function setAutoPickupEnabled(enabled) {
    autoPickupEnabled = Boolean(enabled);
  }

  function setVisible(visible) {
    root.visible = Boolean(visible);
  }

  function update(dt, elapsed, heroPos, allowPickup = true) {
    simClock = elapsed;
    const toPick = [];

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.age += dt;
      const u = Math.min(1, d.age / BOUNCE_SEC);
      const settled = u >= 1;

      // Parabolic bounce from origin -> target while beam stays grounded at target
      if (!settled) {
        const arcY = 0.22 + Math.sin(u * Math.PI) * 0.72;
        d.visualHolder.position.set(
          (d.originX - d.x) * (1 - u),
          arcY,
          (d.originZ - d.z) * (1 - u)
        );
        d.visualHolder.rotation.y += dt * 7.5;
      } else {
        d.visualHolder.position.set(0, 0.23 + Math.sin(elapsed * 2.4 + i) * 0.045, 0);
        d.visualHolder.rotation.y += dt * 1.15;
      }

      if (d.labelSprite) {
        d.labelSprite.visible = settled;
      }

      if (d.beamUniforms) {
        d.beamUniforms.uTime.value = elapsed + i * 0.37;
      }
      if (d.ringMesh && d.ringMat) {
        const s = 0.88 + 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 3.8 + i));
        d.ringMesh.scale.set(s, s, 1);
        d.ringMat.opacity = 0.5 + 0.32 * Math.sin(elapsed * 3.8 + i);
      }
      if (d.secondRingMesh) {
        const s2 = 0.9 + 0.2 * (0.5 + 0.5 * Math.cos(elapsed * 4.5 + i));
        d.secondRingMesh.scale.set(s2, s2, 1);
      }
      for (const m of d.motes) {
        const p = (elapsed * m.speed + m.phase) % 1;
        const a = elapsed * 2.2 + m.phase;
        m.mesh.position.set(Math.cos(a) * m.radius, 0.15 + p * m.maxH, Math.sin(a) * m.radius);
        m.mesh.material.opacity = Math.sin(p * Math.PI) * 0.85;
      }

      if (settled && allowPickup && autoPickupEnabled && heroPos) {
        const dist = Math.hypot(heroPos.x - d.x, heroPos.z - d.z);
        if (dist <= PICKUP_RADIUS_M) {
          toPick.push(i);
        }
      }
    }

    if (toPick.length) {
      pickAtIndices(toPick);
    }
  }

  function getDrops() {
    return drops.map((d) => ({
      dropId: d.dropId,
      kind: d.kind,
      meshKind: d.meshKind,
      rarity: d.rarity,
      displayName: d.displayName,
      x: d.x,
      z: d.z,
      settled: d.age >= BOUNCE_SEC,
    }));
  }

  function dispose() {
    clearAll();
    scene.remove(root);
    gradientMap.dispose();
    outlineMat.dispose();
  }

  return {
    spawnDrops,
    spawnPresetRarity,
    spawnBossBurst,
    spawn12MeshLineup,
    lootAll,
    clearAll,
    raycast,
    update,
    setBeamScale,
    setAutoPickupEnabled,
    setVisible,
    getDrops,
    dispose,
  };
}
