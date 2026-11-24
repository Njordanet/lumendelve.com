/**
 * @file flyff_loot_workbench.js
 * Interactive Flyff Hardcore Drop Rate Simulator & 5-City Town Common Armorer Inspector
 * for LiveOps -> Loot & Economy, powered directly by ../vendor/ld-engine.js.
 */

import {
  CITY_ARMORER_LEVEL_RANGES,
  GEAR_AFFIX_BY_ID,
  GEAR_BASE_BY_ID,
  buildTownArmorerOffers,
  simulateFlyffBatch,
  simulateFlyffDropRoll,
} from '../vendor/ld-engine.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const SOURCES = ['combat', 'elite', 'realm_boss', 'chest', 'sealed_vault', 'map_completion', 'grade_bonus'];
const RANKS = ['small', 'normal', 'large', 'elite', 'boss'];
const CITIES = [
  { id: 'steel_watch', label: 'Steel Watch (1-20)' },
  { id: 'vesperwood', label: 'Vesperwood (21-40)' },
  { id: 'runewick', label: 'Runewick (41-64)' },
  { id: 'sunhaven', label: 'Sunhaven (65-84)' },
  { id: 'solstice', label: 'Solstice (85-100)' },
];
const RARITY_KEYS = ['common', 'uncommon', 'rare', 'epic', 'mythic'];
const RARITY_LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Unique', mythic: 'Ultimate' };

