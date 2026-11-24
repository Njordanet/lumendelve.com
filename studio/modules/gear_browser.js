/**
 * @file gear_browser.js
 * Grouped 2,055-item Gear Browser renderer for 3D Lab Left Rail.
 * Organizes Lv 1-100 Common, Uncommon, and Class Sets into collapsible 6-piece lines
 * while keeping Weapons, Accessories, and Search instant.
 */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const SLOT_ORDER = {
  helmet: 0,
  shoulders: 1,
  chest: 2,
  gloves: 3,
  legs: 4,
  boots: 5,
  main_hand: 6,
  off_hand: 7,
  neck: 8,
  ring_1: 9,
  ring_2: 10,
  back_piece: 11,
};

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Unique',
  mythic: 'Ultimate',
};

export const LEVEL_BANDS = ['all', '1-20', '21-40', '41-64', '65-84', '85-100'];

export function computeLevelBand(levelReq) {
  const lv = Number(levelReq) || 1;
  if (lv <= 20) return '1-20';
  if (lv <= 40) return '21-40';
  if (lv <= 64) return '41-64';
  if (lv <= 84) return '65-84';
  return '85-100';
}

export function getItemPoolCategory(item) {
  const isWeapon =
    item.category === 'weapon' ||
    item.category === 'focus' ||
    item.slot === 'main_hand' ||
    item.slot === 'off_hand';
  if (isWeapon) return 'weapons';
  if (item.setId) return 'sets';
  if (item.isFlyffNonSet) {
    return String(item.rarity || 'common').toLowerCase() === 'uncommon' ? 'uncommon' : 'common';
  }
  return item.category === 'armor' ? 'sets' : 'weapons';
}

function getGroupMeta(item, setsById) {
  if (item.category !== 'armor') return null;
  if (item.setId) {
    const def = setsById.get(item.setId);
    return {
      key: `set::${item.setId}`,
      lineName: def?.name || item.lineName || item.setId,
      rarity: String(item.rarity || 'rare').toLowerCase(),
      levelReq: def?.levelRange?.[0] ?? item.levelReq ?? 15,
      poolKind: 'sets',
      acquisition: 'Drop / Rift Only',
    };
  }
  if (item.isFlyffNonSet) {
    const r = String(item.rarity || 'common').toLowerCase();
    const lineName = item.lineName || item.name.replace(/\s+\S+$/, '');
    return {
      key: `nonset::${r}::${item.levelReq}::${lineName}`,
      lineName,
      rarity: r,
      levelReq: item.levelReq ?? 1,
      poolKind: r === 'uncommon' ? 'uncommon' : 'common',
      acquisition: r === 'common' ? 'Armorer + Drop' : 'Drop-Only',
    };
  }
  return null;
}

