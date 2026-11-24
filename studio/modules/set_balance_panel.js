/**
 * @file set_balance_panel.js
 * Character Sheet "Set Balance" panel: level, one-click full-set equip, live 2/4/6 bonuses,
 * engine-derived stats, and the per-set 3D look picker (placeholder vs. designs).
 */

import {
  computeBalance,
  computeTierBenchmarks,
  getVisualConfig,
  saveVisualConfig,
  setsForHero,
  visualForSet,
} from './set_balance.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (v) => `${(v * 100).toFixed(v * 100 % 1 ? 1 : 0)}%`;

const STAT_ROWS = [
  ['HP', 'maxHp'], ['Physical Attack', 'physAtk'], ['Physical Defense', 'physDef'],
  ['Magic Attack', 'elemAtk'], ['Magic Defense', 'elemDef'], ['Speed', 'speed'],
  ['Crit', 'critChance', pct], ['Crit Dmg', 'critMultiplier', (v) => `×${v.toFixed(2)}`],
  ['Dodge', 'dodgeChance', pct], ['Accuracy', 'accuracy', pct],
  ['Heal Power', 'healPower', pct], ['Bonus Casts', 'spellCastsBonus'],
];

/**
 * @param {{ root: HTMLElement, statsGrid: HTMLElement, getState: () => object,
 *   onEquipSet: (set: object) => void, onStripArmor: () => void, onLevel: (lv: number) => void,
 *   onVisualsChanged: () => void, toast: (msg: string, err?: boolean) => void }} opts
 */
