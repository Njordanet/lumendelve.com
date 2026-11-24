/**
 * Lumendelve 3D Bento Cockpit — Application Controller
 * Coordinates GET /api/catalog, ThreeStageController (Three.js 0.170.0),
 * 6 cockpit modes, class-set armor/weapon catalog filtering (by class + gender), and POST /api/import-render.
 */

import {
  CLASS_DEFAULT_PALETTES,
  CLASS_WEAPON_META,
  FACE_PRESETS,
  FLYFF_STYLES,
  MATERIAL_KEYS,
  ThreeStageController,
} from './three_stage.js';
import { initOperationsHub } from './modules/operations_hub.js';
import { computeBalance, loadVisualConfig, visualTierForItem } from './modules/set_balance.js';
import { createSetBalancePanel } from './modules/set_balance_panel.js';
import { computeLevelBand, getItemPoolCategory, renderGroupedCatalogList } from './modules/gear_browser.js';
import { createLootAudioController } from './modules/loot_audio.js';
import { RARITY_PROFILES } from './modules/ground_loot_3d.js';
import { simulateFlyffDropRoll } from './vendor/ld-engine.js';
import { ARMOR_SLOTS } from './modules/armor_mounter_3d.js';
import {
  REAVER_PAIRINGS,
  STAFF_ELEMENTS,
  getClassWeaponStyles,
  getStaffElementDef,
  getStyleGlyphs,
  getWeaponStyleDef,
} from './modules/weapon_staging_catalog.js';

const lootAudio = createLootAudioController();

const PALETTE_PRESETS = [
  {
    id: 'paladin-gold',
    name: 'Paladin Gold',
    colors: { Primary: '#D97706', Secondary: '#1E293B', Trim: '#FDE047', Glow: '#F59E0B', Steel: '#CBD5E1', Skin: '#E6B89C' },
  },
  {
    id: 'shadow-void',
    name: 'Shadow Void',
    colors: { Primary: '#334155', Secondary: '#0F172A', Trim: '#A855F7', Glow: '#C084FC', Steel: '#64748B', Skin: '#D4A076' },
  },
  {
    id: 'arcane-frost',
    name: 'Arcane Frost',
    colors: { Primary: '#0284C7', Secondary: '#0C4A6E', Trim: '#7DD3FC', Glow: '#38BDF8', Steel: '#E2E8F0', Skin: '#F5D0B8' },
  },
  {
    id: 'crimson-vanguard',
    name: 'Crimson Vanguard',
    colors: { Primary: '#DC2626', Secondary: '#450A0A', Trim: '#F59E0B', Glow: '#F87171', Steel: '#94A3B8', Skin: '#B8734A' },
  },
];

const CLASS_SKILL_META = {
  squire: { skill: 'Aegis Cleave', burst: 'Valiant Breaker' },
  scout: { skill: 'Gale Volley', burst: 'Tempest Barrage' },
  arcanist: { skill: 'Astral Nova', burst: 'Void Singularity' },
  acolyte: { skill: 'Solar Judgment', burst: 'Radiant Choir' },
};

const TIER_MAP = {
  1: { tierKey: 'Tier_Lv1', badge: 'Lv.1', css: 'lv-tier-1' },
  2: { tierKey: 'Tier_Lv15', badge: 'Lv.15', css: 'lv-tier-15' },
  3: { tierKey: 'Tier_Lv30', badge: 'Lv.30', css: 'lv-tier-30' },
  4: { tierKey: 'Tier_Lv50', badge: 'Lv.50', css: 'lv-tier-50' },
  5: { tierKey: 'Tier_Lv50', badge: 'Lv.50', css: 'lv-tier-50' },
};

const TIER_LABELS = {
  Tier_Lv1: { badge: 'Lv.1', css: 'lv-tier-1' },
  Tier_Lv15: { badge: 'Lv.15', css: 'lv-tier-15' },
  Tier_Lv30: { badge: 'Lv.30', css: 'lv-tier-30' },
  Tier_Lv50: { badge: 'Lv.50', css: 'lv-tier-50' },
};

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const VALID_IMPORT_EXTS = ['.blend', '.glb', '.gltf', '.fbx', '.obj'];

const state = {
  suite: 'character-lab',
  catalog: null,
  baseClass: 'acolyte',
  gender: 'female',
  faceId: 'f1',
  weaponVariant: 'A',
  weaponStyle: 'stick_2h',
  reaverPairing: 'swd_axe',
  staffElement: 'fire',
  glyphTier: 5,
  stanceMode: 'peace',
  mode: 'character-select',
  battleSubMode: 'grinding',
  activeTier: 'Tier_Lv50',
  styleId: 'universe-pbr',
  palette: { ...CLASS_DEFAULT_PALETTES.acolyte },
  activePresetId: null,
  armorStripped: false,
  dyeTarget: 'all',
  slotDyeOverrides: {},
  globalArmorOverride: null,
  outlineEnabled: true,
  wireframeEnabled: false,
  autoRotate: false,

  // Left Rail Filters & Loadout
  slotFilter: 'all', // 'all' | 'armor' | 'weapons'
  poolFilter: 'all', // 'all' | 'sets' | 'common' | 'uncommon'
  weaponRarityFilter: 'all', // 'all' | 'common' | 'uncommon' | 'epic' | 'mythic'
  reaverNextHand: 'off_hand',
  levelBandFilter: 'all', // 'all' | '1-20' | '21-40' | '41-64' | '65-84' | '85-100'
  expandedGroupKeys: new Set(),
  tierFilter: 'all', // 'all' | 'Tier_Lv1' | 'Tier_Lv15' | 'Tier_Lv30' | 'Tier_Lv50'
  searchQuery: '',
  equippedBySlot: {},
  balanceLevel: 15,
  activeItem: null,
  lootKillSeed: 1,
  lootToasts: [],
  lootDockCollapsed: false,
  arenaLight: 'day',

  // Walk / Run
  walkClip: 'Walk',
  walkSpeed: 1.0,
  floorGridVisible: true,

  // Turn-Based Boss State
  boss: {
    turnNumber: 1,
    heroHp: 520,
    heroMaxHp: 520,
    heroWard: 0,
    bossHp: 1200,
    bossMaxHp: 1200,
    burstCooldown: 0,
    busy: false,
    autoBattle: false,
    autoStep: 0,
    intent: 'CHARGING',
    over: false,
  },

  // Import Modal
  importSourceMode: 'file',
  importFile: null,
  importAssetIdTouched: false,
  importBusy: false,
};

const dom = {
  suiteBtns: document.querySelectorAll('#studio-suite-switcher .suite-btn'),
  characterLabWorkspace: document.getElementById('character-lab-workspace'),
  ldOpsWorkspace: document.getElementById('ld-ops-workspace'),
  topClassPillsWrap: document.getElementById('top-class-pills'),
  topGenderPillsWrap: document.getElementById('top-gender-pills'),
  modeTabsWrap: document.getElementById('mode-tabs'),
  liveopsHeaderPill: document.getElementById('liveops-header-pill'),

  topClassPills: document.querySelectorAll('#top-class-pills .class-pill'),
  topGenderPills: document.querySelectorAll('#top-gender-pills .gender-pill'),
  modeTabs: document.querySelectorAll('#mode-tabs .mode-tab'),
  catalogStatusPill: document.getElementById('catalog-status-pill'),
  openImportModalBtn: document.getElementById('open-import-modal-btn'),

  // Left Rail
  leftClassBadge: document.getElementById('left-class-badge'),
  slotFilterPills: document.querySelectorAll('#slot-filter-pills .filter-pill'),
  poolFilterRow: document.getElementById('pool-filter-pills'),
  poolFilterPills: document.querySelectorAll('#pool-filter-pills .filter-pill'),
  weaponRarityRow: document.getElementById('weapon-rarity-pills'),
  weaponRarityPills: document.querySelectorAll('#weapon-rarity-pills .filter-pill'),
  levelBandPills: document.querySelectorAll('#level-band-pills .tier-chip'),
  tierFilterPills: document.querySelectorAll('#tier-filter-pills .tier-chip'),
  itemCountBadge: document.getElementById('item-count-badge'),
  itemSearchInput: document.getElementById('item-search-input'),
  catalogItemsList: document.getElementById('catalog-items-list'),
  activeTierPill: document.getElementById('active-tier-pill'),
  loadoutActiveItem: document.getElementById('loadout-active-item'),
  loadoutArmorSlots: document.getElementById('loadout-armor-slots'),
  loadoutWeaponSlots: document.getElementById('loadout-weapon-slots'),
  loadoutStatsStrip: document.getElementById('loadout-stats-strip'),
  quickTierBtns: document.querySelectorAll('[data-equip-tier]'),
  clearLoadoutBtn: document.getElementById('clear-loadout-btn'),

  // Center Stage & Overlays
  stageCanvas: document.getElementById('three-stage-canvas'),
  worldMarkers: document.getElementById('stage-world-markers'),
  damageLayer: document.getElementById('stage-damage-layer'),
  stageClassLabel: document.getElementById('stage-class-label'),
  stageGenderLabel: document.getElementById('stage-gender-label'),
  stageTierLabel: document.getElementById('stage-tier-label'),
  stageStyleLabel: document.getElementById('stage-style-label'),
  stageWeaponSwitcher: document.getElementById('stage-weapon-switcher'),
  stageWeaponScalingBadge: document.getElementById('stage-weapon-scaling-badge'),
  stageReaverPill: document.getElementById('stage-reaver-pill'),
  stageStaffElemPill: document.getElementById('stage-staff-elem-pill'),
  stageLoadingPill: document.getElementById('stage-loading-pill'),

  overlays: {
    'character-select': document.getElementById('overlay-character-select'),
    'armor-page': document.getElementById('overlay-armor-page'),
    walking: document.getElementById('overlay-walking'),
    'battle-mode': document.getElementById('overlay-battle-mode'),
    'character-sheet': document.getElementById('overlay-character-sheet'),
  },

  // Mode 1: Character Select
  csClassCards: document.getElementById('cs-class-cards'),

  // Mode 2: Armor Page
  armorTierBtns: document.querySelectorAll('#armor-tier-switcher .seg-btn'),
  armorWeaponSwitcher: document.getElementById('armor-weapon-switcher'),
  armorWireframeBtn: document.getElementById('armor-wireframe-btn'),
  armorOutlineBtn: document.getElementById('armor-outline-btn'),
  armorMeshStats: document.getElementById('armor-mesh-stats'),
  camPresetBtns: document.querySelectorAll('[data-cam-preset]'),

  // Mode 3: Walk / Run
  walkClipBtns: document.querySelectorAll('#walk-clip-switcher .seg-btn'),
  walkSkillSelect: document.getElementById('walk-skill-select'),
  walkTierSelect: document.getElementById('walk-tier-select'),
  walkSkillPlayBtn: document.getElementById('walk-skill-play-btn'),
  walkJumpBtn: document.getElementById('walk-jump-btn'),
  walkSpeedSlider: document.getElementById('walk-speed-slider'),
  walkSpeedVal: document.getElementById('walk-speed-val'),
  walkGridToggle: document.getElementById('walk-grid-toggle'),

  // Mode 4: Battle Mode
  battleSubmodeBtns: document.querySelectorAll('#battle-submode-switcher .seg-btn'),
  battleAutoPreviewBtn: document.getElementById('battle-auto-preview-btn'),
  battleSkillSelect: document.getElementById('battle-skill-select'),
  battleTierSelect: document.getElementById('battle-tier-select'),
  battleSkillPlayBtn: document.getElementById('battle-skill-play-btn'),
  battleGrindingHud: document.getElementById('battle-grinding-hud'),
  battleBossHud: document.getElementById('battle-boss-hud'),
  grindQuickBtns: document.querySelectorAll('[data-target-mob]'),
  grindTargetName: document.getElementById('grind-target-name'),
  grindHeroState: document.getElementById('grind-hero-state'),
  grindKillCount: document.getElementById('grind-kill-count'),
  grindDmgTotal: document.getElementById('grind-dmg-total'),
  grindResetBtn: document.getElementById('grind-reset-btn'),

  // Battle Mode Ground Loot Dock
  lootDockBody: document.getElementById('loot-dock-body'),
  lootDockToggle: document.getElementById('loot-dock-toggle'),
  lootDockCount: document.getElementById('loot-dock-count'),
  lootToasts: document.getElementById('battle-loot-toasts'),
  lootBackdropBtns: document.querySelectorAll('#loot-backdrop-switcher [data-arena-light]'),
  lootSpawnRarityBtns: document.querySelectorAll('[data-spawn-rarity]'),
  lootSpawnBurstBtn: document.getElementById('loot-spawn-burst-btn'),
  lootSpawn12Btn: document.getElementById('loot-spawn-12-btn'),
  lootAllBtn: document.getElementById('loot-all-btn'),
  lootClearBtn: document.getElementById('loot-clear-btn'),
  lootBeamHeight: document.getElementById('loot-beam-height'),
  lootBeamHeightVal: document.getElementById('loot-beam-height-val'),
  lootBeamGlow: document.getElementById('loot-beam-glow'),
  lootBeamGlowVal: document.getElementById('loot-beam-glow-val'),
  lootAutoPickup: document.getElementById('loot-auto-pickup'),
  lootSfxVol: document.getElementById('loot-sfx-vol'),
  lootSfxMute: document.getElementById('loot-sfx-mute'),
  lootAuditionBtns: document.querySelectorAll('[data-audition-sfx]'),

  bossTurnBadge: document.getElementById('boss-turn-badge'),
  bossTurnTokens: document.getElementById('boss-turn-tokens'),
  bossIntentBadge: document.getElementById('boss-intent-badge'),
  bossHpFill: document.getElementById('boss-hp-fill'),
  bossHpText: document.getElementById('boss-hp-text'),
  bossHeroName: document.getElementById('boss-hero-name'),
  bossHeroWardBadge: document.getElementById('boss-hero-ward-badge'),
  bossHeroHpFill: document.getElementById('boss-hero-hp-fill'),
  bossHeroWardFill: document.getElementById('boss-hero-ward-fill'),
  bossHeroHpText: document.getElementById('boss-hero-hp-text'),
  bossPhaseText: document.getElementById('boss-phase-text'),
  bossClassSkillName: document.getElementById('boss-class-skill-name'),
  bossBurstSub: document.getElementById('boss-burst-sub'),
  bossAutoBtn: document.getElementById('boss-auto-btn'),
  bossAutoState: document.getElementById('boss-auto-state'),
  bossActionBtns: document.querySelectorAll('[data-boss-action]'),

  // Mode 5: Character Sheet
  sheetClassTitle: document.getElementById('sheet-class-title'),
  sheetClassSub: document.getElementById('sheet-class-sub'),
  sheetStatsGrid: document.getElementById('sheet-stats-grid'),
  sheetBalance: document.getElementById('sheet-balance'),
  sheetEquippedList: document.getElementById('sheet-equipped-list'),
  sheetStyleName: document.getElementById('sheet-style-name'),
  sheetDyeSwatches: document.getElementById('sheet-dye-swatches'),
  sheetExportPngBtn: document.getElementById('sheet-export-png-btn'),

  // Right Rail
  rightFaceLabel: document.getElementById('right-face-label'),
  rightFaceGrid: document.getElementById('right-face-grid'),
  dyeTargetPills: document.querySelectorAll('#dye-target-pills .dye-target-btn'),
  applyDyeAllBtn: document.getElementById('apply-dye-all-btn'),
  resetArmorColorsBtn: document.getElementById('reset-armor-colors-btn'),
  resetClassColorsBtn: document.getElementById('reset-class-colors-btn'),
  colorPickersGrid: document.getElementById('color-pickers-grid'),
  palettePresetsGrid: document.getElementById('palette-presets-grid'),
  rightOutlineToggle: document.getElementById('right-outline-toggle'),
  rightOutlineState: document.getElementById('right-outline-state'),
  rightAutorotateToggle: document.getElementById('right-autorotate-toggle'),
  rightAutorotateState: document.getElementById('right-autorotate-state'),
  rightResetCameraBtn: document.getElementById('right-reset-camera-btn'),

  // Import Modal
  importModal: document.getElementById('import-modal'),
  importCloseXBtn: document.getElementById('import-close-x-btn'),
  importCancelBtn: document.getElementById('import-cancel-btn'),
  importForm: document.getElementById('import-render-form'),
  importSourceBtns: document.querySelectorAll('#import-source-tabs .seg-btn'),
  importFilePanel: document.getElementById('import-file-panel'),
  importLocalPanel: document.getElementById('import-local-panel'),
  importFileInput: document.getElementById('import-file-input'),
  importDropzone: document.getElementById('import-dropzone'),
  importFileTitle: document.getElementById('import-file-title'),
  importFileMeta: document.getElementById('import-file-meta'),
  importLocalPath: document.getElementById('import-local-path'),
  importAssetId: document.getElementById('import-asset-id'),
  importSlot: document.getElementById('import-slot'),
  importAngle: document.getElementById('import-angle'),
  importHoldout: document.getElementById('import-holdout'),
  importAutofit: document.getElementById('import-autofit'),
  importSubmitBtn: document.getElementById('import-submit-btn'),
  importResultBox: document.getElementById('import-result-box'),
  importStatusBadge: document.getElementById('import-status-badge'),
  importStatusText: document.getElementById('import-status-text'),
  importRenderLog: document.getElementById('import-render-log'),
  importQcLog: document.getElementById('import-qc-log'),

  toastBanner: document.getElementById('toast-banner'),
};