export function renderGroupedCatalogList({
  containerEl,
  items,
  catalog,
  equippedBySlot,
  expandedKeys,
  mapItemToTier,
  onToggleGroup,
  onEquipLine,
  onEquipItem,
}) {
  if (!containerEl) return;
  if (!items.length) {
    containerEl.innerHTML =
      '<div style="padding:14px;color:var(--text-muted);text-align:center;">No items match filter.</div>';
    return;
  }

  const equippedIds = new Set(Object.values(equippedBySlot || {}).filter(Boolean).map((i) => i.id));
  const setsById = new Map((catalog?.gearSets?.classSets || []).map((s) => [s.setId, s]));
  const armorGroups = new Map();
  const standaloneItems = [];

  for (const item of items) {
    const meta = getGroupMeta(item, setsById);
    if (!meta) {
      standaloneItems.push(item);
      continue;
    }
    let grp = armorGroups.get(meta.key);
    if (!grp) {
      grp = { ...meta, pieces: [] };
      armorGroups.set(meta.key, grp);
    }
    grp.pieces.push(item);
  }

  const sortedGroups = [...armorGroups.values()].sort(
    (a, b) => a.levelReq - b.levelReq || a.rarity.localeCompare(b.rarity) || a.lineName.localeCompare(b.lineName)
  );
  for (const g of sortedGroups) {
    g.pieces.sort((a, b) => (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99));
  }
  standaloneItems.sort(
    (a, b) => (a.levelReq || 1) - (b.levelReq || 1) || (a.name || '').localeCompare(b.name || '')
  );

  const frag = document.createDocumentFragment();

  for (const grp of sortedGroups) {
    const expanded = expandedKeys.has(grp.key);
    const tierInfo = mapItemToTier(grp.pieces[0]);
    const equippedCount = grp.pieces.filter((p) => equippedIds.has(p.id)).length;
    const modularCount = grp.pieces.filter((p) => p.artStatus?.mesh3d === 'modular_armor').length;
    const readyCount = grp.pieces.filter((p) => p.artStatus?.meshStatus === 'ready').length;
    const artBadgeText =
      modularCount > 0
        ? readyCount === grp.pieces.length
          ? '3D:Modular'
          : readyCount > 0
            ? `3D:${readyCount}/${grp.pieces.length}`
            : '3D:Pending'
        : '3D:Rig · 2D:Slot';
    const artBadgeCls = readyCount > 0 ? ' ready' : '';
    const lineSwatch = grp.pieces.find((p) => p.nativePalette?.Primary)?.nativePalette?.Primary || null;
    const card = document.createElement('div');
    card.className = `armor-line-card rarity-${grp.rarity}${equippedCount === grp.pieces.length ? ' equipped' : ''}`;

    const header = document.createElement('div');
    header.className = 'armor-line-head';
    header.innerHTML = `
      <button type="button" class="armor-line-toggle" aria-expanded="${expanded}">
        <span class="line-caret">${expanded ? '▾' : '▸'}</span>
        <div class="line-title-col">
          <div class="line-title-top">
            ${lineSwatch ? `<span class="palette-swatch-dot" style="background:${esc(lineSwatch)}" title="Native Primary: ${esc(lineSwatch)}"></span>` : ''}
            <span class="rarity-text-${grp.rarity}">${esc(grp.lineName)}</span>
            <span class="lv-badge ${tierInfo.css}">Lv.${grp.levelReq}</span>
          </div>
          <div class="line-title-meta">
            <span>${esc(RARITY_LABELS[grp.rarity] || grp.rarity)} · ${grp.pieces.length}pc</span>
            <span class="line-src-pill ${grp.poolKind}">${esc(grp.acquisition)}</span>
            <span class="line-art-pill${artBadgeCls}">${artBadgeText}</span>
            ${equippedCount > 0 ? `<strong class="line-eq-count">${equippedCount}/${grp.pieces.length} Eq</strong>` : ''}
          </div>
        </div>
      </button>
      <button type="button" class="mini-equip-line-btn" title="Equip full ${grp.pieces.length}-piece line">Equip ${grp.pieces.length}pc</button>
    `;

    header.querySelector('.armor-line-toggle').addEventListener('click', () => onToggleGroup(grp.key));
    header.querySelector('.mini-equip-line-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onEquipLine(grp.pieces, grp);
    });
    card.appendChild(header);

    if (expanded) {
      const listEl = document.createElement('div');
      listEl.className = 'armor-line-pieces';
      for (const piece of grp.pieces) {
        const pieceRow = buildItemRow(piece, equippedIds.has(piece.id), mapItemToTier, onEquipItem);
        listEl.appendChild(pieceRow);
      }
      card.appendChild(listEl);
    }
    frag.appendChild(card);
  }

  for (const item of standaloneItems) {
    frag.appendChild(buildItemRow(item, equippedIds.has(item.id), mapItemToTier, onEquipItem));
  }

  containerEl.replaceChildren(frag);
}

function buildItemRow(item, isEquipped, mapItemToTier, onEquipItem) {
  const tierInfo = mapItemToTier(item);
  const rarity = String(item.rarity || 'common').toLowerCase();
  const rarityLabel = RARITY_LABELS[rarity] || rarity;
  const wv = item.weaponVisual || null;
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `catalog-item-row rarity-${rarity}${isEquipped ? ' equipped' : ''}`;
  const missingIcon = item.artStatus?.icon2d === 'missing_icon';
  const primaryHex = wv?.nativePalette?.Primary || item.nativePalette?.Primary || null;
  const glowHex = wv?.nativePalette?.Glow || null;
  const swatches = `${primaryHex ? `<span class="palette-swatch-dot" style="background:${esc(primaryHex)}" title="Primary: ${esc(primaryHex)}"></span>` : ''}${glowHex ? `<span class="palette-swatch-dot glow" style="background:${esc(glowHex)};box-shadow:0 0 5px ${esc(glowHex)}" title="Glow: ${esc(glowHex)}"></span>` : ''}`;
  const stageChip = wv?.stageKey ? `<span class="weapon-stage-chip stage-${esc(wv.stageKey)}" title="3D Model Stage ${esc(wv.stageKey.toUpperCase())}">${esc(wv.stageKey.toUpperCase())}</span>` : '';
  const rightBadges = wv
    ? `<span class="weapon-row-badges">${stageChip}<span class="weapon-rarity-badge rarity-${esc(rarity)}">${esc(rarityLabel)}</span></span>`
    : `<span class="lv-badge ${tierInfo.css}" title="Equips 3D ${tierInfo.tierKey} (Req Lv.${item.levelReq})">${tierInfo.badge}</span>`;
  const isModular = item.artStatus?.mesh3d === 'modular_armor';
  const isReady = item.artStatus?.meshStatus === 'ready';
  const meshBadge = isModular ? (isReady ? '3D:Modular' : '3D:Pending') : '';
  const subLabel = wv && item.subtype ? `${item.slot} · ${item.subtype}` : `${item.slot} • ${rarityLabel}`;
  row.innerHTML = `
    <div class="item-row-top">
      <span class="item-name-wrap">${swatches}<span class="item-name rarity-text-${rarity}">${esc(item.name)}</span></span>
      ${rightBadges}
    </div>
    <div class="item-row-meta">
      <span>${esc(subLabel)}</span>
      <span>${meshBadge ? `<span class="line-art-pill${isReady ? ' ready' : ''}">${meshBadge}</span> · ` : ''}Lv.${item.levelReq}${missingIcon ? ' · no-icon' : ''}</span>
    </div>
  `;
  row.addEventListener('click', () => onEquipItem(item));
  return row;
}
