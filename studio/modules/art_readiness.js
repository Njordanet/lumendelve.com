/**
 * @file art_readiness.js
 * Renders the updated Godot/Studio Registry Strip and the Milestone 2/3 Art Readiness matrix
 * inside LiveOps -> Items & Stats.
 */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function renderStudioRegistryStrip({
  el,
  registries,
  loading,
  error,
  showGapsDrawer,
  onToggleDrawer,
  onRefresh,
}) {
  if (!el) return;
  const totals = registries?.sync?.totals;
  const art = registries?.artReadiness;
  const godot = registries?.godotAssets;

  const totalMissingIcons = art?.slotIcons?.missing?.length || 0;
  const metrics = totals
    ? [
        { label: 'Engine Items', value: totals.engineItems, tone: 'cyan' },
        {
          label: 'Flyff Non-Set',
          value: `${registries?.engine?.counts?.nonsetArmorItems ?? 1248} (C/U)`,
          tone: 'cyan',
        },
        { label: 'Class Sets', value: registries?.engine?.counts?.gearSets ?? 96, tone: 'cyan' },
        {
          label: 'Godot Hero GLBs',
          value: `${godot?.heroesGlb?.length ?? 4} rigs · ${godot?.enemiesGlb?.length ?? 5} mobs`,
          tone: 'emerald',
        },
        {
          label: 'Godot Item Icons',
          value: `${godot?.icons?.itemIcons?.length ?? 0} jpg (${totalMissingIcons} slot gaps)`,
          tone: totalMissingIcons ? 'amber' : 'emerald',
        },
        {
          label: 'Loot SFX',
          value: `${godot?.lootAudio?.length ?? 0} wav`,
          tone: (godot?.lootAudio?.length ?? 0) >= 8 ? 'emerald' : 'amber',
        },
      ]
    : [];

  el.innerHTML = `
    <div class="ops-registry-row">
      <div class="ops-registry-title">
        <span class="dot-live"></span>
        <span>Godot &amp; Engine Registry Sync</span>
      </div>
      <div class="ops-registry-metrics">
        ${
          loading && !totals
            ? '<span class="ops-mono-muted">Scanning engine &amp; Godot assets…</span>'
            : error
              ? `<span class="ops-link-error">Registry error: ${esc(error)}</span>`
              : metrics
                  .map(
                    (m) => `
                <div class="ops-metric-chip tone-${m.tone}">
                  <span>${esc(m.label)}</span>
                  <strong>${esc(m.value)}</strong>
                </div>`
                  )
                  .join('')
        }
      </div>
      <div class="ops-registry-actions">
        ${
          art
            ? `<button id="ops-sync-gaps-toggle" type="button" class="ops-gap-pill ${
                totalMissingIcons === 0 ? 'clean' : 'warn'
              }">
                Milestone 2/3 Queue (${totalMissingIcons} icon gaps)
              </button>`
            : ''
        }
        <button id="ops-refresh-registries-btn" type="button" class="mini-link-btn" ${loading ? 'disabled' : ''}>
          ${loading ? 'Syncing…' : '↻ Sync'}
        </button>
      </div>
    </div>
    ${
      showGapsDrawer && art
        ? `<div class="ops-gaps-drawer">
            <div class="ops-gap-row">
              <span class="ops-gap-label">Milestone 2 (3D Modular Armor GLBs)</span>
              <span class="ops-gap-items">
                <code>Common: 0 / ${art.common?.items ?? 672} (4 shared tier rigs)</code>
                <code>Uncommon: 0 / ${art.uncommon?.items ?? 576} (4 shared tier rigs)</code>
                <code>Class Sets: 0 / ${art.classSets?.items ?? 576} (3 shared tier rigs)</code>
              </span>
            </div>
            <div class="ops-gap-row">
              <span class="ops-gap-label">Milestone 3 (2D Slot Icons Missing)</span>
              <span class="ops-gap-items">
                ${(art.slotIcons?.missing || []).map((s) => `<code>missing: item_${esc(s)}.jpg</code>`).join('')}
                <code>present: ${(art.slotIcons?.present || []).join(', ')}</code>
              </span>
            </div>
          </div>`
        : ''
    }
  `;

  el.querySelector('#ops-refresh-registries-btn')?.addEventListener('click', onRefresh);
  el.querySelector('#ops-sync-gaps-toggle')?.addEventListener('click', onToggleDrawer);
}

