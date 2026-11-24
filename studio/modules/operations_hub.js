/**
 * LD Studio — LiveOps & GM Operations Hub (Phase 4: Live Data Sync & Git/OTA Publish)
 *
 * Connects to:
 *  - GET  /api/studio/manifest
 *  - GET  /api/studio/registries
 *  - GET  /api/data/:domain & PUT /api/data/:domain
 *  - GET  /api/publish/status
 *  - POST /api/publish/preflight
 *  - POST /api/publish/deploy (NDJSON stream)
 *
 * Server Blueprints (World Events, Moderation, Global Chat) remain explicitly labeled
 * as blueprints pending @lumendelve/server portal endpoints, with live WS /ws probe.
 */

import {
  bindArtReadinessEvents,
  renderArtReadinessCard,
  renderStudioRegistryStrip,
} from './art_readiness.js';
import { createFlyffLootWorkbench } from './flyff_loot_workbench.js';

const LIVEOPS_PILLARS = [
  {
    id: 'items-stats',
    title: 'Items & Stats',
    subtitle: 'Engine Gear & Affixes',
    badge: 'LIVE SYNC',
    badgeCss: 'badge-emerald',
    isBlueprint: false,
    summary:
      'Inline stat & balance editor across engine weapons, armor, starter gear, sets, and affixes with automatic catalog sync.',
    targets: [
      'gear-weapons',
      'gear-armor',
      'nonset-armor-tiers',
      'starter-weapons',
      'starter-gear',
      'gear-sets',
      'gear-affixes',
    ],
  },
  {
    id: 'monsters-bosses',
    title: 'Monsters & Bosses',
    subtitle: 'Enemies & Zones',
    badge: 'LIVE SYNC',
    badgeCss: 'badge-emerald',
    isBlueprint: false,
    summary:
      'Edit Ironspire & Zone enemy combat stats, boss encounter tuning, XP/gold rewards, and zone definitions.',
    targets: ['ironspire-enemies', 'zones/*.data.json'],
  },
  {
    id: 'loot-economy',
    title: 'Loot & Economy',
    subtitle: 'Drop Tables & Trash',
    badge: 'LIVE SYNC',
    badgeCss: 'badge-emerald',
    isBlueprint: false,
    summary:
      'Tune base drop tables, gold/dust ranges, rarity weights, epic AoE drop rates, and trash loot economy multipliers.',
    targets: ['loot-tables', 'trash-loot'],
  },
  {
    id: 'glyphs-classes',
    title: 'Glyphs & Classes',
    subtitle: 'Skills & Base Stats',
    badge: 'LIVE SYNC',
    badgeCss: 'badge-emerald',
    isBlueprint: false,
    summary:
      'Inspect and balance class glyphs (Squire, Scout, Arcanist, Acolyte, Flex) and starter class base stat profiles.',
    targets: ['glyphs/*.data.json', 'starter-classes'],
  },
  {
    id: 'publish-ota',
    title: 'Publish & OTA',
    subtitle: 'Git & EAS Deploy',
    badge: 'LIVE OPS',
    badgeCss: 'badge-cyan',
    isBlueprint: false,
    summary:
      'Inspect git branch & working tree status, run preflight (sync + typecheck + test), and stream staging/production deploys & EAS OTA updates.',
    targets: ['GET /api/publish/status', 'POST /api/publish/preflight', 'POST /api/publish/deploy'],
  },
  {
    id: 'world-events',
    title: 'World Events',
    subtitle: 'LiveOps Flags',
    badge: 'SERVER BLUEPRINT',
    badgeCss: 'badge-amber',
    isBlueprint: true,
    summary: 'Server blueprint for 2x EXP, 2x Drop, Rift Invasion, and Maintenance windows in @lumendelve/server.',
    targets: ['apps/server/src/app.ts', 'packages/engine/src/data/bounties.ts', 'apps/server/src/routes/'],
  },
  {
    id: 'moderation',
    title: 'Moderation',
    subtitle: 'Player & GM Ops',
    badge: 'SERVER BLUEPRINT',
    badgeCss: 'badge-amber',
    isBlueprint: true,
    summary: 'Server blueprint for GM player search, Mute / Kick / Ban controls, and persistent moderator audit log.',
    targets: ['apps/server/src/moderator-portal/', 'apps/server/src/auth/', 'apps/server/src/db/'],
  },
  {
    id: 'global-chat',
    title: 'Global Chat',
    subtitle: 'WebSocket Feed',
    badge: 'SERVER BLUEPRINT',
    badgeCss: 'badge-amber',
    isBlueprint: true,
    summary: 'Live ws://127.0.0.1:3000/ws health probe and server blueprint for channel filter & GM announcements.',
    targets: ['apps/server/src/ws/', 'apps/server/src/app.ts'],
  },
];

const ITEM_DOMAINS = [
  'gear-weapons',
  'gear-armor',
  'nonset-armor-tiers',
  'starter-weapons',
  'starter-gear',
  'gear-sets',
  'gear-affixes',
];

const ITEM_STAT_FIELDS = [
  { key: 'hp', label: 'hp' },
  { key: 'physAtk', label: 'physAtk' },
  { key: 'elemAtk', label: 'elemAtk' },
  { key: 'physDef', label: 'physDef' },
  { key: 'elemDef', label: 'elemDef' },
  { key: 'speed', label: 'speed' },
  { key: 'str', label: 'str' },
  { key: 'int', label: 'int' },
  { key: 'dex', label: 'dex' },
  { key: 'sta', label: 'sta' },
  { key: 'critChance', label: 'critChance' },
  { key: 'healPowerBonus', label: 'healPowerBonus' },
];

const ENEMY_STAT_FIELDS = [
  { key: 'maxHp', label: 'hp (maxHp)', scope: 'stats' },
  { key: 'physAtk', label: 'physAtk', scope: 'stats' },
  { key: 'elemAtk', label: 'elemAtk', scope: 'stats' },
  { key: 'specAtk', label: 'specAtk', scope: 'stats' },
  { key: 'physDef', label: 'physDef', scope: 'stats' },
  { key: 'elemDef', label: 'elemDef', scope: 'stats' },
  { key: 'specDef', label: 'specDef', scope: 'stats' },
  { key: 'speed', label: 'speed', scope: 'stats' },
  { key: 'critChance', label: 'critChance', scope: 'stats' },
  { key: 'critMultiplier', label: 'critMultiplier', scope: 'stats' },
  { key: 'dodgeChance', label: 'dodgeChance', scope: 'stats' },
  { key: 'accuracy', label: 'accuracy', scope: 'stats' },
];

const GLYPH_KEYS = ['squire', 'scout', 'arcanist', 'acolyte', 'flex'];

function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function summarizeBaseStats(st) {
  if (!st || typeof st !== 'object') return '—';
  const parts = [];
  if (st.hp) parts.push(`HP +${st.hp}`);
  if (st.physAtk) parts.push(`ATK ${st.physAtk}`);
  if (st.elemAtk) parts.push(`MATK ${st.elemAtk}`);
  if (st.physDef) parts.push(`DEF ${st.physDef}`);
  if (st.elemDef) parts.push(`MDEF ${st.elemDef}`);
  if (st.speed) parts.push(`SPD +${st.speed}`);
  if (st.str) parts.push(`STR +${st.str}`);
  if (st.int) parts.push(`INT +${st.int}`);
  if (st.dex) parts.push(`DEX +${st.dex}`);
  if (st.sta) parts.push(`STA +${st.sta}`);
  if (st.critChance) parts.push(`CRIT ${st.critChance}`);
  if (st.healPowerBonus) parts.push(`HEAL +${st.healPowerBonus}`);
  return parts.slice(0, 3).join(' · ') || '—';
}

function parseOptionalNumber(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (trimmed === '') return { empty: true, valid: true, value: undefined };
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return { empty: false, valid: false, value: undefined };
  return { empty: false, valid: true, value: num };
}

function formatNumVal(val) {
  return typeof val === 'number' && Number.isFinite(val) ? String(val) : '';
}

function setOrDeleteNumeric(targetObj, key, rawValue) {
  const parsed = parseOptionalNumber(rawValue);
  if (!parsed.valid) return false;
  if (parsed.empty) {
    delete targetObj[key];
  } else {
    targetObj[key] = parsed.value;
  }
  return true;
}

