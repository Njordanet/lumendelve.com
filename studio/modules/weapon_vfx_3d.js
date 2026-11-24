/**
 * @file weapon_vfx_3d.js
 * Three.js r170 weapon-signature & per-glyph 3D VFX engine for LD Studio Stage 1.
 * Ensures every weapon's auto chain is distinctive and EVERY individual glyph
 * across all 4 classes renders its own unmistakable silhouette, trajectory, and impact.
 */

import * as THREE from 'https://esm.sh/three@0.170.0';
import { getStaffElementDef } from './weapon_staging_catalog.js';

function makeTaperedArcMesh(radius, width, arcAngle, colorHex, opacity = 0.94) {
  const segs = 32;
  const geo = new THREE.RingGeometry(
    Math.max(0.05, radius - width * 0.5),
    radius + width * 0.5,
    segs,
    1,
    -arcAngle * 0.5,
    arcAngle
  );
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const ang = Math.atan2(vy, vx);
    const u = Math.max(-1, Math.min(1, ang / Math.max(0.001, arcAngle * 0.5)));
    const taper = Math.pow(Math.max(0, 1 - u * u), 0.72);
    const rOrig = Math.hypot(vx, vy);
    const rNew = radius + (rOrig - radius) * taper;
    pos.setXYZ(i, Math.cos(ang) * rNew, Math.sin(ang) * rNew, 0);
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();

  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    toneMapped: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.baseOpacity = opacity;
  mesh.rotation.x = -Math.PI * 0.5;
  return mesh;
}

export class WeaponVfxEngine {
  constructor(vfxGroup, scene) {
    this.vfxGroup = vfxGroup;
    this.scene = scene;
    this.items = [];
    this.projectiles = [];
    this.delayedTimers = [];
  }