export function renderArtReadinessCard({ registries, collapsed = false, onToggle }) {
  const art = registries?.artReadiness;
  if (!art) return '';
  const buckets = [
    { key: 'Common Armor (Lv 1-100)', meta: `${art.common?.tiers ?? 14} tiers · ${art.common?.lines ?? 112} lines`, count: art.common?.items ?? 672, mesh: art.common?.dedicated3dMeshes ?? 0, icon: art.common?.dedicated2dIcons ?? 0, rigNote: 'Uses 4-tier hero rig' },
    { key: 'Uncommon Armor (Lv 8-96)', meta: `${art.uncommon?.tiers ?? 12} tiers · ${art.uncommon?.lines ?? 96} lines`, count: art.uncommon?.items ?? 576, mesh: art.uncommon?.dedicated3dMeshes ?? 0, icon: art.uncommon?.dedicated2dIcons ?? 0, rigNote: 'Uses 4-tier hero rig' },
    { key: 'Class Sets (Lv 15-100)', meta: `${art.classSets?.sets ?? 96} sets · 6 slots`, count: art.classSets?.items ?? 576, mesh: art.classSets?.dedicated3dMeshes ?? 0, icon: art.classSets?.dedicated2dIcons ?? 0, rigNote: 'Uses Lv15/30/50 tier rig' },
  ];
  const itemIcons = (art.slotIcons?.availableItemFiles || []).filter((f) =>
    /^item_(helm|chest|gloves|boots|sword|ring|amulet|hammer|glyph)/i.test(f)
  );
  const missingSlots = art.slotIcons?.missing || [];

  return `
    <div class="art-readiness-card">
      <div class="art-readiness-head">
        <div>
          <strong>Milestone 2 &amp; 3 Art Readiness Coverage</strong>
          <span class="ops-mono-muted"> · Live check against <code>apps/godot/assets/</code></span>
        </div>
        <div class="art-head-badges">
          <span class="badge ${missingSlots.length ? 'badge-amber' : 'badge-emerald'}">
            ${missingSlots.length ? `Missing slot icons: ${esc(missingSlots.join(', '))}` : 'All Generic Slot Icons Present'}
          </span>
          <button type="button" id="ops-art-toggle-btn" class="mini-link-btn">${collapsed ? 'Expand' : 'Collapse'}</button>
        </div>
      </div>
      ${
        collapsed
          ? ''
          : `<div class="art-buckets-grid">
              ${buckets
                .map((b) => {
                  const pct3d = b.count ? Math.round((b.mesh / b.count) * 100) : 0;
                  const pct2d = b.count ? Math.round((b.icon / b.count) * 100) : 0;
                  return `
                    <div class="art-bucket-box">
                      <div class="art-bucket-title"><strong>${esc(b.key)}</strong><span>${esc(b.meta)}</span></div>
                      <div class="art-bar-row">
                        <span>3D Modular GLB</span>
                        <div class="art-track"><div class="art-fill c3d" style="width:${pct3d}%"></div></div>
                        <strong>${b.mesh} / ${b.count}</strong>
                      </div>
                      <div class="art-bar-row">
                        <span>2D Unique Icons</span>
                        <div class="art-track"><div class="art-fill c2d" style="width:${pct2d}%"></div></div>
                        <strong>${b.icon} / ${b.count}</strong>
                      </div>
                      <div class="ops-mono-muted">${esc(b.rigNote)}</div>
                    </div>`;
                })
                .join('')}
            </div>
            <div class="art-icons-strip">
              <span class="art-icons-label">Active Generic Slot Icons (${itemIcons.length}):</span>
              ${itemIcons
                .map(
                  (file) => `
                  <span class="art-icon-chip" title="${esc(file)}">
                    <img src="/api/icons/godot/${encodeURIComponent(file)}" alt="${esc(file)}" loading="lazy" />
                    <span>${esc(file.replace(/^item_|\.jpg$/g, ''))}</span>
                  </span>`
                )
                .join('')}
              ${missingSlots
                .map((slot) => `<span class="art-icon-chip missing">Missing: ${esc(slot)}</span>`)
                .join('')}
            </div>`
      }
    </div>
  `;
}

export function bindArtReadinessEvents(rootEl, onToggle) {
  rootEl.querySelector('#ops-art-toggle-btn')?.addEventListener('click', onToggle);
}