export function createFlyffLootWorkbench({ getLiveTablesData, getLiveTablesError, audio }) {
  const wbState = {
    source: 'combat',
    mobLevel: 15,
    monsterRank: 'normal',
    riftTier: 1,
    areaNumber: 1,
    useUnsaved: true,
    playChime: true,
    seedCounter: 101,
    feed: [],
    batchResult: null,
    cityId: 'steel_watch',
    armorerClass: 'all',
    armorerGender: 'all',
  };

  function getTablesOverrideIfActive() {
    if (!wbState.useUnsaved) return null;
    if (getLiveTablesError?.()) return null;
    return getLiveTablesData?.() || null;
  }

  function formatAffix(af) {
    const def = GEAR_AFFIX_BY_ID?.[af.affixId];
    return `${def?.label || af.affixId} +${af.value}${def?.isPercentage ? '%' : ''}`;
  }

  function highestRarityFromRoll(res) {
    const order = { common: 0, uncommon: 1, rare: 2, epic: 3, mythic: 4 };
    let best = 'common';
    for (const g of res.enrichedGear || []) {
      if ((order[g.rarity] ?? 0) > (order[best] ?? 0)) best = g.rarity;
    }
    return best;
  }

  function runSingleKill() {
    wbState.seedCounter += 1;
    const res = simulateFlyffDropRoll({
      source: wbState.source,
      mobLevel: wbState.mobLevel,
      heroLevel: wbState.mobLevel,
      monsterRank: wbState.monsterRank,
      riftTier: wbState.riftTier,
      areaNumber: wbState.areaNumber,
      seed: wbState.seedCounter * 7919,
      tablesOverride: getTablesOverrideIfActive(),
    });
    const bestR = highestRarityFromRoll(res);
    if (wbState.playChime && audio) {
      void audio.playDrop(bestR, res.enrichedGear?.length ? 'gear' : 'gold');
    }
    wbState.feed.unshift({
      killNo: wbState.seedCounter - 101,
      source: wbState.source,
      mobLevel: wbState.mobLevel,
      rank: wbState.monsterRank,
      ...res,
    });
    if (wbState.feed.length > 10) wbState.feed.length = 10;
  }

  function runBatch(count) {
    wbState.seedCounter += count;
    wbState.batchResult = simulateFlyffBatch({
      source: wbState.source,
      mobLevel: wbState.mobLevel,
      heroLevel: wbState.mobLevel,
      monsterRank: wbState.monsterRank,
      riftTier: wbState.riftTier,
      areaNumber: wbState.areaNumber,
      count,
      seed: wbState.seedCounter * 31,
      tablesOverride: getTablesOverrideIfActive(),
    });
  }

  function renderHtml() {
    const liveError = getLiveTablesError?.();
    const overrideUsed = wbState.useUnsaved && !liveError && Boolean(getLiveTablesData?.());
    const batch = wbState.batchResult;
    const [minCityLv, maxCityLv] = CITY_ARMORER_LEVEL_RANGES[wbState.cityId] || [1, 20];

    const offers = buildTownArmorerOffers({
      cityId: wbState.cityId,
      heroClass: wbState.armorerClass === 'all' ? undefined : wbState.armorerClass,
      heroGender: wbState.armorerGender === 'all' ? undefined : wbState.armorerGender,
      showAll: wbState.armorerGender === 'all',
    });

    const offerRows = offers.map((o) => {
      const base = GEAR_BASE_BY_ID?.[o.definitionId];
      return { o, base };
    });
    const allCommon = offerRows.every(({ o }) => o.rarity === 'common');
    const zeroSet = offerRows.every(({ base }) => !base?.setId);
    const inBracket = offerRows.every(({ base }) => !base || (base.levelReq >= minCityLv && base.levelReq <= maxCityLv));

    return `
      <div class="flyff-workbench">
        <!-- Flyff Drop Rate Simulator -->
        <section class="wb-panel">
          <div class="wb-head">
            <div>
              <strong>Flyff Drop Rate Workbench</strong>
              <span class="ops-mono-muted"> · Real <code>ld-engine</code> pool, rank &amp; rarity shift</span>
            </div>
            <span class="badge ${overrideUsed ? 'badge-amber' : 'badge-cyan'}">
              ${liveError ? 'JSON Error (Using Saved)' : overrideUsed ? 'Live Unsaved Table Active' : 'Using Saved Table'}
            </span>
          </div>

          <div class="wb-controls-grid">
            <label class="ops-field">
              <span>Source</span>
              <select id="wb-source" class="compact-input">
                ${SOURCES.map((s) => `<option value="${s}"${wbState.source === s ? ' selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
            <label class="ops-field">
              <span>Mob Level (1-100)</span>
              <input id="wb-mob-lv" type="number" min="1" max="100" class="compact-input" value="${wbState.mobLevel}" />
            </label>
            <label class="ops-field">
              <span>Monster Rank</span>
              <select id="wb-rank" class="compact-input">
                ${RANKS.map((r) => `<option value="${r}"${wbState.monsterRank === r ? ' selected' : ''}>${r}</option>`).join('')}
              </select>
            </label>
            <label class="ops-field">
              <span>Rift Tier</span>
              <input id="wb-rift-tier" type="number" min="1" max="10" class="compact-input" value="${wbState.riftTier}" />
            </label>
          </div>

          <div class="wb-actions-row">
            <button type="button" id="wb-roll-one-btn" class="btn btn-sm btn-amber">Roll 1 Kill</button>
            <button type="button" class="btn btn-sm" data-wb-batch="100">Sim 100</button>
            <button type="button" class="btn btn-sm" data-wb-batch="1000">Sim 1,000</button>
            <button type="button" class="btn btn-sm" data-wb-batch="10000">Sim 10,000</button>
            <label class="wb-check"><input id="wb-use-unsaved" type="checkbox"${wbState.useUnsaved ? ' checked' : ''}> Test unsaved edits</label>
            <label class="wb-check"><input id="wb-play-chime" type="checkbox"${wbState.playChime ? ' checked' : ''}> Chime</label>
          </div>

          ${
            wbState.feed.length
              ? `<div class="wb-feed-list">
                  ${wbState.feed
                    .slice(0, 4)
                    .map((f) => {
                      const itemsHtml = f.enrichedGear?.length
                        ? f.enrichedGear
                            .map((g) => {
                              const af = (g.affixes || []).map(formatAffix).join(', ');
                              return `<div class="wb-drop-card rarity-${esc(g.rarity)}">
                                <span class="rarity-text-${esc(g.rarity)}"><strong>[${esc(RARITY_LABELS[g.rarity] || g.rarity)}]</strong> ${esc(g.name)}</span>
                                <span class="ops-mono-muted">Lv.${g.levelReq} · ${esc(g.classLock?.join('/') || 'any')} · ${esc(g.genderLock || 'unisex')}${g.setId ? ` · Set:${esc(g.setId)}` : ''}</span>
                                ${af ? `<span class="wb-affix-line">Affixes: ${esc(af)}</span>` : '<span class="ops-mono-muted">0 affixes</span>'}
                              </div>`;
                            })
                            .join('')
                        : `<div class="wb-drop-none">No gear dropped · +${f.gold ?? 0}g · ${f.dust ?? 0} dust</div>`;
                      return `<div class="wb-kill-row"><span class="wb-kill-tag">${esc(f.source)} Lv.${f.mobLevel} (${esc(f.rank)})</span>${itemsHtml}</div>`;
                    })
                    .join('')}
                </div>`
              : '<div class="wb-empty-note">Click <strong>Roll 1 Kill</strong> or run a Monte Carlo batch to test real Flyff drop odds.</div>'
          }

          ${
            batch
              ? `<div class="wb-batch-box">
                  <div class="wb-batch-top">
                    <strong>Batch Report: ${batch.kills.toLocaleString()} Kills</strong>
                    <span>Total Gear: <strong>${batch.totalGear}</strong> (${((batch.totalGear / batch.kills) * 100).toFixed(2)}% per kill)</span>
                    <span>Lv Spread: <strong>${batch.levelSpread.min ?? '—'}–${batch.levelSpread.max ?? '—'}</strong> (avg ${batch.levelSpread.avg ?? '—'})</span>
                  </div>
                  <div class="wb-rarity-grid">
                    ${RARITY_KEYS.map((r) => {
                      const c = batch.byRarity[r] || 0;
                      const pct = Number(batch.ratesPct?.[r] || 0);
                      const avgK = batch.avgKillsPerRarity?.[r];
                      return `<div class="wb-rar-cell rarity-${r}">
                        <span class="rarity-text-${r}">${RARITY_LABELS[r]}</span>
                        <strong>${c} (${pct.toFixed(2)}%)</strong>
                        <small>${avgK ? `1 in ${avgK.toFixed(1)} kills` : '—'}</small>
                      </div>`;
                    }).join('')}
                  </div>
                  <div class="wb-split-row">
                    <span>Class Pool: Sq ${batch.byClass.squire} · Sc ${batch.byClass.scout} · Ar ${batch.byClass.arcanist} · Ac ${batch.byClass.acolyte}</span>
                    <span>Gender Pool: ♂ ${batch.byGender.male} · ♀ ${batch.byGender.female} · Unisex ${batch.byGender.unisex}</span>
                  </div>
                  ${
                    batch.sampleRareDrops?.length
                      ? `<div class="wb-sample-rares">
                          <span class="ops-mono-muted">Recent Rare+:</span>
                          ${batch.sampleRareDrops
                            .slice(-4)
                            .reverse()
                            .map((s) => `<code class="rarity-text-${esc(s.rarity)}">[${esc(RARITY_LABELS[s.rarity] || s.rarity)}] ${esc(s.name)} (Lv.${s.levelReq})</code>`)
                            .join(' ')}
                        </div>`
                      : ''
                  }
                </div>`
              : ''
          }
        </section>

        <!-- 5-City Town Common Armorer Inspector -->
        <section class="wb-panel">
          <div class="wb-head">
            <div>
              <strong>5-City Town Common Armorers</strong>
              <span class="ops-mono-muted"> · Live <code>buildTownArmorerOffers</code> (${offerRows.length} items)</span>
            </div>
            <div class="wb-invariants">
              <span class="badge ${allCommon ? 'badge-emerald' : 'badge-rose'}">${allCommon ? 'Common Only' : 'Rarity Breach'}</span>
              <span class="badge ${zeroSet ? 'badge-emerald' : 'badge-rose'}">${zeroSet ? '0 Set Pieces' : 'Set Leak'}</span>
              <span class="badge ${inBracket ? 'badge-emerald' : 'badge-rose'}">${inBracket ? `Lv ${minCityLv}-${maxCityLv} OK` : 'Bracket Drift'}</span>
            </div>
          </div>

          <div class="wb-city-pills">
            ${CITIES.map((c) => `<button type="button" class="tier-chip${wbState.cityId === c.id ? ' active' : ''}" data-wb-city="${c.id}">${esc(c.label)}</button>`).join('')}
            <select id="wb-armorer-class" class="compact-input wb-mini-sel">
              <option value="all"${wbState.armorerClass === 'all' ? ' selected' : ''}>All Classes</option>
              <option value="squire"${wbState.armorerClass === 'squire' ? ' selected' : ''}>Squire</option>
              <option value="scout"${wbState.armorerClass === 'scout' ? ' selected' : ''}>Scout</option>
              <option value="arcanist"${wbState.armorerClass === 'arcanist' ? ' selected' : ''}>Arcanist</option>
              <option value="acolyte"${wbState.armorerClass === 'acolyte' ? ' selected' : ''}>Acolyte</option>
            </select>
            <select id="wb-armorer-gender" class="compact-input wb-mini-sel">
              <option value="all"${wbState.armorerGender === 'all' ? ' selected' : ''}>M + F</option>
              <option value="male"${wbState.armorerGender === 'male' ? ' selected' : ''}>♂ Male</option>
              <option value="female"${wbState.armorerGender === 'female' ? ' selected' : ''}>♀ Female</option>
            </select>
          </div>

          <div class="wb-armorer-table-wrap">
            <table class="ops-table wb-armorer-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slot</th>
                  <th>Lv</th>
                  <th>Hero</th>
                  <th>Stats</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                ${offerRows
                  .slice(0, 60)
                  .map(({ o, base }) => {
                    const st = base?.baseStats || {};
                    const summary = Object.entries(st)
                      .filter(([, v]) => typeof v === 'number' && v !== 0)
                      .slice(0, 2)
                      .map(([k, v]) => `${k.replace('physDef', 'DEF').replace('elemDef', 'MDEF').replace('physAtk', 'ATK').replace('elemAtk', 'MATK').replace('hp', 'HP')}:${v}`)
                      .join(' ');
                    const clsShort = { squire: 'Sq', scout: 'Sc', arcanist: 'Ar', acolyte: 'Ac' };
                    const clsTxt = (base?.classLock || []).map((c) => clsShort[c] || c).join('/') || 'Any';
                    const genTxt = base?.genderLock === 'male' ? '♂' : base?.genderLock === 'female' ? '♀' : '';
                    return `<tr>
                      <td><span class="rarity-text-common">${esc(base?.name || o.definitionId)}</span></td>
                      <td class="ops-mono-cell">${esc(base?.slot || '—')}</td>
                      <td class="ops-mono-cell">${base?.levelReq ?? '?'}</td>
                      <td class="ops-mono-cell">${esc(clsTxt)}${genTxt}</td>
                      <td class="ops-mono-cell">${esc(summary || '—')}</td>
                      <td class="ops-mono-cell">${o.goldPrice}g</td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  function bindEvents(containerEl, rerender) {
    if (!containerEl) return;
    containerEl.querySelector('#wb-source')?.addEventListener('change', (e) => {
      wbState.source = e.target.value;
      rerender();
    });
    containerEl.querySelector('#wb-mob-lv')?.addEventListener('input', (e) => {
      wbState.mobLevel = Math.max(1, Math.min(100, Number(e.target.value) || 1));
    });
    containerEl.querySelector('#wb-rank')?.addEventListener('change', (e) => {
      wbState.monsterRank = e.target.value;
    });
    containerEl.querySelector('#wb-rift-tier')?.addEventListener('input', (e) => {
      wbState.riftTier = Math.max(1, Math.min(10, Number(e.target.value) || 1));
    });
    containerEl.querySelector('#wb-use-unsaved')?.addEventListener('change', (e) => {
      wbState.useUnsaved = e.target.checked;
      rerender();
    });
    containerEl.querySelector('#wb-play-chime')?.addEventListener('change', (e) => {
      wbState.playChime = e.target.checked;
    });
    containerEl.querySelector('#wb-roll-one-btn')?.addEventListener('click', () => {
      runSingleKill();
      rerender();
    });
    containerEl.querySelectorAll('[data-wb-batch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runBatch(Number(btn.dataset.wbBatch) || 1000);
        rerender();
      });
    });
    containerEl.querySelectorAll('[data-wb-city]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wbState.cityId = btn.dataset.wbCity;
        rerender();
      });
    });
    containerEl.querySelector('#wb-armorer-class')?.addEventListener('change', (e) => {
      wbState.armorerClass = e.target.value;
      rerender();
    });
    containerEl.querySelector('#wb-armorer-gender')?.addEventListener('change', (e) => {
      wbState.armorerGender = e.target.value;
      rerender();
    });
  }

  return { renderHtml, bindEvents, wbState };
}