let toastTimer = 0;
function showToast(msg, isError = false) {
  dom.toastBanner.textContent = msg;
  dom.toastBanner.classList.remove('hidden', 'error');
  if (isError) dom.toastBanner.classList.add('error');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toastBanner.classList.add('hidden');
  }, 3000);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getBaseClassInfo(classId = state.baseClass) {
  return state.catalog?.baseClasses?.find((c) => c.id === classId) || null;
}

function mapItemToTier(item) {
  const setTier = visualTierForItem(item);
  if (setTier) return { tierKey: setTier, ...(TIER_LABELS[setTier] || TIER_LABELS.Tier_Lv1) };
  if (item?.armorTier && TIER_LABELS[item.armorTier]) {
    return { tierKey: item.armorTier, ...TIER_LABELS[item.armorTier] };
  }
  const vt = Number(item?.visualTier);
  if (TIER_MAP[vt]) return TIER_MAP[vt];
  const lv = Number(item?.levelReq) || 1;
  if (lv >= 18) return TIER_MAP[4];
  if (lv >= 13) return TIER_MAP[3];
  if (lv >= 8) return TIER_MAP[2];
  return TIER_MAP[1];
}

function computeCombinedStats() {
  const empty = { hp: 0, physAtk: 0, physDef: 0, elemAtk: 0, elemDef: 0, speed: 0 };
  if (!state.catalog) return { totals: { ...empty }, bonus: { ...empty } };
  const { derived: d, naked: n } = computeBalance({
    catalog: state.catalog, classId: state.baseClass, level: state.balanceLevel, equippedBySlot: state.equippedBySlot,
  });
  const pick = (x) => ({ hp: x.maxHp, physAtk: x.physAtk, physDef: x.physDef, elemAtk: x.elemAtk, elemDef: x.elemDef, speed: x.speed });
  const totals = pick(d);
  const base = pick(n);
  const bonus = Object.fromEntries(Object.keys(totals).map((k) => [k, totals[k] - base[k]]));
  return { totals, bonus };
}

// --- Per-Weapon Style & Glyph Dropdown Population ---
function populateWeaponSkillSelects(styleId = state.weaponStyle) {
  const def = getWeaponStyleDef(styleId, state.baseClass);
  for (const id of ['walk-skill-select', 'battle-skill-select']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const prev = sel.value;
    sel.innerHTML = `<option value="">${escapeHtml(def.shortLabel)} Glyphs &amp; Auto...</option>`;

    const autoOpt = document.createElement('option');
    autoOpt.value = 'AutoChain';
    autoOpt.textContent = '★ 3-Hit Auto Chain';
    sel.appendChild(autoOpt);

    for (const step of def.autoChain || []) {
      const opt = document.createElement('option');
      opt.value = step.clip;
      opt.textContent = `Auto ${step.step}: ${step.name}`;
      sel.appendChild(opt);
    }

    for (const glyph of def.glyphs || []) {
      const opt = document.createElement('option');
      opt.value = glyph.clip;
      opt.dataset.glyphId = glyph.id;
      const tag = glyph.role === 'move' ? 'Glyph' : glyph.role === 'block' ? 'Guard' : glyph.role === 'buff' ? 'Buff' : 'Heal';
      opt.textContent = `[${tag}] ${glyph.name}`;
      sel.appendChild(opt);
    }

    const validValues = new Set([...sel.options].map((o) => o.value));
    sel.value = validValues.has(prev) ? prev : '';
  }
}

// --- Initialize ThreeStageController ---
const stage = new ThreeStageController({
  canvas: dom.stageCanvas,
  markersLayer: dom.worldMarkers,
  damageLayer: dom.damageLayer,
  onLoadingChange: (loading) => {
    dom.stageLoadingPill.classList.toggle('hidden', !loading);
  },
  onJumpStateChange: (jumping) => {
    dom.walkJumpBtn?.classList.toggle('active', Boolean(jumping));
  },
  onHeroLoaded: ({ baseClass, meshCount }) => {
    dom.armorMeshStats.textContent = `${meshCount}m • 17b`;
    populateWeaponSkillSelects(state.weaponStyle);
    renderWeaponSwitchers();
    syncStageMetaChip();
    renderCharacterSheet();
    renderBossHud();
    const sDef = getWeaponStyleDef(state.weaponStyle, baseClass);
    showToast(`Loaded TOTK ${baseClass}.glb + ${sDef.shortLabel} (${meshCount} meshes)`);
  },
  onMobHit: (mob) => {
    const { totals } = computeCombinedStats();
    const power = Math.max(totals.physAtk, totals.elemAtk);
    const crit = Math.random() < 0.28;
    const raw = Math.round(power * (0.42 + Math.random() * 0.14) * (crit ? 1.65 : 1.0));
    return { damage: Math.max(25, raw), crit, mobId: mob.id };
  },
  onMobDeath: (mob) => handleArenaMobDeath(mob),
  onDropPicked: (picked) => handleGroundDropsPicked(picked),
  onGrindStateChange: (info) => {
    dom.grindTargetName.textContent = info.targetName;
    dom.grindHeroState.textContent = info.phase.toUpperCase();
    dom.grindKillCount.textContent = String(info.kills);
    dom.grindDmgTotal.textContent = String(info.totalDamage);
    dom.grindQuickBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.targetMob === info.targetId);
    });
  },
});

function syncStageMetaChip() {
  const cls = getBaseClassInfo();
  const style = FLYFF_STYLES.find((s) => s.id === state.styleId);
  const tierInfo = TIER_LABELS[state.activeTier] || TIER_LABELS.Tier_Lv1;
  dom.stageClassLabel.textContent = cls?.displayName || state.baseClass;
  if (dom.stageGenderLabel) {
    dom.stageGenderLabel.textContent = state.gender === 'male' ? '♂' : '♀';
  }
  dom.stageTierLabel.textContent = tierInfo.badge;
  dom.stageStyleLabel.textContent = style?.name || state.styleId;
}

function getWeaponMeta(classId = state.baseClass) {
  return CLASS_WEAPON_META[classId] || CLASS_WEAPON_META.acolyte;
}

function getActiveWeaponStyle() {
  const styles = getClassWeaponStyles(state.baseClass);
  return styles.find((s) => s.id === state.weaponStyle) || styles[0] || getWeaponStyleDef(state.weaponStyle, state.baseClass);
}

