/**
 * @file loot_audio.js
 * Web Audio API player for Lumendelve synthesized .wav loot drop & pickup chimes.
 * Mirrors AudioManager.gd pitch jitter, boost dB levels, and mute/volume controls.
 */

const LOOT_FILES = {
  drop_coin: '/api/audio/loot/drop_coin.wav',
  drop_common: '/api/audio/loot/drop_common.wav',
  drop_uncommon: '/api/audio/loot/drop_uncommon.wav',
  drop_rare: '/api/audio/loot/drop_rare.wav',
  drop_epic: '/api/audio/loot/drop_epic.wav',
  drop_mythic: '/api/audio/loot/drop_mythic.wav',
  pickup_coin: '/api/audio/loot/pickup_coin.wav',
  pickup_item: '/api/audio/loot/pickup_item.wav',
};

const HIGH_RARITIES = new Set(['rare', 'epic', 'mythic', 'legendary']);

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

export function createLootAudioController() {
  let ctx = null;
  let muted = false;
  let volume = 0.8;
  const bufferCache = new Map();
  const pendingFetches = new Map();

  function ensureContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  }

  async function loadKey(key) {
    if (bufferCache.has(key)) return bufferCache.get(key);
    if (pendingFetches.has(key)) return pendingFetches.get(key);
    const url = LOOT_FILES[key];
    if (!url) return null;
    const p = (async () => {
      try {
        const audioCtx = ensureContext();
        if (!audioCtx) return null;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arr);
        bufferCache.set(key, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        pendingFetches.delete(key);
      }
    })();
    pendingFetches.set(key, p);
    return p;
  }

  async function preloadAll() {
    const audioCtx = ensureContext();
    if (!audioCtx) return false;
    await Promise.all(Object.keys(LOOT_FILES).map((k) => loadKey(k)));
    return bufferCache.size > 0;
  }

  async function playBankKey(bankKey, { dbOffset = 0, pitchBias = 1.0 } = {}) {
    if (muted || volume <= 0.001) return false;
    const audioCtx = ensureContext();
    if (!audioCtx) return false;
    const buf = await loadKey(bankKey);
    if (!buf) return false;
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const jitter = 0.96 + Math.random() * 0.08;
    src.playbackRate.value = pitchBias * jitter;

    const gain = audioCtx.createGain();
    const amp = Math.max(0, Math.min(1.5, volume * dbToLinear(dbOffset - 4.0)));
    gain.gain.value = amp;

    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(0);
    return true;
  }

  function playDrop(rarity = 'common', kind = 'gear') {
    const r = String(rarity || 'common').trim().toLowerCase();
    const k = String(kind || 'gear').trim().toLowerCase();
    const mappedR = r === 'legendary' ? 'mythic' : r;
    const bankKey = (k === 'gold' || k === 'material') && mappedR === 'common'
      ? 'drop_coin'
      : (LOOT_FILES[`drop_${mappedR}`] ? `drop_${mappedR}` : 'drop_common');
    const dbOffset = HIGH_RARITIES.has(mappedR) ? 1.5 : bankKey === 'drop_coin' ? -3.0 : -1.0;
    return playBankKey(bankKey, { dbOffset, pitchBias: 1.0 });
  }

  function playPickup(rarity = 'common', kind = 'gear') {
    const r = String(rarity || 'common').trim().toLowerCase();
    const k = String(kind || 'gear').trim().toLowerCase();
    const bankKey = k === 'gold' ? 'pickup_coin' : 'pickup_item';
    const pitchBias = HIGH_RARITIES.has(r) ? 1.08 : 1.0;
    return playBankKey(bankKey, { dbOffset: -2.0, pitchBias });
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
  }

  function setVolume(nextVol) {
    volume = Math.max(0, Math.min(1, Number(nextVol) || 0));
  }

  function getState() {
    return {
      muted,
      volume,
      loadedCount: bufferCache.size,
      totalCount: Object.keys(LOOT_FILES).length,
      contextState: ctx?.state || 'uninitialized',
    };
  }

  return {
    preloadAll,
    playBankKey,
    playDrop,
    playPickup,
    setMuted,
    setVolume,
    getState,
  };
}
