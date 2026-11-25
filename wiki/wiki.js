(function () {
  'use strict';

  var PAGE_SIZE = 60;

  var FEATURED_KINDS = [
    { kind: 'class', accent: 'sky', icon: 'shield', blurb: 'Starter hero classes, roles, branches, and base stat spreads.' },
    { kind: 'glyph', accent: 'amber', icon: 'spark', blurb: 'Combat moves, heals, blocks, elemental scaling, and class locks.' },
    { kind: 'enemy', accent: 'rose', icon: 'skull', blurb: 'Rift foes, elites, realm bosses, movesets, and weakness tables.' },
    { kind: 'zone', accent: 'teal', icon: 'compass', blurb: 'Explorable delve biomes, unlock paths, and encounter rosters.' },
    { kind: 'mechanics', accent: 'violet', icon: 'gear', blurb: 'Deterministic rift loot rates, rarity weights, and chest tiers.' },
    { kind: 'quest', accent: 'emerald', icon: 'scroll', blurb: 'Storyline quests, mayor dialogue cards, and completion rewards.' }
  ];

  var CATEGORY_FILTERS = {
    glyph: [
      { key: 'classLock', label: 'Class Lock', path: 'data.classLock' },
      { key: 'slotType', label: 'Slot Type', path: 'data.slotType' },
      { key: 'element', label: 'Element', path: 'data.element' },
      { key: 'rarity', label: 'Rarity', path: 'data.rarity' }
    ],
    enemy: [
      { key: 'tier', label: 'Tier', path: 'data.tier' },
      { key: 'primaryElement', label: 'Element', path: 'data.primaryElement' },
      { key: 'biome', label: 'Biome', path: 'data.biome' }
    ],
    gear: [
      { key: 'slot', label: 'Slot', path: 'data.slot' },
      { key: 'subtype', label: 'Subtype', path: 'data.subtype' }
    ],
    zone: [
      { key: 'biome', label: 'Biome', path: 'data.biome' },
      { key: 'cityHub', label: 'City Hub', path: 'data.cityHub' }
    ],
    quest: [
      { key: 'act', label: 'Act', path: 'data.act' },
      { key: 'cityId', label: 'City', path: 'data.cityId' }
    ],
    bounty: [
      { key: 'cadence', label: 'Cadence', path: 'data.cadence' }
    ],
    achievement: [
      { key: 'category', label: 'Category', path: 'data.category' }
    ],
    collection: [
      { key: 'category', label: 'Category', path: 'data.category' }
    ],
    merchant_stock: [
      { key: 'cityId', label: 'City', path: 'data.cityId' },
      { key: 'category', label: 'Category', path: 'data.category' }
    ],
    landmark: [
      { key: 'biome', label: 'Biome', path: 'data.biome' },
      { key: 'interactionKind', label: 'Interaction', path: 'data.interactionKind' }
    ]
  };

  var state = {
    manifest: null,
    manifestMap: {},
    searchIndex: null,
    searchIndexPromise: null,
    kindCache: {},
    kindPromises: {},
    renderToken: 0
  };

  var els = {
    view: document.getElementById('wiki-view'),
    sidebar: document.getElementById('wiki-sidebar'),
    sidebarNav: document.getElementById('sidebar-nav'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    sidebarClose: document.getElementById('sidebar-close'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    headerForm: document.getElementById('header-search-form'),
    headerInput: document.getElementById('header-search-input'),
    headerClear: document.getElementById('header-search-clear'),
    homeLink: document.querySelector('.wiki-home-link'),
    footerMeta: document.getElementById('footer-meta-text'),
    main: document.getElementById('wiki-main')
  };

  /* ------------------------------------------------------------------------
     Safety & Formatting Helpers
     ------------------------------------------------------------------------ */
  function esc(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatLabel(raw) {
    if (raw == null || raw === '') return '—';
    return String(raw)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (m) {
        return m.toUpperCase();
      });
  }

  function formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return '0';
    return n.toLocaleString('en-US');
  }

  function formatPct(val) {
    if (typeof val !== 'number' || isNaN(val)) return '—';
    var pct = val * 100;
    return (Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '')) + '%';
  }

  function getByPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i += 1) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function makeHash(path, params) {
    var clean = path.charAt(0) === '/' ? path : '/' + path;
    if (!params) return '#' + clean;
    var qs = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v !== undefined && v !== null && v !== '') {
        qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
      }
    });
    return '#' + clean + (qs.length ? '?' + qs.join('&') : '');
  }

  function entryUrl(kind, id) {
    return '#/' + encodeURIComponent(kind) + '/' + encodeURIComponent(id);
  }

  function parseRoute() {
    var rawHash = window.location.hash || '#/';
    var withoutHash = rawHash.charAt(0) === '#' ? rawHash.slice(1) : rawHash;
    var qIndex = withoutHash.indexOf('?');
    var pathPart = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
    var queryPart = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : '';

    var params = {};
    if (queryPart) {
      var searchParams = new URLSearchParams(queryPart);
      searchParams.forEach(function (value, key) {
        params[key] = value;
      });
    }

    var segments = pathPart
      .split('/')
      .filter(function (s) {
        return s.length > 0;
      })
      .map(function (s) {
        try {
          return decodeURIComponent(s);
        } catch (_e) {
          return s;
        }
      });

    if (segments.length === 0) {
      return { view: 'home', params: params };
    }
    if (segments[0] === 'search') {
      return { view: 'search', params: params };
    }
    if (segments.length === 1) {
      return { view: 'kind', kind: segments[0], params: params };
    }
    return {
      view: 'detail',
      kind: segments[0],
      id: segments.slice(1).join('/'),
      params: params
    };
  }

  function badgeClassForElement(el) {
    var allowed = ['physical', 'fire', 'water', 'ice', 'earth', 'wind', 'light', 'dark'];
    var key = String(el || '').toLowerCase();
    return allowed.indexOf(key) >= 0 ? 'el-' + key : 'badge-muted';
  }

  function badgeClassForRarity(rarity) {
    var allowed = ['common', 'uncommon', 'rare', 'epic', 'mythic'];
    var key = String(rarity || '').toLowerCase();
    return allowed.indexOf(key) >= 0 ? 'rarity-' + key : 'badge-muted';
  }

  function badgeClassForTier(tier) {
    if (tier === 'boss') return 'badge-rose';
    if (tier === 'elite') return 'badge-violet';
    return 'badge-muted';
  }

  function featureIconSvg(name) {
    var paths = {
      shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z"/>',
      spark: '<path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>',
      skull: '<circle cx="12" cy="10" r="6"/><path d="M9 16v3h6v-3M10 10h.01M14 10h.01"/>',
      compass: '<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
      scroll: '<path d="M8 3h10a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4H6a2 2 0 0 1-2-2v-1h10"/><path d="M8 3a2 2 0 0 0-2 2v11"/><path d="M10 8h6M10 12h6"/>'
    };
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (paths[name] || paths.spark) +
      '</svg>';
  }

  /* ------------------------------------------------------------------------
     Data Loading & Caching
     ------------------------------------------------------------------------ */
  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        throw new Error('Failed to load ' + url + ' (' + res.status + ')');
      }
      return res.json();
    });
  }

  function loadManifest() {
    if (state.manifest) return Promise.resolve(state.manifest);
    return fetchJson('data/manifest.json').then(function (data) {
      state.manifest = data;
      state.manifestMap = {};
      (data.kinds || []).forEach(function (k) {
        state.manifestMap[k.kind] = k;
      });
      if (els.footerMeta && data.version) {
        els.footerMeta.textContent =
          'Codex v' + data.version + ' • ' + formatNumber(data.totalEntries) + ' Entries';
      }
      return data;
    });
  }

  function loadSearchIndex() {
    if (state.searchIndex) return Promise.resolve(state.searchIndex);
    if (state.searchIndexPromise) return state.searchIndexPromise;

    state.searchIndexPromise = fetchJson('data/search-index.json').then(function (rows) {
      var normalized = rows.map(function (item) {
        var tags = Array.isArray(item.tags) ? item.tags : [];
        return {
          id: item.id,
          kind: item.kind,
          name: item.name || item.id,
          summary: item.summary || '',
          tags: tags,
          badge: item.badge || '',
          _nameLower: String(item.name || item.id).toLowerCase(),
          _idLower: String(item.id || '').toLowerCase(),
          _haystack: (
            (item.name || '') + ' ' +
            (item.id || '') + ' ' +
            (item.summary || '') + ' ' +
            tags.join(' ') + ' ' +
            (item.badge || '') + ' ' +
            (item.kind || '')
          ).toLowerCase()
        };
      });
      var idMap = new Set();
      normalized.forEach(function (row) {
        idMap.add(row.kind + ':' + row.id);
      });
      state.searchIndex = { items: normalized, keys: idMap };
      return state.searchIndex;
    });

    return state.searchIndexPromise;
  }

  function loadKind(kind) {
    if (state.kindCache[kind]) return Promise.resolve(state.kindCache[kind]);
    if (state.kindPromises[kind]) return state.kindPromises[kind];
    if (!state.manifestMap[kind]) {
      return Promise.reject(new Error('Unknown codex category: ' + kind));
    }

    var safeKind = encodeURIComponent(kind);
    state.kindPromises[kind] = fetchJson('data/kinds/' + safeKind + '.json').then(function (items) {
      var byId = {};
      items.forEach(function (item) {
        byId[item.id] = item;
      });
      var bundle = { items: items, byId: byId };
      state.kindCache[kind] = bundle;
      return bundle;
    });
    return state.kindPromises[kind];
  }

  /* ------------------------------------------------------------------------
     Sidebar & Drawer Controls
     ------------------------------------------------------------------------ */
  function setSidebarOpen(open) {
    if (!els.sidebar) return;
    els.sidebar.classList.toggle('is-open', open);
    if (els.sidebarBackdrop) {
      els.sidebarBackdrop.hidden = !open;
    }
    if (els.sidebarToggle) {
      els.sidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function renderSidebar(route) {
    if (!state.manifest || !els.sidebarNav) return;
    var activeKind = route.kind || '';
    var isHome = route.view === 'home';
    var isSearch = route.view === 'search';

    var html = [];
    html.push(
      '<a class="sidebar-link' + (isHome ? ' is-active' : '') + '" href="#/">' +
        '<span>Codex Home</span>' +
        '<span class="sidebar-count">' + esc(formatNumber(state.manifest.totalEntries)) + '</span>' +
      '</a>'
    );
    html.push(
      '<a class="sidebar-link' + (isSearch ? ' is-active' : '') + '" href="#/search">' +
        '<span>Global Search</span>' +
        '<span class="sidebar-count">/</span>' +
      '</a>'
    );
    html.push('<div class="sidebar-group-label">Categories (' + esc(state.manifest.kinds.length) + ')</div>');

    state.manifest.kinds.forEach(function (k) {
      var active = !isHome && !isSearch && activeKind === k.kind;
      var emptyCls = k.count === 0 ? ' is-empty' : '';
      html.push(
        '<a class="sidebar-link' + (active ? ' is-active' : '') + emptyCls + '" href="' + esc(makeHash('/' + k.kind)) + '">' +
          '<span>' + esc(k.title) + '</span>' +
          '<span class="sidebar-count">' + esc(formatNumber(k.count)) + '</span>' +
        '</a>'
      );
    });

    els.sidebarNav.innerHTML = html.join('');
  }

  /* ------------------------------------------------------------------------
     Search Logic
     ------------------------------------------------------------------------ */
  function scoreSearchMatch(item, tokens, rawLower) {
    for (var i = 0; i < tokens.length; i += 1) {
      if (item._haystack.indexOf(tokens[i]) === -1) return -1;
    }
    if (!rawLower) return 1;
    if (item._nameLower === rawLower || item._idLower === rawLower) return 100;
    if (item._nameLower.indexOf(rawLower) === 0 || item._idLower.indexOf(rawLower) === 0) return 60;
    if (item._nameLower.indexOf(rawLower) >= 0) return 35;
    if (item._idLower.indexOf(rawLower) >= 0) return 25;
    return 10;
  }

  function querySearchIndex(indexObj, query) {
    var trimmed = String(query || '').trim().toLowerCase();
    if (!trimmed) {
      return indexObj.items;
    }
    var tokens = trimmed.split(/\s+/).filter(Boolean);
    var scored = [];
    for (var i = 0; i < indexObj.items.length; i += 1) {
      var item = indexObj.items[i];
      var score = scoreSearchMatch(item, tokens, trimmed);
      if (score > 0) {
        scored.push({ item: item, score: score });
      }
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name);
    });
    return scored.map(function (x) {
      return x.item;
    });
  }

  /* ------------------------------------------------------------------------
     Shared Component Renderers
     ------------------------------------------------------------------------ */
  function renderLoading(message) {
    els.view.innerHTML =
      '<div class="loading-panel ink-card">' +
        '<span class="loading-sigil" aria-hidden="true"></span>' +
        '<p>' + esc(message || 'Loading codex records…') + '</p>' +
      '</div>';
  }

  function renderError(message, retryFn) {
    els.view.innerHTML =
      '<div class="empty-panel ink-card">' +
        '<h2 class="section-heading">Unable to Load Codex Data</h2>' +
        '<p>' + esc(message) + '</p>' +
        '<div style="margin-top:14px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">' +
          (retryFn ? '<button id="retry-load-btn" class="btn btn-primary" type="button">Retry</button>' : '') +
          '<a class="btn" href="#/">Return Home</a>' +
        '</div>' +
      '</div>';
    var btn = document.getElementById('retry-load-btn');
    if (btn && retryFn) {
      btn.addEventListener('click', retryFn);
    }
  }

  function renderPagination(currentPage, totalItems, onPageChange) {
    var totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (totalPages <= 1) return '';

    var parts = ['<nav class="pagination" aria-label="Pagination">'];
    parts.push(
      '<button class="page-btn" type="button" data-page="' + (currentPage - 1) + '"' +
      (currentPage <= 1 ? ' disabled' : '') + '>Prev</button>'
    );

    var pages = [];
    pages.push(1);
    for (var p = Math.max(2, currentPage - 2); p <= Math.min(totalPages - 1, currentPage + 2); p += 1) {
      pages.push(p);
    }
    if (totalPages > 1) pages.push(totalPages);

    var prev = 0;
    pages.forEach(function (num) {
      if (num - prev > 1) {
        parts.push('<span class="mono-pill badge-muted">…</span>');
      }
      parts.push(
        '<button class="page-btn' + (num === currentPage ? ' is-active' : '') + '" type="button" data-page="' + num + '"' +
        (num === currentPage ? ' aria-current="page"' : '') + '>' + num + '</button>'
      );
      prev = num;
    });

    parts.push(
      '<button class="page-btn" type="button" data-page="' + (currentPage + 1) + '"' +
      (currentPage >= totalPages ? ' disabled' : '') + '>Next</button>'
    );
    parts.push('</nav>');
    return parts.join('');
  }

  function bindPagination(container, onPageChange) {
    var btns = container.querySelectorAll('.page-btn[data-page]');
    for (var i = 0; i < btns.length; i += 1) {
      btns[i].addEventListener('click', function () {
        var page = parseInt(this.getAttribute('data-page'), 10);
        if (!isNaN(page) && page >= 1) {
          onPageChange(page);
        }
      });
    }
  }

  function renderTagChips(tags) {
    if (!Array.isArray(tags) || !tags.length) return '';
    return (
      '<div class="tag-list" aria-label="Tags">' +
      tags
        .map(function (t) {
          return (
            '<a class="tag-chip" href="' + esc(makeHash('/search', { q: t })) + '">#' + esc(t) + '</a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderEntryCard(entry, showKindBadge) {
    var kind = entry.kind;
    var d = entry.data || {};
    var wiki = entry.wiki || {};
    var summary = wiki.wikiDescription || entry.summary || '';
    var hasIcon = kind === 'glyph' && entry.hasIcon === true;

    var badges = [];
    if (showKindBadge) {
      var kindInfo = state.manifestMap[kind];
      badges.push('<span class="badge badge-gold">' + esc(kindInfo ? kindInfo.title : formatLabel(kind)) + '</span>');
    }
    if (entry.badge && showKindBadge) {
      badges.push('<span class="badge badge-muted">' + esc(formatLabel(entry.badge)) + '</span>');
    }
    if (d.rarity) {
      badges.push('<span class="badge ' + badgeClassForRarity(d.rarity) + '">' + esc(formatLabel(d.rarity)) + '</span>');
    }
    if (d.element) {
      badges.push('<span class="badge ' + badgeClassForElement(d.element) + '">' + esc(formatLabel(d.element)) + '</span>');
    }
    if (d.primaryElement) {
      badges.push('<span class="badge ' + badgeClassForElement(d.primaryElement) + '">' + esc(formatLabel(d.primaryElement)) + '</span>');
    }
    if (d.tier) {
      badges.push('<span class="badge ' + badgeClassForTier(d.tier) + '">' + esc(formatLabel(d.tier)) + '</span>');
    }
    if (d.slotType) {
      badges.push('<span class="badge badge-teal">' + esc(formatLabel(d.slotType)) + '</span>');
    }
    if (d.slot) {
      badges.push('<span class="badge badge-sky">' + esc(formatLabel(d.slot)) + '</span>');
    }
    if (d.biome && kind !== 'landmark') {
      badges.push('<span class="badge badge-muted">' + esc(formatLabel(d.biome)) + '</span>');
    }
    if (d.cityHub || d.cityId || d.homeCity) {
      badges.push('<span class="badge badge-violet">' + esc(formatLabel(d.cityHub || d.cityId || d.homeCity)) + '</span>');
    }

    var footBits = [];
    if (d.classLock) {
      var cl = Array.isArray(d.classLock) ? d.classLock.map(formatLabel).join(', ') : formatLabel(d.classLock);
      footBits.push('Class: ' + cl);
    }
    if (d.levelReq !== undefined) footBits.push('Lv ' + d.levelReq);
    if (d.level !== undefined) footBits.push('Lv ' + d.level);
    if (d.levelMin !== undefined && d.levelMax !== undefined) footBits.push('Lv ' + d.levelMin + '–' + d.levelMax);
    if (d.minLevel !== undefined && kind === 'quest') footBits.push('Lv ' + d.minLevel + '–' + (d.maxRecommendedLevel || d.minLevel));
    if (d.itemLevel !== undefined) footBits.push('iLvl ' + d.itemLevel);
    if (d.hp !== undefined) footBits.push(formatNumber(d.hp) + ' HP');
    if (d.basePower) footBits.push('Power ' + d.basePower);
    if (d.unitPriceGold !== undefined) footBits.push(formatNumber(d.unitPriceGold) + 'g');
    if (d.points !== undefined) footBits.push(d.points + ' pts');
    if (d.role && kind === 'class') footBits.push(d.role);

    return (
      '<a class="entry-card ink-card" href="' + esc(entryUrl(kind, entry.id)) + '">' +
        '<div class="entry-card-head">' +
          (hasIcon
            ? '<img class="entry-thumb" src="assets/icons/skill_' + esc(encodeURIComponent(entry.id)) + '.jpg" alt="" width="48" height="48" loading="lazy" />'
            : '') +
          '<div class="entry-card-titles">' +
            '<h3 class="entry-card-name">' + esc(entry.name || entry.id) + '</h3>' +
            '<div class="entry-card-id">' + esc(entry.id) + '</div>' +
          '</div>' +
        '</div>' +
        (badges.length ? '<div class="entry-card-badges">' + badges.slice(0, 4).join('') + '</div>' : '') +
        '<p class="entry-card-summary">' + esc(summary) + '</p>' +
        (footBits.length
          ? '<div class="entry-card-foot">' + footBits.slice(0, 3).map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('<span>•</span>') + '</div>'
          : '') +
      '</a>'
    );
  }

  /* ------------------------------------------------------------------------
     View 1: Home (#/)
     ------------------------------------------------------------------------ */
  var QUICK_JUMP_PILLS = [
    { label: 'Classes', hash: '#/class' },
    { label: 'Glyphs', hash: '#/glyph' },
    { label: 'Enemies', hash: '#/enemy' },
    { label: 'Zones', hash: '#/zone' },
    { label: 'Quests', hash: '#/quest' },
    { label: 'Rift Loot Mechanics', hash: '#/mechanics/loot' }
  ];

  function renderHome(manifest) {
    document.title = 'Lumendelve Codex — Official Game Wiki & Database';

    var quickPillsHtml = QUICK_JUMP_PILLS.map(function (p) {
      return '<a class="quick-jump-pill" href="' + esc(p.hash) + '">' + esc(p.label) + '</a>';
    }).join('');

    var featuredHtml = FEATURED_KINDS.map(function (f) {
      var meta = state.manifestMap[f.kind] || { title: formatLabel(f.kind), count: 0 };
      return (
        '<a class="featured-card ink-card" data-accent="' + esc(f.accent) + '" href="' + esc(makeHash('/' + f.kind)) + '">' +
          '<div class="featured-top">' +
            '<span class="featured-icon">' + featureIconSvg(f.icon) + '</span>' +
            '<span class="badge badge-gold">' + esc(formatNumber(meta.count)) + '</span>' +
          '</div>' +
          '<h3>' + esc(meta.title) + '</h3>' +
          '<p>' + esc(f.blurb) + '</p>' +
        '</a>'
      );
    }).join('');

    var codexGridHtml = (manifest.kinds || [])
      .map(function (k) {
        var emptyCls = k.count === 0 ? ' is-empty' : '';
        return (
          '<a class="codex-card ink-card' + emptyCls + '" href="' + esc(makeHash('/' + k.kind)) + '">' +
            '<div class="codex-card-top">' +
              '<h3>' + esc(k.title) + '</h3>' +
              '<span class="badge ' + (k.count > 0 ? 'badge-gold' : 'badge-muted') + '">' +
                esc(formatNumber(k.count)) +
              '</span>' +
            '</div>' +
            '<p>' + esc(k.description) + '</p>' +
          '</a>'
        );
      })
      .join('');

    els.view.innerHTML =
      '<section class="wiki-hero ink-card" aria-labelledby="wiki-hero-title">' +
        '<div class="wiki-hero-inner">' +
          '<div class="hero-eyebrow">' +
            '<span class="hero-dot" aria-hidden="true"></span>' +
            '<span>Codex v' + esc(manifest.version) + ' • ' + esc(formatNumber(manifest.totalEntries)) + ' Entries</span>' +
          '</div>' +
          '<h1 id="wiki-hero-title" class="wiki-hero-title">THE LUMENDELVE CODEX</h1>' +
          '<p class="wiki-hero-sub">' +
            'Search every class, glyph, rift enemy, piece of gear, quest dialogue, and deterministic drop table straight from the game data.' +
          '</p>' +
          '<div class="hero-search-wrap">' +
            '<form id="hero-search-form" class="hero-search-form" role="search">' +
              '<div class="hero-search-box">' +
                '<span class="search-icon" aria-hidden="true">' +
                  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<circle cx="11" cy="11" r="7" />' +
                    '<path d="m20 20-3.5-3.5" />' +
                  '</svg>' +
                '</span>' +
                '<input id="hero-search-input" class="hero-search-input" type="search" placeholder="Search classes, glyphs, enemies, gear, quests… (press /)" autocomplete="off" spellcheck="false" aria-label="Search the Lumendelve Codex" />' +
                '<button id="hero-search-clear" class="header-search-clear" type="button" aria-label="Clear hero search" hidden>&times;</button>' +
                '<kbd class="search-kbd" aria-hidden="true">/</kbd>' +
              '</div>' +
              '<button class="btn btn-primary" type="submit">Search Codex</button>' +
            '</form>' +
            '<div id="hero-search-dropdown" class="hero-search-dropdown" hidden></div>' +
          '</div>' +
          '<div class="hero-quick-jumps" aria-label="Quick category links">' + quickPillsHtml + '</div>' +
        '</div>' +
      '</section>' +
      '<section aria-labelledby="featured-heading">' +
        '<div class="section-heading-row" style="margin-bottom:14px;">' +
          '<h2 id="featured-heading" class="section-heading">Quick-Access Guides</h2>' +
          '<p class="section-sub">Core gameplay pillars &amp; build references</p>' +
        '</div>' +
        '<div class="featured-grid">' + featuredHtml + '</div>' +
      '</section>' +
      '<section aria-labelledby="all-categories-heading">' +
        '<div class="section-heading-row" style="margin-bottom:14px;">' +
          '<h2 id="all-categories-heading" class="section-heading">Codex Categories (' + esc(manifest.kinds.length) + ')</h2>' +
          '<p class="section-sub">Live entry counts from the current build manifest</p>' +
        '</div>' +
        '<div class="codex-grid">' + codexGridHtml + '</div>' +
      '</section>';

    wireHeroSearch();
    // Warm search index quietly after home render so hero search suggestions feel instant
    window.setTimeout(function () {
      loadSearchIndex().catch(function () {});
    }, 200);
  }

  function wireHeroSearch() {
    var form = document.getElementById('hero-search-form');
    var input = document.getElementById('hero-search-input');
    var clearBtn = document.getElementById('hero-search-clear');
    var dropdown = document.getElementById('hero-search-dropdown');
    if (!form || !input || !dropdown) return;

    function updateDropdown() {
      var q = input.value.trim();
      if (clearBtn) clearBtn.hidden = !input.value.length;
      if (q.length < 2) {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
        return;
      }
      loadSearchIndex()
        .then(function (idx) {
          if (input.value.trim() !== q) return;
          var matches = querySearchIndex(idx, q);
          var top = matches.slice(0, 7);
          if (!top.length) {
            dropdown.innerHTML = '<div class="dropdown-item"><span class="dropdown-item-sub">No matching entries for “' + esc(q) + '”.</span></div>';
            dropdown.hidden = false;
            return;
          }
          dropdown.innerHTML =
            top
              .map(function (item) {
                var kindMeta = state.manifestMap[item.kind];
                return (
                  '<a class="dropdown-item" href="' + esc(entryUrl(item.kind, item.id)) + '">' +
                    '<span class="dropdown-item-main">' +
                      '<span class="dropdown-item-name">' + esc(item.name) + '</span>' +
                      '<span class="dropdown-item-sub">' + esc(item.summary || item.id) + '</span>' +
                    '</span>' +
                    '<span class="badge badge-gold">' + esc(kindMeta ? kindMeta.title : item.kind) + '</span>' +
                  '</a>'
                );
              })
              .join('') +
            '<a class="dropdown-footer" href="' + esc(makeHash('/search', { q: q })) + '">View all ' + esc(formatNumber(matches.length)) + ' results &rarr;</a>';
          dropdown.hidden = false;
        })
        .catch(function () {
          dropdown.hidden = true;
        });
    }

    input.addEventListener('input', updateDropdown);
    input.addEventListener('focus', updateDropdown);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (input.value) {
          input.value = '';
          updateDropdown();
        } else {
          dropdown.hidden = true;
          input.blur();
        }
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        updateDropdown();
        input.focus();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      dropdown.hidden = true;
      window.location.hash = makeHash('/search', { q: input.value.trim() });
    });

    document.addEventListener('click', function onDocClick(e) {
      if (!document.body.contains(dropdown)) {
        document.removeEventListener('click', onDocClick);
        return;
      }
      if (!e.target.closest('.hero-search-wrap')) {
        dropdown.hidden = true;
      }
    });
  }

  /* ------------------------------------------------------------------------
     View 2: Search (#/search?q=...&kind=...&page=...)
     ------------------------------------------------------------------------ */
  function renderSearchView(params, token) {
    var q = params.q || '';
    var selectedKind = params.kind || '';
    var page = Math.max(1, parseInt(params.page || '1', 10) || 1);
    document.title = (q ? 'Search: ' + q + ' — ' : 'Search — ') + 'Lumendelve Codex';

    renderLoading('Searching across the Lumendelve Codex…');

    loadSearchIndex()
      .then(function (indexObj) {
        if (token !== state.renderToken) return;

        var matchedAll = querySearchIndex(indexObj, q);
        var countsByKind = {};
        matchedAll.forEach(function (item) {
          countsByKind[item.kind] = (countsByKind[item.kind] || 0) + 1;
        });

        var filtered = selectedKind
          ? matchedAll.filter(function (item) {
              return item.kind === selectedKind;
            })
          : matchedAll;

        var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (page > totalPages) page = totalPages;
        var startIdx = (page - 1) * PAGE_SIZE;
        var slice = filtered.slice(startIdx, startIdx + PAGE_SIZE);

        var pills = [
          '<button class="pill-btn' + (!selectedKind ? ' is-active' : '') + '" type="button" data-search-kind="">' +
            '<span>All</span><span class="pill-btn-count">' + esc(formatNumber(matchedAll.length)) + '</span>' +
          '</button>'
        ];
        (state.manifest.kinds || []).forEach(function (k) {
          var cnt = countsByKind[k.kind] || 0;
          if (cnt === 0 && selectedKind !== k.kind) return;
          pills.push(
            '<button class="pill-btn' + (selectedKind === k.kind ? ' is-active' : '') + '" type="button" data-search-kind="' + esc(k.kind) + '">' +
              '<span>' + esc(k.title) + '</span>' +
              '<span class="pill-btn-count">' + esc(formatNumber(cnt)) + '</span>' +
            '</button>'
          );
        });

        var rangeEnd = Math.min(startIdx + slice.length, filtered.length);
        var summaryLine = filtered.length
          ? 'Showing ' + formatNumber(startIdx + 1) + '–' + formatNumber(rangeEnd) + ' of ' + formatNumber(filtered.length) + ' entries'
          : '0 matching entries';

        els.view.innerHTML =
          '<section class="view-header ink-card">' +
            '<div class="view-header-main">' +
              '<div class="breadcrumb"><a href="#/">Wiki</a><span>/</span><span>Search</span></div>' +
              '<h1 class="view-title">' + (q ? 'Results for “' + esc(q) + '”' : 'Search the Codex') + '</h1>' +
              '<p class="view-desc">Instant search across all ' + esc(formatNumber(indexObj.items.length)) + ' indexed entries, tags, and IDs.</p>' +
            '</div>' +
          '</section>' +
          '<section class="filter-toolbar ink-card" aria-label="Search filters">' +
            '<form id="page-search-form" class="filter-row">' +
              '<label class="filter-field filter-field-wide">' +
                '<span class="filter-label">Search Query</span>' +
                '<input id="page-search-input" class="filter-input" type="search" value="' + esc(q) + '" placeholder="Name, ID, tag, biome, element…" autocomplete="off" spellcheck="false" />' +
              '</label>' +
              '<div style="display:flex;gap:8px;align-items:flex-end;">' +
                '<button class="btn btn-primary" type="submit">Search</button>' +
                (q || selectedKind ? '<button id="clear-search-filters" class="btn" type="button">Reset</button>' : '') +
              '</div>' +
            '</form>' +
            '<div class="filter-pills-row" role="group" aria-label="Filter by category">' + pills.join('') + '</div>' +
          '</section>' +
          '<div class="results-meta">' +
            '<span>' + esc(summaryLine) + '</span>' +
            '<span>Page ' + page + ' of ' + totalPages + '</span>' +
          '</div>' +
          (slice.length
            ? '<div class="entry-grid">' + slice.map(function (item) { return renderEntryCard(item, true); }).join('') + '</div>'
            : '<div class="empty-panel ink-card"><p>No entries matched your current query and category filter.</p></div>') +
          renderPagination(page, filtered.length);

        var form = document.getElementById('page-search-form');
        var input = document.getElementById('page-search-input');
        var resetBtn = document.getElementById('clear-search-filters');

        if (form && input) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            window.location.hash = makeHash('/search', {
              q: input.value.trim(),
              kind: selectedKind,
              page: 1
            });
          });
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && input.value) {
              input.value = '';
              window.location.hash = makeHash('/search', { kind: selectedKind, page: 1 });
            }
          });
        }

        if (resetBtn) {
          resetBtn.addEventListener('click', function () {
            window.location.hash = '#/search';
          });
        }

        var kindBtns = els.view.querySelectorAll('[data-search-kind]');
        for (var i = 0; i < kindBtns.length; i += 1) {
          kindBtns[i].addEventListener('click', function () {
            var nextKind = this.getAttribute('data-search-kind') || '';
            window.location.hash = makeHash('/search', {
              q: q,
              kind: nextKind,
              page: 1
            });
          });
        }

        bindPagination(els.view, function (nextPage) {
          window.location.hash = makeHash('/search', {
            q: q,
            kind: selectedKind,
            page: nextPage
          });
        });
      })
      .catch(function (err) {
        if (token !== state.renderToken) return;
        renderError(err.message, function () {
          state.searchIndexPromise = null;
          renderSearchView(params, token);
        });
      });
  }

  /* ------------------------------------------------------------------------
     View 3: Category List (#/<kind>)
     ------------------------------------------------------------------------ */
  function renderKindView(kind, params, token) {
    var meta = state.manifestMap[kind];
    if (!meta) {
      renderError('Category "' + kind + '" does not exist in the Lumendelve Codex.');
      return;
    }

    document.title = meta.title + ' — Lumendelve Codex';
    renderLoading('Loading ' + meta.title + ' records…');

    loadKind(kind)
      .then(function (bundle) {
        if (token !== state.renderToken) return;

        var items = bundle.items;
        var filterDefs = CATEGORY_FILTERS[kind] || [];

        // Build distinct option lists per domain filter
        var optionsByFilter = {};
        filterDefs.forEach(function (fd) {
          var seen = {};
          items.forEach(function (item) {
            var val = getByPath(item, fd.path);
            if (val !== undefined && val !== null && val !== '') {
              seen[String(val)] = true;
            }
          });
          optionsByFilter[fd.key] = Object.keys(seen).sort(function (a, b) {
            var na = Number(a);
            var nb = Number(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          });
        });

        var q = (params.q || '').trim();
        var page = Math.max(1, parseInt(params.page || '1', 10) || 1);
        var activeFilters = {};
        filterDefs.forEach(function (fd) {
          if (params[fd.key]) activeFilters[fd.key] = params[fd.key];
        });

        var qLower = q.toLowerCase();
        var filtered = items.filter(function (item) {
          for (var i = 0; i < filterDefs.length; i += 1) {
            var fd = filterDefs[i];
            var selected = activeFilters[fd.key];
            if (selected) {
              var actual = getByPath(item, fd.path);
              if (String(actual == null ? '' : actual) !== selected) return false;
            }
          }
          if (qLower) {
            var wiki = item.wiki || {};
            var hay = (
              (item.name || '') + ' ' +
              (item.id || '') + ' ' +
              (wiki.wikiDescription || '') + ' ' +
              (Array.isArray(wiki.tags) ? wiki.tags.join(' ') : '')
            ).toLowerCase();
            if (hay.indexOf(qLower) === -1) return false;
          }
          return true;
        });

        var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (page > totalPages) page = totalPages;
        var startIdx = (page - 1) * PAGE_SIZE;
        var slice = filtered.slice(startIdx, startIdx + PAGE_SIZE);
        var rangeEnd = Math.min(startIdx + slice.length, filtered.length);

        var controlsHtml =
          '<label class="filter-field filter-field-wide">' +
            '<span class="filter-label">Filter by text</span>' +
            '<input id="kind-text-filter" class="filter-input" type="search" value="' + esc(q) + '" placeholder="Filter ' + esc(meta.title.toLowerCase()) + ' by name, ID, or tag…" autocomplete="off" spellcheck="false" />' +
          '</label>' +
          filterDefs
            .map(function (fd) {
              var opts = optionsByFilter[fd.key] || [];
              var cur = activeFilters[fd.key] || '';
              return (
                '<label class="filter-field">' +
                  '<span class="filter-label">' + esc(fd.label) + '</span>' +
                  '<select class="filter-select" data-filter-key="' + esc(fd.key) + '">' +
                    '<option value="">All ' + esc(fd.label) + '</option>' +
                    opts
                      .map(function (o) {
                        var labelText = fd.key === 'act' ? 'Act ' + o : formatLabel(o);
                        return '<option value="' + esc(o) + '"' + (cur === o ? ' selected' : '') + '>' + esc(labelText) + '</option>';
                      })
                      .join('') +
                  '</select>' +
                '</label>'
              );
            })
            .join('');

        var hasActiveFilters = Boolean(q || Object.keys(activeFilters).length);

        els.view.innerHTML =
          '<section class="view-header ink-card">' +
            '<div class="view-header-main">' +
              '<div class="breadcrumb"><a href="#/">Wiki</a><span>/</span><span>' + esc(meta.title) + '</span></div>' +
              '<h1 class="view-title">' + esc(meta.title) + '</h1>' +
              '<p class="view-desc">' + esc(meta.description) + '</p>' +
            '</div>' +
            '<span class="badge badge-gold">' + esc(formatNumber(meta.count)) + ' Total</span>' +
          '</section>' +
          (items.length
            ? '<section class="filter-toolbar ink-card" aria-label="' + esc(meta.title) + ' filters">' +
                '<div class="filter-row">' +
                  controlsHtml +
                  (hasActiveFilters
                    ? '<div style="display:flex;align-items:flex-end;"><button id="kind-reset-filters" class="btn" type="button">Reset</button></div>'
                    : '') +
                '</div>' +
              '</section>'
            : '') +
          '<div class="results-meta">' +
            '<span>' +
              (filtered.length
                ? 'Showing ' + formatNumber(startIdx + 1) + '–' + formatNumber(rangeEnd) + ' of ' + formatNumber(filtered.length) + ' entries'
                : '0 entries') +
            '</span>' +
            (filtered.length ? '<span>Page ' + page + ' of ' + totalPages + '</span>' : '') +
          '</div>' +
          (slice.length
            ? '<div class="entry-grid">' + slice.map(function (item) { return renderEntryCard(item, false); }).join('') + '</div>'
            : '<div class="empty-panel ink-card"><p>' +
                (items.length === 0
                  ? 'No entries are currently published in the ' + esc(meta.title) + ' category.'
                  : 'No ' + esc(meta.title.toLowerCase()) + ' entries match your active filters.') +
              '</p></div>') +
          renderPagination(page, filtered.length);

        function navigateWithFilters(nextPage, overrideQuery) {
          var nextParams = { page: nextPage || 1 };
          var textVal = overrideQuery !== undefined ? overrideQuery : (document.getElementById('kind-text-filter') ? document.getElementById('kind-text-filter').value.trim() : '');
          if (textVal) nextParams.q = textVal;
          var selects = els.view.querySelectorAll('.filter-select[data-filter-key]');
          for (var i = 0; i < selects.length; i += 1) {
            var k = selects[i].getAttribute('data-filter-key');
            var v = selects[i].value;
            if (v) nextParams[k] = v;
          }
          window.location.hash = makeHash('/' + kind, nextParams);
        }

        var textInput = document.getElementById('kind-text-filter');
        if (textInput) {
          var debounceTimer = 0;
          textInput.addEventListener('input', function () {
            window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(function () {
              navigateWithFilters(1);
            }, 180);
          });
          textInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && textInput.value) {
              textInput.value = '';
              navigateWithFilters(1, '');
            }
          });
        }

        var selects = els.view.querySelectorAll('.filter-select[data-filter-key]');
        for (var i = 0; i < selects.length; i += 1) {
          selects[i].addEventListener('change', function () {
            navigateWithFilters(1);
          });
        }

        var resetBtn = document.getElementById('kind-reset-filters');
        if (resetBtn) {
          resetBtn.addEventListener('click', function () {
            window.location.hash = makeHash('/' + kind);
          });
        }

        bindPagination(els.view, function (nextPage) {
          navigateWithFilters(nextPage);
        });
      })
      .catch(function (err) {
        if (token !== state.renderToken) return;
        renderError(err.message, function () {
          delete state.kindPromises[kind];
          renderKindView(kind, params, token);
        });
      });
  }

  /* ------------------------------------------------------------------------
     View 4: Entry Detail (#/<kind>/<id>)
     ------------------------------------------------------------------------ */
  function renderKvGrid(pairs) {
    var filtered = pairs.filter(function (p) {
      return p.value !== undefined && p.value !== null && p.value !== '';
    });
    if (!filtered.length) return '';
    return (
      '<div class="kv-grid">' +
      filtered
        .map(function (p) {
          return (
            '<div class="kv-box">' +
              '<span class="kv-label">' + esc(p.label) + '</span>' +
              '<span class="kv-value">' + (p.rawHtml ? p.value : esc(p.value)) + '</span>' +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderClassDomain(entry) {
    var d = entry.data || {};
    var stats = [
      { label: 'Base HP', val: d.baseHp, cls: 'fill-teal' },
      { label: 'Speed', val: d.baseSpeed, cls: 'fill-sky' },
      { label: 'Phys ATK', val: d.physAtk, cls: '' },
      { label: 'Phys DEF', val: d.physDef, cls: '' },
      { label: 'Elem ATK', val: d.elemAtk, cls: 'fill-violet' },
      { label: 'Elem DEF', val: d.elemDef, cls: 'fill-violet' },
      { label: 'Spec ATK', val: d.specAtk, cls: 'fill-sky' },
      { label: 'Spec DEF', val: d.specDef, cls: 'fill-teal' }
    ];
    var maxStat = 140;

    return (
      '<div class="detail-grid-2">' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Class Profile</span><span class="badge badge-gold">Total ' + esc(d.statTotal) + '</span></h2>' +
          renderKvGrid([
            { label: 'Role', value: d.role },
            { label: 'Home City', value: formatLabel(d.homeCity) },
            { label: 'Specializations', value: Array.isArray(d.branches) ? d.branches.map(formatLabel).join(' / ') : '—' },
            { label: 'Stat Total', value: formatNumber(d.statTotal) }
          ]) +
          '<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;">' +
            '<a class="btn" href="' + esc(makeHash('/glyph', { classLock: entry.id })) + '">Browse ' + esc(entry.name) + ' Glyphs &rarr;</a>' +
          '</div>' +
        '</section>' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Base Stat Spread</span></h2>' +
          '<div class="stat-bars">' +
            stats
              .map(function (s) {
                var pct = Math.min(100, Math.round(((s.val || 0) / maxStat) * 100));
                return (
                  '<div class="stat-bar-row">' +
                    '<span class="stat-bar-label">' + esc(s.label) + '</span>' +
                    '<div class="stat-bar-track"><div class="stat-bar-fill ' + s.cls + '" style="width:' + pct + '%"></div></div>' +
                    '<span class="stat-bar-val">' + esc(s.val) + '</span>' +
                  '</div>'
                );
              })
              .join('') +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  function renderGlyphDomain(entry) {
    var d = entry.data || {};
    var detailed = Array.isArray(entry.detailedEffects) ? entry.detailedEffects : [];
    var weaponLock = Array.isArray(d.weaponLock) && d.weaponLock.length ? d.weaponLock.map(formatLabel).join(', ') : 'Any';

    return (
      '<div class="detail-grid-2">' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Glyph Parameters</span></h2>' +
          renderKvGrid([
            { label: 'Class Lock', value: formatLabel(d.classLock) },
            { label: 'Spec Lock', value: d.specLock ? formatLabel(d.specLock) : 'None' },
            { label: 'Slot Type', value: formatLabel(d.slotType) },
            { label: 'Category', value: formatLabel(d.category) },
            { label: 'Element', value: formatLabel(d.element) },
            { label: 'Rarity', value: formatLabel(d.rarity) },
            { label: 'Level Req', value: 'Lv ' + (d.levelReq || 1) },
            { label: 'Base Power', value: d.basePower !== undefined ? String(d.basePower) : '—' },
            { label: 'Base Casts', value: d.baseCasts !== undefined ? String(d.baseCasts) : '—' },
            { label: 'Hits / Targeting', value: (d.hitCount || 1) + 'x • ' + (d.isAoe ? 'AoE' : 'Single') },
            { label: 'Salvage Dust', value: d.salvageDust !== undefined ? formatNumber(d.salvageDust) : '—' },
            { label: 'Weapon Lock', value: weaponLock },
            { label: 'Armor Pierce', value: d.armorPierceRatio !== undefined ? formatPct(d.armorPierceRatio) : undefined },
            { label: 'VFX / Anim', value: d.vfxKind || d.animClip ? [d.vfxKind, d.animClip].filter(Boolean).join(' • ') : undefined }
          ]) +
        '</section>' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Combat Effects</span></h2>' +
          (d.effectSummary ? '<p style="margin:0 0 12px;color:var(--text-primary);font-weight:600;">' + esc(d.effectSummary) + '</p>' : '') +
          (detailed.length
            ? '<div class="subcard-list">' +
                detailed
                  .map(function (line) {
                    return '<div class="subcard">' + esc(line) + '</div>';
                  })
                  .join('') +
              '</div>'
            : '<p style="margin:0;color:var(--text-muted);">No additional secondary status effects.</p>') +
        '</section>' +
      '</div>'
    );
  }

  function renderEnemyDomain(entry) {
    var d = entry.data || {};
    var stats = d.stats || {};
    var weaknesses = Array.isArray(entry.weaknesses) ? entry.weaknesses : [];
    var moves = Array.isArray(d.moves) ? d.moves : [];
    var linkedGlyphs = {};
    (entry.resolvedLinks || []).forEach(function (lk) {
      if (lk.kind === 'glyph') linkedGlyphs[lk.id] = true;
    });

    var combatHtml =
      '<div class="detail-grid-2">' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Encounter Profile</span></h2>' +
          renderKvGrid([
            { label: 'Level & Rank', value: 'Lv ' + d.level + ' • ' + (d.rank || formatLabel(d.tier)) },
            { label: 'Tier / Role', value: formatLabel(d.tier) + ' • ' + formatLabel(d.role) },
            { label: 'Archetype', value: formatLabel(d.archetype) },
            { label: 'Primary Element', value: formatLabel(d.primaryElement) },
            { label: 'Secondary Element', value: d.secondaryElement ? formatLabel(d.secondaryElement) : 'None' },
            { label: 'Biome', value: formatLabel(d.biome) },
            { label: 'City Hub', value: formatLabel(d.city) },
            { label: 'Starter Rift', value: d.starterRiftName },
            { label: 'HP', value: formatNumber(d.hp || stats.maxHp) },
            { label: 'Attack Range', value: d.atkMin !== undefined ? d.atkMin + '–' + d.atkMax : undefined },
            { label: 'EXP Share', value: d.experiencePercent !== undefined ? d.experiencePercent + '%' : undefined },
            { label: 'Signature', value: d.signatureMechanic }
          ]) +
        '</section>' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Combat Attributes</span></h2>' +
          renderKvGrid([
            { label: 'Max HP', value: formatNumber(stats.maxHp) },
            { label: 'Speed', value: formatNumber(stats.speed) },
            { label: 'Phys ATK / DEF', value: (stats.physAtk || 0) + ' / ' + (stats.physDef || 0) },
            { label: 'Elem ATK / DEF', value: (stats.elemAtk || 0) + ' / ' + (stats.elemDef || 0) },
            { label: 'Spec ATK / DEF', value: (stats.specAtk || 0) + ' / ' + (stats.specDef || 0) },
            { label: 'Crit Chance', value: formatPct(stats.critChance) },
            { label: 'Crit Multiplier', value: stats.critMultiplier !== undefined ? stats.critMultiplier + '×' : undefined },
            { label: 'Dodge Chance', value: formatPct(stats.dodgeChance) },
            { label: 'Accuracy', value: formatPct(stats.accuracy) }
          ]) +
        '</section>' +
      '</div>';

    var hasSecondary = weaknesses.some(function (w) {
      return w.secondaryMultiplier !== null && w.secondaryMultiplier !== undefined;
    });

    var weaknessHtml = weaknesses.length
      ? '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Elemental Weaknesses</span></h2>' +
          '<div class="table-wrap"><table class="codex-table">' +
            '<thead><tr>' +
              '<th>Element</th>' +
              '<th>Primary Mult</th>' +
              (hasSecondary ? '<th>Secondary Mult</th>' : '') +
              '<th>Effectiveness</th>' +
            '</tr></thead>' +
            '<tbody>' +
              weaknesses
                .map(function (w) {
                  var effCls = w.effectiveness === 'weak' ? 'eff-weak' : w.effectiveness === 'resistant' ? 'eff-resistant' : 'eff-neutral';
                  return (
                    '<tr>' +
                      '<td><span class="badge ' + badgeClassForElement(w.element) + '">' + esc(formatLabel(w.element)) + '</span></td>' +
                      '<td><code>' + esc(w.primaryMultiplier) + '×</code></td>' +
                      (hasSecondary
                        ? '<td><code>' + esc(w.secondaryMultiplier !== null && w.secondaryMultiplier !== undefined ? w.secondaryMultiplier + '×' : '—') + '</code></td>'
                        : '') +
                      '<td class="' + effCls + '">' + esc(formatLabel(w.effectiveness)) + '</td>' +
                    '</tr>'
                  );
                })
                .join('') +
            '</tbody>' +
          '</table></div>' +
        '</section>'
      : '';

    var movesHtml = moves.length
      ? '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Moveset (' + moves.length + ')</span></h2>' +
          '<div class="subcard-list">' +
            moves
              .map(function (m) {
                var canLink = Boolean(m.glyphId && linkedGlyphs[m.glyphId]);
                var titleNode = canLink
                  ? '<a class="subcard-title" href="' + esc(entryUrl('glyph', m.glyphId)) + '">' + esc(m.name || m.glyphId) + ' &rarr;</a>'
                  : '<span class="subcard-title">' + esc(m.name || m.glyphId) + '</span>';
                return (
                  '<div class="subcard">' +
                    '<div class="subcard-head">' +
                      titleNode +
                      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                        (m.element ? '<span class="badge ' + badgeClassForElement(m.element) + '">' + esc(formatLabel(m.element)) + '</span>' : '') +
                        (m.category ? '<span class="badge badge-muted">' + esc(formatLabel(m.category)) + '</span>' : '') +
                        (m.basePower ? '<span class="badge badge-gold">Power ' + esc(m.basePower) + '</span>' : '') +
                        (m.isAoe ? '<span class="badge badge-teal">AoE</span>' : '') +
                      '</div>' +
                    '</div>' +
                    '<p style="margin:0;color:var(--text-secondary);font-size:0.88rem;">' + esc(m.effectSummary || (m.wiki && m.wiki.wikiDescription) || '') + '</p>' +
                  '</div>'
                );
              })
              .join('') +
          '</div>' +
        '</section>'
      : '';

    return combatHtml + weaknessHtml + movesHtml;
  }

  function renderDialogueCard(label, card) {
    if (!card) return '';
    var lines = Array.isArray(card.lines) ? card.lines : [];
    return (
      '<div class="dialogue-card">' +
        '<div class="dialogue-speaker">' +
          '<span class="badge badge-gold">' + esc(label) + '</span>' +
          '<strong>' + esc(card.speakerName || formatLabel(card.speakerMayorId)) + '</strong>' +
          (card.speakerTitle ? '<span class="badge badge-muted">' + esc(card.speakerTitle) + '</span>' : '') +
          (card.cityId ? '<span class="badge badge-violet">' + esc(formatLabel(card.cityId)) + '</span>' : '') +
        '</div>' +
        '<ul class="dialogue-lines">' +
          lines.map(function (ln) { return '<li>' + esc(ln) + '</li>'; }).join('') +
        '</ul>' +
      '</div>'
    );
  }

  function renderQuestDomain(entry) {
    var d = entry.data || {};
    var objs = Array.isArray(d.objectives) ? d.objectives : [];
    var reward = d.reward || {};
    var rewardItems = Array.isArray(reward.rewardItems) ? reward.rewardItems : [];

    var zoneVal = d.zoneId
      ? '<a style="color:var(--amber-400);text-decoration:none;" href="' + esc(entryUrl('zone', d.zoneId)) + '">' + esc(formatLabel(d.zoneId)) + ' &rarr;</a>'
      : '—';

    return (
      '<div class="detail-grid-2">' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Quest Progression</span></h2>' +
          renderKvGrid([
            { label: 'Act & Stage', value: 'Act ' + d.act + ' • Stage ' + d.stage },
            { label: 'Level Range', value: 'Lv ' + d.minLevel + '–' + (d.maxRecommendedLevel || d.minLevel) },
            { label: 'City Hub', value: formatLabel(d.cityId) },
            { label: 'Zone', value: zoneVal, rawHtml: Boolean(d.zoneId) },
            { label: 'Quest Giver', value: formatLabel(d.mayorId) }
          ]) +
          '<h3 style="margin:18px 0 10px;font-family:var(--font-display);font-size:1rem;">Objectives</h3>' +
          '<div class="subcard-list">' +
            objs
              .map(function (o, idx) {
                return (
                  '<div class="subcard">' +
                    '<div class="subcard-head">' +
                      '<span class="subcard-title">Step ' + (idx + 1) + ': ' + esc(o.description || formatLabel(o.type)) + '</span>' +
                      '<span class="badge badge-teal">' + esc(formatLabel(o.type)) + '</span>' +
                    '</div>' +
                    '<div style="display:flex;gap:10px;flex-wrap:wrap;font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">' +
                      (o.requiredCount ? '<span>Required: ' + esc(o.requiredCount) + '</span>' : '') +
                      (o.areaNumber ? '<span>Area ' + esc(o.areaNumber) + '</span>' : '') +
                      (o.targetId ? '<span>Target: ' + esc(o.targetId) + '</span>' : '') +
                    '</div>' +
                  '</div>'
                );
              })
              .join('') +
          '</div>' +
        '</section>' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Rewards &amp; Dialogue</span></h2>' +
          renderKvGrid([
            { label: 'Experience', value: formatNumber(reward.xp) + ' XP' },
            { label: 'Gold', value: formatNumber(reward.gold) + 'g' },
            { label: 'Solstice Writ', value: reward.grantsLetterToSolstice ? 'Grants Letter to Solstice' : 'No' },
            {
              label: 'Reward Items',
              value: rewardItems.length
                ? rewardItems.map(function (it) { return it.quantity + '× ' + formatLabel(it.definitionId); }).join(', ')
                : 'None'
            }
          ]) +
          '<div class="subcard-list" style="margin-top:16px;">' +
            renderDialogueCard('Intro Dialogue', d.introDialogueCard) +
            renderDialogueCard('Completion Dialogue', d.completionDialogueCard) +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  function renderMechanicsDomain(entry) {
    var d = entry.data || {};
    var tables = d.baseTables || {};
    var sources = Object.keys(tables);
    if (!sources.length) return '';

    var rowsHtml = sources
      .map(function (src) {
        var row = tables[src] || {};
        var weights = row.gearRarityWeights || {};
        var weightStr = ['common', 'uncommon', 'rare', 'epic', 'mythic']
          .filter(function (r) {
            return weights[r] > 0;
          })
          .map(function (r) {
            return '<span class="badge ' + badgeClassForRarity(r) + '">' + esc(formatLabel(r)) + ' ' + esc(weights[r]) + '%</span>';
          })
          .join(' ');

        return (
          '<tr>' +
            '<td><strong>' + esc(formatLabel(src)) + '</strong></td>' +
            '<td><code>' + esc(Array.isArray(row.goldRange) ? row.goldRange.join('–') : '—') + '</code></td>' +
            '<td><code>' + esc(Array.isArray(row.dustRange) ? row.dustRange.join('–') : '—') + '</code></td>' +
            '<td><code>' + esc(Array.isArray(row.materialRange) ? row.materialRange.join('–') : '—') + '</code></td>' +
            '<td><code>' + esc(formatPct(row.glyphChance)) + '</code></td>' +
            '<td><code>' + esc(formatPct(row.gearChance)) + '</code></td>' +
            '<td><code>' + esc(formatPct(row.sealedCacheChance)) + '</code></td>' +
            '<td><div style="display:flex;flex-wrap:wrap;gap:4px;">' + (weightStr || '—') + '</div></td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<section class="detail-panel ink-card">' +
        '<h2 class="panel-title"><span>Deterministic Loot &amp; Drop Tables</span><span class="badge badge-gold">' + sources.length + ' Sources</span></h2>' +
        '<div class="table-wrap"><table class="codex-table">' +
          '<thead><tr>' +
            '<th>Source</th>' +
            '<th>Gold</th>' +
            '<th>Dust</th>' +
            '<th>Materials</th>' +
            '<th>Glyph Drop</th>' +
            '<th>Gear Drop</th>' +
            '<th>Sealed Cache</th>' +
            '<th>Gear Rarity Weights</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table></div>' +
      '</section>'
    );
  }

  function renderGearDomain(entry) {
    var d = entry.data || {};
    var stats = d.baseStats || {};
    var statPairs = Object.keys(stats).map(function (k) {
      var v = stats[k];
      var isRatio = /Pct$|Chance$|Ratio$/i.test(k) && typeof v === 'number' && Math.abs(v) <= 2;
      return {
        label: formatLabel(k),
        value: isRatio ? '+' + formatPct(v) : (typeof v === 'number' && v >= 0 ? '+' + formatNumber(v) : String(v))
      };
    });

    var setVal = d.setId
      ? '<a style="color:var(--amber-400);text-decoration:none;" href="' + esc(entryUrl('gear_set', d.setId)) + '">' + esc(formatLabel(d.setId)) + ' &rarr;</a>'
      : 'None';

    return (
      '<div class="detail-grid-2">' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Equipment Specifications</span></h2>' +
          renderKvGrid([
            { label: 'Slot', value: formatLabel(d.slot) },
            { label: 'Subtype', value: formatLabel(d.subtype) },
            { label: 'Item Level', value: d.itemLevel },
            { label: 'Level Req', value: 'Lv ' + d.levelReq },
            { label: 'Class Lock', value: Array.isArray(d.classLock) ? d.classLock.map(formatLabel).join(', ') : 'Any' },
            { label: 'Spec Lock', value: Array.isArray(d.specLock) && d.specLock.length ? d.specLock.map(formatLabel).join(', ') : 'None' },
            { label: 'Gender Lock', value: d.genderLock ? formatLabel(d.genderLock) : 'Any' },
            { label: 'Upgradeable', value: d.upgradeable ? 'Yes' : 'No' },
            { label: 'NPC Sell', value: d.npcSellGold !== undefined ? formatNumber(d.npcSellGold) + 'g' : '—' },
            { label: 'Gear Set', value: setVal, rawHtml: Boolean(d.setId) }
          ]) +
        '</section>' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Base Stats</span></h2>' +
          (statPairs.length ? renderKvGrid(statPairs) : '<p style="margin:0;color:var(--text-muted);">No fixed base stats.</p>') +
        '</section>' +
      '</div>'
    );
  }

  function renderGearSetDomain(entry) {
    var d = entry.data || {};
    var bonuses = [
      { label: '2-Piece Bonus', obj: d.twoPieceBonus },
      { label: '4-Piece Bonus', obj: d.fourPieceBonus },
      { label: '6-Piece Bonus', obj: d.sixPieceBonus }
    ].filter(function (b) { return Boolean(b.obj); });

    return (
      '<div class="detail-grid-2">' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Set Overview</span></h2>' +
          renderKvGrid([
            { label: 'Level Range', value: Array.isArray(d.levelRange) ? 'Lv ' + d.levelRange.join('–') : '—' },
            { label: 'Class Lock', value: Array.isArray(d.classLock) ? d.classLock.map(formatLabel).join(', ') : 'Any' },
            { label: 'Spec Lock', value: Array.isArray(d.specLock) && d.specLock.length ? d.specLock.map(formatLabel).join(', ') : 'None' },
            { label: 'Gender', value: d.gender ? formatLabel(d.gender) : 'Any' },
            { label: 'Variant', value: formatLabel(d.variant) },
            { label: 'Pieces', value: Array.isArray(d.pieceBaseIds) ? d.pieceBaseIds.length + ' Pieces' : '—' }
          ]) +
        '</section>' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Set Bonuses</span></h2>' +
          '<div class="subcard-list">' +
            bonuses
              .map(function (b) {
                return (
                  '<div class="subcard">' +
                    '<div class="subcard-head">' +
                      '<span class="subcard-title">' + esc(b.label) + '</span>' +
                      '<span class="badge badge-gold">' + esc(b.obj.piecesRequired) + ' pcs</span>' +
                    '</div>' +
                    '<p style="margin:0;color:var(--text-secondary);">' + esc(b.obj.description) + '</p>' +
                  '</div>'
                );
              })
              .join('') +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  function renderZoneDomain(entry) {
    var d = entry.data || {};
    var unlock = d.unlock || {};
    var unlockText = unlock.kind === 'starter_home'
      ? 'Starter Home (' + formatLabel(unlock.baseClass) + ')'
      : 'Min Level ' + (unlock.minLevel || 1) + (unlock.prerequisiteZoneId ? ' • Requires ' + formatLabel(unlock.prerequisiteZoneId) : '');

    var linkLookup = {};
    (entry.resolvedLinks || []).forEach(function (lk) {
      linkLookup[lk.id] = lk;
    });

    function renderRosterGroup(title, ids, badgeCls) {
      if (!Array.isArray(ids) || !ids.length) return '';
      return (
        '<div class="subcard">' +
          '<div class="subcard-head"><span class="subcard-title">' + esc(title) + '</span><span class="badge ' + badgeCls + '">' + ids.length + '</span></div>' +
          '<div class="tag-list">' +
            ids
              .map(function (id) {
                var lk = linkLookup[id];
                if (lk) {
                  return '<a class="tag-chip" href="' + esc(entryUrl(lk.kind, lk.id)) + '">' + esc(lk.name) + '</a>';
                }
                return '<span class="mono-pill">' + esc(formatLabel(id)) + '</span>';
              })
              .join('') +
          '</div>' +
        '</div>'
      );
    }

    return (
      '<div class="detail-grid-2">' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Zone Atlas Data</span></h2>' +
          renderKvGrid([
            { label: 'City Hub', value: formatLabel(d.cityHub) },
            { label: 'Biome', value: formatLabel(d.biome) },
            { label: 'Zone Levels', value: 'Lv ' + d.levelMin + '–' + d.levelMax },
            { label: 'Mob Levels', value: Array.isArray(d.mobLevelRange) ? 'Lv ' + d.mobLevelRange.join('–') : '—' },
            { label: 'Unlock Rule', value: unlockText },
            { label: 'Prefab Set', value: d.prefabSetId }
          ]) +
        '</section>' +
        '<section class="detail-panel ink-card">' +
          '<h2 class="panel-title"><span>Encounter Roster</span></h2>' +
          '<div class="subcard-list">' +
            renderRosterGroup('Realm Boss', d.bossId ? [d.bossId] : [], 'badge-rose') +
            renderRosterGroup('Elites', d.eliteIds, 'badge-violet') +
            renderRosterGroup('Standard Mobs', d.mobIds, 'badge-gold') +
            renderRosterGroup('Trash & Minions', d.trashIds, 'badge-muted') +
          '</div>' +
        '</section>' +
      '</div>'
    );
  }

  function renderAffixDomain(entry) {
    var d = entry.data || {};
    var tiers = Array.isArray(d.tiers) ? d.tiers : [];
    return (
      '<section class="detail-panel ink-card">' +
        '<h2 class="panel-title"><span>Affix Properties &amp; Scaling</span></h2>' +
        renderKvGrid([
          { label: 'Stat Key', value: d.statKey },
          { label: 'Roll Weight', value: d.weight },
          { label: 'Allowed Slots', value: Array.isArray(d.allowedSlots) ? d.allowedSlots.map(formatLabel).join(', ') : '—' }
        ]) +
        (tiers.length
          ? '<div class="table-wrap" style="margin-top:16px;"><table class="codex-table">' +
              '<thead><tr><th>Tier</th><th>Item Level Range</th><th>Roll Range</th></tr></thead>' +
              '<tbody>' +
                tiers
                  .map(function (t) {
                    return (
                      '<tr>' +
                        '<td><span class="badge badge-gold">Tier ' + esc(t.tier) + '</span></td>' +
                        '<td>iLvl ' + esc(t.minItemLevel) + '–' + esc(t.maxItemLevel) + '</td>' +
                        '<td><code>' + esc(t.minRoll) + ' – ' + esc(t.maxRoll) + '</code></td>' +
                      '</tr>'
                    );
                  })
                  .join('') +
              '</tbody>' +
            '</table></div>'
          : '') +
      '</section>'
    );
  }

  function renderGenericDomain(entry) {
    var d = entry.data || {};
    var kind = entry.kind;
    var pairs = [];

    if (kind === 'bounty') {
      var obj = d.objective || {};
      var rew = d.reward || {};
      pairs = [
        { label: 'Cadence', value: formatLabel(d.cadence) },
        { label: 'Min Level', value: 'Lv ' + d.minLevel },
        { label: 'Objective', value: formatLabel(obj.kind) + (obj.count ? ' (' + obj.count + ')' : '') },
        { label: 'Zone', value: obj.zoneId ? formatLabel(obj.zoneId) : 'Any' },
        { label: 'Gold Reward', value: rew.gold !== undefined ? formatNumber(rew.gold) + 'g' : '—' },
        { label: 'Upgrade Dust', value: rew.upgradeDust !== undefined ? formatNumber(rew.upgradeDust) : '—' },
        { label: 'XP Reward', value: rew.xp !== undefined ? formatNumber(rew.xp) + ' XP' : '—' }
      ];
    } else if (kind === 'achievement') {
      var titleReward = d.titleReward || {};
      pairs = [
        { label: 'Category', value: formatLabel(d.category) },
        { label: 'Target Count', value: formatNumber(d.targetCount) },
        { label: 'Codex Points', value: formatNumber(d.points) },
        { label: 'Title Reward', value: titleReward.displayTitle || 'None' }
      ];
    } else if (kind === 'elite_affix') {
      pairs = [
        { label: 'Effect Summary', value: d.effectSummary },
        { label: 'Min Rift Tier', value: 'Tier ' + d.minRiftTier },
        { label: 'Potency', value: d.potency },
        { label: 'Stackable', value: d.stackable ? 'Yes' : 'No' },
        { label: 'Visual Cue', value: formatLabel(d.visual) }
      ];
    } else if (kind === 'landmark') {
      pairs = [
        { label: 'Biome', value: formatLabel(d.biome) },
        { label: 'Interaction', value: formatLabel(d.interactionKind) },
        { label: 'Signal Glow', value: d.emitsSignalGlow ? 'Emits Signal Glow' : 'No' }
      ];
    } else if (kind === 'merchant_stock') {
      pairs = [
        { label: 'City', value: formatLabel(d.cityId) },
        { label: 'Category', value: formatLabel(d.category) },
        { label: 'Rarity', value: formatLabel(d.rarity) },
        { label: 'Price', value: formatNumber(d.unitPriceGold) + 'g' },
        { label: 'Definition ID', value: d.definitionId },
        { label: 'Offline Stock', value: d.usableOffline ? 'Yes' : 'No' }
      ];
    } else if (kind === 'collection') {
      pairs = [
        { label: 'Category', value: formatLabel(d.category) },
        { label: 'Codex Points', value: formatNumber(d.points) },
        { label: 'Target ID', value: d.targetId }
      ];
    }

    if (!pairs.length) return '';
    return (
      '<section class="detail-panel ink-card">' +
        '<h2 class="panel-title"><span>Details</span></h2>' +
        renderKvGrid(pairs) +
      '</section>'
    );
  }

  function renderDomainSection(entry) {
    switch (entry.kind) {
      case 'class':
        return renderClassDomain(entry);
      case 'glyph':
        return renderGlyphDomain(entry);
      case 'enemy':
        return renderEnemyDomain(entry);
      case 'quest':
        return renderQuestDomain(entry);
      case 'mechanics':
        return renderMechanicsDomain(entry);
      case 'gear':
        return renderGearDomain(entry);
      case 'gear_set':
        return renderGearSetDomain(entry);
      case 'zone':
        return renderZoneDomain(entry);
      case 'affix':
        return renderAffixDomain(entry);
      default:
        return renderGenericDomain(entry);
    }
  }

  function renderDetailView(kind, id, token) {
    var meta = state.manifestMap[kind];
    if (!meta) {
      renderError('Unknown category "' + kind + '".');
      return;
    }

    document.title = formatLabel(id) + ' — ' + meta.title + ' — Lumendelve Codex';
    renderLoading('Loading ' + meta.title + ' entry…');

    loadKind(kind)
      .then(function (bundle) {
        if (token !== state.renderToken) return;
        var entry = bundle.byId[id];
        if (!entry) {
          renderError('Could not find ' + meta.title + ' entry "' + id + '".');
          return;
        }

        document.title = entry.name + ' — ' + meta.title + ' — Lumendelve Codex';
        var wiki = entry.wiki || {};
        var d = entry.data || {};
        var hasIcon = kind === 'glyph' && entry.hasIcon === true;

        var badges = ['<span class="badge badge-gold">' + esc(meta.title) + '</span>'];
        if (d.rarity) badges.push('<span class="badge ' + badgeClassForRarity(d.rarity) + '">' + esc(formatLabel(d.rarity)) + '</span>');
        if (d.element) badges.push('<span class="badge ' + badgeClassForElement(d.element) + '">' + esc(formatLabel(d.element)) + '</span>');
        if (d.primaryElement) badges.push('<span class="badge ' + badgeClassForElement(d.primaryElement) + '">' + esc(formatLabel(d.primaryElement)) + '</span>');
        if (d.secondaryElement) badges.push('<span class="badge ' + badgeClassForElement(d.secondaryElement) + '">' + esc(formatLabel(d.secondaryElement)) + '</span>');
        if (d.tier) badges.push('<span class="badge ' + badgeClassForTier(d.tier) + '">' + esc(formatLabel(d.tier)) + '</span>');
        if (d.slotType) badges.push('<span class="badge badge-teal">' + esc(formatLabel(d.slotType)) + '</span>');
        if (d.slot) badges.push('<span class="badge badge-sky">' + esc(formatLabel(d.slot)) + '</span>');

        var relatedLinks = Array.isArray(entry.resolvedLinks) ? entry.resolvedLinks : [];
        var relatedHtml = relatedLinks.length
          ? '<section class="detail-panel ink-card">' +
              '<h2 class="panel-title"><span>Related Codex Entries</span><span class="badge badge-gold">' + relatedLinks.length + '</span></h2>' +
              '<div class="links-grid">' +
                relatedLinks
                  .map(function (lk) {
                    var lkMeta = state.manifestMap[lk.kind];
                    return (
                      '<a class="related-link-card" href="' + esc(entryUrl(lk.kind, lk.id)) + '">' +
                        '<span class="related-link-name">' + esc(lk.name || lk.id) + '</span>' +
                        '<span class="badge badge-muted">' + esc(lkMeta ? lkMeta.title : lk.kind) + '</span>' +
                      '</a>'
                    );
                  })
                  .join('') +
              '</div>' +
            '</section>'
          : '';

        els.view.innerHTML =
          '<nav class="breadcrumb" aria-label="Breadcrumb">' +
            '<a href="#/">Wiki</a><span>/</span>' +
            '<a href="' + esc(makeHash('/' + kind)) + '">' + esc(meta.title) + '</a><span>/</span>' +
            '<span>' + esc(entry.name) + '</span>' +
          '</nav>' +
          '<section class="detail-hero ink-card">' +
            '<div class="detail-hero-top">' +
              (hasIcon
                ? '<img class="detail-icon" src="assets/icons/skill_' + esc(encodeURIComponent(entry.id)) + '.jpg" alt="' + esc(entry.name) + ' icon" width="84" height="84" />'
                : '') +
              '<div class="detail-title-block">' +
                '<div class="detail-badges">' + badges.join('') + '</div>' +
                '<h1 class="detail-title">' + esc(entry.name) + '</h1>' +
                '<p class="detail-id-line">ID: ' + esc(entry.id) + '</p>' +
              '</div>' +
            '</div>' +
            (wiki.acquisitionSource
              ? '<div class="detail-acquisition"><strong>Acquisition</strong>' + esc(wiki.acquisitionSource) + '</div>'
              : '') +
            renderTagChips(wiki.tags) +
          '</section>' +
          '<section class="detail-panel ink-card">' +
            '<h2 class="panel-title"><span>Description &amp; Lore</span></h2>' +
            '<p style="margin:0;color:var(--text-primary);font-size:0.97rem;">' + esc(wiki.wikiDescription || 'No description available.') + '</p>' +
            (wiki.lore ? '<blockquote class="lore-quote">' + esc(wiki.lore) + '</blockquote>' : '') +
          '</section>' +
          renderDomainSection(entry) +
          relatedHtml;
      })
      .catch(function (err) {
        if (token !== state.renderToken) return;
        renderError(err.message, function () {
          delete state.kindPromises[kind];
          renderDetailView(kind, id, token);
        });
      });
  }

  /* ------------------------------------------------------------------------
     Router & Global Interactions
     ------------------------------------------------------------------------ */
  function renderCurrentRoute() {
    state.renderToken += 1;
    var token = state.renderToken;
    var route = parseRoute();

    setSidebarOpen(false);

    if (els.homeLink) {
      els.homeLink.classList.toggle('is-active', route.view === 'home');
    }

    if (els.headerInput) {
      if (route.view === 'search') {
        els.headerInput.value = route.params.q || '';
      }
      if (els.headerClear) {
        els.headerClear.hidden = !els.headerInput.value.length;
      }
    }

    loadManifest()
      .then(function (manifest) {
        if (token !== state.renderToken) return;
        renderSidebar(route);

        if (route.view === 'home') {
          renderHome(manifest);
        } else if (route.view === 'search') {
          renderSearchView(route.params, token);
        } else if (route.view === 'kind') {
          renderKindView(route.kind, route.params, token);
        } else {
          renderDetailView(route.kind, route.id, token);
        }

        window.scrollTo({ top: 0, behavior: 'auto' });
      })
      .catch(function (err) {
        if (token !== state.renderToken) return;
        renderError(err.message, function () {
          state.manifest = null;
          renderCurrentRoute();
        });
      });
  }

  function initHeaderAndShortcuts() {
    if (els.sidebarToggle) {
      els.sidebarToggle.addEventListener('click', function () {
        var isOpen = els.sidebar && els.sidebar.classList.contains('is-open');
        setSidebarOpen(!isOpen);
      });
    }
    if (els.sidebarClose) {
      els.sidebarClose.addEventListener('click', function () {
        setSidebarOpen(false);
      });
    }
    if (els.sidebarBackdrop) {
      els.sidebarBackdrop.addEventListener('click', function () {
        setSidebarOpen(false);
      });
    }

    if (els.headerForm && els.headerInput) {
      els.headerInput.addEventListener('input', function () {
        if (els.headerClear) els.headerClear.hidden = !els.headerInput.value.length;
      });
      els.headerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        window.location.hash = makeHash('/search', { q: els.headerInput.value.trim(), page: 1 });
      });
      els.headerInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (els.headerInput.value) {
            els.headerInput.value = '';
            if (els.headerClear) els.headerClear.hidden = true;
            if (parseRoute().view === 'search') {
              window.location.hash = '#/search';
            }
          } else {
            els.headerInput.blur();
          }
        }
      });
    }

    if (els.headerClear && els.headerInput) {
      els.headerClear.addEventListener('click', function () {
        els.headerInput.value = '';
        els.headerClear.hidden = true;
        if (parseRoute().view === 'search') {
          window.location.hash = '#/search';
        } else {
          els.headerInput.focus();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      var isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

      if (e.key === '/' && !isEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        var heroInput = document.getElementById('hero-search-input');
        var target = heroInput || els.headerInput;
        if (target) {
          target.focus();
          target.select();
        }
      } else if (e.key === 'Escape' && els.sidebar && els.sidebar.classList.contains('is-open')) {
        setSidebarOpen(false);
      }
    });
  }

  initHeaderAndShortcuts();
  window.addEventListener('hashchange', renderCurrentRoute);
  renderCurrentRoute();
})();