function renderWeaponSwitchers() {
  const styles = getClassWeaponStyles(state.baseClass);
  const active = getActiveWeaponStyle();
  state.weaponStyle = active.id;

  if (dom.stageWeaponSwitcher) {
    const kicker = '<span class="stage-weapon-kicker">Weapon</span>';
    const buttonsHtml = styles
      .map(
        (s) =>
          `<button type="button" class="seg-btn${s.id === active.id ? ' active' : ''}" data-weapon-style="${s.id}" title="${escapeHtml(s.specBadge)} · ${escapeHtml(s.scalingLabel)}">${escapeHtml(s.shortLabel)}</button>`
      )
      .join('');
    dom.stageWeaponSwitcher.innerHTML = kicker + buttonsHtml;
  }

  if (dom.armorWeaponSwitcher) {
    dom.armorWeaponSwitcher.innerHTML = styles
      .map(
        (s) =>
          `<button type="button" class="seg-btn${s.id === active.id ? ' active' : ''}" data-weapon-style="${s.id}" title="${escapeHtml(s.specBadge)} · ${escapeHtml(s.scalingLabel)}">${escapeHtml(s.shortLabel)}</button>`
      )
      .join('');
  }

  for (const container of [dom.stageWeaponSwitcher, dom.armorWeaponSwitcher]) {
    container?.querySelectorAll('[data-weapon-style]').forEach((btn) => {
      btn.addEventListener('click', () => setWeaponStyle(btn.dataset.weaponStyle));
    });
  }

  if (dom.stageWeaponScalingBadge) {
    dom.stageWeaponScalingBadge.textContent = active.scalingLabel;
    dom.stageWeaponScalingBadge.className = `badge ${active.scalingStat === 'elemAtk' ? 'badge-cyan' : 'badge-amber'} stage-scaling-badge`;
  }

  if (dom.stageReaverPill) {
    dom.stageReaverPill.classList.toggle('hidden', !active.supportsReaverPairing);
    dom.stageReaverPill.querySelectorAll('[data-reaver-pair]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.reaverPair === state.reaverPairing);
    });
  }

  if (dom.stageStaffElemPill) {
    dom.stageStaffElemPill.classList.toggle('hidden', !active.supportsStaffElement);
    const elDef = getStaffElementDef(state.staffElement);
    dom.stageStaffElemPill.title = elDef.tipText;
    dom.stageStaffElemPill.querySelectorAll('[data-staff-elem]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.staffElem === state.staffElement);
    });
  }
}

async function setWeaponStyle(styleId) {
  const styles = getClassWeaponStyles(state.baseClass);
  const chosen = styles.find((s) => s.id === styleId) || styles[0];
  if (!chosen) return;
  state.weaponStyle = chosen.id;
  state.weaponVariant = chosen.id === styles[0]?.id ? 'A' : 'B';
  await stage.setWeaponStyle(chosen.id, {
    reaverPairing: state.reaverPairing,
    staffElement: state.staffElement,
  });
  renderWeaponSwitchers();
  populateWeaponSkillSelects(chosen.id);
  renderActiveLoadoutSummary();
  renderCharacterSheet();
  renderBossHud();
}

function setWeaponVariant(variant) {
  const v = String(variant).toUpperCase() === 'B' ? 'B' : 'A';
  const styles = getClassWeaponStyles(state.baseClass);
  const chosen = v === 'B' ? (styles[1] || styles[0]) : styles[0];
  return chosen ? setWeaponStyle(chosen.id) : Promise.resolve();
}

function setReaverPairing(pairId) {
  state.reaverPairing = pairId || 'swd_axe';
  void stage.setReaverPairing(state.reaverPairing).then(() => {
    renderActiveLoadoutSummary();
  });
  renderWeaponSwitchers();
  const label = REAVER_PAIRINGS.find((p) => p.id === state.reaverPairing)?.label || state.reaverPairing;
  showToast(`Reaver dual pairing: ${label}`);
}

function setStaffElement(elemId) {
  state.staffElement = elemId || 'arcane';
  stage.setStaffElement(state.staffElement);
  renderWeaponSwitchers();
  const elDef = getStaffElementDef(state.staffElement);
  showToast(elDef.tipText);
}

function setGlyphTier(tier) {
  state.glyphTier = Math.max(1, Math.min(5, Number(tier) || 5));
  stage.setGlyphTier(state.glyphTier);
  if (dom.walkTierSelect) dom.walkTierSelect.value = String(state.glyphTier);
  if (dom.battleTierSelect) dom.battleTierSelect.value = String(state.glyphTier);
}

function syncStanceButtons() {
  const isCombat = state.stanceMode === 'combat';
  document.querySelectorAll('[data-stance-toggle]').forEach((btn) => {
    btn.classList.toggle('active', isCombat);
    btn.textContent = isCombat ? 'Combat' : 'Peace';
    btn.setAttribute('aria-pressed', String(isCombat));
  });
}

function setStanceMode(stance) {
  const s = stance === 'combat' ? 'combat' : 'peace';
  state.stanceMode = s;
  if (typeof stage.setStanceMode === 'function') {
    stage.setStanceMode(s);
  }
  syncStanceButtons();
}

function setGender(gender) {
  const g = gender === 'male' ? 'male' : 'female';
  state.gender = g;
  dom.topGenderPills.forEach((btn) => btn.classList.toggle('active', btn.dataset.gender === g));

  // Drop equipped set pieces made for the other body type, then refresh the catalog list & 3D armor.
  for (const [slot, item] of Object.entries(state.equippedBySlot)) {
    if (item?.gender && item.gender !== g) delete state.equippedBySlot[slot];
  }
  if (state.activeItem?.gender && state.activeItem.gender !== g) {
    state.activeItem = Object.values(state.equippedBySlot)[0] || null;
  }
  stage.setEquippedArmor(state.equippedBySlot, { stripped: state.armorStripped, deferSync: true });
  void stage.setGender(g);

  renderLeftCatalogItems();
  renderActiveLoadoutSummary();
  renderColorOptions();

  // Auto-switch face to m1 / f1 if current face belongs to the opposite gender
  const currentFace = FACE_PRESETS.find((f) => f.id === state.faceId);
  if (!currentFace || currentFace.gender !== g) {
    setFace(g === 'male' ? 'm1' : 'f1');
  } else {
    renderCharacterSheet();
  }
  syncStageMetaChip();
}

function setFace(faceId) {
  const preset = FACE_PRESETS.find((f) => f.id === faceId);
  if (!preset) return;
  state.faceId = preset.id;
  stage.setFace(preset.id);
  if (dom.rightFaceLabel) {
    dom.rightFaceLabel.textContent = preset.label;
  }
  if (dom.rightFaceGrid) {
    dom.rightFaceGrid.querySelectorAll('[data-face-id]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.faceId === preset.id);
    });
  }
  renderCharacterSheet();
}

function isWeaponCatalogItem(item) {
  return (
    item?.category === 'weapon' ||
    item?.category === 'focus' ||
    item?.slot === 'main_hand' ||
    item?.slot === 'off_hand'
  );
}

function weaponArchetype(item) {
  if (!item) return '';
  const sub = String(item.archetype || item.subtype || '').toLowerCase();
  if (sub === 'rod') return 'stick_2h';
  if (sub === 'dagger_dual') return 'razor_fans';
  return sub;
}

function isTwoHandOrDualWeapon(item) {
  if (!item) return false;
  if (item.handedness === 'two_handed' || item.weaponVisual?.dualHanded) return true;
  return ['sword_2h', 'bow', 'staff', 'stick_2h', 'razor_fans', 'gauntlet'].includes(weaponArchetype(item));
}

function isReaverOneHandWeapon(item) {
  const arch = weaponArchetype(item);
  return arch === 'sword_1h' || arch === 'axe_1h';
}

function mapWeaponItemToStyle(item, classId = state.baseClass) {
  if (!isWeaponCatalogItem(item)) return null;
  const sub = weaponArchetype(item);
  const valid = new Set(getClassWeaponStyles(classId).map((s) => s.id));
  if (sub === 'axe_1h' && valid.has('axe_1h')) return 'axe_1h';
  if (sub === 'sword_1h' && valid.has('sword_1h')) return 'sword_1h';
  if (sub === 'sword_2h' && valid.has('sword_2h')) return 'sword_2h';
  if (sub === 'bow' && valid.has('bow')) return 'bow';
  if (sub === 'razor_fans' && valid.has('razor_fans')) return 'razor_fans';
  if (sub === 'staff' && valid.has('staff')) return 'staff';
  if (sub === 'wand' && valid.has('wand')) return 'wand';
  if (sub === 'stick_2h' && valid.has('stick_2h')) return 'stick_2h';
  if (sub === 'gauntlet' && valid.has('gauntlet')) return 'gauntlet';
  return null;
}

// --- Class, Tier, Mode, Style Controls ---
async function selectBaseClass(classId, { resetPalette = true } = {}) {
  if (!classId || (state.baseClass === classId && stage.modelGroup)) return;
  state.baseClass = classId;
  state.equippedBySlot = {};
  state.activeItem = null;
  state.armorStripped = false;
  state.reaverNextHand = 'off_hand';
  stage.setEquippedArmor({}, { stripped: false, deferSync: true });
  stage.setEquippedWeapons({}, { remount: false });
  const classStyles = getClassWeaponStyles(classId);
  if (!classStyles.some((s) => s.id === state.weaponStyle)) {
    state.weaponStyle = classStyles[0]?.id || state.weaponStyle;
  }

  dom.topClassPills.forEach((p) => p.classList.toggle('active', p.dataset.class === classId));
  const cls = getBaseClassInfo(classId);
  dom.leftClassBadge.textContent = cls?.displayName || classId;

  if (resetPalette && CLASS_DEFAULT_PALETTES[classId]) {
    state.palette = { ...CLASS_DEFAULT_PALETTES[classId] };
    state.activePresetId = null;
    state.slotDyeOverrides = {};
    state.globalArmorOverride = null;
    state.dyeTarget = 'all';
    stage.clearSlotDyes('all', { deferSync: true });
    stage.setSlotDyeTarget('all');
    stage.setPalette(state.palette, { updateArmorOverride: false });
    renderColorOptions();
  }

  renderWeaponSwitchers();
  populateWeaponSkillSelects(state.weaponStyle);
  renderLeftCatalogItems();
  renderActiveLoadoutSummary();
  renderCharacterSelectCards();
  resetBossFight();
  syncStageMetaChip();
  await stage.loadClassModel(classId);
  renderColorOptions();
  renderCharacterSheet();
}

function setActiveTier(tierKey, { unstrip = true } = {}) {
  state.activeTier = tierKey;
  const hasAnyArmor = ARMOR_SLOTS.some((s) => Boolean(state.equippedBySlot?.[s]));
  if (unstrip && !hasAnyArmor) {
    state.armorStripped = false;
  }
  void stage.setTier(tierKey, { unstrip });

  const info = TIER_LABELS[tierKey] || TIER_LABELS.Tier_Lv1;
  dom.activeTierPill.textContent = tierKey;
  dom.activeTierPill.className = `lv-badge ${info.css}`;

  dom.quickTierBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.equipTier === tierKey);
  });
  dom.armorTierBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tier === tierKey);
  });

  syncStageMetaChip();
  renderActiveLoadoutSummary();
  renderDyeTargetPills();
  renderCharacterSheet();
}

function setMode(mode) {
  state.mode = mode;
  dom.modeTabs.forEach((t) => {
    const active = t.dataset.mode === mode;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });

  for (const [key, el] of Object.entries(dom.overlays)) {
    el.classList.toggle('hidden', key !== mode);
  }

  stage.setMode(mode, state.battleSubMode);
  if (mode === 'character-sheet') renderCharacterSheet();
  if (mode === 'battle-mode') syncBattleSubmodeUI();
}

function setBattleSubMode(subMode) {
  state.battleSubMode = subMode;
  dom.battleSubmodeBtns.forEach((b) => b.classList.toggle('active', b.dataset.battleSub === subMode));
  syncBattleSubmodeUI();
  if (state.mode === 'battle-mode') {
    stage.setMode('battle-mode', subMode);
  }
}

function syncBattleSubmodeUI() {
  const isGrind = state.battleSubMode === 'grinding';
  dom.battleGrindingHud.classList.toggle('hidden', !isGrind);
  dom.battleBossHud.classList.toggle('hidden', isGrind);
  if (!isGrind) {
    renderBossHud();
  }
}

function applyFlyffStyle() {
  const style = stage.applyStyle('universe-pbr');
  state.styleId = style.id;
  state.outlineEnabled = style.outline;

  syncOutlineToggleUI();
  syncStageMetaChip();
  renderCharacterSheet();
}

function syncOutlineToggleUI() {
  dom.rightOutlineToggle.classList.toggle('active', state.outlineEnabled);
  dom.rightOutlineState.textContent = state.outlineEnabled ? 'ON' : 'OFF';
  dom.armorOutlineBtn.classList.toggle('active', state.outlineEnabled);
}

// --- Left Rail: Catalog Filter (class, gender, slot, pool, band, tier) + Level Requirements ---
function levelBandKey(item) {
  if (item?.armorTier && TIER_LABELS[item.armorTier]) return item.armorTier;
  const vt = Number(item?.visualTier);
  if (TIER_MAP[vt]) return TIER_MAP[vt].tierKey;
  const lv = Number(item?.levelReq) || 1;
  return lv >= 50 ? 'Tier_Lv50' : lv >= 30 ? 'Tier_Lv30' : lv >= 15 ? 'Tier_Lv15' : 'Tier_Lv1';
}