  _disposeObj(root) {
    if (!root) return;
    root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  clear() {
    for (const id of this.delayedTimers) clearTimeout(id);
    this.delayedTimers = [];
    for (const item of this.items) {
      this.vfxGroup.remove(item.mesh);
      this._disposeObj(item.mesh);
    }
    this.items = [];
    for (const p of this.projectiles) {
      this.vfxGroup.remove(p.mesh);
      this._disposeObj(p.mesh);
    }
    this.projectiles = [];
  }

  _later(ms, fn) {
    const id = setTimeout(() => {
      const idx = this.delayedTimers.indexOf(id);
      if (idx >= 0) this.delayedTimers.splice(idx, 1);
      fn();
    }, ms);
    this.delayedTimers.push(id);
  }

  _pushItem(entry) {
    this.vfxGroup.add(entry.mesh);
    this.items.push({ age: 0, ...entry });
  }

  _makePhantomRazorFanMesh(primaryHex = '#34d399', edgeHex = '#ffffff', scale = 1.0) {
    const fan = new THREE.Group();
    const bladeCount = 6;
    const spreadRad = Math.PI * 0.72;
    for (let i = 0; i < bladeCount; i += 1) {
      const ang = -spreadRad * 0.5 + (i / (bladeCount - 1)) * spreadRad;
      const bladePivot = new THREE.Group();
      bladePivot.rotation.y = ang;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.058 * scale, 0.014 * scale, 0.34 * scale),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? primaryHex : '#6ee7b7',
          transparent: true,
          opacity: 0.94,
          toneMapped: false,
          depthWrite: false,
        })
      );
      blade.userData.baseOpacity = 0.94;
      blade.position.z = 0.21 * scale;
      bladePivot.add(blade);
      fan.add(bladePivot);
    }

    const rim = makeTaperedArcMesh(0.39 * scale, 0.11 * scale, spreadRad * 1.12, edgeHex, 0.98);
    const rimGrp = new THREE.Group();
    rimGrp.add(rim);
    rimGrp.rotation.y = -Math.PI * 0.5;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065 * scale, 0.065 * scale, 0.032 * scale, 12),
      new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
    );
    hub.userData.baseOpacity = 0.96;
    fan.add(rimGrp, hub);
    return fan;
  }

  _spawnLightningStrike(targetPos, scaleBoost = 1.0) {
    const groundPt = targetPos.clone().setY(0.06);
    const boltGroup = new THREE.Group();
    boltGroup.position.copy(groundPt);

    const pts = [new THREE.Vector3(0, 5.2, 0)];
    const segs = 7;
    for (let i = 1; i < segs; i += 1) {
      const u = i / segs;
      const y = 5.2 * (1 - u);
      const zig = (i % 2 === 0 ? 1 : -1) * (0.28 + ((i * 37) % 10) * 0.018) * scaleBoost;
      const zag = (i % 3 === 0 ? -0.18 : 0.14) * scaleBoost;
      pts.push(new THREE.Vector3(zig, y, zag));
    }
    pts.push(new THREE.Vector3(0, 0, 0));

    const up = new THREE.Vector3(0, 1, 0);
    const addSegmentMesh = (a, b, coreR, glowR, glowCol = '#38bdf8') => {
      const d = new THREE.Vector3().subVectors(b, a);
      const len = Math.max(0.05, d.length());
      const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize());
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(coreR, coreR, len, 6),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.99, toneMapped: false, depthWrite: false })
      );
      core.userData.baseOpacity = 0.99;
      core.position.copy(mid);
      core.quaternion.copy(q);

      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(glowR, glowR, len, 6),
        new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.68, toneMapped: false, depthWrite: false })
      );
      glow.userData.baseOpacity = 0.68;
      glow.position.copy(mid);
      glow.quaternion.copy(q);
      boltGroup.add(glow, core);
    };

    for (let i = 0; i < pts.length - 1; i += 1) {
      addSegmentMesh(pts[i], pts[i + 1], 0.048 * scaleBoost, 0.135 * scaleBoost, i % 2 === 0 ? '#38bdf8' : '#facc15');
    }

    const branches = [
      [pts[3], pts[3].clone().add(new THREE.Vector3(0.75 * scaleBoost, -1.15, 0.45 * scaleBoost))],
      [pts[4], pts[4].clone().add(new THREE.Vector3(-0.85 * scaleBoost, -1.05, -0.35 * scaleBoost))],
      [pts[5], pts[5].clone().add(new THREE.Vector3(0.45 * scaleBoost, -0.75, -0.72 * scaleBoost))],
    ];
    for (const [bStart, bEnd] of branches) {
      const bMid = new THREE.Vector3().lerpVectors(bStart, bEnd, 0.5).add(new THREE.Vector3(0.12 * scaleBoost, 0, -0.10 * scaleBoost));
      addSegmentMesh(bStart, bMid, 0.024 * scaleBoost, 0.072 * scaleBoost, '#fde047');
      addSegmentMesh(bMid, bEnd, 0.018 * scaleBoost, 0.056 * scaleBoost, '#38bdf8');
    }

    this._pushItem({ kind: 'lightning-flash', mesh: boltGroup, life: 0.46 });
    const impactFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.42 * scaleBoost, 14, 10),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
    );
    impactFlash.userData.baseOpacity = 0.96;
    impactFlash.position.copy(groundPt).setY(0.28);
    this._pushItem({ kind: 'fade-pop', mesh: impactFlash, life: 0.34, maxScale: 1.8 });

    this._spawnShockRing(groundPt.clone().setY(0.05), '#facc15', 2.4 * scaleBoost, 0.48);
    this._spawnShockRing(groundPt.clone().setY(0.08), '#38bdf8', 1.65 * scaleBoost, 0.42);
    this._spawnSparks(targetPos, '#fef08a', 18 + Math.round(scaleBoost * 5), 2.8, 5.8, 0.42, 0.055);
  }

  _spawnSparks(center, colorHex, count = 8, speedMin = 1.6, speedMax = 3.4, life = 0.34, size = 0.045, inward = false) {
    const grp = new THREE.Group();
    grp.position.copy(center);
    const velocities = [];
    for (let i = 0; i < count; i += 1) {
      const theta = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.5;
      const phi = (Math.random() - 0.35) * 1.1;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      const dir = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(phi) + (inward ? 0 : 0.25), Math.sin(theta) * Math.cos(phi)).normalize();
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(size * (0.8 + Math.random() * 0.6), 0),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? '#ffffff' : colorHex, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false })
      );
      shard.userData.baseOpacity = 0.95;
      if (inward) {
        const startR = 0.75 + Math.random() * 0.55;
        shard.position.copy(dir).multiplyScalar(startR);
        velocities.push(dir.clone().multiplyScalar(-spd));
      } else {
        velocities.push(dir.clone().multiplyScalar(spd));
      }
      grp.add(shard);
    }
    this._pushItem({ kind: 'sparks', mesh: grp, velocities, life, gravity: inward ? 0 : 5.4 });
  }

  _spawnCrescentArc(pos, yaw, bankRad, radius, width, arcLen, colorHex, sweepDir = 1, life = 0.38, coreColor = '#f8fafc') {
    const pivot = new THREE.Group();
    pivot.position.copy(pos);
    pivot.rotation.order = 'YXZ';
    pivot.rotation.y = yaw;
    pivot.rotation.z = bankRad;

    const sweepGroup = new THREE.Group();
    const outerArc = makeTaperedArcMesh(radius, width, arcLen, colorHex, 0.92);
    const coreArc = makeTaperedArcMesh(radius + width * 0.14, width * 0.34, arcLen * 0.9, coreColor, 0.88);
    coreArc.position.y = 0.01;
    sweepGroup.add(outerArc, coreArc);
    pivot.add(sweepGroup);

    this._pushItem({ kind: 'swing-slash', mesh: pivot, sweepGroup, sweepDir, life });
  }

  _spawnShockRing(pos, colorHex, maxScale = 1.6, life = 0.38, rotEuler = null, innerR = 0.26, outerR = 0.42) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(innerR, outerR, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.94, toneMapped: false, depthWrite: false })
    );
    ring.userData.baseOpacity = 0.94;
    ring.position.copy(pos);
    if (rotEuler) ring.rotation.copy(rotEuler);
    else ring.rotation.x = -Math.PI / 2;
    this._pushItem({ kind: 'ring', mesh: ring, life, maxScale });
  }

  _spawnLineBeam(fromPos, toPos, colorHex, coreHex = '#ffffff', radius = 0.08, life = 0.42, overextend = 0, ringCount = 0) {
    const d = new THREE.Vector3().subVectors(toPos, fromPos);
    const baseDist = Math.max(0.4, d.length());
    const dir = d.clone().normalize();
    const totalLen = baseDist + overextend;
    const endPos = fromPos.clone().addScaledVector(dir, totalLen);

    const grp = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.72, totalLen, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.84, toneMapped: false, depthWrite: false })
    );
    outer.userData.baseOpacity = 0.84;
    outer.rotation.x = Math.PI / 2;
    outer.position.z = totalLen * 0.5;

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.42, radius * 0.32, totalLen, 8),
      new THREE.MeshBasicMaterial({ color: coreHex, transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
    );
    core.userData.baseOpacity = 0.96;
    core.rotation.x = Math.PI / 2;
    core.position.z = totalLen * 0.5;

    grp.add(outer, core);
    grp.position.copy(fromPos);
    grp.lookAt(endPos);
    this._pushItem({ kind: 'line-beam', mesh: grp, life });

    for (let i = 0; i < ringCount; i += 1) {
      const frac = 0.16 + (i / Math.max(1, ringCount)) * 0.74;
      const rPos = fromPos.clone().addScaledVector(dir, totalLen * frac);
      const rMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.18 + i * 0.05, 0.022, 6, 22),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? coreHex : colorHex, transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false })
      );
      rMesh.userData.baseOpacity = 0.92;
      rMesh.position.copy(rPos);
      rMesh.lookAt(endPos);
      this._pushItem({ kind: 'fade-pop', mesh: rMesh, life: life * 0.95, maxScale: 1.85 });
    }
  }

  _spawnDirectionalFistShock(pos, yaw, colorHex, coreHex = '#fef08a', scale = 1.0, upward = false) {
    const grp = new THREE.Group();
    grp.position.copy(pos);
    grp.rotation.order = 'YXZ';
    grp.rotation.y = yaw;

    const ringA = new THREE.Mesh(
      new THREE.RingGeometry(0.18 * scale, 0.31 * scale, 24),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.94, toneMapped: false, depthWrite: false })
    );
    ringA.userData.baseOpacity = 0.94;
    if (upward) ringA.rotation.x = -Math.PI * 0.32;

    const ringB = new THREE.Mesh(
      new THREE.RingGeometry(0.10 * scale, 0.20 * scale, 24),
      new THREE.MeshBasicMaterial({ color: coreHex, side: THREE.DoubleSide, transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
    );
    ringB.userData.baseOpacity = 0.96;
    ringB.position.z = 0.14 * scale;
    if (upward) ringB.rotation.x = -Math.PI * 0.32;

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16 * scale, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false })
    );
    core.userData.baseOpacity = 0.95;

    grp.add(ringA, ringB, core);
    this._pushItem({ kind: 'fist-shock', mesh: grp, life: 0.34, maxScale: 1.55 * scale });
    this._spawnSparks(pos, colorHex, Math.round(7 * scale), 2.0, 4.2, 0.32, 0.042 * scale);
  }

  _spawnMentalStrikeAtTarget(originPos, targetPos, isFinisher = false, tier = 1) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(isFinisher ? 0.14 : 0.10, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#f5d0fe', transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false })
    );
    flash.userData.baseOpacity = 0.95;
    flash.position.copy(originPos);
    this._pushItem({ kind: 'fade-pop', mesh: flash, life: 0.20, maxScale: 1.8 });

    const scaleBoost = 1 + (tier - 1) * 0.22 + (isFinisher ? 0.28 : 0);
    const grp = new THREE.Group();
    grp.position.copy(targetPos);

    const darkCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 * scaleBoost, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#581c87', transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
    );
    darkCore.userData.baseOpacity = 0.96;

    const innerLight = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18 * scaleBoost, 0),
      new THREE.MeshBasicMaterial({ color: '#faf5ff', transparent: true, opacity: 0.98, toneMapped: false, depthWrite: false })
    );
    innerLight.userData.baseOpacity = 0.98;

    const ringTiltA = new THREE.Mesh(
      new THREE.TorusGeometry(0.36 * scaleBoost, 0.032 * scaleBoost, 8, 28),
      new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.94, toneMapped: false, depthWrite: false })
    );
    ringTiltA.userData.baseOpacity = 0.94;
    ringTiltA.rotation.set(Math.PI * 0.32, Math.PI * 0.18, 0);

    const ringTiltB = new THREE.Mesh(
      new THREE.TorusGeometry(0.42 * scaleBoost, 0.024 * scaleBoost, 8, 28),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })
    );
    ringTiltB.userData.baseOpacity = 0.9;
    ringTiltB.rotation.set(-Math.PI * 0.35, -Math.PI * 0.22, Math.PI * 0.15);

    grp.add(darkCore, innerLight, ringTiltA, ringTiltB);

    if (isFinisher || tier >= 2) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.14 * scaleBoost, 1.35 * scaleBoost, 8),
        new THREE.MeshBasicMaterial({ color: '#a855f7', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })
      );
      spike.userData.baseOpacity = 0.85;
      spike.position.y = 0.38 * scaleBoost;
      grp.add(spike);
    }

    this._pushItem({ kind: 'mental-implosion', mesh: grp, life: isFinisher || tier >= 3 ? 0.48 : 0.38 });
    this._spawnSparks(targetPos, '#c084fc', 8 + tier * 2, 1.8, 3.8, 0.36, 0.044);
  }

  _spawnStickTwirlAndSmite(originPos, targetPos, isFinisher = false, tier = 1) {
    const twirlRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.028, 6, 26, Math.PI * 1.6),
      new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })
    );
    twirlRing.userData.baseOpacity = 0.9;
    twirlRing.position.copy(originPos);
    twirlRing.rotation.set(Math.PI * 0.22, 0.35, 0);
    this._pushItem({ kind: 'spin-ribbon', mesh: twirlRing, life: 0.36 });

    const scaleBoost = 1 + (tier - 1) * 0.20 + (isFinisher ? 0.25 : 0);
    const groundPos = targetPos.clone().setY(0.03);
    const grp = new THREE.Group();
    grp.position.copy(groundPos);

    const beamH = 2.1 + tier * 0.35 + (isFinisher ? 0.55 : 0);
    const outerCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * scaleBoost, 0.28 * scaleBoost, beamH, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#fde047', side: THREE.DoubleSide, transparent: true, opacity: 0.78, toneMapped: false, depthWrite: false })
    );
    outerCol.userData.baseOpacity = 0.78;
    outerCol.position.y = beamH * 0.5;

    const innerCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * scaleBoost, 0.13 * scaleBoost, beamH * 1.04, 12),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false })
    );
    innerCol.userData.baseOpacity = 0.92;
    innerCol.position.y = beamH * 0.5;

    const seal = new THREE.Mesh(
      new THREE.RingGeometry(0.28 * scaleBoost, 0.44 * scaleBoost, 28),
      new THREE.MeshBasicMaterial({ color: '#fde047', side: THREE.DoubleSide, transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false })
    );
    seal.userData.baseOpacity = 0.92;
    seal.rotation.x = -Math.PI / 2;
    seal.position.y = 0.03;

    grp.add(outerCol, innerCol, seal);
    this._pushItem({ kind: 'smite-pillar', mesh: grp, life: isFinisher || tier >= 3 ? 0.52 : 0.40 });
    this._spawnSparks(targetPos, '#fde047', 6 + tier * 2, 1.4, 2.9, 0.35, 0.038);
  }

  _spawnProjectile({
    kind,
    startPos,
    targetPos,
    colorHex,
    coreHex = '#ffffff',
    scale = 1.0,
    speedMul = 1.0,
    isFinisher = false,
    gravityArc = 0.08,
    onArrive = null,
  }) {
    const group = new THREE.Group();
    if (kind === 'arrow' || kind === 'gale_arrow') {
      const isGale = kind === 'gale_arrow';
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry((isGale ? 0.020 : 0.012) * scale, (isGale ? 0.018 : 0.012) * scale, 0.76 * scale, 6),
        new THREE.MeshBasicMaterial({ color: isGale ? '#ffffff' : '#fef08a', toneMapped: false })
      );
      shaft.rotation.x = Math.PI / 2;
      const head = new THREE.Mesh(
        new THREE.ConeGeometry((isGale ? 0.068 : 0.038) * scale, (isGale ? 0.24 : 0.15) * scale, 6),
        new THREE.MeshBasicMaterial({ color: isGale || isFinisher ? '#fde047' : colorHex, toneMapped: false })
      );
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.42 * scale;
      const wake = new THREE.Mesh(
        new THREE.CylinderGeometry((isGale ? 0.11 : 0.055) * scale, 0.008, (isGale ? 1.45 : 0.95) * scale, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: isGale ? 0.88 : 0.78, toneMapped: false, depthWrite: false })
      );
      wake.rotation.x = Math.PI / 2;
      wake.position.z = -0.52 * scale;
      group.add(shaft, head, wake);

      if (isGale) {
        for (let r = 0; r < 2; r += 1) {
          const helix = new THREE.Mesh(
            new THREE.TorusGeometry((0.14 + r * 0.06) * scale, 0.016 * scale, 6, 18),
            new THREE.MeshBasicMaterial({ color: r === 0 ? '#a7f3d0' : '#fde047', toneMapped: false })
          );
          helix.position.z = 0.14 * scale - r * 0.26 * scale;
          group.add(helix);
        }
      }
    } else if (kind === 'lance') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.11 * scale, 0.92 * scale, 8),
        new THREE.MeshBasicMaterial({ color: colorHex, toneMapped: false })
      );
      cone.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(
        new THREE.ConeGeometry(0.05 * scale, 0.98 * scale, 6),
        new THREE.MeshBasicMaterial({ color: coreHex, toneMapped: false })
      );
      core.rotation.x = Math.PI / 2;
      const fin = new THREE.Mesh(
        new THREE.TorusGeometry(0.16 * scale, 0.018 * scale, 6, 18),
        new THREE.MeshBasicMaterial({ color: coreHex, toneMapped: false })
      );
      fin.position.z = -0.22 * scale;
      group.add(cone, core, fin);
    } else if (kind === 'meteor') {
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.32 * scale, 0),
        new THREE.MeshBasicMaterial({ color: colorHex, toneMapped: false })
      );
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22 * scale, 0),
        new THREE.MeshBasicMaterial({ color: coreHex, toneMapped: false })
      );
      const aura = new THREE.Mesh(
        new THREE.TorusGeometry(0.42 * scale, 0.036 * scale, 8, 22),
        new THREE.MeshBasicMaterial({ color: coreHex, toneMapped: false })
      );
      group.add(boulder, core, aura);
    } else {
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry((isFinisher ? 0.17 : 0.13) * scale, 1),
        new THREE.MeshBasicMaterial({ color: colorHex, toneMapped: false })
      );
      const inner = new THREE.Mesh(
        new THREE.SphereGeometry((isFinisher ? 0.095 : 0.075) * scale, 10, 8),
        new THREE.MeshBasicMaterial({ color: coreHex, toneMapped: false })
      );
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry((isFinisher ? 0.25 : 0.19) * scale, 0.024 * scale, 6, 22),
        new THREE.MeshBasicMaterial({ color: coreHex, toneMapped: false })
      );
      const wake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048 * scale, 0.006, 0.85 * scale, 8),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.72, toneMapped: false, depthWrite: false })
      );
      wake.rotation.x = Math.PI / 2;
      wake.position.z = -0.46 * scale;
      group.add(orb, inner, halo, wake);
    }

    group.position.copy(startPos);
    group.lookAt(targetPos);
    this.vfxGroup.add(group);

    const dist = Math.max(0.45, startPos.distanceTo(targetPos));
    const baseSpeed = (kind === 'arrow' || kind === 'gale_arrow' ? 14.2 : kind === 'lance' ? 16.5 : 11.4) * speedMul;
    this.projectiles.push({
      kind,
      mesh: group,
      startPos: startPos.clone(),
      targetPos: targetPos.clone(),
      gravityArc,
      age: 0,
      life: dist / Math.max(2.0, baseSpeed),
      colorHex,
      isFinisher,
      onArrive,
    });
  }

  /**
   * Spawns weapon-signature VFX for one step (1, 2, or 3) of the weapon's auto-attack chain.
   */
  spawnAutoVfx({ weaponStyle, step = 1, heroPos, heroYaw = 0, originPos, targetPos, staffElement = 'arcane', onImpact = null }) {
    const isFinisher = step >= 3;
    const fwdX = Math.sin(heroYaw);
    const fwdZ = Math.cos(heroYaw);
    const strikeCenter = heroPos.clone().add(new THREE.Vector3(fwdX * 0.75, 1.02 + (step - 1) * 0.08, fwdZ * 0.75));

    switch (weaponStyle) {
      case 'sword_1h':
      case 'axe_1h': {
        const col = weaponStyle === 'axe_1h' ? '#fb923c' : '#38bdf8';
        const bank = step === 1 ? -0.48 : step === 2 ? 0.48 : -1.04;
        const rad = isFinisher ? 0.90 : 0.80;
        this._spawnCrescentArc(strikeCenter, heroYaw, bank, rad, isFinisher ? 0.24 : 0.18, Math.PI * 1.32, isFinisher ? '#fde047' : col, step === 2 ? -1 : 1, 0.38);
        this._spawnSparks(targetPos, isFinisher ? '#fde047' : col, isFinisher ? 12 : 7, 1.8, 3.6, 0.32);
        if (onImpact) onImpact();
        break;
      }

      case 'sword_2h': {
        const bank = step === 1 ? -0.22 : step === 2 ? 0.24 : -1.08;
        const rad = isFinisher ? 1.12 : 0.98;
        this._spawnCrescentArc(strikeCenter, heroYaw, bank, rad, 0.26, Math.PI * 1.48, isFinisher ? '#fbbf24' : '#60a5fa', step === 2 ? -1 : 1, 0.46);
        if (isFinisher) {
          this._spawnShockRing(targetPos.clone().setY(0.06), '#fbbf24', 2.1, 0.44);
        }
        this._spawnSparks(targetPos, isFinisher ? '#fbbf24' : '#93c5fd', isFinisher ? 15 : 9, 1.8, 3.8, 0.36, 0.052);
        if (onImpact) onImpact();
        break;
      }

      case 'dual_1h': {
        if (isFinisher) {
          this._spawnCrescentArc(strikeCenter, heroYaw, 0.56, 0.84, 0.18, Math.PI * 1.28, '#22d3ee', 1, 0.40);
          this._spawnCrescentArc(strikeCenter, heroYaw, -0.56, 0.84, 0.18, Math.PI * 1.28, '#fde047', -1, 0.40);
          this._spawnSparks(targetPos, '#fde047', 14, 2.2, 4.0, 0.36);
        } else {
          const bank = step === 1 ? -0.52 : 0.52;
          this._spawnCrescentArc(strikeCenter, heroYaw, bank, 0.78, 0.16, Math.PI * 1.24, '#22d3ee', step === 1 ? 1 : -1, 0.34);
          this._spawnSparks(targetPos, '#67e8f9', 7, 1.8, 3.2, 0.28);
        }
        if (onImpact) onImpact();
        break;
      }

      case 'razor_fans': {
        const col = '#34d399';
        if (isFinisher) {
          this._spawnCrescentArc(strikeCenter.clone().add(new THREE.Vector3(0, 0.12, 0)), heroYaw, 0.0, 0.92, 0.16, Math.PI * 1.85, '#6ee7b7', 1, 0.44, '#fde047');
          this._spawnCrescentArc(strikeCenter, heroYaw, 0.58, 0.78, 0.15, Math.PI * 1.32, '#a7f3d0', 1, 0.40);
          this._spawnCrescentArc(strikeCenter, heroYaw, -0.58, 0.78, 0.15, Math.PI * 1.32, '#fde047', -1, 0.40);
          this._spawnSparks(targetPos, '#6ee7b7', 14, 2.2, 4.2, 0.36, 0.048);
        } else {
          const bank = step === 1 ? -0.54 : 0.54;
          const dir = step === 1 ? 1 : -1;
          this._spawnCrescentArc(strikeCenter, heroYaw, bank, 0.76, 0.15, Math.PI * 1.32, col, dir, 0.34, '#ffffff');
          this._spawnCrescentArc(strikeCenter, heroYaw, bank * 0.4, 0.84, 0.08, Math.PI * 1.18, '#a7f3d0', dir, 0.30, '#ffffff');
          this._spawnSparks(targetPos, '#a7f3d0', 8, 1.8, 3.4, 0.28);
        }
        if (onImpact) onImpact();
        break;
      }

      case 'bow': {
        const col = isFinisher ? '#fde047' : '#2dd4bf';
        this._spawnProjectile({
          kind: 'arrow',
          startPos: originPos,
          targetPos,
          colorHex: col,
          scale: isFinisher ? 1.25 : 1.0,
          isFinisher,
          onArrive: () => {
            this._spawnShockRing(targetPos.clone(), col, isFinisher ? 1.65 : 1.05, 0.34, new THREE.Euler(0, heroYaw, 0));
            this._spawnSparks(targetPos, col, isFinisher ? 12 : 7, 1.8, 3.4, 0.30);
            if (onImpact) onImpact();
          },
        });
        break;
      }

      case 'wand': {
        this._spawnMentalStrikeAtTarget(originPos, targetPos, isFinisher, 1);
        if (onImpact) onImpact();
        break;
      }

      case 'staff': {
        const elDef = getStaffElementDef(staffElement);
        this._spawnProjectile({
          kind: 'elemental',
          startPos: originPos,
          targetPos,
          colorHex: elDef.primaryColor,
          coreHex: elDef.coreColor,
          scale: isFinisher ? 1.28 : 1.0,
          isFinisher,
          onArrive: () => {
            this._spawnShockRing(targetPos.clone().setY(0.06), elDef.primaryColor, isFinisher ? 1.85 : 1.15, 0.38);
            this._spawnSparks(targetPos, elDef.accentColor, isFinisher ? 14 : 8, 1.8, 3.8, 0.36, 0.048);
            if (onImpact) onImpact();
          },
        });
        break;
      }

      case 'stick_2h': {
        this._spawnStickTwirlAndSmite(originPos, targetPos, isFinisher, 1);
        if (onImpact) onImpact();
        break;
      }

      case 'gauntlet': {
        const fistOffset = new THREE.Vector3(
          fwdX * 0.78 + (step === 1 ? -0.14 : step === 2 ? 0.14 : 0),
          1.06 + (isFinisher ? 0.22 : 0),
          fwdZ * 0.78
        );
        const punchPos = heroPos.clone().add(fistOffset);
        this._spawnDirectionalFistShock(
          punchPos,
          heroYaw,
          isFinisher ? '#fde047' : '#fbbf24',
          '#ffffff',
          isFinisher ? 1.45 : 1.0,
          isFinisher
        );
        if (isFinisher) {
          this._spawnShockRing(targetPos.clone().setY(0.06), '#fbbf24', 1.85, 0.42);
        }
        if (onImpact) onImpact();
        break;
      }

      default:
        if (onImpact) onImpact();
        break;
    }
  }

  /**
   * Spawns a completely distinct, glyph-specific 3D VFX matching `glyph.vfxKind` and scaling across T1..T5.
   */
  spawnGlyphVfx({ weaponStyle, glyph, tier = 1, heroPos, heroYaw = 0, originPos, targetPos, staffElement = 'arcane', onImpact = null }) {
    const t = Math.max(1, Math.min(5, Math.round(tier)));
    const scaleBoost = 1 + (t - 1) * 0.20;
    const role = glyph?.role || 'move';
    const vk = glyph?.vfxKind || '';
    const fwdX = Math.sin(heroYaw);
    const fwdZ = Math.cos(heroYaw);
    const rightX = Math.cos(heroYaw);
    const rightZ = -Math.sin(heroYaw);
    const center = heroPos.clone().add(new THREE.Vector3(fwdX * 0.90, 1.05, fwdZ * 0.90));
    const elDef = getStaffElementDef(staffElement);
    const goldColor = '#fde047';

    // ---------- GUARDS & HEALS ----------
    if (vk === 'guard_wind' || (role === 'block' && (weaponStyle === 'bow' || weaponStyle === 'razor_fans'))) {
      for (let i = 0; i < 3; i += 1) {
        this._later(i * 60, () => {
          this._spawnCrescentArc(
            heroPos.clone().add(new THREE.Vector3(0, 0.55 + i * 0.35, 0)),
            heroYaw + i * 1.1,
            0.12,
            0.78 * scaleBoost,
            0.10,
            Math.PI * 1.5,
            i === 2 ? goldColor : '#34d399',
            i % 2 === 0 ? 1 : -1,
            0.48
          );
        });
      }
      if (onImpact) onImpact();
      return;
    }
    if (vk === 'guard_psychic' || (role === 'block' && weaponStyle === 'wand')) {
      const prism = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.95 * scaleBoost, 0),
        new THREE.MeshBasicMaterial({ color: '#c084fc', wireframe: true, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })
      );
      prism.userData.baseOpacity = 0.9;
      prism.position.copy(heroPos).add(new THREE.Vector3(0, 0.95, 0));
      this._pushItem({ kind: 'spin-ribbon', mesh: prism, life: 0.58 });
      this._spawnShockRing(heroPos.clone().setY(0.06), '#a855f7', 1.55 * scaleBoost, 0.5);
      if (onImpact) onImpact();
      return;
    }
    if (vk === 'guard_holy' || (role === 'block' && (weaponStyle === 'stick_2h' || weaponStyle === 'gauntlet'))) {
      this._spawnShockRing(heroPos.clone().setY(0.06), goldColor, 1.65 * scaleBoost, 0.55);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.78 * scaleBoost, 0.04, 8, 28),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.94, toneMapped: false, depthWrite: false })
      );
      halo.userData.baseOpacity = 0.94;
      halo.rotation.x = Math.PI / 2;
      halo.position.copy(heroPos).add(new THREE.Vector3(0, 1.65, 0));
      this._pushItem({ kind: 'ring', mesh: halo, life: 0.55, maxScale: 1.35 });
      if (onImpact) onImpact();
      return;
    }
    if (role === 'block') {
      for (let i = 0; i < Math.min(3, t); i += 1) {
        this._spawnShockRing(heroPos.clone().add(new THREE.Vector3(0, 0.1 + i * 0.45, 0)), '#38bdf8', 1.2 + i * 0.35, 0.55);
      }
      if (onImpact) onImpact();
      return;
    }
    if (role === 'heal' || role === 'buff' || vk === 'valor_pillar') {
      const col = vk === 'heal_holy' || role === 'buff' || vk === 'valor_pillar' ? goldColor : '#34d399';
      const gPos = heroPos.clone().setY(0.04);
      this._spawnShockRing(gPos, col, 1.6 * scaleBoost, 0.65);
      const colMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42 * scaleBoost, 0.58 * scaleBoost, 2.4 + t * 0.3, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.46, toneMapped: false, depthWrite: false })
      );
      colMesh.userData.baseOpacity = 0.46;
      colMesh.position.copy(gPos).setY((2.4 + t * 0.3) * 0.5);
      this._pushItem({ kind: 'smite-pillar', mesh: colMesh, life: 0.72 });
      this._spawnSparks(heroPos.clone().add(new THREE.Vector3(0, 1.1, 0)), col, 10 + t * 3, 1.2, 2.5, 0.58, 0.045);
      if (onImpact) onImpact();
      return;
    }

    // ---------- SCOUT BOW GLYPHS ----------
    if (vk === 'bow_powershot') {
      this._spawnProjectile({
        kind: 'gale_arrow',
        startPos: originPos,
        targetPos,
        colorHex: '#34d399',
        scale: 1.45 * scaleBoost,
        speedMul: 1.15,
        isFinisher: true,
        gravityArc: 0.02,
        onArrive: () => {
          this._spawnShockRing(targetPos.clone(), goldColor, 2.2 * scaleBoost, 0.44, new THREE.Euler(0, heroYaw, 0));
          for (let r = 0; r < 2 + Math.min(2, t); r += 1) {
            const windRing = new THREE.Mesh(
              new THREE.TorusGeometry((0.35 + r * 0.20) * scaleBoost, 0.03, 6, 26),
              new THREE.MeshBasicMaterial({ color: r % 2 === 0 ? '#34d399' : goldColor, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })
            );
            windRing.userData.baseOpacity = 0.9;
            windRing.position.copy(targetPos).add(new THREE.Vector3(0, -0.35 + r * 0.38, 0));
            windRing.rotation.x = Math.PI / 2;
            this._pushItem({ kind: 'spin-ribbon', mesh: windRing, life: 0.5 });
          }
          this._spawnSparks(targetPos, '#a7f3d0', 14 + t * 3, 2.4, 4.6, 0.40, 0.055);
          if (onImpact) onImpact();
        },
      });
      return;
    }

    if (vk === 'bow_volley') {
      const groundTarget = targetPos.clone().setY(0.05);
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.85 * scaleBoost, 1.05 * scaleBoost, 32),
        new THREE.MeshBasicMaterial({ color: '#2dd4bf', side: THREE.DoubleSide, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })
      );
      reticle.userData.baseOpacity = 0.85;
      reticle.rotation.x = -Math.PI / 2;
      reticle.position.copy(groundTarget);
      this._pushItem({ kind: 'fade-pop', mesh: reticle, life: 0.88, maxScale: 1.15 });

      const launchCount = 3;
      for (let i = 0; i < launchCount; i += 1) {
        const apex = originPos.clone().lerp(targetPos, 0.45).add(new THREE.Vector3((i - 1) * 0.35, 3.6, 0));
        this._spawnProjectile({ kind: 'arrow', startPos: originPos, targetPos: apex, colorHex: '#2dd4bf', scale: 1.0, speedMul: 1.15, gravityArc: 0.12 });
      }

      const rainCount = 6 + t * 2;
      for (let i = 0; i < rainCount; i += 1) {
        const ang = (i / rainCount) * Math.PI * 2 + Math.random() * 0.5;
        const rad = (0.12 + Math.random() * 0.95) * scaleBoost;
        const land = groundTarget.clone().add(new THREE.Vector3(Math.cos(ang) * rad, 0.08, Math.sin(ang) * rad));
        const skyStart = land.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 4.2 + Math.random() * 0.8, 0.25));
        this._later(160 + i * 42, () => {
          this._spawnProjectile({
            kind: 'arrow',
            startPos: skyStart,
            targetPos: land,
            colorHex: i % 2 === 0 ? '#2dd4bf' : goldColor,
            scale: 1.05,
            speedMul: 1.3,
            gravityArc: 0.0,
            onArrive: () => {
              this._spawnShockRing(land.clone().setY(0.04), i % 2 === 0 ? '#2dd4bf' : goldColor, 0.85, 0.30);
              this._spawnSparks(land, '#a7f3d0', 5, 1.4, 2.8, 0.26, 0.036);
              if (i === rainCount - 1 && onImpact) onImpact();
            },
          });
        });
      }
      return;
    }

    if (vk === 'bow_railshot') {
      this._spawnShockRing(originPos.clone(), '#ffffff', 0.95, 0.32, new THREE.Euler(0, heroYaw, 0));
      this._spawnLineBeam(originPos, targetPos, '#2dd4bf', '#ffffff', 0.085 * scaleBoost, 0.52, 2.2, 3 + Math.min(3, t));
      this._spawnSparks(targetPos, goldColor, 16 + t * 3, 2.6, 5.2, 0.40, 0.055);
      if (onImpact) onImpact();
      return;
    }

    // ---------- SCOUT RAZOR FANS GLYPHS ----------
    if (vk === 'fan_flurry') {
      const cuts = 4 + (t >= 4 ? 2 : 0);
      const banks = [-0.95, 0.95, -0.35, 1.15, -0.70, 0.70];
      for (let i = 0; i < cuts; i += 1) {
        const off = new THREE.Vector3(rightX * (i % 2 === 0 ? -0.18 : 0.18), (i - cuts * 0.4) * 0.14, rightZ * (i % 2 === 0 ? -0.18 : 0.18));
        this._later(i * 68, () => {
          this._spawnCrescentArc(
            targetPos.clone().add(off),
            heroYaw,
            banks[i % banks.length],
            0.86 * scaleBoost,
            0.14,
            Math.PI * 1.28,
            i === cuts - 1 ? goldColor : (i % 2 === 0 ? '#34d399' : '#e2e8f0'),
            i % 2 === 0 ? 1 : -1,
            0.34,
            '#ffffff'
          );
          this._spawnSparks(targetPos.clone().add(off), '#a7f3d0', 6, 1.8, 3.6, 0.28);
          if (i === cuts - 1 && onImpact) onImpact();
        });
      }
      return;
    }

    if (vk === 'fan_cyclone') {
      const funnelBase = heroPos.clone().lerp(targetPos, 0.65).setY(0.05);
      const ringLevels = 4 + t;
      for (let i = 0; i < ringLevels; i += 1) {
        const y = 0.20 + i * 0.32;
        const rad = (0.45 + i * 0.14) * scaleBoost;
        const arc = makeTaperedArcMesh(rad, 0.11, Math.PI * 1.65, i % 2 === 0 ? '#34d399' : '#6ee7b7', 0.88);
        arc.position.copy(funnelBase).setY(y);
        arc.rotation.y = i * 0.9;
        this._pushItem({ kind: 'cyclone-ring', mesh: arc, spinSpeed: 10 + i * 1.6, riseSpeed: 0.55, life: 0.66 });
      }
      this._spawnSparks(funnelBase.clone().setY(1.0), '#a7f3d0', 14 + t * 3, 2.0, 4.2, 0.55, 0.048);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'fan_snap') {
      const grp = new THREE.Group();
      grp.position.copy(targetPos);
      grp.rotation.y = heroYaw;
      for (const tilt of [Math.PI * 0.25, -Math.PI * 0.25]) {
        const blade = new THREE.Mesh(
          new THREE.PlaneGeometry(1.85 * scaleBoost, 0.22 * scaleBoost),
          new THREE.MeshBasicMaterial({ color: goldColor, side: THREE.DoubleSide, transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
        );
        blade.userData.baseOpacity = 0.96;
        blade.rotation.z = tilt;
        const edge = new THREE.Mesh(
          new THREE.PlaneGeometry(1.92 * scaleBoost, 0.08 * scaleBoost),
          new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.98, toneMapped: false, depthWrite: false })
        );
        edge.userData.baseOpacity = 0.98;
        edge.rotation.z = tilt;
        grp.add(blade, edge);
      }
      this._pushItem({ kind: 'fade-pop', mesh: grp, life: 0.48, maxScale: 1.55 });
      this._spawnShockRing(targetPos.clone().setY(0.06), '#34d399', 2.2 * scaleBoost, 0.50);
      this._spawnSparks(targetPos, goldColor, 16 + t * 3, 2.4, 4.8, 0.42, 0.055);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'fan_lunge') {
      const startL = heroPos.clone().add(new THREE.Vector3(-rightX * 0.34, 1.02, -rightZ * 0.34));
      const startR = heroPos.clone().add(new THREE.Vector3(rightX * 0.34, 1.02, rightZ * 0.34));
      const endPt = targetPos.clone().setY(Math.max(0.88, targetPos.y + 0.15)).add(new THREE.Vector3(fwdX * 0.28, 0, fwdZ * 0.28));
      const mid = heroPos.clone().lerp(endPt, 0.52).setY(1.00);
      const ctrlL = mid.clone().add(new THREE.Vector3(-rightX * 1.15 * scaleBoost, 0.08, -rightZ * 1.15 * scaleBoost));
      const ctrlR = mid.clone().add(new THREE.Vector3(rightX * 1.15 * scaleBoost, 0.08, rightZ * 1.15 * scaleBoost));
      const flightSec = 0.38;

      const fanL = this._makePhantomRazorFanMesh('#34d399', '#ffffff', 1.12 * scaleBoost);
      fanL.position.copy(startL);
      const fanR = this._makePhantomRazorFanMesh('#6ee7b7', goldColor, 1.12 * scaleBoost);
      fanR.position.copy(startR);

      let impacted = false;
      const fireConvergeCut = () => {
        if (impacted) return;
        impacted = true;
        const cutPos = targetPos.clone().setY(Math.max(0.90, targetPos.y + 0.15));
        this._spawnCrescentArc(cutPos, heroYaw, -0.35, 1.08 * scaleBoost, 0.18, Math.PI * 1.42, '#34d399', 1, 0.38, '#ffffff');
        this._spawnCrescentArc(cutPos, heroYaw, 0.35, 1.08 * scaleBoost, 0.18, Math.PI * 1.42, goldColor, -1, 0.38, '#ffffff');
        const xSnap = new THREE.Group();
        xSnap.position.copy(cutPos);
        xSnap.rotation.y = heroYaw;
        for (const tilt of [Math.PI * 0.24, -Math.PI * 0.24]) {
          const line = new THREE.Mesh(
            new THREE.PlaneGeometry(1.55 * scaleBoost, 0.14 * scaleBoost),
            new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
          );
          line.userData.baseOpacity = 0.96;
          line.rotation.z = tilt;
          xSnap.add(line);
        }
        this._pushItem({ kind: 'fade-pop', mesh: xSnap, life: 0.32, maxScale: 1.4 });
        this._spawnShockRing(targetPos.clone().setY(0.06), '#34d399', 2.0 * scaleBoost, 0.44);
        this._spawnSparks(cutPos, '#a7f3d0', 14 + t * 2, 2.4, 4.8, 0.38, 0.05);
        if (onImpact) onImpact();
      };

      this._pushItem({ kind: 'fan-boomerang', mesh: fanL, startPos: startL, ctrlPos: ctrlL, endPos: endPt, spinDir: 1, bankTilt: 0.22, life: flightSec, onArrive: fireConvergeCut });
      this._pushItem({ kind: 'fan-boomerang', mesh: fanR, startPos: startR, ctrlPos: ctrlR, endPos: endPt, spinDir: -1, bankTilt: -0.22, life: flightSec });
      this._later(140, () => {
        this._spawnSparks(ctrlL.clone().setY(1.0), '#6ee7b7', 6, 1.4, 2.8, 0.28, 0.04);
        this._spawnSparks(ctrlR.clone().setY(1.0), '#6ee7b7', 6, 1.4, 2.8, 0.28, 0.04);
      });
      return;
    }

    // ---------- SQUIRE GLYPHS ----------
    if (vk === 'sword_cleave') {
      const col = weaponStyle === 'axe_1h' ? '#fb923c' : '#38bdf8';
      this._spawnCrescentArc(center, heroYaw, -0.18, 0.98 * scaleBoost, 0.24, Math.PI * 1.42, col, 1, 0.44);
      this._spawnCrescentArc(center.clone().add(new THREE.Vector3(0, 0.14, 0)), heroYaw, 0.14, 0.88 * scaleBoost, 0.14, Math.PI * 1.25, goldColor, -1, 0.38);
      this._spawnShockRing(targetPos.clone().setY(0.06), col, 1.75 * scaleBoost, 0.44);
      this._spawnSparks(targetPos, col, 12 + t * 2, 2.0, 4.0, 0.38);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'shield_slam') {
      const bashPos = heroPos.clone().add(new THREE.Vector3(fwdX * 0.95, 1.0, fwdZ * 0.95));
      const hex = new THREE.Mesh(
        new THREE.CircleGeometry(0.62 * scaleBoost, 6),
        new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide, transparent: true, opacity: 0.72, toneMapped: false, depthWrite: false })
      );
      hex.userData.baseOpacity = 0.72;
      hex.position.copy(bashPos);
      hex.rotation.y = heroYaw;
      this._pushItem({ kind: 'fade-pop', mesh: hex, life: 0.38, maxScale: 1.55 });
      this._spawnShockRing(bashPos, goldColor, 1.85 * scaleBoost, 0.40, new THREE.Euler(0, heroYaw, 0));
      this._spawnShockRing(targetPos.clone().setY(targetPos.y + 0.7), goldColor, 1.2 * scaleBoost, 0.46);
      this._spawnSparks(targetPos, '#7dd3fc', 12 + t * 2, 1.8, 3.8, 0.36);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'sword_flurry') {
      const col = weaponStyle === 'axe_1h' ? '#fb923c' : '#38bdf8';
      this._spawnCrescentArc(center, heroYaw, -0.42, 0.88 * scaleBoost, 0.17, Math.PI * 1.32, col, 1, 0.32);
      this._spawnSparks(targetPos, col, 7, 1.8, 3.4, 0.28);

      this._later(230, () => {
        const checkPos = heroPos.clone().add(new THREE.Vector3(fwdX * 0.85, 1.0, fwdZ * 0.85));
        const hex = new THREE.Mesh(
          new THREE.CircleGeometry(0.42 * scaleBoost, 6),
          new THREE.MeshBasicMaterial({ color: '#facc15', side: THREE.DoubleSide, transparent: true, opacity: 0.84, toneMapped: false, depthWrite: false })
        );
        hex.userData.baseOpacity = 0.84;
        hex.position.copy(checkPos);
        hex.rotation.y = heroYaw;
        this._pushItem({ kind: 'fade-pop', mesh: hex, life: 0.26, maxScale: 1.4 });
        this._spawnShockRing(checkPos, goldColor, 1.35 * scaleBoost, 0.28, new THREE.Euler(0, heroYaw, 0));
        this._spawnSparks(checkPos, goldColor, 8, 1.6, 3.4, 0.26);
      });

      this._later(440, () => {
        this._spawnCrescentArc(center.clone().add(new THREE.Vector3(0, 0.10, 0)), heroYaw, 0.46, 0.90 * scaleBoost, 0.18, Math.PI * 1.36, col, -1, 0.32, '#ffffff');
        this._spawnSparks(targetPos, '#ffffff', 8, 1.8, 3.8, 0.28);
      });

      this._later(630, () => {
        this._spawnCrescentArc(center, heroYaw, -0.24, 1.08 * scaleBoost, 0.24, Math.PI * 1.52, col, 1, 0.42, goldColor);
        this._spawnShockRing(targetPos.clone().setY(0.06), goldColor, 1.9 * scaleBoost, 0.44);
        this._spawnSparks(targetPos, goldColor, 14 + t * 2, 2.2, 4.6, 0.38, 0.052);
        if (onImpact) onImpact();
      });
      return;
    }

    if (vk === 'sword_riposte' || vk === 'pierce_lance') {
      const col = vk === 'pierce_lance' ? '#60a5fa' : '#38bdf8';
      this._spawnLineBeam(center, targetPos, col, goldColor, 0.11 * scaleBoost, 0.44, 1.3, 3 + Math.min(2, t));
      this._spawnSparks(targetPos, goldColor, 12 + t * 3, 2.2, 4.5, 0.38);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'greatsword_cleave') {
      this._spawnCrescentArc(center, heroYaw, -0.25, 1.18 * scaleBoost, 0.30, Math.PI * 1.58, '#60a5fa', 1, 0.50, goldColor);
      this._spawnShockRing(targetPos.clone().setY(0.06), goldColor, 2.2 * scaleBoost, 0.50);
      this._spawnSparks(targetPos, goldColor, 16 + t * 3, 2.2, 4.6, 0.42, 0.055);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'greatsword_slam') {
      const gPos = targetPos.clone().setY(0.04);
      this._spawnShockRing(gPos, '#fbbf24', 2.4 * scaleBoost, 0.56);
      this._spawnShockRing(gPos.clone().setY(0.06), '#60a5fa', 1.65 * scaleBoost, 0.48);
      const spikeCount = 6 + t * 2;
      for (let i = 0; i < spikeCount; i += 1) {
        const ang = (i / spikeCount) * Math.PI * 2;
        const dist = (0.65 + (i % 2) * 0.35) * scaleBoost;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.14 * scaleBoost, (0.85 + (i % 3) * 0.35) * scaleBoost, 5),
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? '#60a5fa' : '#fbbf24', transparent: true, opacity: 0.90, toneMapped: false, depthWrite: false })
        );
        spike.userData.baseOpacity = 0.90;
        spike.position.copy(gPos).add(new THREE.Vector3(Math.cos(ang) * dist, 0.42 * scaleBoost, Math.sin(ang) * dist));
        spike.rotation.z = (Math.random() - 0.5) * 0.3;
        this._pushItem({ kind: 'fade-pop', mesh: spike, life: 0.52, maxScale: 1.25 });
      }
      this._spawnSparks(targetPos, '#fbbf24', 18 + t * 3, 2.4, 5.2, 0.44, 0.055);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'whirlwind_ring') {
      const col = weaponStyle === 'dual_1h' ? '#22d3ee' : '#60a5fa';
      for (let i = 0; i < 3; i += 1) {
        this._later(i * 90, () => {
          this._spawnCrescentArc(
            heroPos.clone().add(new THREE.Vector3(0, 0.65 + i * 0.25, 0)),
            heroYaw + i * 2.1,
            0.08 * (i % 2 === 0 ? 1 : -1),
            (1.10 + i * 0.15) * scaleBoost,
            0.22,
            Math.PI * 1.9,
            i === 2 ? goldColor : col,
            1,
            0.44
          );
        });
      }
      this._spawnShockRing(heroPos.clone().setY(0.06), goldColor, 2.2 * scaleBoost, 0.54);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'dual_flurry') {
      const strikes = 4 + (t >= 3 ? 2 : 0);
      for (let i = 0; i < strikes; i += 1) {
        this._later(i * 65, () => {
          this._spawnCrescentArc(
            center.clone().add(new THREE.Vector3(0, (i % 2 === 0 ? -0.1 : 0.15), 0)),
            heroYaw,
            (i % 2 === 0 ? -0.82 : 0.82),
            0.82 * scaleBoost,
            0.15,
            Math.PI * 1.26,
            i === strikes - 1 ? goldColor : '#22d3ee',
            i % 2 === 0 ? 1 : -1,
            0.34
          );
          this._spawnSparks(targetPos, '#67e8f9', 6, 1.8, 3.6, 0.28);
          if (i === strikes - 1 && onImpact) onImpact();
        });
      }
      return;
    }

    if (vk === 'dual_execute') {
      const xGrp = new THREE.Group();
      xGrp.position.copy(targetPos);
      xGrp.rotation.y = heroYaw;
      for (const tilt of [Math.PI * 0.24, -Math.PI * 0.24]) {
        const slab = new THREE.Mesh(
          new THREE.PlaneGeometry(1.95 * scaleBoost, 0.24 * scaleBoost),
          new THREE.MeshBasicMaterial({ color: '#f43f5e', side: THREE.DoubleSide, transparent: true, opacity: 0.94, toneMapped: false, depthWrite: false })
        );
        slab.userData.baseOpacity = 0.94;
        slab.rotation.z = tilt;
        xGrp.add(slab);
      }
      this._pushItem({ kind: 'fade-pop', mesh: xGrp, life: 0.50, maxScale: 1.6 });
      this._spawnShockRing(targetPos.clone().setY(0.06), '#f43f5e', 2.2 * scaleBoost, 0.50);
      this._spawnSparks(targetPos, goldColor, 18 + t * 3, 2.4, 5.0, 0.44, 0.055);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'dual_riposte') {
      const parryPos = heroPos.clone().add(new THREE.Vector3(fwdX * 0.55, 1.05, fwdZ * 0.55));
      const parryX = new THREE.Group();
      parryX.position.copy(parryPos);
      parryX.rotation.y = heroYaw;
      for (const [idx, tilt] of [0.64, -0.64].entries()) {
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(0.95 * scaleBoost, 0.11 * scaleBoost),
          new THREE.MeshBasicMaterial({ color: idx === 0 ? goldColor : '#f43f5e', side: THREE.DoubleSide, transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
        );
        bar.userData.baseOpacity = 0.96;
        bar.rotation.z = tilt;
        parryX.add(bar);
      }
      this._pushItem({ kind: 'fade-pop', mesh: parryX, life: 0.24, maxScale: 1.3 });
      this._spawnShockRing(parryPos, goldColor, 1.15 * scaleBoost, 0.24, new THREE.Euler(0, heroYaw, 0));
      this._spawnSparks(parryPos, goldColor, 8, 1.8, 3.6, 0.24, 0.045);

      this._later(90, () => {
        this._spawnCrescentArc(center, heroYaw, -0.45, 1.12 * scaleBoost, 0.22, Math.PI * 1.48, '#f43f5e', 1, 0.42, '#ffffff');
        this._spawnCrescentArc(center.clone().add(new THREE.Vector3(0, 0.10, 0)), heroYaw, 0.45, 1.12 * scaleBoost, 0.22, Math.PI * 1.48, '#22d3ee', -1, 0.42, '#ffffff');
        this._spawnShockRing(targetPos.clone().setY(0.06), '#f43f5e', 2.0 * scaleBoost, 0.48);
        this._spawnSparks(targetPos, '#f43f5e', 14 + t * 3, 2.4, 5.0, 0.42, 0.055);
        this._spawnSparks(targetPos, goldColor, 8 + t * 2, 2.0, 4.2, 0.36, 0.045);
        if (onImpact) onImpact();
      });
      return;
    }

    // ---------- ARCANIST 2H STAFF GLYPHS (Fire / Lightning / Water / Air) ----------
    if (vk === 'staff_fire_meteor' || vk === 'staff_supernova') {
      const firePrimary = '#f97316';
      const fireCore = '#fde047';
      const fireAccent = '#fb7185';
      const skyOrigin = targetPos.clone().add(new THREE.Vector3(0.4, 4.8, 0.3));
      this._spawnProjectile({
        kind: 'meteor',
        startPos: skyOrigin,
        targetPos: targetPos.clone().setY(0.15),
        colorHex: firePrimary,
        coreHex: fireCore,
        scale: 1.42 * scaleBoost,
        speedMul: 0.96,
        gravityArc: 0,
        onArrive: () => {
          const gPos = targetPos.clone().setY(0.05);
          this._spawnShockRing(gPos, firePrimary, 2.85 * scaleBoost, 0.62);
          this._spawnShockRing(gPos.clone().setY(0.08), fireCore, 1.95 * scaleBoost, 0.54);
          const colMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32 * scaleBoost, 0.62 * scaleBoost, 3.2 * scaleBoost, 16, 1, true),
            new THREE.MeshBasicMaterial({ color: fireAccent, side: THREE.DoubleSide, transparent: true, opacity: 0.74, toneMapped: false, depthWrite: false })
          );
          colMesh.userData.baseOpacity = 0.74;
          colMesh.position.copy(gPos).setY(1.6 * scaleBoost);
          this._pushItem({ kind: 'smite-pillar', mesh: colMesh, life: 0.58 });
          this._spawnSparks(targetPos, fireCore, 20 + t * 4, 2.8, 5.8, 0.50, 0.06);
          if (onImpact) onImpact();
        },
      });
      return;
    }

    if (vk === 'staff_lightning') {
      this._spawnLightningStrike(targetPos, scaleBoost);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'staff_water') {
      const gPos = targetPos.clone().setY(0.05);
      const waterH = 3.1 * scaleBoost;
      const geyser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.64 * scaleBoost, 0.24 * scaleBoost, waterH, 18, 1, true),
        new THREE.MeshBasicMaterial({ color: '#0ea5e9', side: THREE.DoubleSide, transparent: true, opacity: 0.66, toneMapped: false, depthWrite: false })
      );
      geyser.userData.baseOpacity = 0.66;
      geyser.position.copy(gPos).setY(waterH * 0.5);
      this._pushItem({ kind: 'smite-pillar', mesh: geyser, life: 0.62 });

      for (let i = 0; i < 3; i += 1) {
        this._later(i * 65, () => {
          const crest = makeTaperedArcMesh((0.50 + i * 0.22) * scaleBoost, 0.14, Math.PI * 1.5, i === 1 ? '#e0f2fe' : '#38bdf8', 0.90);
          crest.position.copy(gPos).setY(0.35 + i * 0.65);
          crest.rotation.y = i * 1.3;
          this._pushItem({ kind: 'cyclone-ring', mesh: crest, spinSpeed: 9 + i * 2, riseSpeed: 0.75, life: 0.56 });
        });
      }
      for (let r = 0; r < 3; r += 1) {
        this._later(r * 90, () => {
          this._spawnShockRing(gPos.clone().setY(0.05 + r * 0.03), r === 1 ? '#e0f2fe' : '#0ea5e9', (1.7 + r * 0.55) * scaleBoost, 0.52);
        });
      }
      this._spawnSparks(targetPos.clone().add(new THREE.Vector3(0, 0.7, 0)), '#38bdf8', 18 + t * 3, 2.6, 5.2, 0.48, 0.05);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'staff_air') {
      const gPos = targetPos.clone().setY(0.05);
      const angles = [-0.55, 0.55, -0.25, 0.85];
      for (let i = 0; i < 4; i += 1) {
        this._later(i * 55, () => {
          this._spawnCrescentArc(
            targetPos.clone().add(new THREE.Vector3(0, 0.45 + i * 0.28, 0)),
            heroYaw + i * 1.15,
            angles[i],
            (0.95 + i * 0.12) * scaleBoost,
            0.11,
            Math.PI * 1.48,
            i % 2 === 0 ? '#67e8f9' : '#34d399',
            i % 2 === 0 ? 1 : -1,
            0.40,
            '#ffffff'
          );
        });
      }
      for (let r = 0; r < 3; r += 1) {
        const ringArc = makeTaperedArcMesh((0.68 + r * 0.22) * scaleBoost, 0.08, Math.PI * 1.72, r % 2 === 0 ? '#e0f2fe' : '#34d399', 0.88);
        ringArc.position.copy(gPos).setY(0.32 + r * 0.42);
        ringArc.rotation.y = r * 1.4;
        this._pushItem({ kind: 'cyclone-ring', mesh: ringArc, spinSpeed: 16, riseSpeed: 0.85, life: 0.58 });
      }
      this._spawnShockRing(gPos, '#67e8f9', 2.0 * scaleBoost, 0.48);
      this._spawnSparks(targetPos, '#e0f2fe', 16 + t * 3, 2.6, 5.4, 0.44, 0.048);
      if (onImpact) onImpact();
      return;
    }

    // ---------- ARCANIST 1H WAND GLYPHS ----------
    if (vk === 'wand_shackle') {
      const chainCount = 3 + Math.min(2, t);
      for (let i = 0; i < chainCount; i += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry((0.68 - i * 0.06) * scaleBoost, 0.032, 8, 28),
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? '#a855f7' : '#f5d0fe', transparent: true, opacity: 0.94, toneMapped: false, depthWrite: false })
        );
        ring.userData.baseOpacity = 0.94;
        ring.position.copy(targetPos).add(new THREE.Vector3(0, (i - chainCount * 0.4) * 0.25, 0));
        ring.rotation.set(Math.PI * 0.42 + i * 0.55, i * 0.85, i * 0.4);
        this._pushItem({ kind: 'constrict', mesh: ring, life: 0.58 });
      }
      this._spawnSparks(targetPos, '#c084fc', 10 + t * 2, 1.4, 3.0, 0.36);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'wand_collapse') {
      const voidOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.40 * scaleBoost, 16, 12),
        new THREE.MeshBasicMaterial({ color: '#1e1b4b', transparent: true, opacity: 0.98, toneMapped: false, depthWrite: false })
      );
      voidOrb.userData.baseOpacity = 0.98;
      voidOrb.position.copy(targetPos);
      this._pushItem({ kind: 'mental-implosion', mesh: voidOrb, life: 0.56 });
      this._spawnSparks(targetPos, '#c084fc', 18 + t * 4, 1.8, 3.2, 0.48, 0.05, true);
      this._later(240, () => this._spawnShockRing(targetPos.clone(), '#f0abfc', 2.4 * scaleBoost, 0.42));
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'wand_barrier') {
      const hexCage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.85 * scaleBoost, 0),
        new THREE.MeshBasicMaterial({ color: '#c084fc', wireframe: true, transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false })
      );
      hexCage.userData.baseOpacity = 0.96;
      hexCage.position.copy(targetPos);
      this._pushItem({ kind: 'spin-ribbon', mesh: hexCage, life: 0.54 });
      this._spawnShockRing(targetPos.clone().setY(0.06), '#f5d0fe', 1.8 * scaleBoost, 0.48);
      this._spawnSparks(targetPos, '#f5d0fe', 12 + t * 2, 2.0, 4.0, 0.38);
      if (onImpact) onImpact();
      return;
    }

    if (weaponStyle === 'wand' || vk === 'wand_mental') {
      this._spawnMentalStrikeAtTarget(originPos, targetPos, true, t);
      if (t >= 3) {
        this._later(140, () => this._spawnMentalStrikeAtTarget(originPos, targetPos.clone().add(new THREE.Vector3(0.25, 0.25, 0)), true, t));
      }
      if (onImpact) onImpact();
      return;
    }

    // ---------- ACOLYTE 2H STICK GLYPHS ----------
    if (vk === 'stick_wave') {
      this._spawnCrescentArc(center.clone().setY(0.22), heroYaw, 0.0, 1.15 * scaleBoost, 0.26, Math.PI * 1.45, goldColor, 1, 0.48, '#ffffff');
      this._spawnShockRing(targetPos.clone().setY(0.05), '#67e8f9', 2.2 * scaleBoost, 0.48);
      this._spawnSparks(targetPos, goldColor, 12 + t * 3, 2.0, 4.2, 0.40);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'stick_hymn') {
      const pillarCount = 3 + Math.min(3, t);
      const gPos = targetPos.clone().setY(0.04);
      for (let i = 0; i < pillarCount; i += 1) {
        const ang = (i / pillarCount) * Math.PI * 2;
        const rad = 0.85 * scaleBoost;
        const colMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08 * scaleBoost, 0.14 * scaleBoost, 2.2 + t * 0.25, 10, 1, true),
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? goldColor : '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.84, toneMapped: false, depthWrite: false })
        );
        colMesh.userData.baseOpacity = 0.84;
        colMesh.position.copy(gPos).add(new THREE.Vector3(Math.cos(ang) * rad, (2.2 + t * 0.25) * 0.5, Math.sin(ang) * rad));
        this._pushItem({ kind: 'smite-pillar', mesh: colMesh, life: 0.62 });
      }
      this._spawnShockRing(gPos, goldColor, 2.0 * scaleBoost, 0.56);
      this._spawnSparks(targetPos, goldColor, 14 + t * 3, 1.4, 3.0, 0.50);
      if (onImpact) onImpact();
      return;
    }

    if (weaponStyle === 'stick_2h' || vk === 'stick_smite') {
      this._spawnStickTwirlAndSmite(originPos, targetPos, true, t);
      if (t >= 3) {
        this._spawnShockRing(targetPos.clone().setY(0.05), goldColor, 2.2 * scaleBoost, 0.55);
      }
      if (t >= 4) {
        const crown = new THREE.Mesh(
          new THREE.TorusGeometry(0.95, 0.05, 8, 32),
          new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false })
        );
        crown.userData.baseOpacity = 0.92;
        crown.rotation.x = Math.PI / 2;
        crown.position.copy(targetPos).setY(2.6);
        this._pushItem({ kind: 'ring', mesh: crown, life: 0.55, maxScale: 1.5 });
      }
      if (onImpact) onImpact();
      return;
    }

    // ---------- ACOLYTE GAUNTLET GLYPHS ----------
    if (vk === 'gauntlet_combo') {
      const offsets = [-0.28, 0.28, 0.0];
      offsets.forEach((offX, idx) => {
        this._later(idx * 105, () => {
          const punchPos = center.clone().add(new THREE.Vector3(rightX * offX, idx === 2 ? 0.32 : 0.05, rightZ * offX));
          this._spawnDirectionalFistShock(punchPos, heroYaw, idx === 2 ? goldColor : '#fbbf24', '#ffffff', (idx === 2 ? 1.55 : 1.05) * scaleBoost, idx === 2);
          if (idx === offsets.length - 1 && onImpact) onImpact();
        });
      });
      return;
    }

    if (vk === 'gauntlet_slam') {
      const gPos = targetPos.clone().setY(0.05);
      this._spawnShockRing(gPos, '#fbbf24', 2.8 * scaleBoost, 0.58);
      this._spawnShockRing(gPos.clone().setY(0.08), goldColor, 2.0 * scaleBoost, 0.50);
      const chiCol = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32 * scaleBoost, 0.62 * scaleBoost, 3.0 * scaleBoost, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: goldColor, side: THREE.DoubleSide, transparent: true, opacity: 0.72, toneMapped: false, depthWrite: false })
      );
      chiCol.userData.baseOpacity = 0.72;
      chiCol.position.copy(gPos).setY(1.5 * scaleBoost);
      this._pushItem({ kind: 'smite-pillar', mesh: chiCol, life: 0.54 });
      this._spawnSparks(targetPos, '#fef08a', 20 + t * 4, 2.6, 5.6, 0.46, 0.06);
      if (onImpact) onImpact();
      return;
    }

    if (vk === 'gauntlet_lunge') {
      this._spawnLineBeam(center, targetPos, '#fbbf24', '#ffffff', 0.14 * scaleBoost, 0.44, 1.2, 4 + Math.min(2, t));
      this._spawnSparks(targetPos, goldColor, 14 + t * 3, 2.4, 4.8, 0.38);
      if (onImpact) onImpact();
      return;
    }

    if (weaponStyle === 'gauntlet' || vk === 'gauntlet_burst') {
      const waves = Math.min(3, Math.ceil(t / 2) + 1);
      for (let w = 0; w < waves; w += 1) {
        this._later(w * 95, () => {
          this._spawnDirectionalFistShock(center, heroYaw, w === waves - 1 ? goldColor : '#fbbf24', '#ffffff', (1.1 + w * 0.25) * scaleBoost, w === waves - 1);
        });
      }
      this._spawnShockRing(targetPos.clone().setY(0.06), '#fbbf24', 2.0 * scaleBoost, 0.48);
      if (onImpact) onImpact();
      return;
    }

    // Fallback generic slash
    this._spawnCrescentArc(center, heroYaw, -0.45, 0.86 * scaleBoost, 0.18, Math.PI * 1.25, '#38bdf8', 1, 0.40);
    this._spawnSparks(targetPos, '#38bdf8', 10, 1.8, 3.8, 0.36);
    if (onImpact) onImpact();
  }

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      p.age += dt;
      const t = Math.min(1, p.age / Math.max(0.05, p.life));
      p.mesh.position.lerpVectors(p.startPos, p.targetPos, t);
      if (p.kind === 'arrow' || p.kind === 'gale_arrow' || p.kind === 'lance') {
        p.mesh.position.y += Math.sin(t * Math.PI) * (p.gravityArc ?? 0.08);
        p.mesh.lookAt(p.targetPos);
        if (p.kind === 'gale_arrow') p.mesh.rotation.z += dt * 16;
      } else {
        p.mesh.rotation.y += dt * 12;
        p.mesh.rotation.z += dt * 7;
      }
      if (t >= 1) {
        if (typeof p.onArrive === 'function') p.onArrive();
        this.vfxGroup.remove(p.mesh);
        this._disposeObj(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      item.age += dt;
      const t = Math.min(1, item.age / Math.max(0.04, item.life));
      const fade = Math.max(0, 1 - t);

      if (item.kind === 'swing-slash') {
        item.mesh.scale.setScalar(1 + t * 0.25);
        if (item.sweepGroup) item.sweepGroup.rotation.y += (item.sweepDir || 1) * dt * 4.8;
      } else if (item.kind === 'fan-boomerang') {
        const u = t;
        const omt = 1 - u;
        item.mesh.position.set(
          omt * omt * item.startPos.x + 2 * omt * u * item.ctrlPos.x + u * u * item.endPos.x,
          omt * omt * item.startPos.y + 2 * omt * u * item.ctrlPos.y + u * u * item.endPos.y,
          omt * omt * item.startPos.z + 2 * omt * u * item.ctrlPos.z + u * u * item.endPos.z
        );
        item.mesh.rotation.y += (item.spinDir || 1) * dt * 26;
        item.mesh.rotation.z = (item.bankTilt || 0) * Math.sin(u * Math.PI);
        if (t >= 1 && typeof item.onArrive === 'function' && !item.arrived) {
          item.arrived = true;
          item.onArrive();
        }
      } else if (item.kind === 'cyclone-ring') {
        item.mesh.rotation.y += (item.spinSpeed || 10) * dt;
        item.mesh.position.y += (item.riseSpeed || 0.5) * dt;
        item.mesh.scale.setScalar(1 + t * 0.55);
      } else if (item.kind === 'constrict') {
        const s = 1.25 - t * 0.65;
        item.mesh.scale.setScalar(Math.max(0.35, s));
        item.mesh.rotation.y += dt * 6;
      } else if (item.kind === 'ring') {
        const s = 1 + t * (item.maxScale || 1.6);
        item.mesh.scale.set(s, s, 1);
      } else if (item.kind === 'fist-shock') {
        const s = 0.8 + t * (item.maxScale || 1.5);
        item.mesh.scale.setScalar(s);
        item.mesh.translateZ(dt * 1.4);
      } else if (item.kind === 'mental-implosion') {
        const pulse = t < 0.25 ? 0.55 + (t / 0.25) * 0.85 : 1.4 - (t - 0.25) * 0.55;
        item.mesh.scale.setScalar(Math.max(0.25, pulse));
        item.mesh.rotation.y += dt * 8.5;
      } else if (item.kind === 'smite-pillar') {
        const sXZ = 1.0 - t * 0.35;
        item.mesh.scale.set(sXZ, 1 + t * 0.14, sXZ);
      } else if (item.kind === 'spin-ribbon') {
        item.mesh.rotation.z += dt * 16;
        item.mesh.rotation.y += dt * 8;
        item.mesh.scale.setScalar(1 + t * 0.30);
      } else if (item.kind === 'line-beam') {
        const rScale = 1 + t * 0.28;
        item.mesh.scale.set(rScale, rScale, 1);
      } else if (item.kind === 'fade-pop') {
        item.mesh.scale.setScalar(1 + t * (item.maxScale || 1.5));
      } else if (item.kind === 'sparks') {
        const children = item.mesh.children;
        const g = item.gravity ?? 5.4;
        for (let k = 0; k < children.length; k += 1) {
          const vel = item.velocities[k];
          if (!vel) continue;
          vel.y -= g * dt;
          children[k].position.addScaledVector(vel, dt);
          children[k].rotation.x += dt * 12;
          children[k].rotation.y += dt * 10;
        }
      }

      const opacityFactor = item.kind === 'fan-boomerang'
        ? Math.max(0, t < 0.82 ? 1 : (1 - t) / 0.18)
        : item.kind === 'lightning-flash'
          ? fade * (0.78 + 0.22 * Math.sin(t * 48))
          : fade;
      item.mesh.traverse((c) => {
        if (c.material) c.material.opacity = opacityFactor * (c.userData.baseOpacity ?? 0.92);
      });

      if (t >= 1) {
        this.vfxGroup.remove(item.mesh);
        this._disposeObj(item.mesh);
        this.items.splice(i, 1);
      }
    }
  }
}