export function createSetBalancePanel(opts) {
  const { root, statsGrid, getState } = opts;

  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'bal-level') opts.onLevel(Math.max(1, Math.min(100, Number(t.value) || 1)));
    if (t.dataset.visualFor) await saveVisual((cfg) => {
      const bySetId = { ...cfg.bySetId };
      if (t.value === cfg.defaultVisualId) delete bySetId[t.dataset.visualFor];
      else bySetId[t.dataset.visualFor] = t.value;
      return { ...cfg, bySetId };
    });
    if (t.id === 'bal-designs') await saveVisual((cfg) => ({ ...cfg, designsEnabled: t.checked }));
  });
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-bal]');
    if (!btn) return;
    if (btn.dataset.bal === 'equip') {
      const set = setsForHero(getState().catalog, getState().baseClass, getState().gender)
        .find((s) => s.setId === root.querySelector('#bal-set').value);
      if (set) opts.onEquipSet(set);
    }
    if (btn.dataset.bal === 'strip') opts.onStripArmor();
  });

  async function saveVisual(mutate) {
    const cfg = getVisualConfig();
    if (!cfg) return;
    try {
      await saveVisualConfig(mutate(cfg));
      opts.toast('Saved armor look (Studio + game data synced)');
      opts.onVisualsChanged();
    } catch (err) {
      opts.toast(`Couldn't save armor look: ${err.message}`, true);
      render();
    }
  }

  function render() {
    const st = getState();
    if (!st.catalog) return;
    const sets = setsForHero(st.catalog, st.baseClass, st.gender);
    const picked = root.querySelector('#bal-set')?.value;
    const b = computeBalance({ catalog: st.catalog, classId: st.baseClass, level: st.balanceLevel, equippedBySlot: st.equippedBySlot });
    const cfg = getVisualConfig();

    statsGrid.innerHTML = STAT_ROWS.map(([label, key, fmt]) => {
      const v = b.derived[key] ?? 0;
      const d = v - (b.naked[key] ?? 0);
      const show = fmt ? fmt(v) : Math.round(v);
      const plus = Math.abs(d) > 1e-6 ? `<em class="bal-plus">+${fmt ? fmt(d) : Math.round(d)}</em>` : '';
      return `<div class="sheet-stat-cell"><span>${label}</span><strong>${show} ${plus}</strong></div>`;
    }).join('');

    const options = sets.map((s) => `<option value="${s.setId}" ${s.setId === picked ? 'selected' : ''}>Lv${s.levelRange[0]} ${esc(s.name)}${s.specLock?.length ? ` · ${esc(s.specLock[0])}` : ''}${s.variant === 'guard' ? ' (def)' : ''}</option>`).join('');
    const core = b.coreStats;
    const setsHtml = b.setStates.length ? b.setStates.map((s) => {
      const def = s.def || {};
      const steps = [[2, def.twoPieceBonus], [4, def.fourPieceBonus], [6, def.sixPieceBonus]].filter(([, x]) => x);
      const vis = visualForSet(s.setId);
      const visOpts = (cfg?.visuals || []).map((v) => `<option value="${v.visualId}" ${v.visualId === (cfg.bySetId[s.setId] || cfg.defaultVisualId) ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
      return `<div class="bal-set">
        <div class="bal-set-head"><strong>${esc(s.name)}</strong><span class="bal-count">${s.equippedCount}/6</span></div>
        ${steps.map(([n, x]) => `<div class="bal-step ${s.equippedCount >= n ? 'on' : ''}"><span>${n}pc</span>${esc(x.description)}</div>`).join('')}
        <label class="bal-look">3D look <select data-visual-for="${s.setId}" ${cfg?.designsEnabled ? '' : 'disabled'}>${visOpts}</select>
          <span class="bal-tier">${esc(vis?.tierKey || '')}</span></label>
      </div>`;
    }).join('') : '<div class="bal-empty">No set pieces equipped. Pick a set above and equip all 6.</div>';
    const dataOnly = b.dataOnly.length
      ? `<div class="bal-dataonly"><span>Not in combat yet:</span> ${b.dataOnly.map((x) => `<em>${esc(x.label)} +${pct(x.value)}</em>`).join(' ')}</div>` : '';
    const bench = computeTierBenchmarks({ catalog: st.catalog, classId: st.baseClass, gender: st.gender, level: st.balanceLevel, equippedBySlot: st.equippedBySlot });
    const armorSlots = ['helmet', 'shoulders', 'chest', 'gloves', 'legs', 'boots'].map((sl) => st.equippedBySlot[sl]).filter(Boolean);
    const nonSetSummary = armorSlots.length && !b.setStates.length
      ? `<div class="bal-nonset-chip">Active Non-Set Armor: <strong>${armorSlots.length}/6 ${esc(armorSlots[0].rarity || 'common')}</strong> (${esc(armorSlots[0].lineName || armorSlots[0].name)})</div>`
      : '';
    const fmtDelta = (v) => (v > 0 ? `<em class="bal-plus">+${v}</em>` : v < 0 ? `<em class="bal-minus">${v}</em>` : '<em class="bal-even">0</em>');
    const benchRows = [bench.common, bench.uncommon, bench.classSet].filter(Boolean);
    const benchHtml = benchRows.length
      ? `<div class="bal-bench">
          <div class="bal-bench-title">Compare Lv.${st.balanceLevel} Tiers (Cur: HP ${bench.current.maxHp} · ATK ${bench.current.atk} · DEF ${bench.current.def})</div>
          ${benchRows.map((r) => `<div class="bal-bench-row"><span>${esc(r.kind)} (Lv.${r.levelReq} ${esc(r.label)})</span><span>HP ${r.maxHp} (${fmtDelta(r.dHp)}) · ATK ${r.atk} (${fmtDelta(r.dAtk)}) · DEF ${r.def} (${fmtDelta(r.dDef)})</span></div>`).join('')}
        </div>`
      : '';

    root.innerHTML = `
      <div class="bal-controls">
        <label>Lv <input id="bal-level" type="number" min="1" max="100" value="${st.balanceLevel}"></label>
        <select id="bal-set" aria-label="Armor set">${options}</select>
        <button type="button" class="btn btn-sm btn-amber" data-bal="equip">Equip 6</button>
        <button type="button" class="btn btn-sm" data-bal="strip">Remove armor</button>
      </div>
      <div class="bal-meta">${esc(b.path?.label || 'No weapon path')} · ${esc(b.weapon?.name || 'unarmed')} · STR ${core.str} INT ${core.int} DEX ${core.dex} STA ${core.sta} (auto-allocated)</div>
      <label class="bal-designs"><input id="bal-designs" type="checkbox" ${cfg?.designsEnabled ? 'checked' : ''}> Use armor designs (off = every set shows the Lv1 placeholder)</label>
      ${nonSetSummary}${setsHtml}${dataOnly}${benchHtml}`;
  }

  return { render };
}