function getFilteredItems() {
  const items = state.catalog?.items || [];
  const q = state.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    const reqs = item.classReq;
    if (Array.isArray(reqs) && reqs.length > 0 && !reqs.includes(state.baseClass)) {
      return false;
    }

    if (item.gender && item.gender !== state.gender) return false;

    const isWeapon = isWeaponCatalogItem(item);
    if (state.slotFilter === 'weapons' && !isWeapon) return false;
    if (state.slotFilter === 'armor' && isWeapon) return false;

    if (state.slotFilter === 'weapons') {
      if (state.weaponRarityFilter !== 'all' && String(item.rarity || 'common').toLowerCase() !== state.weaponRarityFilter) {
        return false;
      }
    } else if (state.poolFilter !== 'all' && getItemPoolCategory(item) !== state.poolFilter) {
      return false;
    }

    if (state.levelBandFilter !== 'all' && computeLevelBand(item.levelReq) !== state.levelBandFilter) {
      return false;
    }

    const tierInfo = mapItemToTier(item);
    if (state.tierFilter !== 'all' && levelBandKey(item) !== state.tierFilter) {
      return false;
    }

    if (q) {
      const hay = `${item.name} ${item.lineName || ''} ${item.slot} ${item.subtype || ''} ${item.rarity} ${item.rarityLabel || ''} ${item.weaponVisual?.stageKey || ''} lv.${item.levelReq} ${tierInfo.badge}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderLeftCatalogItems() {
  const list = getFilteredItems();
  dom.itemCountBadge.textContent = String(list.length);

  renderGroupedCatalogList({
    containerEl: dom.catalogItemsList,
    items: list,
    catalog: state.catalog,
    equippedBySlot: state.equippedBySlot,
    expandedKeys: state.expandedGroupKeys,
    mapItemToTier,
    onToggleGroup: (key) => {
      if (state.expandedGroupKeys.has(key)) state.expandedGroupKeys.delete(key);
      else state.expandedGroupKeys.add(key);
      renderLeftCatalogItems();
    },
    onEquipLine: (pieces, grp) => equipArmorLine(pieces, grp),
    onEquipItem: (item) => equipCatalogItem(item),
  });
}

const ARMOR_SLOT_SHORT = {
  helmet: 'Helm',
  shoulders: 'Shldr',
  chest: 'Chest',
  gloves: 'Glove',
  legs: 'Legs',
  boots: 'Boots',
};

function unequipArmorSlot(slot) {
  if (!ARMOR_SLOTS.includes(slot) || !state.equippedBySlot[slot]) return;
  const removed = state.equippedBySlot[slot];
  delete state.equippedBySlot[slot];
  if (state.activeItem?.id === removed.id) {
    state.activeItem = Object.values(state.equippedBySlot)[0] || null;
  }
  const hasAnyArmor = ARMOR_SLOTS.some((s) => Boolean(state.equippedBySlot[s]));
  if (!hasAnyArmor) state.armorStripped = true;
  void stage.setEquippedArmor(state.equippedBySlot, { stripped: state.armorStripped });
  refreshLoadoutViews();
  renderColorOptions();
  showToast(`Unequipped ${removed.name || slot}`);
}

async function unequipWeaponSlot(slot) {
  if ((slot !== 'main_hand' && slot !== 'off_hand') || !state.equippedBySlot[slot]) return;
  const removed = state.equippedBySlot[slot];
  delete state.equippedBySlot[slot];
  if (state.activeItem?.id === removed.id) {
    state.activeItem = Object.values(state.equippedBySlot)[0] || null;
  }
  await stage.setEquippedWeapons(state.equippedBySlot, { remount: true });
  refreshLoadoutViews();
  showToast(`Unequipped ${removed.name || slot} (default T1 fallback active)`);
}

function equipArmorLine(pieces, grp) {
  if (!pieces?.length) return;
  state.armorStripped = false;
  for (const p of pieces) state.equippedBySlot[p.slot] = p;
  state.activeItem = pieces[0];
  state.balanceLevel = grp?.levelReq || pieces[0].levelReq || state.balanceLevel;
  const tierInfo = mapItemToTier(pieces[0]);
  setActiveTier(tierInfo.tierKey, { unstrip: true });
  void stage.setEquippedArmor(state.equippedBySlot, { stripped: false });
  refreshLoadoutViews();
  renderColorOptions();
  showToast(`Equipped ${grp?.lineName || pieces[0].name} (${pieces.length}pc Lv.${state.balanceLevel}) → 3D ${tierInfo.tierKey}`);
}

function syncReaverSlotsAndPairing() {
  const mArch = weaponArchetype(state.equippedBySlot.main_hand);
  const oArch = weaponArchetype(state.equippedBySlot.off_hand);
  if (mArch === 'axe_1h' && oArch === 'sword_1h') {
    const tmp = state.equippedBySlot.main_hand;
    state.equippedBySlot.main_hand = state.equippedBySlot.off_hand;
    state.equippedBySlot.off_hand = tmp;
    state.reaverPairing = 'swd_axe';
    return;
  }
  if (mArch === 'sword_1h' && oArch === 'axe_1h') state.reaverPairing = 'swd_axe';
  else if (mArch === 'sword_1h' && oArch === 'sword_1h') state.reaverPairing = 'swd_swd';
  else if (mArch === 'axe_1h' && (oArch === 'axe_1h' || !oArch)) state.reaverPairing = 'axe_axe';
  else if (mArch === 'sword_1h' && !oArch && state.reaverPairing === 'axe_axe') state.reaverPairing = 'swd_axe';
}

async function equipCatalogItem(item) {
  const isArmor = ARMOR_SLOTS.includes(item.slot);
  if (isArmor) {
    state.armorStripped = false;
    state.equippedBySlot[item.slot] = item;
    state.activeItem = item;
    const tierInfo = mapItemToTier(item);
    setActiveTier(tierInfo.tierKey, { unstrip: true });
    void stage.setEquippedArmor(state.equippedBySlot, { stripped: false });
    refreshLoadoutViews();
    renderColorOptions();
    showToast(`Equipped ${item.name} → 3D ${tierInfo.tierKey}`);
    return;
  }

  if (isWeaponCatalogItem(item)) {
    const arch = weaponArchetype(item);
    let nextStyle = state.weaponStyle;
    let handNote = item.slot;

    if (item.slot === 'off_hand') {
      state.equippedBySlot.off_hand = item;
      if (isTwoHandOrDualWeapon(state.equippedBySlot.main_hand)) {
        delete state.equippedBySlot.main_hand;
      }
      if (state.baseClass === 'squire' && (state.weaponStyle === 'dual_1h' || state.weaponStyle === 'sword_2h')) {
        nextStyle = weaponArchetype(state.equippedBySlot.main_hand) === 'axe_1h' ? 'axe_1h' : 'sword_1h';
      }
    } else if (isTwoHandOrDualWeapon(item)) {
      delete state.equippedBySlot.off_hand;
      state.equippedBySlot.main_hand = item;
      nextStyle = mapWeaponItemToStyle(item) || nextStyle;
    } else if (state.baseClass === 'squire' && state.weaponStyle === 'dual_1h' && isReaverOneHandWeapon(item)) {
      const mainIs1H = isReaverOneHandWeapon(state.equippedBySlot.main_hand);
      const offIs1H = isReaverOneHandWeapon(state.equippedBySlot.off_hand);
      if (!mainIs1H) {
        if (state.equippedBySlot.off_hand && !offIs1H) delete state.equippedBySlot.off_hand;
        state.equippedBySlot.main_hand = item;
        state.reaverNextHand = 'off_hand';
        handNote = 'main_hand (Reaver)';
      } else if (!offIs1H) {
        state.equippedBySlot.off_hand = item;
        state.reaverNextHand = 'main_hand';
        handNote = 'off_hand (Reaver)';
      } else {
        const targetHand = state.reaverNextHand === 'main_hand' ? 'main_hand' : 'off_hand';
        state.equippedBySlot[targetHand] = item;
        state.reaverNextHand = targetHand === 'main_hand' ? 'off_hand' : 'main_hand';
        handNote = `${targetHand} (Reaver)`;
      }
      syncReaverSlotsAndPairing();
      nextStyle = 'dual_1h';
    } else {
      if (state.equippedBySlot.off_hand && (arch === 'wand' || weaponArchetype(state.equippedBySlot.off_hand) !== 'shield')) {
        delete state.equippedBySlot.off_hand;
      }
      state.equippedBySlot.main_hand = item;
      nextStyle = mapWeaponItemToStyle(item) || nextStyle;
    }

    state.activeItem = item;
    await stage.setEquippedWeapons(state.equippedBySlot, { remount: false });
    await setWeaponStyle(nextStyle);
    renderLeftCatalogItems();
    renderActiveLoadoutSummary();
    renderCharacterSheet();
    renderBossHud();
    const stTag = item.weaponVisual?.stageKey ? item.weaponVisual.stageKey.toUpperCase() : 'T1';
    const rarTag = item.weaponVisual?.rarityLabel || item.rarityLabel || '';
    showToast(`Equipped ${item.name} [${stTag}${rarTag ? ` · ${rarTag}` : ''}] → ${handNote}`);
    return;
  }

  state.equippedBySlot[item.slot] = item;
  state.activeItem = item;
  refreshLoadoutViews();
  showToast(`Equipped ${item.name}`);
}

function renderActiveLoadoutSummary() {
  const equippedCount = Object.keys(state.equippedBySlot).length;
  const hasAnyArmor = ARMOR_SLOTS.some((s) => Boolean(state.equippedBySlot[s]));
  if (state.activeItem) {
    const wStage = state.activeItem.weaponVisual?.stageKey ? ` • ${state.activeItem.weaponVisual.stageKey.toUpperCase()}` : '';
    dom.loadoutActiveItem.textContent = `${state.activeItem.name}${wStage} (${equippedCount} slot${equippedCount === 1 ? '' : 's'})`;
  } else if (state.armorStripped && !hasAnyArmor) {
    dom.loadoutActiveItem.textContent = 'Base Undergarment • Pick gear or tier';
  } else {
    dom.loadoutActiveItem.textContent = `Base ${getBaseClassInfo()?.displayName || state.baseClass} • Click gear above`;
  }

  if (dom.loadoutArmorSlots) {
    dom.loadoutArmorSlots.innerHTML = ARMOR_SLOTS.map((slot) => {
      const item = state.equippedBySlot[slot];
      const label = ARMOR_SLOT_SHORT[slot] || slot;
      if (item) {
        const dot = item.nativePalette?.Primary;
        return `<button type="button" class="loadout-slot-pill equipped" data-unequip-slot="${slot}" title="${escapeHtml(item.name)} — Click to unequip ${slot}">${dot ? `<span class="loadout-slot-dot" style="background:${escapeHtml(dot)}"></span>` : ''}<span>${label}</span></button>`;
      }
      if (!hasAnyArmor && !state.armorStripped) {
        return `<span class="loadout-slot-pill fallback" title="Default ${escapeHtml(state.activeTier)} ${slot}">${label}</span>`;
      }
      return `<span class="loadout-slot-pill" title="Empty ${slot} (base undergarment)">${label}</span>`;
    }).join('');
    dom.loadoutArmorSlots.querySelectorAll('[data-unequip-slot]').forEach((btn) => {
      btn.addEventListener('click', () => unequipArmorSlot(btn.dataset.unequipSlot));
    });
  }

  if (dom.loadoutWeaponSlots) {
    const activeStyle = getActiveWeaponStyle();
    const mh = state.equippedBySlot.main_hand || null;
    const oh = state.equippedBySlot.off_hand || null;
    const style2HOrDual = ['sword_2h', 'bow', 'razor_fans', 'staff', 'stick_2h', 'gauntlet'].includes(activeStyle.id);

    const renderWeaponPill = (handCode, item, fallbackText, lockedText = null) => {
      if (lockedText) {
        return `<span class="loadout-weapon-pill fallback" title="${escapeHtml(lockedText)}"><span class="loadout-weapon-hand">${handCode}</span><span class="loadout-weapon-name">${escapeHtml(lockedText)}</span></span>`;
      }
      if (item) {
        const wv = item.weaponVisual;
        const st = wv?.stageKey ? wv.stageKey.toUpperCase() : 'T1';
        const dot = wv?.nativePalette?.Primary || item.nativePalette?.Primary;
        const glow = wv?.nativePalette?.Glow;
        const rar = String(item.rarity || 'common').toLowerCase();
        return `<button type="button" class="loadout-weapon-pill equipped rarity-${escapeHtml(rar)}" data-unequip-weapon="${escapeHtml(item.slot)}" title="${escapeHtml(item.name)} [${st}] — Click to unequip">${dot ? `<span class="loadout-slot-dot" style="background:${escapeHtml(dot)}"></span>` : ''}${glow ? `<span class="loadout-slot-dot" style="background:${escapeHtml(glow)}"></span>` : ''}<span class="loadout-weapon-hand">${handCode}</span><span class="loadout-weapon-name rarity-text-${escapeHtml(rar)}">${escapeHtml(item.name)}</span><span class="loadout-weapon-stage">${escapeHtml(st)}</span></button>`;
      }
      return `<span class="loadout-weapon-pill fallback" title="Default ${escapeHtml(fallbackText)} [T1]"><span class="loadout-weapon-hand">${handCode}</span><span class="loadout-weapon-name">${escapeHtml(fallbackText)}</span><span class="loadout-weapon-stage">T1</span></span>`;
    };

    let ohLocked = null;
    let ohFallback = 'Empty';
    if (style2HOrDual || (mh && isTwoHandOrDualWeapon(mh))) {
      if (activeStyle.id === 'bow') ohLocked = 'Quiver';
      else if (activeStyle.id === 'razor_fans' || activeStyle.id === 'gauntlet') {
        const st = mh?.weaponVisual?.stageKey ? mh.weaponVisual.stageKey.toUpperCase() : 'T1';
        ohLocked = `Twin (${st})`;
      } else {
        ohLocked = '2H Grip';
      }
    } else if (activeStyle.id === 'dual_1h') {
      ohFallback = state.reaverPairing === 'swd_swd' ? 'Off Swd' : 'Off Axe';
    } else if (activeStyle.id === 'sword_1h' || activeStyle.id === 'axe_1h') {
      ohFallback = 'Shield';
    } else if (activeStyle.id === 'wand') {
      ohLocked = '1H Wand';
    }

    dom.loadoutWeaponSlots.innerHTML =
      renderWeaponPill('MH', mh, activeStyle.shortLabel || activeStyle.id) +
      renderWeaponPill('OH', ohLocked ? null : oh, ohFallback, ohLocked);

    dom.loadoutWeaponSlots.querySelectorAll('[data-unequip-weapon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void unequipWeaponSlot(btn.dataset.unequipWeapon);
      });
    });
  }

  const { totals } = computeCombinedStats();
  const activeStyle = getActiveWeaponStyle();
  const isMagic = activeStyle.scalingStat === 'elemAtk';
  dom.loadoutStatsStrip.innerHTML = `
    <span class="stat-chip">HP <strong>${totals.hp}</strong></span>
    <span class="stat-chip">${isMagic ? 'MATK' : 'ATK'} <strong>${isMagic ? totals.elemAtk : totals.physAtk}</strong></span>
    <span class="stat-chip">${isMagic ? 'MDEF' : 'DEF'} <strong>${isMagic ? totals.elemDef : totals.physDef}</strong></span>
    <span class="stat-chip">SPD <strong>${totals.speed}</strong></span>
  `;
}

// --- Mode 1: Character Select Cards ---
function renderCharacterSelectCards() {
  const classes = state.catalog?.baseClasses || [];
  const specs = state.catalog?.specializations || [];
  if (!classes.length) return;

  dom.csClassCards.innerHTML = classes
    .map((cls) => {
      const active = cls.id === state.baseClass;
      const classSpecs = specs.filter((s) => s.baseClass === cls.id).map((s) => s.displayName);
      const weapons = [...(cls.allowedWeapons || []), ...(cls.allowedOffhands || [])];
      return `
        <button type="button" class="cs-card${active ? ' active' : ''}" data-select-class="${cls.id}">
          <div class="cs-card-head">
            <span class="cs-card-title">${escapeHtml(cls.displayName)}</span>
            <span class="badge ${active ? 'badge-amber' : 'badge-cyan'}">${escapeHtml(cls.armorWeight)}</span>
          </div>
          <div class="cs-card-role">${escapeHtml(cls.role)}</div>
          <div class="cs-chip-row">
            ${weapons.map((w) => `<span class="cs-chip">${escapeHtml(w)}</span>`).join('')}
          </div>
          <div class="cs-chip-row">
            ${classSpecs.map((sp) => `<span class="cs-chip spec">${escapeHtml(sp)}</span>`).join('')}
          </div>
          <div class="cs-card-foot">
            <span>HP ${cls.baseStats?.baseHp ?? 100} • SPD ${cls.baseStats?.baseSpeed ?? 90}</span>
            <strong>${active ? 'ACTIVE 3D' : 'Load →'}</strong>
          </div>
        </button>
      `;
    })
    .join('');

  dom.csClassCards.querySelectorAll('[data-select-class]').forEach((btn) => {
    btn.addEventListener('click', () => selectBaseClass(btn.dataset.selectClass));
  });
}

// --- Mode 4B: Turn-Based Boss Logic ---
function resetBossFight() {
  const { totals } = computeCombinedStats();
  state.boss = {
    turnNumber: 1,
    heroHp: totals.hp,
    heroMaxHp: totals.hp,
    heroWard: 0,
    bossHp: 1200,
    bossMaxHp: 1200,
    burstCooldown: 0,
    busy: false,
    autoBattle: false,
    autoStep: 0,
    intent: 'CHARGING',
    over: false,
  };
  stage.resetBossVisuals();
  renderBossHud();
}

function renderBossHud() {
  const b = state.boss;
  const cls = getBaseClassInfo();
  const wStyle = getActiveWeaponStyle();
  const moves = (wStyle.glyphs || []).filter((g) => g.role === 'move');
  const sigSkill = moves[0]?.name || CLASS_SKILL_META[state.baseClass]?.skill || 'Signature';
  const burstSkill = moves[moves.length - 1]?.name || CLASS_SKILL_META[state.baseClass]?.burst || 'Ultimate';

  dom.bossHeroName.textContent = cls?.displayName || state.baseClass;
  const autoNameEl = document.getElementById('boss-auto-atk-name');
  const autoSubEl = document.getElementById('boss-auto-atk-sub');
  if (autoNameEl) autoNameEl.textContent = `${wStyle.shortLabel} Auto`;
  if (autoSubEl) autoSubEl.textContent = wStyle.autoChain?.[0]?.name || '3-Hit Chain';
  dom.bossClassSkillName.textContent = sigSkill;
  dom.bossTurnBadge.textContent = `Turn ${b.turnNumber}`;
  dom.bossIntentBadge.textContent = b.over ? (b.bossHp <= 0 ? 'DEFEATED' : 'VICTORIOUS') : b.intent;
  dom.bossHpFill.style.width = `${Math.max(0, (b.bossHp / b.bossMaxHp) * 100)}%`;
  dom.bossHpText.textContent = `${b.bossHp} / ${b.bossMaxHp} HP`;

  dom.bossHeroHpFill.style.width = `${Math.max(0, (b.heroHp / b.heroMaxHp) * 100)}%`;
  dom.bossHeroWardFill.style.width = `${Math.min(100, (b.heroWard / b.heroMaxHp) * 100)}%`;
  dom.bossHeroHpText.textContent = `${b.heroHp} / ${b.heroMaxHp} HP`;
  dom.bossHeroWardBadge.classList.toggle('hidden', b.heroWard <= 0);
  dom.bossHeroWardBadge.textContent = `Ward +${b.heroWard}`;

  dom.bossBurstSub.textContent = b.burstCooldown > 0 ? `CD ${b.burstCooldown}` : `T5 · ${burstSkill}`;
  dom.bossAutoBtn.classList.toggle('active', b.autoBattle);
  dom.bossAutoState.textContent = b.autoBattle ? 'ON' : 'OFF';

  // Turn Order Speed Bar based on Hero Speed vs Boss Speed (95)
  const { totals } = computeCombinedStats();
  const heroSpd = totals.speed || 90;
  const bossSpd = 95;
  const tokens = [];
  let hT = 100 / heroSpd;
  let bT = 100 / bossSpd;
  for (let i = 0; i < 6; i += 1) {
    if (hT <= bT) {
      tokens.push({ who: 'hero', label: `${cls?.displayName || 'Hero'} (${heroSpd})` });
      hT += 100 / heroSpd;
    } else {
      tokens.push({ who: 'boss', label: `Rift Boss (${bossSpd})` });
      bT += 100 / bossSpd;
    }
  }
  dom.bossTurnTokens.innerHTML = tokens
    .map((tk, idx) => `<span class="turn-token ${tk.who}${idx === 0 ? ' next' : ''}">${escapeHtml(tk.label)}</span>`)
    .join('');
}

function triggerBossAction(action) {
  if (action === 'reset') {
    resetBossFight();
    showToast('Reset Rift Boss encounter.');
    return;
  }
  if (action === 'auto') {
    state.boss.autoBattle = !state.boss.autoBattle;
    renderBossHud();
    if (state.boss.autoBattle && !state.boss.busy && !state.boss.over) {
      runAutoBossStep();
    }
    return;
  }

  const b = state.boss;
  if (b.busy || b.over) return;
  if (action === 'burst' && b.burstCooldown > 0) {
    showToast(`Burst cooling down (${b.burstCooldown} turns).`, true);
    return;
  }

  b.busy = true;
  const { totals } = computeCombinedStats();
  const atk = Math.max(totals.physAtk, totals.elemAtk);
  let damage = 0;
  let crit = false;
  let ward = 0;

  if (action === 'slash') {
    crit = Math.random() < 0.22;
    damage = Math.round(atk * (0.95 + Math.random() * 0.2) * (crit ? 1.55 : 1));
    dom.bossPhaseText.textContent = 'Hero Slash!';
  } else if (action === 'skill') {
    crit = Math.random() < 0.35;
    damage = Math.round(atk * (1.45 + Math.random() * 0.25) * (crit ? 1.6 : 1));
    dom.bossPhaseText.textContent = `${CLASS_SKILL_META[state.baseClass]?.skill || 'Class Skill'}!`;
  } else if (action === 'guard') {
    ward = Math.round(65 + totals.physDef * 0.65);
    b.heroWard = Math.min(260, b.heroWard + ward);
    dom.bossPhaseText.textContent = 'Aegis Guard (+Ward)';
  } else if (action === 'burst') {
    crit = true;
    damage = Math.round(atk * 2.45);
    b.burstCooldown = 3;
    dom.bossPhaseText.textContent = 'BURST OVERDRIVE!';
  }

  if (action !== 'burst' && b.burstCooldown > 0) {
    b.burstCooldown -= 1;
  }

  stage.playBossHeroAction(action, { damage, crit, ward, classId: state.baseClass });

  setTimeout(() => {
    if (damage > 0) {
      b.bossHp = Math.max(0, b.bossHp - damage);
    }
    renderBossHud();

    if (b.bossHp <= 0) {
      b.over = true;
      b.busy = false;
      b.autoBattle = false;
      dom.bossPhaseText.textContent = 'VICTORY! Rift Boss Defeated!';
      handleArenaBossVictory();
      renderBossHud();
      showToast('Rift Boss defeated! Collect your ground drops or Press Reset.');
      return;
    }

    // Boss Retaliation Turn
    setTimeout(() => {
      dom.bossPhaseText.textContent = 'Rift Boss Strikes!';
      const rawEnemyDmg = Math.round((85 + Math.random() * 35) * (action === 'guard' ? 0.4 : 1.0));
      const absorbed = Math.min(b.heroWard, rawEnemyDmg);
      b.heroWard -= absorbed;
      const hpDmg = Math.max(0, rawEnemyDmg - absorbed);
      b.heroHp = Math.max(0, b.heroHp - hpDmg);
      b.turnNumber += 1;
      b.intent = b.turnNumber % 3 === 0 ? 'RIFT NOVA' : 'CLEAVE';

      stage.playBossEnemyStrike({ damage: hpDmg, absorbed, wardBroken: absorbed > 0 && b.heroWard === 0 });
      renderBossHud();

      setTimeout(() => {
        b.busy = false;
        if (b.heroHp <= 0) {
          b.over = true;
          b.autoBattle = false;
          dom.bossPhaseText.textContent = 'Hero Fallen — Click Reset';
        } else {
          dom.bossPhaseText.textContent = 'Hero Turn Ready';
        }
        renderBossHud();
        if (b.autoBattle && !b.over && state.mode === 'battle-mode' && state.battleSubMode === 'boss') {
          runAutoBossStep();
        }
      }, 650);
    }, 520);
  }, 460);
}

function runAutoBossStep() {
  if (!state.boss.autoBattle || state.boss.busy || state.boss.over) return;
  const seq = state.boss.burstCooldown === 0 ? ['burst', 'skill', 'slash', 'guard'] : ['skill', 'slash', 'guard'];
  const next = seq[state.boss.autoStep % seq.length];
  state.boss.autoStep += 1;
  triggerBossAction(next);
}

// --- Mode 5: Character Sheet ---
/** Tier of the set with the most pieces worn (chest counts double), or null with no set pieces. */
function dominantSetTier() {
  const counts = {};
  for (const [slot, it] of Object.entries(state.equippedBySlot)) {
    if (it?.setId) counts[it.setId] = (counts[it.setId] || 0) + (slot === 'chest' ? 2 : 1);
  }
  const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const item = best && Object.values(state.equippedBySlot).find((it) => it?.setId === best);
  return item ? visualTierForItem(item) : null;
}

function refreshLoadoutViews() {
  renderLeftCatalogItems();
  renderActiveLoadoutSummary();
  renderCharacterSheet();
  renderBossHud();
}

const balancePanel = createSetBalancePanel({
  root: dom.sheetBalance,
  statsGrid: dom.sheetStatsGrid,
  getState: () => state,
  toast: showToast,
  onLevel: (lv) => {
    state.balanceLevel = lv;
    refreshLoadoutViews();
  },
  onEquipSet: (set) => {
    const byId = new Map((state.catalog?.items || []).map((i) => [i.id, i]));
    state.armorStripped = false;
    for (const pid of set.pieceBaseIds) {
      const item = byId.get(pid);
      if (item) state.equippedBySlot[item.slot] = item;
    }
    state.activeItem = byId.get(set.pieceBaseIds[0]) || state.activeItem;
    state.balanceLevel = Math.max(state.balanceLevel, set.levelRange[0]);
    const tier = dominantSetTier();
    if (tier) setActiveTier(tier, { unstrip: true });
    void stage.setEquippedArmor(state.equippedBySlot, { stripped: false });
    refreshLoadoutViews();
    renderColorOptions();
    showToast(`Equipped ${set.name} (6 pieces) → 3D ${tier || state.activeTier}`);
  },
  onStripArmor: () => {
    for (const slot of Object.keys(state.equippedBySlot)) {
      if (slot !== 'main_hand' && slot !== 'off_hand') delete state.equippedBySlot[slot];
    }
    state.activeItem = null;
    state.armorStripped = true;
    void stage.setEquippedArmor(state.equippedBySlot, { stripped: true });
    refreshLoadoutViews();
    renderColorOptions();
    showToast('Stripped armor to base undergarment.');
  },
  onVisualsChanged: () => {
    const tier = dominantSetTier();
    if (tier) setActiveTier(tier);
    refreshLoadoutViews();
  },
});

function renderCharacterSheet() {
  const cls = getBaseClassInfo();
  const style = FLYFF_STYLES.find((s) => s.id === state.styleId);
  const face = FACE_PRESETS.find((f) => f.id === state.faceId);
  const wStyle = getActiveWeaponStyle();
  const weaponLabel = `${wStyle.label} (${wStyle.scalingLabel})`;

  dom.sheetClassTitle.textContent = cls?.displayName || state.baseClass;
  dom.sheetClassSub.textContent = `${state.gender === 'male' ? '♂ Male' : '♀ Female'} • ${face?.label || state.faceId} • ${weaponLabel} • ${state.activeTier}`;

  balancePanel.render();

  const equipped = Object.values(state.equippedBySlot);
  if (!equipped.length) {
    dom.sheetEquippedList.innerHTML =
      '<div class="sheet-equip-row" style="grid-column:span 2;color:var(--text-muted);">No catalog gear equipped — click items in Left Rail to equip.</div>';
  } else {
    dom.sheetEquippedList.innerHTML = equipped
      .slice(0, 12)
      .map((item) => {
        const tierInfo = mapItemToTier(item);
        const rarity = (item.rarity || 'common').toLowerCase();
        return `
          <div class="sheet-equip-row">
            <span class="sheet-equip-name rarity-text-${rarity}">${escapeHtml(item.name)}</span>
            <span class="lv-badge ${tierInfo.css}">Lv.${item.levelReq}</span>
          </div>
        `;
      })
      .join('');
  }

  dom.sheetStyleName.textContent = style?.name || state.styleId;
  dom.sheetDyeSwatches.innerHTML = MATERIAL_KEYS.map(
    (k) => `<span class="dye-dot" style="background:${state.palette[k]};" title="${k}: ${state.palette[k]}"></span>`
  ).join('');
}

// --- Right Rail ---
function renderFaceGrid() {
  if (!dom.rightFaceGrid) return;
  dom.rightFaceGrid.innerHTML = FACE_PRESETS.map((preset) => {
    const active = state.faceId === preset.id;
    return `
      <button type="button" class="face-pill-btn${active ? ' active' : ''}" data-face-id="${preset.id}" title="${escapeHtml(preset.label)}">
        <span class="face-iris-dot" style="background:${preset.irisMid};"></span>
        <span>${preset.code}</span>
      </button>
    `;
  }).join('');

  dom.rightFaceGrid.querySelectorAll('[data-face-id]').forEach((btn) => {
    btn.addEventListener('click', () => setFace(btn.dataset.faceId));
  });

  const activePreset = FACE_PRESETS.find((f) => f.id === state.faceId);
  if (dom.rightFaceLabel && activePreset) {
    dom.rightFaceLabel.textContent = activePreset.label;
  }
}

function getEffectiveTargetHex(target, matKey) {
  const clsDefaults = CLASS_DEFAULT_PALETTES[state.baseClass] || CLASS_DEFAULT_PALETTES.squire;
  if (target === 'all' || matKey === 'Skin') {
    return (state.palette[matKey] || clsDefaults[matKey] || '#ffffff').toUpperCase();
  }
  const slotOverride = state.slotDyeOverrides?.[target]?.[matKey];
  if (slotOverride) return slotOverride.toUpperCase();
  const globalOv = state.globalArmorOverride?.[matKey];
  if (globalOv) return globalOv.toUpperCase();
  const nativeHex = state.equippedBySlot?.[target]?.nativePalette?.[matKey];
  if (nativeHex) return nativeHex.toUpperCase();
  return (clsDefaults[matKey] || state.palette[matKey] || '#ffffff').toUpperCase();
}

function renderDyeTargetPills() {
  if (!dom.dyeTargetPills?.length) return;
  const hasAnyArmor = ARMOR_SLOTS.some((s) => Boolean(state.equippedBySlot?.[s]));
  dom.dyeTargetPills.forEach((btn) => {
    const target = btn.dataset.dyeTarget;
    btn.classList.toggle('active', target === state.dyeTarget);
    const hasOverride =
      target !== 'all' &&
      state.slotDyeOverrides?.[target] &&
      Object.keys(state.slotDyeOverrides[target]).length > 0;
    btn.classList.toggle('has-dye', Boolean(hasOverride));
    const isEmpty =
      target !== 'all' &&
      (state.armorStripped || (hasAnyArmor && !state.equippedBySlot?.[target]));
    btn.classList.toggle('is-empty', Boolean(isEmpty));
  });
}

function renderColorOptions() {
  renderDyeTargetPills();
  const target = state.dyeTarget;
  dom.colorPickersGrid.innerHTML = MATERIAL_KEYS.map((matKey) => {
    const hex = getEffectiveTargetHex(target, matKey);
    const hasSlotOv = target !== 'all' && matKey !== 'Skin' && Boolean(state.slotDyeOverrides?.[target]?.[matKey]);
    return `
      <label class="color-picker-tile${hasSlotOv ? ' has-override' : ''}" data-mat-tile="${matKey}">
        <input type="color" data-mat-color="${matKey}" value="${hex}" />
        <div class="color-picker-meta">
          <span>${matKey}</span>
          <code data-mat-hex="${matKey}">${hex}</code>
        </div>
      </label>
    `;
  }).join('');

  dom.colorPickersGrid.querySelectorAll('[data-mat-color]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.matColor;
      const val = e.target.value;
      if (state.dyeTarget === 'all' || key === 'Skin') {
        state.palette[key] = val;
        state.activePresetId = null;
        const applyGlobal = state.dyeTarget === 'all' && key !== 'Skin';
        if (applyGlobal) {
          state.globalArmorOverride = { ...(state.globalArmorOverride || {}), [key]: val };
        }
        stage.setMaterialColor(key, val, { updateArmorOverride: applyGlobal });
      } else {
        state.slotDyeOverrides[state.dyeTarget] = {
          ...(state.slotDyeOverrides[state.dyeTarget] || {}),
          [key]: val,
        };
        state.activePresetId = null;
        stage.setSlotDye(state.dyeTarget, key, val);
        const tile = dom.colorPickersGrid.querySelector(`[data-mat-tile="${key}"]`);
        tile?.classList.add('has-override');
      }
      const codeEl = dom.colorPickersGrid.querySelector(`[data-mat-hex="${key}"]`);
      if (codeEl) codeEl.textContent = val.toUpperCase();
      renderDyeTargetPills();
      renderPalettePresets();
      renderCharacterSheet();
    });
  });

  renderPalettePresets();
}

function renderPalettePresets() {
  dom.palettePresetsGrid.innerHTML = PALETTE_PRESETS.map(
    (preset) => `
      <button type="button" class="palette-preset-btn${state.activePresetId === preset.id ? ' active' : ''}" data-preset-id="${preset.id}">
        <span class="preset-dots">
          <i style="background:${preset.colors.Primary}"></i>
          <i style="background:${preset.colors.Trim}"></i>
          <i style="background:${preset.colors.Glow}"></i>
        </span>
        <span>${escapeHtml(preset.name)}</span>
      </button>
    `
  ).join('');

  dom.palettePresetsGrid.querySelectorAll('[data-preset-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = PALETTE_PRESETS.find((p) => p.id === btn.dataset.presetId);
      if (!preset) return;
      if (state.dyeTarget === 'all') {
        state.activePresetId = preset.id;
        state.palette = { ...preset.colors };
        state.slotDyeOverrides = {};
        state.globalArmorOverride = { ...preset.colors };
        stage.applyPaletteToAllSlots(state.palette);
        showToast(`Applied ${preset.name} palette to hero & all armor.`);
      } else {
        const slot = state.dyeTarget;
        state.activePresetId = null;
        state.slotDyeOverrides[slot] = {};
        for (const ch of MATERIAL_KEYS) {
          if (ch !== 'Skin' && preset.colors[ch]) {
            state.slotDyeOverrides[slot][ch] = preset.colors[ch];
            stage.setSlotDye(slot, ch, preset.colors[ch]);
          }
        }
        showToast(`Dyed ${ARMOR_SLOT_SHORT[slot] || slot} with ${preset.name}.`);
      }
      renderColorOptions();
      renderCharacterSheet();
    });
  });
}

// --- Import 3D Modal (POST /api/import-render) ---
function setImportSourceMode(mode) {
  state.importSourceMode = mode;
  dom.importSourceBtns.forEach((b) => b.classList.toggle('active', b.dataset.importSource === mode));
  dom.importFilePanel.classList.toggle('hidden', mode !== 'file');
  dom.importLocalPanel.classList.toggle('hidden', mode !== 'local');
}

function suggestAssetIdFromName(name) {
  const base = String(name || '')
    .split(/[/\\]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'custom-3d-asset';
}

function handleChosenImportFile(file) {
  const lower = file.name.toLowerCase();
  if (!VALID_IMPORT_EXTS.some((ext) => lower.endsWith(ext))) {
    showToast(`Unsupported extension. Allowed: ${VALID_IMPORT_EXTS.join(', ')}`, true);
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    showToast('File exceeds 50 MB import limit.', true);
    return;
  }
  state.importFile = file;
  dom.importFileTitle.textContent = file.name;
  dom.importFileMeta.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready`;
  if (!state.importAssetIdTouched || !dom.importAssetId.value.trim()) {
    dom.importAssetId.value = suggestAssetIdFromName(file.name);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

async function submitImportRender(e) {
  e.preventDefault();
  if (state.importBusy) return;

  const assetId = dom.importAssetId.value.trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(assetId)) {
    showToast('Invalid Asset ID format.', true);
    return;
  }

  const payload = {
    assetId,
    slot: dom.importSlot.value,
    angle: dom.importAngle.value,
    holdoutMannequin: dom.importHoldout.checked,
    autoFit: dom.importAutofit.checked,
  };

  try {
    if (state.importSourceMode === 'file') {
      if (!state.importFile) {
        showToast('Please select a 3D model file first.', true);
        return;
      }
      payload.filename = state.importFile.name;
      payload.fileBase64 = await readFileAsBase64(state.importFile);
    } else {
      const localPath = dom.importLocalPath.value.trim();
      if (!localPath) {
        showToast('Please enter a local model path.', true);
        return;
      }
      payload.localPath = localPath;
    }

    state.importBusy = true;
    dom.importSubmitBtn.disabled = true;
    dom.importCancelBtn.disabled = true;
    dom.importSubmitBtn.textContent = 'Rendering…';
    dom.importResultBox.classList.remove('hidden');
    dom.importStatusBadge.className = 'badge badge-amber';
    dom.importStatusBadge.textContent = 'RUNNING';
    dom.importStatusText.textContent = `Rendering ${assetId} in Blender…`;
    dom.importRenderLog.textContent = 'Starting Blender process…';
    dom.importQcLog.textContent = 'Pending…';

    const res = await fetch('/api/import-render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    dom.importRenderLog.textContent = data.renderLog || '(no render log)';
    dom.importQcLog.textContent = data.qcOutput || '(no QC output)';

    if (data.ok) {
      dom.importStatusBadge.className = 'badge badge-promoted';
      dom.importStatusBadge.textContent = 'QC PASSED';
      dom.importStatusText.textContent = `${data.assetId || assetId} rendered & validated!`;
      showToast(`Imported & rendered ${data.assetId || assetId}!`);
      await fetchCatalog();
    } else {
      dom.importStatusBadge.className = 'badge badge-error';
      dom.importStatusBadge.textContent = `EXIT ${data.exitCode ?? 1}`;
      dom.importStatusText.textContent = 'Render or QC reported issues.';
      showToast(`Import exited with code ${data.exitCode}`, true);
    }
  } catch (err) {
    dom.importResultBox.classList.remove('hidden');
    dom.importStatusBadge.className = 'badge badge-error';
    dom.importStatusBadge.textContent = 'ERROR';
    dom.importStatusText.textContent = err.message;
    dom.importRenderLog.textContent = err.message;
    showToast(`Import failed: ${err.message}`, true);
  } finally {
    state.importBusy = false;
    dom.importSubmitBtn.disabled = false;
    dom.importCancelBtn.disabled = false;
    dom.importSubmitBtn.textContent = 'Import & Render';
  }
}

// --- Event Bindings ---
function bindEvents() {
  dom.topClassPills.forEach((btn) => {
    btn.addEventListener('click', () => selectBaseClass(btn.dataset.class));
  });

  dom.topGenderPills.forEach((btn) => {
    btn.addEventListener('click', () => setGender(btn.dataset.gender));
  });

  dom.stageReaverPill?.querySelectorAll('[data-reaver-pair]').forEach((btn) => {
    btn.addEventListener('click', () => setReaverPairing(btn.dataset.reaverPair));
  });

  dom.stageStaffElemPill?.querySelectorAll('[data-staff-elem]').forEach((btn) => {
    btn.addEventListener('click', () => setStaffElement(btn.dataset.staffElem));
  });

  document.querySelectorAll('[data-stance-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStanceMode(state.stanceMode === 'combat' ? 'peace' : 'combat');
    });
  });

  dom.modeTabs.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  dom.slotFilterPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.slotFilter = btn.dataset.slotFilter;
      dom.slotFilterPills.forEach((p) => p.classList.toggle('active', p === btn));
      const isWeapons = state.slotFilter === 'weapons';
      dom.poolFilterRow?.classList.toggle('hidden', isWeapons);
      dom.weaponRarityRow?.classList.toggle('hidden', !isWeapons);
      renderLeftCatalogItems();
    });
  });

  dom.poolFilterPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.poolFilter = btn.dataset.poolFilter;
      dom.poolFilterPills.forEach((p) => p.classList.toggle('active', p === btn));
      renderLeftCatalogItems();
    });
  });

  dom.weaponRarityPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.weaponRarityFilter = btn.dataset.weaponRarity || 'all';
      dom.weaponRarityPills.forEach((p) => p.classList.toggle('active', p === btn));
      renderLeftCatalogItems();
    });
  });

  dom.levelBandPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.levelBandFilter = btn.dataset.bandFilter;
      dom.levelBandPills.forEach((p) => p.classList.toggle('active', p === btn));
      renderLeftCatalogItems();
    });
  });

  dom.tierFilterPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tierFilter = btn.dataset.tierFilter;
      dom.tierFilterPills.forEach((p) => p.classList.toggle('active', p === btn));
      renderLeftCatalogItems();
    });
  });

  dom.itemSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderLeftCatalogItems();
  });

  dom.quickTierBtns.forEach((btn) => {
    btn.addEventListener('click', () => setActiveTier(btn.dataset.equipTier));
  });

  dom.clearLoadoutBtn.addEventListener('click', () => {
    state.equippedBySlot = {};
    state.activeItem = null;
    state.armorStripped = true;
    state.reaverNextHand = 'off_hand';
    setActiveTier('Tier_Lv1', { unstrip: false });
    void stage.setEquippedArmor(state.equippedBySlot, { stripped: true });
    void stage.setEquippedWeapons(state.equippedBySlot, { remount: true });
    refreshLoadoutViews();
    renderColorOptions();
    showToast('Reset armor & weapons to base defaults.');
  });

  // Mode 2: Armor Page
  dom.armorTierBtns.forEach((btn) => {
    btn.addEventListener('click', () => setActiveTier(btn.dataset.tier));
  });

  dom.armorWireframeBtn.addEventListener('click', () => {
    state.wireframeEnabled = !state.wireframeEnabled;
    stage.setWireframe(state.wireframeEnabled);
    dom.armorWireframeBtn.classList.toggle('active', state.wireframeEnabled);
  });

  const toggleOutline = () => {
    state.outlineEnabled = !state.outlineEnabled;
    stage.setOutlineEnabled(state.outlineEnabled);
    syncOutlineToggleUI();
  };
  dom.armorOutlineBtn.addEventListener('click', toggleOutline);
  dom.rightOutlineToggle.addEventListener('click', toggleOutline);

  dom.camPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.camPreset;
      stage.setCameraPreset(preset);
      dom.camPresetBtns.forEach((b) => b.classList.toggle('active', b.dataset.camPreset === preset));
    });
  });

  // Mode 3: Walk / Run
  populateWeaponSkillSelects(state.weaponStyle);

  const playSelectedWalkSkill = () => {
    const sel = dom.walkSkillSelect;
    const val = sel?.value;
    if (!val) return;
    dom.walkClipBtns.forEach((b) => b.classList.remove('active'));
    if (val === 'AutoChain') {
      state.walkClip = 'AutoChain';
      stage.setWalkClip('AutoChain');
      return;
    }
    const glyphId = sel.selectedOptions?.[0]?.dataset?.glyphId;
    const glyphDef = glyphId ? getStyleGlyphs(state.weaponStyle).find((g) => g.id === glyphId) : null;
    if (glyphDef) {
      state.walkClip = val;
      stage.setWalkClip(val);
      stage.playStagingGlyph(glyphDef, state.glyphTier);
      return;
    }
    state.walkClip = val;
    stage.setWalkClip(val);
    stage.playBattlePreviewClip(val, null, state.glyphTier);
  };

  dom.walkClipBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.walkClip = btn.dataset.clip;
      if (dom.walkSkillSelect) dom.walkSkillSelect.value = '';
      dom.walkClipBtns.forEach((b) => b.classList.toggle('active', b === btn));
      stage.setWalkClip(state.walkClip);
    });
  });
  dom.walkSkillSelect?.addEventListener('change', playSelectedWalkSkill);
  dom.walkSkillPlayBtn?.addEventListener('click', playSelectedWalkSkill);
  dom.walkTierSelect?.addEventListener('change', () => setGlyphTier(dom.walkTierSelect.value));

  dom.walkJumpBtn?.addEventListener('click', () => {
    stage.triggerJump();
  });

  dom.walkSpeedSlider.addEventListener('input', (e) => {
    state.walkSpeed = Number(e.target.value) || 1;
    dom.walkSpeedVal.textContent = `${state.walkSpeed.toFixed(2)}×`;
    stage.setWalkSpeed(state.walkSpeed);
  });

  dom.walkGridToggle.addEventListener('click', () => {
    state.floorGridVisible = !state.floorGridVisible;
    dom.walkGridToggle.classList.toggle('active', state.floorGridVisible);
    stage.setFloorGridVisible(state.floorGridVisible);
  });

  // Mode 4: Battle Mode
  const playSelectedBattleSkill = () => {
    const sel = dom.battleSkillSelect;
    const val = sel?.value;
    if (!val) return;
    if (val === 'AutoChain') {
      stage.playStagingAutoChain({ repeat: false });
      return;
    }
    const glyphId = sel.selectedOptions?.[0]?.dataset?.glyphId;
    const glyphDef = glyphId ? getStyleGlyphs(state.weaponStyle).find((g) => g.id === glyphId) : null;
    stage.playBattlePreviewClip(val, glyphDef || null, state.glyphTier);
  };
  dom.battleAutoPreviewBtn?.addEventListener('click', () => stage.playStagingAutoChain({ repeat: false }));
  dom.battleSkillSelect?.addEventListener('change', playSelectedBattleSkill);
  dom.battleSkillPlayBtn?.addEventListener('click', playSelectedBattleSkill);
  dom.battleTierSelect?.addEventListener('change', () => setGlyphTier(dom.battleTierSelect.value));

  dom.battleSubmodeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setBattleSubMode(btn.dataset.battleSub));
  });

  dom.grindQuickBtns.forEach((btn) => {
    btn.addEventListener('click', () => stage.targetMob(btn.dataset.targetMob));
  });

  dom.grindResetBtn.addEventListener('click', () => stage.resetGrindingMobs());

  // Battle Mode Ground Loot & Beams Dock
  dom.lootDockToggle?.addEventListener('click', () => {
    state.lootDockCollapsed = !state.lootDockCollapsed;
    dom.lootDockBody?.classList.toggle('hidden', state.lootDockCollapsed);
    dom.lootDockToggle.textContent = state.lootDockCollapsed ? 'Show' : 'Hide';
  });

  dom.lootBackdropBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.arenaLight = btn.dataset.arenaLight || 'day';
      dom.lootBackdropBtns.forEach((b) => b.classList.toggle('active', b === btn));
      stage.setArenaLightingPreset(state.arenaLight);
    });
  });

  dom.lootSpawnRarityBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.spawnRarity;
      const spawned = stage.spawnPresetRarity(r);
      syncLootDockCount();
      void lootAudio.playDrop(r, 'gear');
      if (spawned[0]) showToast(`Spawned ${RARITY_PROFILES[r]?.label || r} beam: ${spawned[0].displayName}`);
    });
  });

  dom.lootSpawnBurstBtn?.addEventListener('click', () => {
    const spawned = stage.spawnBossBurst();
    syncLootDockCount();
    void lootAudio.playDrop('mythic', 'gear');
    showToast(`Spawned Boss Burst (${spawned.length} drops from Coin -> Ultimate)!`);
  });

  dom.lootSpawn12Btn?.addEventListener('click', () => {
    const spawned = stage.spawn12MeshLineup();
    syncLootDockCount();
    void lootAudio.playDrop('rare', 'gear');
    showToast(`Spawned all ${spawned.length} slot silhouettes!`);
  });

  dom.lootAllBtn?.addEventListener('click', () => {
    const picked = stage.lootAllGroundDrops();
    if (!picked.length) showToast('No ground drops to loot.');
  });

  dom.lootClearBtn?.addEventListener('click', () => {
    stage.clearGroundDrops();
    syncLootDockCount();
  });

  const updateBeamSliders = () => {
    const h = Number(dom.lootBeamHeight?.value || 1.0);
    const g = Number(dom.lootBeamGlow?.value || 1.0);
    if (dom.lootBeamHeightVal) dom.lootBeamHeightVal.textContent = `${h.toFixed(2)}×`;
    if (dom.lootBeamGlowVal) dom.lootBeamGlowVal.textContent = `${g.toFixed(2)}×`;
    stage.setLootBeamScale(h, g);
  };
  dom.lootBeamHeight?.addEventListener('input', updateBeamSliders);
  dom.lootBeamGlow?.addEventListener('input', updateBeamSliders);
  dom.lootAutoPickup?.addEventListener('change', (e) => {
    stage.setLootAutoPickup(e.target.checked);
  });

  dom.lootSfxVol?.addEventListener('input', (e) => {
    lootAudio.setVolume(Number(e.target.value));
  });

  dom.lootSfxMute?.addEventListener('click', () => {
    const nextMuted = !lootAudio.getState().muted;
    lootAudio.setMuted(nextMuted);
    dom.lootSfxMute.textContent = nextMuted ? 'Muted' : 'Sound On';
    dom.lootSfxMute.classList.toggle('active', !nextMuted);
  });

  dom.lootAuditionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      void lootAudio.playBankKey(btn.dataset.auditionSfx, { dbOffset: 0, pitchBias: 1 });
    });
  });

  dom.bossActionBtns.forEach((btn) => {
    btn.addEventListener('click', () => triggerBossAction(btn.dataset.bossAction));
  });

  // Mode 5: Character Sheet PNG Export
  dom.sheetExportPngBtn.addEventListener('click', () => {
    const url = stage.captureSnapshotPng();
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumendelve-${state.baseClass}-${state.gender}-${state.faceId}-${state.weaponVariant}-${state.activeTier}-${state.styleId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Exported 3D cockpit PNG snapshot.');
  });

  // Right Rail
  dom.dyeTargetPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.dyeTarget = btn.dataset.dyeTarget || 'all';
      stage.setSlotDyeTarget(state.dyeTarget);
      renderColorOptions();
    });
  });

  dom.applyDyeAllBtn?.addEventListener('click', () => {
    if (state.dyeTarget !== 'all') {
      for (const ch of MATERIAL_KEYS) {
        if (ch !== 'Skin') {
          state.palette[ch] = getEffectiveTargetHex(state.dyeTarget, ch);
        }
      }
    }
    state.slotDyeOverrides = {};
    state.globalArmorOverride = { ...state.palette };
    state.activePresetId = null;
    stage.applyPaletteToAllSlots(state.palette);
    renderColorOptions();
    renderCharacterSheet();
    showToast('Applied palette uniformly to body and all 6 armor slots.');
  });

  dom.resetArmorColorsBtn?.addEventListener('click', () => {
    state.slotDyeOverrides = {};
    state.globalArmorOverride = null;
    state.activePresetId = null;
    stage.clearSlotDyes('all');
    renderColorOptions();
    renderCharacterSheet();
    showToast('Restored equipped armor to native palettes.');
  });

  dom.resetClassColorsBtn.addEventListener('click', () => {
    state.palette = { ...(CLASS_DEFAULT_PALETTES[state.baseClass] || CLASS_DEFAULT_PALETTES.squire) };
    state.slotDyeOverrides = {};
    state.globalArmorOverride = null;
    state.activePresetId = null;
    stage.clearSlotDyes('all');
    stage.setPalette(state.palette, { updateArmorOverride: false });
    renderColorOptions();
    renderCharacterSheet();
    showToast(`Restored ${state.baseClass} default colors.`);
  });

  dom.rightAutorotateToggle.addEventListener('click', () => {
    state.autoRotate = !state.autoRotate;
    stage.setAutoRotate(state.autoRotate);
    dom.rightAutorotateToggle.classList.toggle('active', state.autoRotate);
    dom.rightAutorotateState.textContent = state.autoRotate ? 'ON' : 'OFF';
  });

  dom.rightResetCameraBtn.addEventListener('click', () => {
    stage.resetCamera();
    dom.camPresetBtns.forEach((b) => b.classList.remove('active'));
  });

  // Import Modal
  dom.openImportModalBtn.addEventListener('click', () => dom.importModal.classList.remove('hidden'));
  const closeImport = () => {
    if (!state.importBusy) dom.importModal.classList.add('hidden');
  };
  dom.importCloseXBtn.addEventListener('click', closeImport);
  dom.importCancelBtn.addEventListener('click', closeImport);
  dom.importModal.addEventListener('click', (e) => {
    if (e.target === dom.importModal) closeImport();
  });
  dom.importSourceBtns.forEach((b) => b.addEventListener('click', () => setImportSourceMode(b.dataset.importSource)));
  dom.importFileInput.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleChosenImportFile(e.target.files[0]);
  });
  dom.importDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.importDropzone.classList.add('dragover');
  });
  dom.importDropzone.addEventListener('dragleave', () => dom.importDropzone.classList.remove('dragover'));
  dom.importDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.importDropzone.classList.remove('dragover');
    if (e.dataTransfer?.files?.[0]) handleChosenImportFile(e.dataTransfer.files[0]);
  });
  dom.importLocalPath.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val && (!state.importAssetIdTouched || !dom.importAssetId.value.trim())) {
      dom.importAssetId.value = suggestAssetIdFromName(val);
    }
  });
  dom.importAssetId.addEventListener('input', () => {
    state.importAssetIdTouched = dom.importAssetId.value.trim().length > 0;
  });
  dom.importForm.addEventListener('submit', submitImportRender);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeImport();
      return;
    }
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!dom.importModal.classList.contains('hidden')) return;
    if (state.suite !== 'character-lab') return;

    if (e.code === 'Space' && state.mode === 'walking') {
      e.preventDefault();
      stage.triggerJump();
      return;
    }

    if (state.mode === 'battle-mode') {
      if (state.battleSubMode === 'grinding') {
        if (e.key === '1') stage.targetMob('slime');
        else if (e.key === '2') stage.targetMob('wisp');
        else if (e.key === '3') stage.targetMob('golem');
      } else {
        if (e.key === '1') triggerBossAction('slash');
        else if (e.key === '2') triggerBossAction('skill');
        else if (e.key === '3') triggerBossAction('guard');
        else if (e.key === '4') triggerBossAction('burst');
        else if (e.key === '5') triggerBossAction('auto');
        else if (e.key === '6') triggerBossAction('reset');
      }
    }
  });

  dom.suiteBtns.forEach((btn) => {
    btn.addEventListener('click', () => setSuite(btn.dataset.suite));
  });
}