export function initOperationsHub({
  rootEl,
  getCatalog,
  refreshMainCatalog,
  showToast,
  manifestUrl = '/api/studio/manifest',
  audio = null,
}) {
  if (!rootEl) {
    throw new Error('initOperationsHub requires rootEl');
  }

  const hubState = {
    activePillar: 'items-stats',
    manifest: null,
    manifestLoading: false,
    manifestError: null,
    registries: null,
    registriesLoading: false,
    registriesError: null,
    showGapsDrawer: false,
    artReadinessCollapsed: false,

    domains: {}, // domain -> { loading, loaded, saving, dirty, error, kind, path, paths, data }

    // Items & Stats
    itemDomainFilter: 'all',
    itemSearch: '',
    selectedItemUid: null,
    itemJsonText: '',
    itemJsonError: null,

    // Monsters & Bosses
    monsterSourceFilter: 'all',
    monsterSearch: '',
    selectedMonsterUid: null,
    monsterEditorMode: 'enemy', // 'enemy' | 'zone'
    monsterJsonText: '',
    monsterJsonError: null,

    // Loot & Economy
    selectedLootUid: null,
    lootJsonText: '',
    lootJsonError: null,

    // Glyphs & Classes
    glyphFilter: 'all',
    glyphSearch: '',
    selectedGlyphUid: null,
    glyphJsonText: '',
    glyphJsonError: null,

    // Publish & OTA
    publishStatus: null,
    publishStatusLoading: false,
    publishStatusError: null,
    preflightRunning: false,
    preflightResult: null,
    preflightError: null,
    deployTarget: 'staging',
    deployCommitMessage: '',
    deployPushGit: true,
    deployRunOta: false,
    deployRunning: false,
    deployResult: null,
    deployLogs: [],

    // Global Chat Blueprint
    chatChannel: 'all',
    wsProbeStatus: 'idle',
    wsProbeDetail: 'Not probed yet. Click Probe WS /ws to test connection.',

    // Status message inside hub
    statusNotice: null, // { text, isError }
  };

  let statusNoticeTimer = 0;
  function notify(text, isError = false) {
    hubState.statusNotice = { text, isError };
    if (typeof showToast === 'function') {
      showToast(text, isError);
    }
    renderStatusNotice();
    clearTimeout(statusNoticeTimer);
    statusNoticeTimer = setTimeout(() => {
      hubState.statusNotice = null;
      renderStatusNotice();
    }, 4000);
  }

  rootEl.innerHTML = `
    <aside class="bento-card ops-left-rail" aria-label="LD Studio Pillars">
      <div class="rail-head">
        <div class="rail-title-row">
          <h2 class="rail-title">LD Studio Pillars</h2>
          <span class="badge badge-emerald">5 Live · 3 BP</span>
        </div>
        <div class="ops-rail-note">Live Engine JSON Sync + Git/OTA Publish</div>
      </div>
      <div id="ops-pillar-list" class="ops-pillar-list" role="tablist" aria-label="LiveOps Pillars"></div>
      <div class="ops-rail-footer">
        <div class="ops-footer-row">
          <span>Engine Sync</span>
          <strong id="ops-footer-pillar-count">5 Live · 3 Blueprints</strong>
        </div>
        <div class="ops-footer-sub">Direct engine JSON persistence &amp; catalog sync.</div>
      </div>
    </aside>

    <section class="bento-card ops-center-stage" aria-label="LiveOps Center Workspace">
      <div id="ops-registry-strip" class="ops-registry-strip"></div>
      <div id="ops-center-head" class="ops-center-head"></div>
      <div id="ops-center-body" class="ops-center-body"></div>
    </section>

    <aside class="bento-card ops-right-rail" aria-label="Architecture and Server Link">
      <div class="rail-head">
        <div class="rail-title-row">
          <h2 class="rail-title">Architecture &amp; Server Link</h2>
          <button id="ops-refresh-manifest-btn" type="button" class="mini-link-btn">Refresh</button>
        </div>
      </div>
      <div id="ops-server-link-body" class="ops-right-body"></div>
    </aside>
  `;

  const pillarListEl = rootEl.querySelector('#ops-pillar-list');
  const registryStripEl = rootEl.querySelector('#ops-registry-strip');
  const centerHeadEl = rootEl.querySelector('#ops-center-head');
  const centerBodyEl = rootEl.querySelector('#ops-center-body');
  const serverLinkBodyEl = rootEl.querySelector('#ops-server-link-body');
  const refreshManifestBtn = rootEl.querySelector('#ops-refresh-manifest-btn');

  function renderStatusNotice() {
    const existing = centerHeadEl.querySelector('#ops-inline-notice');
    if (!hubState.statusNotice) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.textContent = hubState.statusNotice.text;
      existing.className = `ops-inline-notice ${hubState.statusNotice.isError ? 'error' : 'ok'}`;
    } else {
      const div = document.createElement('div');
      div.id = 'ops-inline-notice';
      div.className = `ops-inline-notice ${hubState.statusNotice.isError ? 'error' : 'ok'}`;
      div.textContent = hubState.statusNotice.text;
      centerHeadEl.appendChild(div);
    }
  }

  function getDomainState(domain) {
    if (!hubState.domains[domain]) {
      hubState.domains[domain] = {
        loading: false,
        loaded: false,
        saving: false,
        dirty: false,
        error: null,
        kind: null,
        path: null,
        paths: null,
        data: null,
      };
    }
    return hubState.domains[domain];
  }

  async function fetchDomain(domain, { force = false } = {}) {
    const st = getDomainState(domain);
    if (st.loading) return st;
    if (st.loaded && !force) return st;

    st.loading = true;
    st.error = null;
    try {
      const res = await fetch(`/api/data/${encodeURIComponent(domain)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      st.kind = json.kind;
      st.path = json.path ?? null;
      st.paths = json.paths ?? null;
      st.data = json.data;
      st.loaded = true;
      st.dirty = false;
    } catch (err) {
      st.error = err.message;
    } finally {
      st.loading = false;
    }
    return st;
  }

  async function ensureDomainsLoaded(domains, { force = false } = {}) {
    const needed = domains.filter((d) => {
      const st = getDomainState(d);
      return force || (!st.loaded && !st.loading);
    });
    if (needed.length === 0) return;
    await Promise.all(needed.map((d) => fetchDomain(d, { force })));
    renderPillarList();
    renderCenterBody();
  }

  async function saveDomain(domain, payloadOverride = null) {
    const st = getDomainState(domain);
    if (!st.loaded && payloadOverride === null) {
      notify(`Domain "${domain}" is not loaded yet.`, true);
      return false;
    }
    st.saving = true;
    renderCenterBody();
    try {
      const payload = payloadOverride ?? st.data;
      const res = await fetch(`/api/data/${encodeURIComponent(domain)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      st.dirty = false;
      const syncMsg = json.catalogSync?.ran
        ? json.catalogSync.ok
          ? ' • Catalog Synced'
          : ' • Catalog Sync Failed'
        : '';
      const filesLabel = Array.isArray(json.writtenPaths) ? json.writtenPaths.join(', ') : domain;
      notify(`Saved ${domain} (${filesLabel})${syncMsg}`);
      if (json.catalogSync?.ran && json.catalogSync.ok && typeof refreshMainCatalog === 'function') {
        void refreshMainCatalog();
      }
      void refreshRegistries();
      if (hubState.publishStatus) {
        void refreshPublishStatus();
      }
      return true;
    } catch (err) {
      notify(`Save ${domain} failed: ${err.message}`, true);
      return false;
    } finally {
      st.saving = false;
      renderPillarList();
      renderCenterBody();
    }
  }

  // --- Registry Sync Strip ---
  async function refreshRegistries() {
    hubState.registriesLoading = true;
    hubState.registriesError = null;
    renderRegistryStrip();
    try {
      const res = await fetch('/api/studio/registries', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      hubState.registries = await res.json();
    } catch (err) {
      hubState.registriesError = err.message;
    } finally {
      hubState.registriesLoading = false;
      renderRegistryStrip();
      renderPillarList();
      renderRightRail();
    }
  }

  function countSyncGaps(gaps) {
    if (!gaps) return [];
    const entries = [
      { label: 'Enemies Missing From Mobile Rig', items: gaps.enemiesMissingFromRig || [] },
      { label: 'Rig Aliases Not In Engine', items: gaps.rigAliasesNotInEngine || [] },
      { label: 'Bosses Missing Sprites', items: gaps.bossesMissingSprites || [] },
      { label: 'Bosses Missing Pivots', items: gaps.bossesMissingPivots || [] },
      { label: 'Gear Sets Missing From Rig', items: gaps.gearSetsMissingFromRig || [] },
      {
        label: 'Visual Tiers Missing Sprites',
        items: (gaps.gearVisualTiersMissingSprites || []).map((t) => `Tier ${t}`),
      },
      {
        label: 'Visual Tiers Missing Rig Parts',
        items: (gaps.gearVisualTiersMissingRigParts || []).map((t) => `Tier ${t}`),
      },
    ];
    return entries.filter((e) => e.items.length > 0);
  }

  function renderRegistryStrip() {
    renderStudioRegistryStrip({
      el: registryStripEl,
      registries: hubState.registries,
      loading: hubState.registriesLoading,
      error: hubState.registriesError,
      showGapsDrawer: hubState.showGapsDrawer,
      onToggleDrawer: () => {
        hubState.showGapsDrawer = !hubState.showGapsDrawer;
        renderRegistryStrip();
      },
      onRefresh: () => {
        void refreshRegistries();
      },
    });
  }

  // --- Left Rail ---
  function renderPillarList() {
    const totals = hubState.registries?.sync?.totals;
    const catItemsCount = Array.isArray(getCatalog?.()?.items) ? getCatalog().items.length : 0;

    const frag = document.createDocumentFragment();
    for (const p of LIVEOPS_PILLARS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ops-pillar-btn${hubState.activePillar === p.id ? ' active' : ''}`;
      btn.dataset.opsPillar = p.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(hubState.activePillar === p.id));

      let sub = p.subtitle;
      if (p.id === 'items-stats') {
        const count = totals?.engineItems ?? catItemsCount;
        sub = count > 0 ? `${count} Engine Items • 6 Domains` : p.subtitle;
      } else if (p.id === 'monsters-bosses' && totals) {
        sub = `${totals.engineEnemies} Enemies · ${totals.engineBosses} Bosses · ${totals.engineZones} Zones`;
      } else if (p.id === 'loot-economy' && totals) {
        sub = `${totals.engineLootTables} Base Tables · Trash Loot`;
      } else if (p.id === 'glyphs-classes' && totals) {
        sub = `${totals.engineGlyphs} Glyphs · 4 Classes`;
      } else if (p.id === 'publish-ota' && hubState.publishStatus) {
        sub = `Branch: ${hubState.publishStatus.currentBranch} (${hubState.publishStatus.changedFileCount} changed)`;
      }

      btn.innerHTML = `
        <div class="ops-pillar-top">
          <strong>${esc(p.title)}</strong>
          <span class="badge ${p.badgeCss}">${esc(p.badge)}</span>
        </div>
        <span class="ops-pillar-sub">${esc(sub)}</span>
      `;
      btn.addEventListener('click', () => setPillar(p.id));
      frag.appendChild(btn);
    }
    pillarListEl.replaceChildren(frag);
  }

  function renderCenterHeader(pillar) {
    const bannerBadge = pillar.isBlueprint
      ? '<span class="badge badge-amber">Server Blueprint (Pending @lumendelve/server)</span>'
      : pillar.id === 'publish-ota'
        ? '<span class="badge badge-cyan">Live Git + Preflight + EAS OTA</span>'
        : '<span class="badge badge-emerald">Live Engine JSON Editor • PUT /api/data/:domain</span>';

    centerHeadEl.innerHTML = `
      <div class="ops-center-title-row">
        <div>
          <h3>${esc(pillar.title)}</h3>
          <p class="ops-center-sub">${esc(pillar.summary)}</p>
        </div>
        <div class="ops-center-badges">${bannerBadge}</div>
      </div>
      <div class="ops-target-strip">
        <span class="ops-strip-label">Sources</span>
        ${pillar.targets.map((t) => `<code class="ops-code-chip">${esc(t)}</code>`).join('')}
      </div>
    `;
    renderStatusNotice();
  }

  // --- Shared Editor Helpers ---
  function bindJsonEditor({ textareaEl, statusEl, onValidApply }) {
    if (!textareaEl) return;
    textareaEl.addEventListener('input', () => {
      const raw = textareaEl.value;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Must be a JSON object');
        }
        if (statusEl) {
          statusEl.textContent = 'Valid JSON';
          statusEl.className = 'badge badge-emerald';
        }
        onValidApply(parsed, raw, null);
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = `JSON Error: ${err.message}`;
          statusEl.className = 'badge badge-rose';
        }
        onValidApply(null, raw, err.message);
      }
    });
  }

  // --- PILLAR 1: Items & Stats ---
  function buildUnifiedItemRecords() {
    const records = [];

    const pushArrayDomain = (domain, idKey, defaultSlot, defaultRarity) => {
      const st = getDomainState(domain);
      if (!st.loaded || !Array.isArray(st.data)) return;
      st.data.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        records.push({
          uid: `${domain}::${item[idKey] || index}`,
          domain,
          id: item[idKey] || `${domain}#${index}`,
          name: item.name || item[idKey] || `Entry #${index}`,
          slot: item.slot || item.equipmentSlot || item.statKey || item.zoneId || defaultSlot,
          rarity: item.rarity || defaultRarity,
          levelReq: item.requiredLevel ?? item.levelReq ?? (Array.isArray(item.levelRange) ? item.levelRange[0] : 1),
          item,
          replaceItem: (nextObj) => {
            st.data[index] = nextObj;
            st.dirty = true;
          },
        });
      });
    };

    pushArrayDomain('gear-weapons', 'baseId', 'weapon', 'common');
    pushArrayDomain('gear-armor', 'baseId', 'armor', 'common');
    pushArrayDomain('gear-sets', 'setId', 'set', 'epic');
    pushArrayDomain('gear-affixes', 'affixId', 'affix', 'uncommon');

    // nonset-armor-tiers (26 tiers -> 1,248 Flyff Common/Uncommon armor pieces)
    const nsSt = getDomainState('nonset-armor-tiers');
    if (nsSt.loaded && Array.isArray(nsSt.data)) {
      nsSt.data.forEach((tierObj, index) => {
        if (!tierObj || typeof tierObj !== 'object') return;
        const lv = tierObj.level ?? 1;
        const r = String(tierObj.rarity || 'common').toLowerCase();
        const sq = Object.values(tierObj.lines?.squire || {}).filter(Boolean).join(' / ');
        records.push({
          uid: `nonset-armor-tiers::lv${lv}_${r}_${index}`,
          domain: 'nonset-armor-tiers',
          id: `lv${lv}_${r}`,
          name: `Lv.${lv} ${r === 'uncommon' ? 'Uncommon' : 'Common'} Tier (${sq || tierObj.silhouetteTier})`,
          slot: '6-slot tier (48 items)',
          rarity: r,
          levelReq: lv,
          item: tierObj,
          replaceItem: (nextObj) => {
            nsSt.data[index] = nextObj;
            nsSt.dirty = true;
          },
        });
      });
    }

    // starter-weapons
    const sw = getDomainState('starter-weapons');
    if (sw.loaded && sw.data && typeof sw.data === 'object') {
      const list = Array.isArray(sw.data.starterWeaponDefinitions) ? sw.data.starterWeaponDefinitions : [];
      list.forEach((item, index) => {
        records.push({
          uid: `starter-weapons::${item.definitionId || index}`,
          domain: 'starter-weapons',
          id: item.definitionId || `starter_weapon_${index}`,
          name: item.name || item.definitionId,
          slot: item.equipmentSlot || 'main_hand',
          rarity: item.rarity || 'common',
          levelReq: item.requiredLevel ?? item.levelReq ?? 1,
          item,
          replaceItem: (nextObj) => {
            sw.data.starterWeaponDefinitions[index] = nextObj;
            sw.dirty = true;
          },
        });
      });
    }

    // starter-gear
    const sg = getDomainState('starter-gear');
    if (sg.loaded && sg.data && typeof sg.data === 'object') {
      const pushStarterArr = (arr, subLabel) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((item, index) => {
          records.push({
            uid: `starter-gear::${subLabel}::${item.definitionId || index}`,
            domain: 'starter-gear',
            id: item.definitionId || `${subLabel}_${index}`,
            name: item.name || item.definitionId,
            slot: item.equipmentSlot || subLabel,
            rarity: item.rarity || 'common',
            levelReq: item.requiredLevel ?? item.levelReq ?? 1,
            item,
            replaceItem: (nextObj) => {
              arr[index] = nextObj;
              sg.dirty = true;
            },
          });
        });
      };
      pushStarterArr(sg.data.starterGearDefinitions, 'starterGear');
      if (sg.data.bossAccessoryByBiome && typeof sg.data.bossAccessoryByBiome === 'object') {
        Object.entries(sg.data.bossAccessoryByBiome).forEach(([biomeKey, item]) => {
          if (!item || typeof item !== 'object') return;
          records.push({
            uid: `starter-gear::boss::${biomeKey}`,
            domain: 'starter-gear',
            id: item.definitionId || biomeKey,
            name: item.name || biomeKey,
            slot: item.equipmentSlot || 'accessory',
            rarity: item.rarity || 'epic',
            levelReq: item.requiredLevel ?? item.levelReq ?? 15,
            item,
            replaceItem: (nextObj) => {
              sg.data.bossAccessoryByBiome[biomeKey] = nextObj;
              sg.dirty = true;
            },
          });
        });
      }
      pushStarterArr(sg.data.lv20MythicPieceDefinitions, 'mythic');
    }

    return records;
  }

  function syncItemJsonText(rec) {
    hubState.itemJsonText = rec ? JSON.stringify(rec.item, null, 2) : '';
    hubState.itemJsonError = null;
  }

  function renderItemsInspectorPane(rec) {
    if (!rec) {
      return `
        <div class="ops-inspector-card">
          <div class="ops-inspector-head">
            <strong>Stat &amp; Balance Editor</strong>
            <span class="badge badge-cyan">Select Item</span>
          </div>
          <div class="ops-empty-state">Select any item, set, or affix on the left to edit stats and save to the engine.</div>
        </div>
      `;
    }

    const domainSt = getDomainState(rec.domain);
    const item = rec.item;

    if (rec.domain === 'nonset-armor-tiers') {
      const lines = item.lines || {};
      const classes = ['squire', 'scout', 'arcanist', 'acolyte'];
      const silTiers = ['tier_1', 'tier_2', 'tier_3', 'tier_4'];
      return `
        <div class="ops-inspector-card ops-editor-scroll" id="ops-item-inspector">
          <div class="ops-inspector-head">
            <div>
              <strong>${esc(rec.name)}</strong>
              <div class="ops-mono-muted">${esc(rec.id)} · <span class="ops-domain-tag">nonset-armor-tiers (48 pieces)</span></div>
            </div>
            <div class="ops-head-badges">
              ${domainSt.dirty ? '<span class="badge badge-amber">Unsaved</span>' : '<span class="badge badge-emerald">Synced</span>'}
            </div>
          </div>

          <div class="ops-form-grid ops-form-3col">
            <label class="ops-field">
              <span>level</span>
              <input type="number" min="1" max="100" step="1" class="compact-input" data-nonset-field="level" value="${esc(item.level ?? 1)}" />
            </label>
            <label class="ops-field">
              <span>rarity</span>
              <select class="compact-input" data-nonset-field="rarity">
                <option value="common"${item.rarity === 'common' ? ' selected' : ''}>common</option>
                <option value="uncommon"${item.rarity === 'uncommon' ? ' selected' : ''}>uncommon</option>
              </select>
            </label>
            <label class="ops-field">
              <span>silhouetteTier</span>
              <select class="compact-input" data-nonset-field="silhouetteTier">
                ${silTiers.map((t) => `<option value="${t}"${item.silhouetteTier === t ? ' selected' : ''}>${t}</option>`).join('')}
              </select>
            </label>
            <label class="ops-field ops-span-3">
              <span>lore</span>
              <input type="text" class="compact-input" data-nonset-field="lore" value="${esc(item.lore ?? '')}" />
            </label>
          </div>

          <div class="ops-section-kicker">8 Gendered Armor Lines (4 Classes × M/F)</div>
          <div class="ops-form-grid ops-form-2col">
            ${classes
              .map(
                (cls) => `
                <label class="ops-field">
                  <span>${cls} ♂ male</span>
                  <input type="text" class="compact-input" data-nonset-line="${cls}:male" value="${esc(lines?.[cls]?.male ?? '')}" />
                </label>
                <label class="ops-field">
                  <span>${cls} ♀ female</span>
                  <input type="text" class="compact-input" data-nonset-line="${cls}:female" value="${esc(lines?.[cls]?.female ?? '')}" />
                </label>`
              )
              .join('')}
          </div>

          <div class="ops-json-header">
            <span class="ops-section-kicker">Fallback / Nested JSON</span>
            <span id="ops-item-json-status" class="badge ${hubState.itemJsonError ? 'badge-rose' : 'badge-emerald'}">
              ${hubState.itemJsonError ? `JSON Error: ${esc(hubState.itemJsonError)}` : 'Valid JSON'}
            </span>
          </div>
          <textarea id="ops-item-json" class="ops-json-textarea" spellcheck="false">${esc(hubState.itemJsonText)}</textarea>

          <div class="ops-inspector-foot">
            <span class="ops-mono-muted">Target: ${esc(domainSt.path || rec.domain)}</span>
            <div class="ops-foot-actions">
              <button id="ops-item-reload-btn" type="button" class="btn btn-sm" ${domainSt.saving ? 'disabled' : ''}>Reload</button>
              <button id="ops-item-save-btn" type="button" class="btn btn-sm btn-amber" ${
                domainSt.saving || hubState.itemJsonError ? 'disabled' : ''
              }>
                ${domainSt.saving ? 'Saving…' : 'Save &amp; Sync Catalog'}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const statsObj = item.baseStats && typeof item.baseStats === 'object' ? item.baseStats : null;
    const reqLevelVal = item.requiredLevel ?? item.levelReq;
    const tierVal = item.visualTier ?? item.materialTier;
    const sellVal = item.sellValue ?? item.npcSellGold;

    return `
      <div class="ops-inspector-card ops-editor-scroll" id="ops-item-inspector">
        <div class="ops-inspector-head">
          <div>
            <strong>${esc(rec.name)}</strong>
            <div class="ops-mono-muted">${esc(rec.id)} · <span class="ops-domain-tag">${esc(rec.domain)}</span></div>
          </div>
          <div class="ops-head-badges">
            ${domainSt.dirty ? '<span class="badge badge-amber">Unsaved</span>' : '<span class="badge badge-emerald">Synced</span>'}
          </div>
        </div>

        <div class="ops-form-grid ops-form-3col">
          <label class="ops-field ops-span-2">
            <span>name</span>
            <input type="text" class="compact-input" data-item-meta="name" value="${esc(item.name ?? '')}" />
          </label>
          <label class="ops-field">
            <span>requiredLevel</span>
            <input type="number" step="1" class="compact-input" data-item-meta="requiredLevel" value="${esc(formatNumVal(reqLevelVal))}" placeholder="1" />
          </label>
          <label class="ops-field">
            <span>visualTier</span>
            <input type="number" step="1" class="compact-input" data-item-meta="visualTier" value="${esc(formatNumVal(tierVal))}" placeholder="—" />
          </label>
          <label class="ops-field">
            <span>sellValue</span>
            <input type="number" step="1" class="compact-input" data-item-meta="sellValue" value="${esc(formatNumVal(sellVal))}" placeholder="—" />
          </label>
          ${
            typeof item.weight === 'number'
              ? `<label class="ops-field">
                  <span>weight</span>
                  <input type="number" step="1" class="compact-input" data-item-meta="weight" value="${esc(formatNumVal(item.weight))}" />
                </label>`
              : `<label class="ops-field">
                  <span>slot</span>
                  <input type="text" class="compact-input" value="${esc(rec.slot)}" readonly />
                </label>`
          }
        </div>

        ${
          statsObj || rec.domain !== 'gear-sets'
            ? `<div class="ops-section-kicker">baseStats (Numeric Balance)</div>
               <div class="ops-form-grid ops-form-3col">
                 ${ITEM_STAT_FIELDS.map((f) => {
                   const val = statsObj ? statsObj[f.key] : undefined;
                   return `
                     <label class="ops-field">
                       <span>${esc(f.label)}</span>
                       <input
                         type="number"
                         step="any"
                         class="compact-input"
                         data-item-stat="${esc(f.key)}"
                         value="${esc(formatNumVal(val))}"
                         placeholder="—"
                       />
                     </label>
                   `;
                 }).join('')}
               </div>`
            : ''
        }

        <div class="ops-json-header">
          <span class="ops-section-kicker">Fallback / Nested JSON</span>
          <span id="ops-item-json-status" class="badge ${hubState.itemJsonError ? 'badge-rose' : 'badge-emerald'}">
            ${hubState.itemJsonError ? `JSON Error: ${esc(hubState.itemJsonError)}` : 'Valid JSON'}
          </span>
        </div>
        <textarea id="ops-item-json" class="ops-json-textarea" spellcheck="false">${esc(hubState.itemJsonText)}</textarea>

        <div class="ops-inspector-foot">
          <span class="ops-mono-muted">Target: ${esc(domainSt.path || rec.domain)}</span>
          <div class="ops-foot-actions">
            <button id="ops-item-reload-btn" type="button" class="btn btn-sm" ${domainSt.saving ? 'disabled' : ''}>Reload</button>
            <button id="ops-item-save-btn" type="button" class="btn btn-sm btn-amber" ${
              domainSt.saving || hubState.itemJsonError ? 'disabled' : ''
            }>
              ${domainSt.saving ? 'Saving…' : 'Save to Engine'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function bindItemInspectorEvents(rec) {
    if (!rec) return;
    const domainSt = getDomainState(rec.domain);
    const jsonTextarea = centerBodyEl.querySelector('#ops-item-json');
    const jsonStatus = centerBodyEl.querySelector('#ops-item-json-status');
    const saveBtn = centerBodyEl.querySelector('#ops-item-save-btn');
    const reloadBtn = centerBodyEl.querySelector('#ops-item-reload-btn');

    const updateJsonFromRecord = () => {
      syncItemJsonText(rec);
      if (jsonTextarea) jsonTextarea.value = hubState.itemJsonText;
      if (jsonStatus) {
        jsonStatus.textContent = 'Valid JSON';
        jsonStatus.className = 'badge badge-emerald';
      }
      if (saveBtn) saveBtn.disabled = domainSt.saving;
      domainSt.dirty = true;
    };

    centerBodyEl.querySelectorAll('[data-nonset-field]').forEach((input) => {
      const evName = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(evName, () => {
        const field = input.dataset.nonsetField;
        if (field === 'level') {
          const parsed = parseOptionalNumber(input.value);
          if (parsed.valid && !parsed.empty) {
            rec.item.level = Math.max(1, Math.min(100, Math.round(parsed.value)));
            rec.levelReq = rec.item.level;
            updateJsonFromRecord();
          }
        } else {
          rec.item[field] = input.value;
          updateJsonFromRecord();
        }
      });
    });

    centerBodyEl.querySelectorAll('[data-nonset-line]').forEach((input) => {
      input.addEventListener('input', () => {
        const [cls, gender] = input.dataset.nonsetLine.split(':');
        if (!rec.item.lines || typeof rec.item.lines !== 'object') rec.item.lines = {};
        if (!rec.item.lines[cls] || typeof rec.item.lines[cls] !== 'object') rec.item.lines[cls] = {};
        rec.item.lines[cls][gender] = input.value;
        updateJsonFromRecord();
      });
    });

    centerBodyEl.querySelectorAll('[data-item-meta]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.itemMeta;
        if (key === 'name') {
          rec.item.name = input.value;
          rec.name = input.value;
          updateJsonFromRecord();
          return;
        }
        if (key === 'requiredLevel') {
          const targetKey = Object.prototype.hasOwnProperty.call(rec.item, 'requiredLevel')
            ? 'requiredLevel'
            : 'levelReq';
          if (setOrDeleteNumeric(rec.item, targetKey, input.value)) {
            updateJsonFromRecord();
          }
          return;
        }
        if (key === 'visualTier') {
          const targetKey = Object.prototype.hasOwnProperty.call(rec.item, 'visualTier')
            ? 'visualTier'
            : Object.prototype.hasOwnProperty.call(rec.item, 'materialTier')
              ? 'materialTier'
              : 'visualTier';
          if (setOrDeleteNumeric(rec.item, targetKey, input.value)) {
            updateJsonFromRecord();
          }
          return;
        }
        if (key === 'sellValue') {
          const targetKey = Object.prototype.hasOwnProperty.call(rec.item, 'sellValue')
            ? 'sellValue'
            : Object.prototype.hasOwnProperty.call(rec.item, 'npcSellGold')
              ? 'npcSellGold'
              : 'sellValue';
          if (setOrDeleteNumeric(rec.item, targetKey, input.value)) {
            updateJsonFromRecord();
          }
          return;
        }
        if (key === 'weight') {
          if (setOrDeleteNumeric(rec.item, 'weight', input.value)) {
            updateJsonFromRecord();
          }
        }
      });
    });

    centerBodyEl.querySelectorAll('[data-item-stat]').forEach((input) => {
      input.addEventListener('input', () => {
        const statKey = input.dataset.itemStat;
        if (!rec.item.baseStats || typeof rec.item.baseStats !== 'object') {
          rec.item.baseStats = {};
        }
        if (setOrDeleteNumeric(rec.item.baseStats, statKey, input.value)) {
          updateJsonFromRecord();
        }
      });
    });

    bindJsonEditor({
      textareaEl: jsonTextarea,
      statusEl: jsonStatus,
      onValidApply: (parsed, raw, err) => {
        hubState.itemJsonText = raw;
        hubState.itemJsonError = err;
        if (parsed) {
          rec.item = parsed;
          rec.replaceItem(parsed);
          if (saveBtn) saveBtn.disabled = domainSt.saving;
        } else if (saveBtn) {
          saveBtn.disabled = true;
        }
      },
    });

    reloadBtn?.addEventListener('click', async () => {
      await ensureDomainsLoaded([rec.domain], { force: true });
      const fresh = buildUnifiedItemRecords().find((r) => r.uid === rec.uid);
      if (fresh) syncItemJsonText(fresh);
      renderItemsStatsBody();
    });

    saveBtn?.addEventListener('click', () => {
      if (hubState.itemJsonError) return;
      void saveDomain(rec.domain);
    });
  }

  function renderItemsStatsBody() {
    const anyLoading = ITEM_DOMAINS.some((d) => getDomainState(d).loading);
    const anyLoaded = ITEM_DOMAINS.some((d) => getDomainState(d).loaded);
    const errors = ITEM_DOMAINS.map((d) => getDomainState(d).error).filter(Boolean);

    if (!anyLoaded && anyLoading) {
      centerBodyEl.innerHTML = '<div class="ops-empty-state">Loading engine item, set, and affix domains…</div>';
      return;
    }

    const allRecords = buildUnifiedItemRecords();
    const q = hubState.itemSearch.trim().toLowerCase();
    const filtered = allRecords.filter((rec) => {
      if (hubState.itemDomainFilter !== 'all' && rec.domain !== hubState.itemDomainFilter) return false;
      if (q) {
        const hay = `${rec.id} ${rec.name} ${rec.slot} ${rec.rarity} ${rec.domain} lv.${rec.levelReq}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!hubState.selectedItemUid || !filtered.some((r) => r.uid === hubState.selectedItemUid)) {
      const next = filtered[0] ?? null;
      hubState.selectedItemUid = next?.uid ?? null;
      syncItemJsonText(next);
    }
    const selectedRec = filtered.find((r) => r.uid === hubState.selectedItemUid) ?? null;
    if (selectedRec && !hubState.itemJsonText) {
      syncItemJsonText(selectedRec);
    }

    centerBodyEl.innerHTML = `
      ${errors.length ? `<div class="ops-inline-notice error">Load warning: ${esc(errors.join('; '))}</div>` : ''}
      ${renderArtReadinessCard({
        registries: hubState.registries,
        collapsed: hubState.artReadinessCollapsed,
      })}
      <div class="ops-items-layout">
        <div class="ops-items-left">
          <div class="ops-toolbar-row">
            <input
              id="ops-item-search"
              type="search"
              class="compact-input ops-search-grow"
              placeholder="Search ${allRecords.length} items (name, id, slot, lv)…"
              value="${esc(hubState.itemSearch)}"
            />
            <select id="ops-item-domain-select" class="compact-input ops-domain-select" aria-label="Filter by domain">
              <option value="all"${hubState.itemDomainFilter === 'all' ? ' selected' : ''}>All Domains (${allRecords.length})</option>
              ${ITEM_DOMAINS.map(
                (d) =>
                  `<option value="${d}"${hubState.itemDomainFilter === d ? ' selected' : ''}>${d}${
                    getDomainState(d).dirty ? ' *' : ''
                  }</option>`
              ).join('')}
            </select>
            <span class="count-chip">${filtered.length} / ${allRecords.length}</span>
          </div>
          <div class="ops-table-wrap">
            <table class="ops-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Domain</th>
                  <th>Slot</th>
                  <th>Lv</th>
                  <th>Stats</th>
                </tr>
              </thead>
              <tbody id="ops-items-tbody"></tbody>
            </table>
          </div>
        </div>
        <div id="ops-inspector-slot" class="ops-items-right">
          ${renderItemsInspectorPane(selectedRec)}
        </div>
      </div>
    `;

    const tbody = centerBodyEl.querySelector('#ops-items-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="ops-empty-cell">No records match current filters.</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      for (const rec of filtered) {
        const rarity = String(rec.rarity || 'common').toLowerCase();
        const tr = document.createElement('tr');
        tr.className = `ops-item-row${rec.uid === selectedRec?.uid ? ' selected' : ''}`;
        tr.dataset.uid = rec.uid;
        tr.innerHTML = `
          <td><span class="rarity-text-${esc(rarity)}">${esc(rec.name)}</span></td>
          <td class="ops-mono-cell">${esc(rec.domain)}</td>
          <td class="ops-mono-cell">${esc(rec.slot)}</td>
          <td class="ops-mono-cell">Lv.${esc(rec.levelReq ?? 1)}</td>
          <td class="ops-mono-cell">${esc(summarizeBaseStats(rec.item?.baseStats))}</td>
        `;
        tr.addEventListener('click', () => {
          hubState.selectedItemUid = rec.uid;
          syncItemJsonText(rec);
          tbody.querySelectorAll('.ops-item-row').forEach((r) => {
            r.classList.toggle('selected', r.dataset.uid === rec.uid);
          });
          const slot = centerBodyEl.querySelector('#ops-inspector-slot');
          if (slot) {
            slot.innerHTML = renderItemsInspectorPane(rec);
            bindItemInspectorEvents(rec);
          }
        });
        frag.appendChild(tr);
      }
      tbody.replaceChildren(frag);
    }

    const searchInput = centerBodyEl.querySelector('#ops-item-search');
    searchInput?.addEventListener('input', (e) => {
      hubState.itemSearch = e.target.value;
      const caret = e.target.selectionStart;
      renderItemsStatsBody();
      const refreshed = centerBodyEl.querySelector('#ops-item-search');
      if (refreshed) {
        refreshed.focus();
        if (typeof caret === 'number') refreshed.setSelectionRange(caret, caret);
      }
    });

    centerBodyEl.querySelector('#ops-item-domain-select')?.addEventListener('change', (e) => {
      hubState.itemDomainFilter = e.target.value;
      renderItemsStatsBody();
    });

    bindArtReadinessEvents(centerBodyEl, () => {
      hubState.artReadinessCollapsed = !hubState.artReadinessCollapsed;
      renderItemsStatsBody();
    });

    bindItemInspectorEvents(selectedRec);
  }

  // --- PILLAR 2: Monsters & Bosses ---
  function buildMonsterRecords() {
    const records = [];
    const irSt = getDomainState('ironspire-enemies');
    if (irSt.loaded && irSt.data && typeof irSt.data === 'object') {
      Object.entries(irSt.data).forEach(([key, enemy]) => {
        if (!enemy || typeof enemy !== 'object') return;
        records.push({
          uid: `ironspire-enemies::${key}`,
          domain: 'ironspire-enemies',
          sourceKey: 'ironspire-enemies',
          id: enemy.id || key,
          name: enemy.name || key,
          level: enemy.level ?? 1,
          tier: enemy.tier || 'mob',
          enemy,
          zoneJson: null,
          replaceEnemy: (nextObj) => {
            irSt.data[key] = nextObj;
            irSt.dirty = true;
          },
        });
      });
    }

    const zSt = getDomainState('zones');
    if (zSt.loaded && zSt.data && typeof zSt.data === 'object') {
      Object.entries(zSt.data).forEach(([zoneStem, zoneJson]) => {
        if (!zoneJson || typeof zoneJson !== 'object') return;
        const addEnemy = (enemy, setter) => {
          if (!enemy || typeof enemy !== 'object') return;
          records.push({
            uid: `zones::${zoneStem}::${enemy.id || Math.random()}`,
            domain: 'zones',
            sourceKey: zoneStem,
            id: enemy.id || zoneStem,
            name: enemy.name || enemy.id || zoneStem,
            level: enemy.level ?? 1,
            tier: enemy.tier || 'mob',
            enemy,
            zoneJson,
            replaceEnemy: (nextObj) => {
              setter(nextObj);
              zSt.dirty = true;
            },
          });
        };

        if (Array.isArray(zoneJson.zoneEnemies)) {
          zoneJson.zoneEnemies.forEach((e, i) => addEnemy(e, (n) => (zoneJson.zoneEnemies[i] = n)));
        }
        if (Array.isArray(zoneJson.enemies)) {
          zoneJson.enemies.forEach((e, i) => addEnemy(e, (n) => (zoneJson.enemies[i] = n)));
        }
        if (zoneJson.standardEnemy && typeof zoneJson.standardEnemy === 'object') {
          addEnemy(zoneJson.standardEnemy, (n) => (zoneJson.standardEnemy = n));
        }
        if (Array.isArray(zoneJson.trashEnemies)) {
          zoneJson.trashEnemies.forEach((e, i) => addEnemy(e, (n) => (zoneJson.trashEnemies[i] = n)));
        }
      });
    }

    return records;
  }

  function syncMonsterJsonText(rec) {
    if (!rec) {
      hubState.monsterJsonText = '';
      hubState.monsterJsonError = null;
      return;
    }
    const targetObj =
      hubState.monsterEditorMode === 'zone' && rec.zoneJson ? rec.zoneJson : rec.enemy;
    hubState.monsterJsonText = JSON.stringify(targetObj, null, 2);
    hubState.monsterJsonError = null;
  }

  function renderMonsterInspectorPane(rec) {
    if (!rec) {
      return `
        <div class="ops-inspector-card">
          <div class="ops-inspector-head">
            <strong>Enemy &amp; Boss Combat Editor</strong>
            <span class="badge badge-cyan">Select Enemy</span>
          </div>
          <div class="ops-empty-state">Select any monster or boss on the left to tune combat stats &amp; rewards.</div>
        </div>
      `;
    }

    const domainSt = getDomainState(rec.domain);
    const enemy = rec.enemy;
    const stats = enemy.stats && typeof enemy.stats === 'object' ? enemy.stats : {};
    const xpVal = enemy.xpReward ?? enemy.rewards?.xp;
    const goldVal = enemy.goldReward ?? enemy.rewards?.gold;

    return `
      <div class="ops-inspector-card ops-editor-scroll">
        <div class="ops-inspector-head">
          <div>
            <strong>${esc(enemy.name || rec.id)}</strong>
            <div class="ops-mono-muted">${esc(rec.id)} · ${esc(rec.sourceKey)} · ${esc(rec.tier)}</div>
          </div>
          <div class="ops-head-badges">
            ${
              rec.zoneJson
                ? `<div class="seg-group">
                    <button type="button" class="seg-btn${hubState.monsterEditorMode === 'enemy' ? ' active' : ''}" data-mob-edmode="enemy">Enemy</button>
                    <button type="button" class="seg-btn${hubState.monsterEditorMode === 'zone' ? ' active' : ''}" data-mob-edmode="zone">Zone JSON</button>
                  </div>`
                : ''
            }
          </div>
        </div>

        <div class="ops-form-grid ops-form-3col">
          <label class="ops-field">
            <span>level</span>
            <input type="number" step="1" class="compact-input" data-mob-top="level" value="${esc(formatNumVal(enemy.level))}" />
          </label>
          <label class="ops-field">
            <span>baseHp</span>
            <input type="number" step="1" class="compact-input" data-mob-top="baseHp" value="${esc(formatNumVal(enemy.baseHp))}" />
          </label>
          <label class="ops-field">
            <span>baseSpeed</span>
            <input type="number" step="1" class="compact-input" data-mob-top="baseSpeed" value="${esc(formatNumVal(enemy.baseSpeed))}" />
          </label>
          <label class="ops-field">
            <span>xpReward</span>
            <input type="number" step="1" class="compact-input" data-mob-top="xpReward" value="${esc(formatNumVal(xpVal))}" placeholder="—" />
          </label>
          <label class="ops-field">
            <span>goldReward</span>
            <input type="number" step="1" class="compact-input" data-mob-top="goldReward" value="${esc(formatNumVal(goldVal))}" placeholder="—" />
          </label>
          <label class="ops-field">
            <span>primaryElement</span>
            <input type="text" class="compact-input" value="${esc(enemy.primaryElement || 'physical')}" readonly />
          </label>
        </div>

        <div class="ops-section-kicker">Combat Stats (enemy.stats)</div>
        <div class="ops-form-grid ops-form-3col">
          ${ENEMY_STAT_FIELDS.map((f) => {
            const val = stats[f.key];
            return `
              <label class="ops-field">
                <span>${esc(f.label)}</span>
                <input type="number" step="any" class="compact-input" data-mob-stat="${esc(f.key)}" value="${esc(formatNumVal(val))}" placeholder="—" />
              </label>
            `;
          }).join('')}
        </div>

        <div class="ops-json-header">
          <span class="ops-section-kicker">${
            hubState.monsterEditorMode === 'zone' && rec.zoneJson
              ? `Full Zone JSON (${esc(rec.sourceKey)})`
              : 'Enemy JSON (moves, wiki, ai)'
          }</span>
          <span id="ops-mob-json-status" class="badge ${hubState.monsterJsonError ? 'badge-rose' : 'badge-emerald'}">
            ${hubState.monsterJsonError ? `JSON Error: ${esc(hubState.monsterJsonError)}` : 'Valid JSON'}
          </span>
        </div>
        <textarea id="ops-mob-json" class="ops-json-textarea" spellcheck="false">${esc(hubState.monsterJsonText)}</textarea>

        <div class="ops-inspector-foot">
          <span class="ops-mono-muted">PUT /api/data/${esc(rec.domain)}${rec.domain === 'zones' ? ` (${rec.sourceKey})` : ''}</span>
          <div class="ops-foot-actions">
            <button id="ops-mob-reload-btn" type="button" class="btn btn-sm" ${domainSt.saving ? 'disabled' : ''}>Reload</button>
            <button id="ops-mob-save-btn" type="button" class="btn btn-sm btn-amber" ${
              domainSt.saving || hubState.monsterJsonError ? 'disabled' : ''
            }>
              ${domainSt.saving ? 'Saving…' : 'Save to Engine'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function bindMonsterInspectorEvents(rec) {
    if (!rec) return;
    const domainSt = getDomainState(rec.domain);
    const jsonTextarea = centerBodyEl.querySelector('#ops-mob-json');
    const jsonStatus = centerBodyEl.querySelector('#ops-mob-json-status');
    const saveBtn = centerBodyEl.querySelector('#ops-mob-save-btn');
    const reloadBtn = centerBodyEl.querySelector('#ops-mob-reload-btn');

    const updateJsonFromEnemy = () => {
      syncMonsterJsonText(rec);
      if (jsonTextarea) jsonTextarea.value = hubState.monsterJsonText;
      if (jsonStatus) {
        jsonStatus.textContent = 'Valid JSON';
        jsonStatus.className = 'badge badge-emerald';
      }
      if (saveBtn) saveBtn.disabled = domainSt.saving;
      domainSt.dirty = true;
    };

    centerBodyEl.querySelectorAll('[data-mob-edmode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        hubState.monsterEditorMode = btn.dataset.mobEdmode;
        syncMonsterJsonText(rec);
        const slot = centerBodyEl.querySelector('#ops-mob-inspector-slot');
        if (slot) {
          slot.innerHTML = renderMonsterInspectorPane(rec);
          bindMonsterInspectorEvents(rec);
        }
      });
    });

    centerBodyEl.querySelectorAll('[data-mob-top]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.mobTop;
        if (key === 'xpReward' || key === 'goldReward') {
          const rewardKey = key === 'xpReward' ? 'xp' : 'gold';
          if (rec.enemy.rewards && typeof rec.enemy.rewards === 'object') {
            if (setOrDeleteNumeric(rec.enemy.rewards, rewardKey, input.value)) {
              updateJsonFromEnemy();
            }
          } else if (setOrDeleteNumeric(rec.enemy, key, input.value)) {
            updateJsonFromEnemy();
          }
          return;
        }
        if (setOrDeleteNumeric(rec.enemy, key, input.value)) {
          updateJsonFromEnemy();
        }
      });
    });

    centerBodyEl.querySelectorAll('[data-mob-stat]').forEach((input) => {
      input.addEventListener('input', () => {
        const statKey = input.dataset.mobStat;
        if (!rec.enemy.stats || typeof rec.enemy.stats !== 'object') {
          rec.enemy.stats = {};
        }
        if (setOrDeleteNumeric(rec.enemy.stats, statKey, input.value)) {
          updateJsonFromEnemy();
        }
      });
    });

    bindJsonEditor({
      textareaEl: jsonTextarea,
      statusEl: jsonStatus,
      onValidApply: (parsed, raw, err) => {
        hubState.monsterJsonText = raw;
        hubState.monsterJsonError = err;
        if (parsed) {
          if (hubState.monsterEditorMode === 'zone' && rec.domain === 'zones') {
            domainSt.data[rec.sourceKey] = parsed;
            rec.zoneJson = parsed;
            domainSt.dirty = true;
          } else {
            rec.enemy = parsed;
            rec.replaceEnemy(parsed);
          }
          if (saveBtn) saveBtn.disabled = domainSt.saving;
        } else if (saveBtn) {
          saveBtn.disabled = true;
        }
      },
    });

    reloadBtn?.addEventListener('click', async () => {
      await ensureDomainsLoaded([rec.domain], { force: true });
      const fresh = buildMonsterRecords().find((r) => r.uid === rec.uid);
      if (fresh) syncMonsterJsonText(fresh);
      renderMonstersBody();
    });

    saveBtn?.addEventListener('click', () => {
      if (hubState.monsterJsonError) return;
      if (rec.domain === 'zones') {
        void saveDomain('zones', { [rec.sourceKey]: domainSt.data[rec.sourceKey] });
      } else {
        void saveDomain('ironspire-enemies');
      }
    });
  }

  function renderMonstersBody() {
    const irSt = getDomainState('ironspire-enemies');
    const zSt = getDomainState('zones');
    if ((!irSt.loaded && irSt.loading) || (!zSt.loaded && zSt.loading)) {
      centerBodyEl.innerHTML = '<div class="ops-empty-state">Loading Ironspire enemies &amp; zone data…</div>';
      return;
    }

    const allMonsters = buildMonsterRecords();
    const sources = [...new Set(allMonsters.map((m) => m.sourceKey))].sort();
    const q = hubState.monsterSearch.trim().toLowerCase();
    const filtered = allMonsters.filter((m) => {
      if (hubState.monsterSourceFilter !== 'all' && m.sourceKey !== hubState.monsterSourceFilter) return false;
      if (q) {
        const hay = `${m.id} ${m.name} ${m.sourceKey} ${m.tier} lv.${m.level}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!hubState.selectedMonsterUid || !filtered.some((m) => m.uid === hubState.selectedMonsterUid)) {
      const next = filtered[0] ?? null;
      hubState.selectedMonsterUid = next?.uid ?? null;
      hubState.monsterEditorMode = 'enemy';
      syncMonsterJsonText(next);
    }
    const selectedRec = filtered.find((m) => m.uid === hubState.selectedMonsterUid) ?? null;
    if (selectedRec && !hubState.monsterJsonText) {
      syncMonsterJsonText(selectedRec);
    }

    centerBodyEl.innerHTML = `
      <div class="ops-items-layout">
        <div class="ops-items-left">
          <div class="ops-toolbar-row">
            <input
              id="ops-mob-search"
              type="search"
              class="compact-input ops-search-grow"
              placeholder="Search ${allMonsters.length} monsters &amp; bosses…"
              value="${esc(hubState.monsterSearch)}"
            />
            <select id="ops-mob-source" class="compact-input ops-domain-select" aria-label="Filter by zone">
              <option value="all"${hubState.monsterSourceFilter === 'all' ? ' selected' : ''}>All Sources (${allMonsters.length})</option>
              ${sources
                .map(
                  (s) =>
                    `<option value="${esc(s)}"${hubState.monsterSourceFilter === s ? ' selected' : ''}>${esc(s)}</option>`
                )
                .join('')}
            </select>
            <span class="count-chip">${filtered.length} / ${allMonsters.length}</span>
          </div>
          <div class="ops-table-wrap">
            <table class="ops-table">
              <thead>
                <tr>
                  <th>Enemy / Boss</th>
                  <th>Source</th>
                  <th>Tier</th>
                  <th>Lv</th>
                  <th>HP / ATK</th>
                </tr>
              </thead>
              <tbody id="ops-mob-tbody"></tbody>
            </table>
          </div>
        </div>
        <div id="ops-mob-inspector-slot" class="ops-items-right">
          ${renderMonsterInspectorPane(selectedRec)}
        </div>
      </div>
    `;

    const tbody = centerBodyEl.querySelector('#ops-mob-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="ops-empty-cell">No monsters match current filters.</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      for (const m of filtered) {
        const tr = document.createElement('tr');
        tr.className = `ops-item-row${m.uid === selectedRec?.uid ? ' selected' : ''}`;
        tr.dataset.uid = m.uid;
        const hp = m.enemy?.stats?.maxHp ?? m.enemy?.baseHp ?? '—';
        const atk = m.enemy?.stats?.physAtk ?? m.enemy?.stats?.elemAtk ?? '—';
        const tierBadge = m.tier === 'boss' ? 'badge-rose' : m.tier === 'elite' ? 'badge-amber' : 'badge-cyan';
        tr.innerHTML = `
          <td><strong>${esc(m.name)}</strong></td>
          <td class="ops-mono-cell">${esc(m.sourceKey)}</td>
          <td><span class="badge ${tierBadge}">${esc(m.tier)}</span></td>
          <td class="ops-mono-cell">Lv.${esc(m.level)}</td>
          <td class="ops-mono-cell">HP ${esc(hp)} · ATK ${esc(atk)}</td>
        `;
        tr.addEventListener('click', () => {
          hubState.selectedMonsterUid = m.uid;
          hubState.monsterEditorMode = 'enemy';
          syncMonsterJsonText(m);
          tbody.querySelectorAll('.ops-item-row').forEach((r) => {
            r.classList.toggle('selected', r.dataset.uid === m.uid);
          });
          const slot = centerBodyEl.querySelector('#ops-mob-inspector-slot');
          if (slot) {
            slot.innerHTML = renderMonsterInspectorPane(m);
            bindMonsterInspectorEvents(m);
          }
        });
        frag.appendChild(tr);
      }
      tbody.replaceChildren(frag);
    }

    const searchInput = centerBodyEl.querySelector('#ops-mob-search');
    searchInput?.addEventListener('input', (e) => {
      hubState.monsterSearch = e.target.value;
      const caret = e.target.selectionStart;
      renderMonstersBody();
      const refreshed = centerBodyEl.querySelector('#ops-mob-search');
      if (refreshed) {
        refreshed.focus();
        if (typeof caret === 'number') refreshed.setSelectionRange(caret, caret);
      }
    });

    centerBodyEl.querySelector('#ops-mob-source')?.addEventListener('change', (e) => {
      hubState.monsterSourceFilter = e.target.value;
      renderMonstersBody();
    });

    bindMonsterInspectorEvents(selectedRec);
  }

  const flyffWorkbench = createFlyffLootWorkbench({
    getLiveTablesData: () => getDomainState('loot-tables').data,
    getLiveTablesError: () => hubState.lootJsonError,
    audio,
  });

  function renderWorkbenchHost() {
    const host = centerBodyEl.querySelector('#ops-flyff-workbench-host');
    if (!host) return;
    host.innerHTML = flyffWorkbench.renderHtml();
    flyffWorkbench.bindEvents(host, renderWorkbenchHost);
  }

  // --- PILLAR 3: Loot & Economy ---
  function buildLootRecords() {
    const records = [];
    const ltSt = getDomainState('loot-tables');
    if (ltSt.loaded && ltSt.data && typeof ltSt.data === 'object') {
      if (ltSt.data.epicAoeDropRates) {
        records.push({
          uid: 'loot-tables::epicAoeDropRates',
          domain: 'loot-tables',
          id: 'epicAoeDropRates',
          title: 'Epic AoE Drop Rates',
          kind: 'epic-aoe',
          entry: ltSt.data.epicAoeDropRates,
          replaceEntry: (nextObj) => {
            ltSt.data.epicAoeDropRates = nextObj;
            ltSt.dirty = true;
          },
        });
      }
      if (ltSt.data.baseDropTables && typeof ltSt.data.baseDropTables === 'object') {
        Object.entries(ltSt.data.baseDropTables).forEach(([key, tbl]) => {
          records.push({
            uid: `loot-tables::base::${key}`,
            domain: 'loot-tables',
            id: key,
            title: `Base Table: ${key}`,
            kind: 'drop-table',
            entry: tbl,
            replaceEntry: (nextObj) => {
              ltSt.data.baseDropTables[key] = nextObj;
              ltSt.dirty = true;
            },
          });
        });
      }
    }

    const trSt = getDomainState('trash-loot');
    if (trSt.loaded && trSt.data && typeof trSt.data === 'object') {
      records.push({
        uid: 'trash-loot::config',
        domain: 'trash-loot',
        id: 'trash-loot',
        title: 'Trash Loot Economy Tuning',
        kind: 'trash-loot',
        entry: trSt.data,
        replaceEntry: (nextObj) => {
          trSt.data = nextObj;
          trSt.dirty = true;
        },
      });
    }
    return records;
  }

  function syncLootJsonText(rec) {
    hubState.lootJsonText = rec ? JSON.stringify(rec.entry, null, 2) : '';
    hubState.lootJsonError = null;
  }

  function renderLootInspectorPane(rec) {
    if (!rec) {
      return '<div class="ops-empty-state">Select a loot table or economy config on the left.</div>';
    }
    const domainSt = getDomainState(rec.domain);
    const entry = rec.entry;
    let fieldsHtml = '';

    if (rec.kind === 'drop-table') {
      const gold = Array.isArray(entry.goldRange) ? entry.goldRange : [0, 0];
      const dust = Array.isArray(entry.dustRange) ? entry.dustRange : [0, 0];
      const mat = Array.isArray(entry.materialRange) ? entry.materialRange : [0, 0];
      const weights = entry.gearRarityWeights || {};
      fieldsHtml = `
        <div class="ops-section-kicker">Ranges &amp; Drop Chances</div>
        <div class="ops-form-grid ops-form-3col">
          <label class="ops-field"><span>goldMin</span><input type="number" step="1" class="compact-input" data-loot-range="goldRange:0" value="${esc(gold[0] ?? 0)}" /></label>
          <label class="ops-field"><span>goldMax</span><input type="number" step="1" class="compact-input" data-loot-range="goldRange:1" value="${esc(gold[1] ?? 0)}" /></label>
          <label class="ops-field"><span>glyphChance</span><input type="number" step="any" class="compact-input" data-loot-scalar="glyphChance" value="${esc(formatNumVal(entry.glyphChance))}" /></label>
          <label class="ops-field"><span>dustMin</span><input type="number" step="1" class="compact-input" data-loot-range="dustRange:0" value="${esc(dust[0] ?? 0)}" /></label>
          <label class="ops-field"><span>dustMax</span><input type="number" step="1" class="compact-input" data-loot-range="dustRange:1" value="${esc(dust[1] ?? 0)}" /></label>
          <label class="ops-field"><span>gearChance</span><input type="number" step="any" class="compact-input" data-loot-scalar="gearChance" value="${esc(formatNumVal(entry.gearChance))}" /></label>
          <label class="ops-field"><span>materialMin</span><input type="number" step="1" class="compact-input" data-loot-range="materialRange:0" value="${esc(mat[0] ?? 0)}" /></label>
          <label class="ops-field"><span>materialMax</span><input type="number" step="1" class="compact-input" data-loot-range="materialRange:1" value="${esc(mat[1] ?? 0)}" /></label>
          <label class="ops-field"><span>sealedCacheChance</span><input type="number" step="any" class="compact-input" data-loot-scalar="sealedCacheChance" value="${esc(formatNumVal(entry.sealedCacheChance))}" /></label>
        </div>
        <div class="ops-section-kicker">Gear Rarity Weights</div>
        <div class="ops-form-grid ops-form-5col">
          ${['common', 'uncommon', 'rare', 'epic', 'mythic']
            .map(
              (r) => `
            <label class="ops-field">
              <span>${r}</span>
              <input type="number" step="any" class="compact-input" data-loot-rarity="${r}" value="${esc(formatNumVal(weights[r] ?? 0))}" />
            </label>`
            )
            .join('')}
        </div>
      `;
    } else {
      fieldsHtml = `
        <div class="ops-section-kicker">Numeric Multipliers &amp; Rates</div>
        <div class="ops-form-grid ops-form-3col">
          ${Object.entries(entry)
            .filter(([, v]) => typeof v === 'number')
            .map(
              ([k, v]) => `
            <label class="ops-field">
              <span>${esc(k)}</span>
              <input type="number" step="any" class="compact-input" data-loot-scalar="${esc(k)}" value="${esc(v)}" />
            </label>`
            )
            .join('')}
        </div>
      `;
    }

    return `
      <div class="ops-inspector-card ops-editor-scroll">
        <div class="ops-inspector-head">
          <div>
            <strong>${esc(rec.title)}</strong>
            <div class="ops-mono-muted">${esc(rec.domain)} · ${esc(rec.id)}</div>
          </div>
          ${domainSt.dirty ? '<span class="badge badge-amber">Unsaved</span>' : '<span class="badge badge-emerald">Synced</span>'}
        </div>
        ${fieldsHtml}
        <div class="ops-json-header">
          <span class="ops-section-kicker">JSON Editor</span>
          <span id="ops-loot-json-status" class="badge ${hubState.lootJsonError ? 'badge-rose' : 'badge-emerald'}">
            ${hubState.lootJsonError ? `JSON Error: ${esc(hubState.lootJsonError)}` : 'Valid JSON'}
          </span>
        </div>
        <textarea id="ops-loot-json" class="ops-json-textarea" spellcheck="false">${esc(hubState.lootJsonText)}</textarea>
        <div class="ops-inspector-foot">
          <span class="ops-mono-muted">Target: ${esc(domainSt.path || rec.domain)}</span>
          <div class="ops-foot-actions">
            <button id="ops-loot-reload-btn" type="button" class="btn btn-sm" ${domainSt.saving ? 'disabled' : ''}>Reload</button>
            <button id="ops-loot-save-btn" type="button" class="btn btn-sm btn-amber" ${
              domainSt.saving || hubState.lootJsonError ? 'disabled' : ''
            }>${domainSt.saving ? 'Saving…' : 'Save to Engine'}</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindLootInspectorEvents(rec) {
    if (!rec) return;
    const domainSt = getDomainState(rec.domain);
    const jsonTextarea = centerBodyEl.querySelector('#ops-loot-json');
    const jsonStatus = centerBodyEl.querySelector('#ops-loot-json-status');
    const saveBtn = centerBodyEl.querySelector('#ops-loot-save-btn');
    const reloadBtn = centerBodyEl.querySelector('#ops-loot-reload-btn');

    const updateJson = () => {
      syncLootJsonText(rec);
      if (jsonTextarea) jsonTextarea.value = hubState.lootJsonText;
      if (jsonStatus) {
        jsonStatus.textContent = 'Valid JSON';
        jsonStatus.className = 'badge badge-emerald';
      }
      if (saveBtn) saveBtn.disabled = domainSt.saving;
      domainSt.dirty = true;
      renderWorkbenchHost();
    };

    centerBodyEl.querySelectorAll('[data-loot-scalar]').forEach((input) => {
      input.addEventListener('input', () => {
        const parsed = parseOptionalNumber(input.value);
        if (parsed.valid && !parsed.empty) {
          rec.entry[input.dataset.lootScalar] = parsed.value;
          updateJson();
        }
      });
    });

    centerBodyEl.querySelectorAll('[data-loot-range]').forEach((input) => {
      input.addEventListener('input', () => {
        const [field, idxStr] = input.dataset.lootRange.split(':');
        const idx = Number(idxStr);
        const parsed = parseOptionalNumber(input.value);
        if (parsed.valid && !parsed.empty) {
          if (!Array.isArray(rec.entry[field])) rec.entry[field] = [0, 0];
          rec.entry[field][idx] = parsed.value;
          updateJson();
        }
      });
    });

    centerBodyEl.querySelectorAll('[data-loot-rarity]').forEach((input) => {
      input.addEventListener('input', () => {
        const r = input.dataset.lootRarity;
        const parsed = parseOptionalNumber(input.value);
        if (parsed.valid && !parsed.empty) {
          if (!rec.entry.gearRarityWeights || typeof rec.entry.gearRarityWeights !== 'object') {
            rec.entry.gearRarityWeights = {};
          }
          rec.entry.gearRarityWeights[r] = parsed.value;
          updateJson();
        }
      });
    });

    bindJsonEditor({
      textareaEl: jsonTextarea,
      statusEl: jsonStatus,
      onValidApply: (parsed, raw, err) => {
        hubState.lootJsonText = raw;
        hubState.lootJsonError = err;
        if (parsed) {
          rec.entry = parsed;
          rec.replaceEntry(parsed);
          if (saveBtn) saveBtn.disabled = domainSt.saving;
        } else if (saveBtn) {
          saveBtn.disabled = true;
        }
        renderWorkbenchHost();
      },
    });

    reloadBtn?.addEventListener('click', async () => {
      await ensureDomainsLoaded([rec.domain], { force: true });
      const fresh = buildLootRecords().find((r) => r.uid === rec.uid);
      if (fresh) syncLootJsonText(fresh);
      renderLootEconomyBody();
    });

    saveBtn?.addEventListener('click', () => {
      if (hubState.lootJsonError) return;
      void saveDomain(rec.domain);
    });
  }

  function renderLootEconomyBody() {
    const ltSt = getDomainState('loot-tables');
    const trSt = getDomainState('trash-loot');
    if ((!ltSt.loaded && ltSt.loading) || (!trSt.loaded && trSt.loading)) {
      centerBodyEl.innerHTML = '<div class="ops-empty-state">Loading loot tables &amp; trash loot configuration…</div>';
      return;
    }

    const records = buildLootRecords();
    if (!hubState.selectedLootUid || !records.some((r) => r.uid === hubState.selectedLootUid)) {
      const next = records[0] ?? null;
      hubState.selectedLootUid = next?.uid ?? null;
      syncLootJsonText(next);
    }
    const selectedRec = records.find((r) => r.uid === hubState.selectedLootUid) ?? null;
    if (selectedRec && !hubState.lootJsonText) syncLootJsonText(selectedRec);

    centerBodyEl.innerHTML = `
      <div class="ops-loot-scroll">
        <div class="ops-items-layout ops-loot-top-editor">
          <div class="ops-items-left">
            <div class="ops-table-wrap">
              <table class="ops-table">
                <thead>
                  <tr>
                    <th>Table / Config</th>
                    <th>Domain</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody id="ops-loot-tbody"></tbody>
              </table>
            </div>
          </div>
          <div id="ops-loot-inspector-slot" class="ops-items-right">
            ${renderLootInspectorPane(selectedRec)}
          </div>
        </div>
        <div id="ops-flyff-workbench-host"></div>
      </div>
    `;

    const tbody = centerBodyEl.querySelector('#ops-loot-tbody');
    const frag = document.createDocumentFragment();
    for (const r of records) {
      const tr = document.createElement('tr');
      tr.className = `ops-item-row${r.uid === selectedRec?.uid ? ' selected' : ''}`;
      tr.dataset.uid = r.uid;
      let summary = '';
      if (r.kind === 'drop-table') {
        summary = `Gold ${r.entry.goldRange?.join('-')} · Gear ${(Number(r.entry.gearChance || 0) * 100).toFixed(0)}% · Glyph ${(Number(r.entry.glyphChance || 0) * 100).toFixed(1)}%`;
      } else if (r.kind === 'epic-aoe') {
        summary = `Elite ${r.entry.elite} · Boss ${r.entry.realm_boss}`;
      } else {
        summary = `XP x${r.entry.xpMultiplier} · Gold x${r.entry.goldMultiplier} · Gear ${r.entry.gearChance}`;
      }
      tr.innerHTML = `
        <td><strong>${esc(r.title)}</strong></td>
        <td class="ops-mono-cell">${esc(r.domain)}</td>
        <td class="ops-mono-cell">${esc(summary)}</td>
      `;
      tr.addEventListener('click', () => {
        hubState.selectedLootUid = r.uid;
        syncLootJsonText(r);
        tbody.querySelectorAll('.ops-item-row').forEach((row) => {
          row.classList.toggle('selected', row.dataset.uid === r.uid);
        });
        const slot = centerBodyEl.querySelector('#ops-loot-inspector-slot');
        if (slot) {
          slot.innerHTML = renderLootInspectorPane(r);
          bindLootInspectorEvents(r);
        }
      });
      frag.appendChild(tr);
    }
    tbody.replaceChildren(frag);
    bindLootInspectorEvents(selectedRec);
    renderWorkbenchHost();
  }

  // --- PILLAR 4: Glyphs & Classes ---
  function buildGlyphClassRecords() {
    const records = [];
    const gSt = getDomainState('glyphs');
    if (gSt.loaded && gSt.data && typeof gSt.data === 'object') {
      GLYPH_KEYS.forEach((fileKey) => {
        const list = Array.isArray(gSt.data[fileKey]) ? gSt.data[fileKey] : [];
        list.forEach((glyph, index) => {
          records.push({
            uid: `glyphs::${fileKey}::${glyph.glyphId || index}`,
            domain: 'glyphs',
            fileKey,
            kind: 'glyph',
            id: glyph.glyphId || `${fileKey}_${index}`,
            name: glyph.name || glyph.glyphId,
            group: fileKey,
            levelReq: glyph.levelReq ?? 1,
            rarity: glyph.rarity || 'common',
            entry: glyph,
            replaceEntry: (nextObj) => {
              gSt.data[fileKey][index] = nextObj;
              gSt.dirty = true;
            },
          });
        });
      });
    }

    const cSt = getDomainState('starter-classes');
    if (cSt.loaded && cSt.data && typeof cSt.data === 'object') {
      Object.entries(cSt.data).forEach(([classKey, cls]) => {
        if (!cls || typeof cls !== 'object') return;
        records.push({
          uid: `starter-classes::${classKey}`,
          domain: 'starter-classes',
          fileKey: classKey,
          kind: 'class',
          id: cls.id || classKey,
          name: cls.displayName || classKey,
          group: 'starter-classes',
          levelReq: 1,
          rarity: 'epic',
          entry: cls,
          replaceEntry: (nextObj) => {
            cSt.data[classKey] = nextObj;
            cSt.dirty = true;
          },
        });
      });
    }
    return records;
  }

  function syncGlyphJsonText(rec) {
    hubState.glyphJsonText = rec ? JSON.stringify(rec.entry, null, 2) : '';
    hubState.glyphJsonError = null;
  }

  function renderGlyphInspectorPane(rec) {
    if (!rec) {
      return '<div class="ops-empty-state">Select a glyph or starter class on the left to inspect and edit.</div>';
    }
    const domainSt = getDomainState(rec.domain);
    const e = rec.entry;
    const fieldsHtml =
      rec.kind === 'glyph'
        ? `
        <div class="ops-form-grid ops-form-3col">
          <label class="ops-field"><span>levelReq</span><input type="number" step="1" class="compact-input" data-gc-num="levelReq" value="${esc(formatNumVal(e.levelReq))}" /></label>
          <label class="ops-field"><span>basePower</span><input type="number" step="any" class="compact-input" data-gc-num="basePower" value="${esc(formatNumVal(e.basePower))}" /></label>
          <label class="ops-field"><span>baseCasts</span><input type="number" step="1" class="compact-input" data-gc-num="baseCasts" value="${esc(formatNumVal(e.baseCasts))}" /></label>
          <label class="ops-field"><span>hitCount</span><input type="number" step="1" class="compact-input" data-gc-num="hitCount" value="${esc(formatNumVal(e.hitCount))}" /></label>
          <label class="ops-field"><span>salvageDust</span><input type="number" step="1" class="compact-input" data-gc-num="salvageDust" value="${esc(formatNumVal(e.salvageDust))}" /></label>
          <label class="ops-field ops-checkbox-field">
            <span>isAoe</span>
            <input type="checkbox" data-gc-bool="isAoe" ${e.isAoe ? 'checked' : ''} />
          </label>
        </div>
      `
        : `
        <div class="ops-form-grid ops-form-3col">
          ${['baseHp', 'baseSpeed', 'physAtk', 'physDef', 'elemAtk', 'elemDef', 'specAtk', 'specDef', 'statTotal']
            .map(
              (k) => `
            <label class="ops-field">
              <span>${k}</span>
              <input type="number" step="any" class="compact-input" data-gc-num="${k}" value="${esc(formatNumVal(e[k]))}" />
            </label>`
            )
            .join('')}
        </div>
      `;

    return `
      <div class="ops-inspector-card ops-editor-scroll">
        <div class="ops-inspector-head">
          <div>
            <strong>${esc(rec.name)}</strong>
            <div class="ops-mono-muted">${esc(rec.id)} · ${esc(rec.domain)}${rec.kind === 'glyph' ? ` (${rec.fileKey})` : ''}</div>
          </div>
          ${domainSt.dirty ? '<span class="badge badge-amber">Unsaved</span>' : '<span class="badge badge-emerald">Synced</span>'}
        </div>
        ${fieldsHtml}
        <div class="ops-json-header">
          <span class="ops-section-kicker">Full Entry JSON</span>
          <span id="ops-gc-json-status" class="badge ${hubState.glyphJsonError ? 'badge-rose' : 'badge-emerald'}">
            ${hubState.glyphJsonError ? `JSON Error: ${esc(hubState.glyphJsonError)}` : 'Valid JSON'}
          </span>
        </div>
        <textarea id="ops-gc-json" class="ops-json-textarea" spellcheck="false">${esc(hubState.glyphJsonText)}</textarea>
        <div class="ops-inspector-foot">
          <span class="ops-mono-muted">PUT /api/data/${esc(rec.domain)}${rec.domain === 'glyphs' ? ` (${rec.fileKey})` : ''}</span>
          <div class="ops-foot-actions">
            <button id="ops-gc-reload-btn" type="button" class="btn btn-sm" ${domainSt.saving ? 'disabled' : ''}>Reload</button>
            <button id="ops-gc-save-btn" type="button" class="btn btn-sm btn-amber" ${
              domainSt.saving || hubState.glyphJsonError ? 'disabled' : ''
            }>${domainSt.saving ? 'Saving…' : 'Save to Engine'}</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindGlyphInspectorEvents(rec) {
    if (!rec) return;
    const domainSt = getDomainState(rec.domain);
    const jsonTextarea = centerBodyEl.querySelector('#ops-gc-json');
    const jsonStatus = centerBodyEl.querySelector('#ops-gc-json-status');
    const saveBtn = centerBodyEl.querySelector('#ops-gc-save-btn');
    const reloadBtn = centerBodyEl.querySelector('#ops-gc-reload-btn');

    const updateJson = () => {
      syncGlyphJsonText(rec);
      if (jsonTextarea) jsonTextarea.value = hubState.glyphJsonText;
      if (jsonStatus) {
        jsonStatus.textContent = 'Valid JSON';
        jsonStatus.className = 'badge badge-emerald';
      }
      if (saveBtn) saveBtn.disabled = domainSt.saving;
      domainSt.dirty = true;
    };

    centerBodyEl.querySelectorAll('[data-gc-num]').forEach((input) => {
      input.addEventListener('input', () => {
        if (setOrDeleteNumeric(rec.entry, input.dataset.gcNum, input.value)) {
          updateJson();
        }
      });
    });

    centerBodyEl.querySelectorAll('[data-gc-bool]').forEach((input) => {
      input.addEventListener('change', () => {
        rec.entry[input.dataset.gcBool] = input.checked;
        updateJson();
      });
    });

    bindJsonEditor({
      textareaEl: jsonTextarea,
      statusEl: jsonStatus,
      onValidApply: (parsed, raw, err) => {
        hubState.glyphJsonText = raw;
        hubState.glyphJsonError = err;
        if (parsed) {
          rec.entry = parsed;
          rec.replaceEntry(parsed);
          if (saveBtn) saveBtn.disabled = domainSt.saving;
        } else if (saveBtn) {
          saveBtn.disabled = true;
        }
      },
    });

    reloadBtn?.addEventListener('click', async () => {
      await ensureDomainsLoaded([rec.domain], { force: true });
      const fresh = buildGlyphClassRecords().find((r) => r.uid === rec.uid);
      if (fresh) syncGlyphJsonText(fresh);
      renderGlyphsClassesBody();
    });

    saveBtn?.addEventListener('click', () => {
      if (hubState.glyphJsonError) return;
      if (rec.domain === 'glyphs') {
        void saveDomain('glyphs', { [rec.fileKey]: domainSt.data[rec.fileKey] });
      } else {
        void saveDomain('starter-classes');
      }
    });
  }

  function renderGlyphsClassesBody() {
    const gSt = getDomainState('glyphs');
    const cSt = getDomainState('starter-classes');
    if ((!gSt.loaded && gSt.loading) || (!cSt.loaded && cSt.loading)) {
      centerBodyEl.innerHTML = '<div class="ops-empty-state">Loading glyphs &amp; starter classes…</div>';
      return;
    }

    const allRecords = buildGlyphClassRecords();
    const q = hubState.glyphSearch.trim().toLowerCase();
    const filtered = allRecords.filter((r) => {
      if (hubState.glyphFilter !== 'all' && r.group !== hubState.glyphFilter) return false;
      if (q) {
        const hay = `${r.id} ${r.name} ${r.group} ${r.rarity} lv.${r.levelReq}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!hubState.selectedGlyphUid || !filtered.some((r) => r.uid === hubState.selectedGlyphUid)) {
      const next = filtered[0] ?? null;
      hubState.selectedGlyphUid = next?.uid ?? null;
      syncGlyphJsonText(next);
    }
    const selectedRec = filtered.find((r) => r.uid === hubState.selectedGlyphUid) ?? null;
    if (selectedRec && !hubState.glyphJsonText) syncGlyphJsonText(selectedRec);

    centerBodyEl.innerHTML = `
      <div class="ops-items-layout">
        <div class="ops-items-left">
          <div class="ops-toolbar-row">
            <input
              id="ops-gc-search"
              type="search"
              class="compact-input ops-search-grow"
              placeholder="Search ${allRecords.length} glyphs &amp; classes…"
              value="${esc(hubState.glyphSearch)}"
            />
            <select id="ops-gc-filter" class="compact-input ops-domain-select" aria-label="Filter glyphs or classes">
              <option value="all"${hubState.glyphFilter === 'all' ? ' selected' : ''}>All (${allRecords.length})</option>
              ${GLYPH_KEYS.map(
                (k) => `<option value="${k}"${hubState.glyphFilter === k ? ' selected' : ''}>glyphs/${k}</option>`
              ).join('')}
              <option value="starter-classes"${hubState.glyphFilter === 'starter-classes' ? ' selected' : ''}>starter-classes</option>
            </select>
            <span class="count-chip">${filtered.length}</span>
          </div>
          <div class="ops-table-wrap">
            <table class="ops-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Group</th>
                  <th>Lv</th>
                  <th>Stats / Power</th>
                </tr>
              </thead>
              <tbody id="ops-gc-tbody"></tbody>
            </table>
          </div>
        </div>
        <div id="ops-gc-inspector-slot" class="ops-items-right">
          ${renderGlyphInspectorPane(selectedRec)}
        </div>
      </div>
    `;

    const tbody = centerBodyEl.querySelector('#ops-gc-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="ops-empty-cell">No records match filters.</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      for (const r of filtered) {
        const tr = document.createElement('tr');
        tr.className = `ops-item-row${r.uid === selectedRec?.uid ? ' selected' : ''}`;
        tr.dataset.uid = r.uid;
        const summary =
          r.kind === 'glyph'
            ? `Pwr ${r.entry.basePower ?? 0} · Casts ${r.entry.baseCasts ?? 0} · ${r.entry.element || 'phys'}`
            : `HP ${r.entry.baseHp} · ATK ${r.entry.physAtk}/${r.entry.elemAtk} · Total ${r.entry.statTotal}`;
        tr.innerHTML = `
          <td><span class="rarity-text-${esc(r.rarity)}">${esc(r.name)}</span></td>
          <td class="ops-mono-cell">${esc(r.group)}</td>
          <td class="ops-mono-cell">Lv.${esc(r.levelReq)}</td>
          <td class="ops-mono-cell">${esc(summary)}</td>
        `;
        tr.addEventListener('click', () => {
          hubState.selectedGlyphUid = r.uid;
          syncGlyphJsonText(r);
          tbody.querySelectorAll('.ops-item-row').forEach((row) => {
            row.classList.toggle('selected', row.dataset.uid === r.uid);
          });
          const slot = centerBodyEl.querySelector('#ops-gc-inspector-slot');
          if (slot) {
            slot.innerHTML = renderGlyphInspectorPane(r);
            bindGlyphInspectorEvents(r);
          }
        });
        frag.appendChild(tr);
      }
      tbody.replaceChildren(frag);
    }

    const searchInput = centerBodyEl.querySelector('#ops-gc-search');
    searchInput?.addEventListener('input', (e) => {
      hubState.glyphSearch = e.target.value;
      const caret = e.target.selectionStart;
      renderGlyphsClassesBody();
      const refreshed = centerBodyEl.querySelector('#ops-gc-search');
      if (refreshed) {
        refreshed.focus();
        if (typeof caret === 'number') refreshed.setSelectionRange(caret, caret);
      }
    });

    centerBodyEl.querySelector('#ops-gc-filter')?.addEventListener('change', (e) => {
      hubState.glyphFilter = e.target.value;
      renderGlyphsClassesBody();
    });

    bindGlyphInspectorEvents(selectedRec);
  }

  // --- PILLAR 5: Publish & OTA ---
  async function refreshPublishStatus() {
    hubState.publishStatusLoading = true;
    hubState.publishStatusError = null;
    if (hubState.activePillar === 'publish-ota') renderCenterBody();
    try {
      const res = await fetch('/api/publish/status', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      hubState.publishStatus = json;
    } catch (err) {
      hubState.publishStatusError = err.message;
    } finally {
      hubState.publishStatusLoading = false;
      renderPillarList();
      if (hubState.activePillar === 'publish-ota') renderCenterBody();
    }
  }

  async function runPreflight() {
    hubState.preflightRunning = true;
    hubState.preflightError = null;
    hubState.preflightResult = null;
    renderCenterBody();
    try {
      const res = await fetch('/api/publish/preflight', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      hubState.preflightResult = json;
      notify(json.ok ? 'Preflight passed (sync + typecheck + test)' : 'Preflight failed — check step output', !json.ok);
    } catch (err) {
      hubState.preflightError = err.message;
      notify(`Preflight error: ${err.message}`, true);
    } finally {
      hubState.preflightRunning = false;
      renderCenterBody();
    }
  }

  function appendDeployLog(lineObj) {
    hubState.deployLogs.push(lineObj);
    const term = centerBodyEl.querySelector('#ops-deploy-terminal');
    if (term) {
      const div = document.createElement('div');
      div.className = `ops-term-line ${lineObj.tone || 'info'}`;
      div.textContent = lineObj.text;
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
    }
  }

  async function runDeploy() {
    if (hubState.deployRunning) return;
    hubState.deployRunning = true;
    hubState.deployResult = null;
    hubState.deployLogs = [
      {
        tone: 'step',
        text: `▶ Starting deploy to "${hubState.deployTarget}" (pushGit=${hubState.deployPushGit}, runOta=${hubState.deployRunOta})…`,
      },
    ];
    renderCenterBody();

    try {
      const res = await fetch('/api/publish/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: hubState.deployTarget,
          commitMessage: hubState.deployCommitMessage,
          pushGit: hubState.deployPushGit,
          runOta: hubState.deployRunOta,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('ReadableStream not supported by browser response');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleEvent = (ev) => {
        if (ev.type === 'step') {
          const tone = ev.status === 'failed' ? 'error' : ev.status === 'completed' ? 'ok' : 'step';
          const extra = ev.command ? ` (${ev.command})` : ev.branch ? ` [${ev.branch}]` : '';
          const dur = typeof ev.durationMs === 'number' ? ` • ${ev.durationMs}ms` : '';
          appendDeployLog({
            tone,
            text: `[STEP:${ev.step}] ${ev.status.toUpperCase()}${extra}${dur}`,
          });
        } else if (ev.type === 'log') {
          const lines = String(ev.text ?? '').split(/\r?\n/);
          for (const l of lines) {
            if (!l) continue;
            appendDeployLog({
              tone: ev.stream === 'stderr' ? 'warn' : 'info',
              text: `  [${ev.step}] ${l}`,
            });
          }
        } else if (ev.type === 'error') {
          hubState.deployResult = { ok: false, message: ev.message };
          appendDeployLog({
            tone: 'error',
            text: `✖ ERROR [${ev.step}]: ${ev.message} (exit ${ev.exitCode ?? 1})`,
          });
        } else if (ev.type === 'done') {
          hubState.deployResult = ev;
          appendDeployLog({
            tone: 'ok',
            text: `✔ Deploy complete: target=${ev.target} branch=${ev.branch} committed=${ev.committed} pushed=${ev.pushed} ota=${ev.otaPublished}`,
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx;
        while ((nlIdx = buffer.indexOf('\n')) !== -1) {
          const rawLine = buffer.slice(0, nlIdx).trim();
          buffer = buffer.slice(nlIdx + 1);
          if (!rawLine) continue;
          try {
            handleEvent(JSON.parse(rawLine));
          } catch {
            appendDeployLog({ tone: 'info', text: rawLine });
          }
        }
      }
      if (buffer.trim()) {
        try {
          handleEvent(JSON.parse(buffer.trim()));
        } catch {
          appendDeployLog({ tone: 'info', text: buffer.trim() });
        }
      }

      if (hubState.deployResult?.ok) {
        notify(`Deploy to ${hubState.deployTarget} completed!`);
      } else {
        notify(`Deploy failed: ${hubState.deployResult?.message || 'Check terminal log'}`, true);
      }
    } catch (err) {
      hubState.deployResult = { ok: false, message: err.message };
      appendDeployLog({ tone: 'error', text: `✖ Deploy request failed: ${err.message}` });
      notify(`Deploy failed: ${err.message}`, true);
    } finally {
      hubState.deployRunning = false;
      void refreshPublishStatus();
      renderCenterBody();
    }
  }

  function renderPublishOtaBody() {
    const st = hubState.publishStatus;
    const pre = hubState.preflightResult;

    centerBodyEl.innerHTML = `
      <div class="ops-publish-layout">
        <div class="ops-publish-top-grid">
          <!-- Git & Staging Status -->
          <div class="ops-panel-card">
            <div class="ops-panel-head">
              <strong>Git &amp; Staging Status</strong>
              <button id="ops-pub-refresh-btn" type="button" class="mini-link-btn" ${
                hubState.publishStatusLoading ? 'disabled' : ''
              }>${hubState.publishStatusLoading ? 'Refreshing…' : '↻ Refresh'}</button>
            </div>
            ${
              hubState.publishStatusError
                ? `<div class="ops-link-error">${esc(hubState.publishStatusError)}</div>`
                : !st
                  ? '<div class="ops-mono-muted">Loading git repository status…</div>'
                  : `
                  <div class="ops-kv-strip">
                    <div class="ops-stat-kv"><span>Branch</span><strong class="ops-text-cyan">${esc(st.currentBranch)}</strong></div>
                    <div class="ops-stat-kv"><span>staging local</span><strong>${st.stagingBranchExists ? 'Exists' : 'Will branch'}</strong></div>
                    <div class="ops-stat-kv"><span>origin/staging</span><strong>${st.stagingRemoteExists ? 'Tracked' : 'Not pushed'}</strong></div>
                    <div class="ops-stat-kv"><span>Tree</span><strong class="${st.clean ? 'ops-text-emerald' : 'ops-text-amber'}">${
                      st.clean ? 'Clean' : `${st.changedFileCount} changed`
                    }</strong></div>
                  </div>
                  ${
                    st.latestCommit
                      ? `<div class="ops-mono-muted">HEAD ${esc(st.latestCommit.shortHash)} · ${esc(st.latestCommit.subject)} (${esc(st.latestCommit.author)})</div>`
                      : ''
                  }
                  <pre class="ops-git-status-pre">${esc(
                    [st.statusShort || '(working tree clean)', st.diffStat ? `\n${st.diffStat}` : ''].join('')
                  )}</pre>
                `
            }
          </div>

          <!-- Preflight + Deploy Form -->
          <div class="ops-panel-card">
            <div class="ops-panel-head">
              <strong>Preflight &amp; Deploy Controls</strong>
              <button id="ops-preflight-btn" type="button" class="btn btn-sm" ${
                hubState.preflightRunning || hubState.deployRunning ? 'disabled' : ''
              }>
                ${hubState.preflightRunning ? 'Running Preflight…' : 'Run Preflight (typecheck + test)'}
              </button>
            </div>

            ${
              hubState.preflightError
                ? `<div class="ops-link-error">Preflight error: ${esc(hubState.preflightError)}</div>`
                : pre
                  ? `<div class="ops-preflight-steps">
                      ${pre.steps
                        .map(
                          (step) => `
                        <div class="ops-preflight-step">
                          <span class="badge ${step.ok ? 'badge-emerald' : 'badge-rose'}">${step.ok ? 'PASS' : 'FAIL'}</span>
                          <strong>${esc(step.name)}</strong>
                          <span class="ops-mono-muted">${esc(step.durationMs)}ms</span>
                        </div>`
                        )
                        .join('')}
                    </div>`
                  : ''
            }

            <div class="ops-deploy-form">
              <div class="ops-toolbar-row">
                <span class="ops-strip-label">Target</span>
                <div class="seg-group" id="ops-deploy-target-group">
                  <button type="button" class="seg-btn${hubState.deployTarget === 'staging' ? ' active' : ''}" data-deploy-target="staging" ${
                    hubState.deployRunning ? 'disabled' : ''
                  }>staging</button>
                  <button type="button" class="seg-btn${hubState.deployTarget === 'production' ? ' active' : ''}" data-deploy-target="production" ${
                    hubState.deployRunning ? 'disabled' : ''
                  }>production</button>
                </div>
              </div>

              <label class="ops-field">
                <span>Commit Message</span>
                <input
                  id="ops-deploy-commit-msg"
                  type="text"
                  class="compact-input"
                  placeholder="chore(ld-studio): publish ${esc(hubState.deployTarget)} update"
                  value="${esc(hubState.deployCommitMessage)}"
                  ${hubState.deployRunning ? 'disabled' : ''}
                />
              </label>

              <div class="ops-deploy-checks">
                <label class="check-row">
                  <input id="ops-deploy-push-git" type="checkbox" ${hubState.deployPushGit ? 'checked' : ''} ${
                    hubState.deployRunning ? 'disabled' : ''
                  } />
                  <span>Push to Git (<code>origin/${hubState.deployTarget === 'staging' ? 'staging' : 'main'}</code>)</span>
                </label>
                <label class="check-row">
                  <input id="ops-deploy-run-ota" type="checkbox" ${hubState.deployRunOta ? 'checked' : ''} ${
                    hubState.deployRunning ? 'disabled' : ''
                  } />
                  <span>Run EAS OTA Update</span>
                </label>
              </div>

              <div class="ops-inspector-foot">
                <span class="ops-mono-muted">Runs typecheck + test before branch checkout</span>
                <button id="ops-deploy-btn" type="button" class="btn btn-sm btn-amber" ${
                  hubState.deployRunning ? 'disabled' : ''
                }>
                  ${hubState.deployRunning ? 'Deploying…' : `Deploy to ${esc(hubState.deployTarget)}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Streaming Terminal Output -->
        <div class="ops-panel-card ops-terminal-card">
          <div class="ops-panel-head">
            <strong>Live Deploy &amp; Preflight Terminal</strong>
            <div class="ops-head-badges">
              ${
                hubState.deployRunning
                  ? '<span class="badge badge-cyan">Streaming NDJSON…</span>'
                  : hubState.deployResult
                    ? `<span class="badge ${hubState.deployResult.ok ? 'badge-emerald' : 'badge-rose'}">${
                        hubState.deployResult.ok ? 'Deploy Succeeded' : 'Deploy Failed'
                      }</span>`
                    : '<span class="badge badge-cyan">Ready</span>'
              }
              <button id="ops-term-clear-btn" type="button" class="mini-link-btn">Clear</button>
            </div>
          </div>
          <div id="ops-deploy-terminal" class="ops-deploy-terminal" role="log" aria-live="polite">
            ${
              hubState.deployLogs.length === 0
                ? '<div class="ops-term-line muted">No deploy logs yet. Run Preflight or click Deploy to stream live NDJSON logs.</div>'
                : hubState.deployLogs
                    .map((l) => `<div class="ops-term-line ${esc(l.tone || 'info')}">${esc(l.text)}</div>`)
                    .join('')
            }
          </div>
        </div>
      </div>
    `;

    centerBodyEl.querySelector('#ops-pub-refresh-btn')?.addEventListener('click', () => {
      void refreshPublishStatus();
    });
    centerBodyEl.querySelector('#ops-preflight-btn')?.addEventListener('click', () => {
      void runPreflight();
    });
    centerBodyEl.querySelectorAll('[data-deploy-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        hubState.deployTarget = btn.dataset.deployTarget;
        renderCenterBody();
      });
    });
    centerBodyEl.querySelector('#ops-deploy-commit-msg')?.addEventListener('input', (e) => {
      hubState.deployCommitMessage = e.target.value;
    });
    centerBodyEl.querySelector('#ops-deploy-push-git')?.addEventListener('change', (e) => {
      hubState.deployPushGit = e.target.checked;
    });
    centerBodyEl.querySelector('#ops-deploy-run-ota')?.addEventListener('change', (e) => {
      hubState.deployRunOta = e.target.checked;
    });
    centerBodyEl.querySelector('#ops-deploy-btn')?.addEventListener('click', () => {
      void runDeploy();
    });
    centerBodyEl.querySelector('#ops-term-clear-btn')?.addEventListener('click', () => {
      hubState.deployLogs = [];
      hubState.deployResult = null;
      renderCenterBody();
    });

    const termEl = centerBodyEl.querySelector('#ops-deploy-terminal');
    if (termEl) termEl.scrollTop = termEl.scrollHeight;
  }

  // --- SERVER BLUEPRINTS (World Events, Moderation, Global Chat) ---
  function renderWorldEventsBlueprint() {
    const flags = [
      { id: '2x-exp', name: '2x EXP Surge', field: 'expMultiplier', desc: 'Doubles combat & bounty experience awards server-wide.' },
      { id: '2x-drop', name: '2x Drop Rate', field: 'dropMultiplier', desc: 'Boosts loot roll weights across field mobs & Delve chests.' },
      { id: 'rift-invasion', name: 'Rift Invasion', field: 'riftInvasionActive', desc: 'Spawns Archon rift elites in starter realms & bounties.' },
      { id: 'maintenance', name: 'Maintenance Lock', field: 'maintenanceMode', desc: 'Gracefully drains logins and displays downtime banner.' },
    ];
    centerBodyEl.innerHTML = `
      <div class="ops-events-grid">
        ${flags
          .map(
            (f) => `
          <div class="ops-panel-card">
            <div class="ops-panel-head">
              <strong>${esc(f.name)}</strong>
              <span class="badge badge-amber">Server Blueprint</span>
            </div>
            <p class="ops-panel-copy">${esc(f.desc)}</p>
            <div class="ops-inspector-foot">
              <code>${esc(f.field)}</code>
              <button type="button" class="btn btn-sm" disabled title="Server Blueprint: Requires PATCH /api/admin/events/:id in @lumendelve/server">
                Locked (PATCH /api/admin/events/:id)
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  function renderModerationBlueprint() {
    centerBodyEl.innerHTML = `
      <div class="ops-blueprint-grid">
        <div class="ops-panel-card">
          <div class="ops-panel-head">
            <strong>Player Lookup &amp; GM Actions</strong>
            <span class="badge badge-amber">Server Blueprint</span>
          </div>
          <p class="ops-panel-copy">
            Target portals: <code>apps/server/src/moderator-portal/</code>, <code>apps/server/src/auth/</code>, <code>apps/server/src/db/</code>.
          </p>
          <div class="ops-toolbar-row">
            <input class="compact-input ops-search-grow" placeholder="Search player handle or Apple ID (requires GET /api/mod/players)" disabled />
            <button type="button" class="btn btn-sm" disabled>Lookup</button>
          </div>
          <div class="ops-mod-actions">
            <button type="button" class="btn btn-sm" disabled>Mute</button>
            <button type="button" class="btn btn-sm" disabled>Kick</button>
            <button type="button" class="btn btn-sm" disabled>Ban</button>
          </div>
        </div>
        <div class="ops-panel-card">
          <div class="ops-panel-head">
            <strong>Audit Log Schema</strong>
            <span class="badge badge-amber">Server Blueprint</span>
          </div>
          <div class="ops-table-wrap ops-table-compact">
            <table class="ops-table">
              <thead>
                <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr>
              </thead>
              <tbody>
                <tr><td colspan="5" class="ops-empty-cell">Audit stream awaits GET /api/mod/audit in @lumendelve/server.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function runWsProbe() {
    const wsUrl = hubState.manifest?.gameServer?.wsUrl || 'ws://127.0.0.1:3000/ws';
    hubState.wsProbeStatus = 'probing';
    hubState.wsProbeDetail = `Connecting to ${wsUrl}…`;
    renderCenterBody();

    let settled = false;
    let ws;
    const finish = (status, detail) => {
      if (settled) return;
      settled = true;
      hubState.wsProbeStatus = status;
      hubState.wsProbeDetail = detail;
      try { ws?.close(); } catch { /* ignore */ }
      if (hubState.activePillar === 'global-chat') {
        renderCenterBody();
      }
    };

    const timer = setTimeout(() => {
      finish('offline', `Timeout connecting to ${wsUrl} (@lumendelve/server offline or unreachable).`);
    }, 1000);

    try {
      ws = new WebSocket(wsUrl);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      });
      ws.addEventListener('message', (ev) => {
        clearTimeout(timer);
        finish('online', `WS connected (${wsUrl}) • Frame: ${String(ev.data).slice(0, 140)}`);
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        finish('offline', `Unable to reach ${wsUrl} (start @lumendelve/server on :3000 to connect).`);
      });
      ws.addEventListener('close', () => {
        clearTimeout(timer);
        finish('offline', `Socket closed before greeting from ${wsUrl}.`);
      });
    } catch (err) {
      clearTimeout(timer);
      finish('offline', `WebSocket error: ${err.message}`);
    }
  }

  function renderGlobalChatBlueprint() {
    const wsUrl = hubState.manifest?.gameServer?.wsUrl || 'ws://127.0.0.1:3000/ws';
    const channels = ['all', 'global', 'trade', 'party', 'system'];
    const probeBadge =
      hubState.wsProbeStatus === 'online'
        ? '<span class="badge badge-emerald">WS Reachable</span>'
        : hubState.wsProbeStatus === 'probing'
          ? '<span class="badge badge-cyan">Probing…</span>'
          : '<span class="badge badge-amber">Server Blueprint</span>';

    centerBodyEl.innerHTML = `
      <div class="ops-blueprint-grid">
        <div class="ops-panel-card">
          <div class="ops-panel-head">
            <strong>WebSocket Stream Probe</strong>
            ${probeBadge}
          </div>
          <p class="ops-panel-copy">
            Target endpoint: <code>${esc(wsUrl)}</code> (<code>apps/server/src/ws/</code>). Tests real server greeting &amp; <code>ping</code>/<code>pong</code> handshake.
          </p>
          <div class="ops-probe-box">
            <span class="ops-mono-cell" id="ops-ws-probe-detail">${esc(hubState.wsProbeDetail)}</span>
            <button id="ops-ws-probe-btn" type="button" class="btn btn-sm">Probe WS /ws</button>
          </div>
          <div class="ops-toolbar-row">
            <span class="ops-strip-label">Channel Filter</span>
            <div class="seg-group">
              ${channels
                .map(
                  (ch) =>
                    `<button type="button" class="seg-btn${hubState.chatChannel === ch ? ' active' : ''}" data-ops-chat-ch="${ch}">${ch.toUpperCase()}</button>`
                )
                .join('')}
            </div>
          </div>
          <div class="ops-empty-state">Channel feed (${esc(hubState.chatChannel.toUpperCase())}) awaits WS message relay.</div>
        </div>
        <div class="ops-panel-card">
          <div class="ops-panel-head">
            <strong>GM Broadcast Blueprint</strong>
            <span class="badge badge-amber">Server Blueprint</span>
          </div>
          <p class="ops-panel-copy">Planned endpoint: <code>POST /api/mod/chat/broadcast</code> with GM role JWT verification.</p>
          <label class="ops-field">
            <span>System Announcement Payload</span>
            <input class="compact-input" placeholder="[GM Notice] Server blueprint broadcast..." disabled />
          </label>
          <div class="ops-inspector-foot">
            <span class="ops-mono-muted">Disabled until mod portal routes mount</span>
            <button type="button" class="btn btn-sm" disabled>Broadcast Notice</button>
          </div>
        </div>
      </div>
    `;

    centerBodyEl.querySelector('#ops-ws-probe-btn')?.addEventListener('click', runWsProbe);
    centerBodyEl.querySelectorAll('[data-ops-chat-ch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        hubState.chatChannel = btn.dataset.opsChatCh;
        renderCenterBody();
      });
    });
  }

  function renderCenterBody() {
    const pillar = LIVEOPS_PILLARS.find((p) => p.id === hubState.activePillar) || LIVEOPS_PILLARS[0];
    renderCenterHeader(pillar);
    if (pillar.id === 'items-stats') renderItemsStatsBody();
    else if (pillar.id === 'monsters-bosses') renderMonstersBody();
    else if (pillar.id === 'loot-economy') renderLootEconomyBody();
    else if (pillar.id === 'glyphs-classes') renderGlyphsClassesBody();
    else if (pillar.id === 'publish-ota') renderPublishOtaBody();
    else if (pillar.id === 'world-events') renderWorldEventsBlueprint();
    else if (pillar.id === 'moderation') renderModerationBlueprint();
    else renderGlobalChatBlueprint();
  }

  // --- Right Rail ---
  function renderRightRail() {
    const m = hubState.manifest;
    const gs = m?.gameServer || {
      httpUrl: 'http://127.0.0.1:3000',
      wsUrl: 'ws://127.0.0.1:3000/ws',
      reachable: false,
      status: hubState.manifestLoading ? 'checking' : 'offline',
    };
    const appPort = m?.app?.port || 4321;
    const appVersion = m?.app?.version || '0.1.0';
    const totals = hubState.registries?.sync?.totals;
    const serverBadge = gs.reachable
      ? `<span class="badge badge-emerald">Online (${esc(gs.status)})</span>`
      : `<span class="badge badge-rose">Offline</span>`;

    serverLinkBodyEl.innerHTML = `
      <div class="ops-link-card">
        <div class="ops-link-row">
          <span>LD Studio :${esc(appPort)}</span>
          <span class="badge badge-emerald">Online</span>
        </div>
        <div class="ops-link-meta">@lumendelve/ld-studio · v${esc(appVersion)}</div>
      </div>

      <div class="ops-link-card">
        <div class="ops-link-row">
          <span>3D &amp; Godot Sync</span>
          <span class="badge badge-cyan">${totals ? `${totals.godotHeroGlbs ?? totals.workshopGlbModels} Hero GLBs` : 'Ready'}</span>
        </div>
        <div class="ops-link-meta">${
          totals
            ? `${totals.engineItems ?? 2055} Items · ${totals.godotItemIcons ?? 16} Icons · ${totals.godotLootAudio ?? 8} Loot WAVs`
            : '4 Class GLBs · 5 Flyff Styles · 10 Faces'
        }</div>
      </div>

      <div class="ops-link-card" id="ops-gameserver-card">
        <div class="ops-link-row">
          <span>@lumendelve/server :3000</span>
          ${serverBadge}
        </div>
        <div class="ops-link-meta">HTTP: <code>${esc(gs.httpUrl)}</code></div>
        <div class="ops-link-meta">WS: <code>${esc(gs.wsUrl)}</code></div>
        ${hubState.manifestError ? `<div class="ops-link-error">${esc(hubState.manifestError)}</div>` : ''}
      </div>

      <div class="ops-paths-card">
        <div class="ops-paths-title">Live Data &amp; Publish APIs</div>
        <ul class="ops-paths-list">
          <li><code>GET /api/studio/registries</code></li>
          <li><code>GET/PUT /api/data/:domain</code></li>
          <li><code>GET /api/publish/status</code></li>
          <li><code>POST /api/publish/preflight</code></li>
          <li><code>POST /api/publish/deploy</code></li>
        </ul>
      </div>
    `;
  }

  async function refreshManifest() {
    hubState.manifestLoading = true;
    hubState.manifestError = null;
    renderRightRail();
    try {
      const res = await fetch(manifestUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      hubState.manifest = await res.json();
    } catch (err) {
      hubState.manifestError = err.message;
    } finally {
      hubState.manifestLoading = false;
      renderRightRail();
      if (hubState.activePillar === 'global-chat') {
        renderCenterBody();
      }
    }
  }

  function loadActivePillarData() {
    if (hubState.activePillar === 'items-stats') {
      void ensureDomainsLoaded(ITEM_DOMAINS);
    } else if (hubState.activePillar === 'monsters-bosses') {
      void ensureDomainsLoaded(['ironspire-enemies', 'zones']);
    } else if (hubState.activePillar === 'loot-economy') {
      void ensureDomainsLoaded(['loot-tables', 'trash-loot']);
    } else if (hubState.activePillar === 'glyphs-classes') {
      void ensureDomainsLoaded(['glyphs', 'starter-classes']);
    } else if (hubState.activePillar === 'publish-ota') {
      void refreshPublishStatus();
    }
  }

  function setPillar(pillarId) {
    if (!LIVEOPS_PILLARS.some((p) => p.id === pillarId)) return;
    hubState.activePillar = pillarId;
    renderPillarList();
    renderCenterBody();
    loadActivePillarData();
  }

  function refreshCatalog() {
    renderPillarList();
    if (hubState.activePillar === 'items-stats') {
      renderCenterBody();
    }
  }

  refreshManifestBtn?.addEventListener('click', () => {
    void refreshManifest();
    void refreshRegistries();
  });

  renderRegistryStrip();
  renderPillarList();
  renderCenterBody();
  renderRightRail();
  void refreshManifest();
  void refreshRegistries();
  loadActivePillarData();

  return {
    refreshCatalog,
    refreshManifest,
    refreshRegistries,
    setPillar,
    getState: () => ({ ...hubState }),
  };
}