// --- Battle Mode Ground Drops (Real Engine Roll + Three.js + Audio) ---
function syncLootDockCount() {
  if (!dom.lootDockCount) return;
  const count = stage.getGroundDrops().length;
  dom.lootDockCount.textContent = `${count} drop${count === 1 ? '' : 's'}`;
}

function highestDropRarity(drops) {
  const rank = { common: 0, uncommon: 1, rare: 2, epic: 3, mythic: 4 };
  let best = 'common';
  for (const d of drops || []) {
    if ((rank[d.rarity] ?? 0) > (rank[best] ?? 0)) best = d.rarity;
  }
  return best;
}

function spawnEngineLootInArena(params, originX, originZ) {
  state.lootKillSeed += 1;
  const res = simulateFlyffDropRoll({
    ...params,
    seed: state.lootKillSeed * 7919,
  });
  const drops = (res.groundDrops || []).map((gd, i) => ({
    ...gd,
    dropId: `${gd.dropId}_${state.lootKillSeed}_${i}`,
    originX,
    originZ,
    x: originX + (gd.x - 0),
    z: originZ + (gd.z - 0),
  }));
  if (drops.length) {
    stage.spawnGroundDrops(drops);
    syncLootDockCount();
    const bestR = highestDropRarity(drops);
    const hasItem = drops.some((d) => d.kind === 'gear' || d.kind === 'glyph');
    void lootAudio.playDrop(bestR, hasItem ? 'gear' : 'gold');
  }
  return res;
}

function handleArenaMobDeath(mob) {
  if (!mob) return;
  const cfg =
    mob.id === 'slime'
      ? { source: 'combat', monsterRank: 'small', mobLevel: 5 }
      : mob.id === 'wisp'
        ? { source: 'combat', monsterRank: 'normal', mobLevel: 18 }
        : { source: 'elite', monsterRank: 'elite', mobLevel: 35 };
  spawnEngineLootInArena(cfg, mob.basePos?.x || 0, mob.basePos?.z || -1.5);
}

function handleArenaBossVictory() {
  spawnEngineLootInArena({ source: 'realm_boss', monsterRank: 'boss', mobLevel: 60, riftTier: 3 }, 0, -2.1);
}

function handleGroundDropsPicked(picked) {
  if (!picked?.length) return;
  syncLootDockCount();
  const bestR = highestDropRarity(picked);
  const onlyGold = picked.every((d) => d.kind === 'gold');
  void lootAudio.playPickup(bestR, onlyGold ? 'gold' : 'gear');

  for (const d of picked) {
    state.lootToasts.unshift({
      rarity: d.rarity || 'common',
      label: RARITY_PROFILES[d.rarity]?.label || 'Common',
      name: d.displayName || d.kind,
      kind: d.kind,
    });
  }
  if (state.lootToasts.length > 5) state.lootToasts.length = 5;
  renderLootToasts();
}

function renderLootToasts() {
  if (!dom.lootToasts) return;
  dom.lootToasts.innerHTML = state.lootToasts
    .map(
      (t) => `
      <div class="loot-toast-pill rarity-${escapeHtml(t.rarity)}">
        <span class="rarity-text-${escapeHtml(t.rarity)}">${escapeHtml(t.label)}</span>
        <strong>+${escapeHtml(t.name)}</strong>
      </div>`
    )
    .join('');
}

const operationsHub = initOperationsHub({
  rootEl: dom.ldOpsWorkspace,
  getCatalog: () => state.catalog,
  refreshMainCatalog: fetchCatalog,
  showToast,
  manifestUrl: '/api/studio/manifest',
  audio: lootAudio,
});

function setSuite(suiteId) {
  const next = suiteId === 'liveops' ? 'liveops' : 'character-lab';
  state.suite = next;
  const isOps = next === 'liveops';

  dom.suiteBtns.forEach((btn) => {
    const active = btn.dataset.suite === next;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  dom.characterLabWorkspace?.classList.toggle('hidden', isOps);
  dom.topClassPillsWrap?.classList.toggle('hidden', isOps);
  dom.topGenderPillsWrap?.classList.toggle('hidden', isOps);
  dom.modeTabsWrap?.classList.toggle('hidden', isOps);
  dom.openImportModalBtn?.classList.toggle('hidden', isOps);

  dom.ldOpsWorkspace?.classList.toggle('hidden', !isOps);
  dom.liveopsHeaderPill?.classList.toggle('hidden', !isOps);

  if (isOps) {
    operationsHub.refreshCatalog();
    void operationsHub.refreshManifest();
    void operationsHub.refreshRegistries();
  } else {
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}

// --- Bootstrap ---
async function fetchCatalog() {
  try {
    const res = await fetch('/api/catalog');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.catalog = data.gameCatalog || { baseClasses: [], specializations: [], gearSets: {}, items: [] };
    await loadVisualConfig().catch((err) => showToast(`Armor looks not loaded: ${err.message}`, true));

    const totalItems = state.catalog.items?.length || 0;
    dom.catalogStatusPill.textContent = `${totalItems} Items • 4 GLBs`;

    renderLeftCatalogItems();
    renderActiveLoadoutSummary();
    renderCharacterSelectCards();
    renderCharacterSheet();
    resetBossFight();
    operationsHub.refreshCatalog();
  } catch (err) {
    dom.catalogStatusPill.textContent = 'Catalog Error';
    showToast(`Failed to load catalog: ${err.message}`, true);
  }
}

bindEvents();
setActiveTier(state.activeTier);
applyFlyffStyle();
renderFaceGrid();
renderWeaponSwitchers();
populateWeaponSkillSelects(state.weaponStyle);
setGlyphTier(state.glyphTier);
setStaffElement(state.staffElement);
setGender(state.gender);
setFace(state.faceId);
setStanceMode(state.stanceMode);
window.__studioStage = stage;
renderColorOptions();
syncOutlineToggleUI();
setMode('character-select');
await fetchCatalog();
await stage.loadClassModel(state.baseClass);
