/**
 * @file weapon_staging_catalog.js
 * Stage 1 weapon styles, modular mounts, weapon-locked glyph catalogs,
 * 3-hit weapon auto-attack chains, Reaver pairings, and Staff majority-element attunement.
 */

export const REAVER_PAIRINGS = [
  {
    id: 'swd_swd',
    label: 'Swd + Swd',
    mounts: [
      { key: 'sword_1h', file: 'sword_1h.glb', slot: 'main_hand' },
      { key: 'sword_1h_l', file: 'sword_1h.glb', slot: 'off_hand' },
    ],
  },
  {
    id: 'swd_axe',
    label: 'Swd + Axe',
    mounts: [
      { key: 'sword_1h', file: 'sword_1h.glb', slot: 'main_hand' },
      { key: 'axe_1h_l', file: 'axe_1h.glb', slot: 'off_hand' },
    ],
  },
  {
    id: 'axe_axe',
    label: 'Axe + Axe',
    mounts: [
      { key: 'axe_1h', file: 'axe_1h.glb', slot: 'main_hand' },
      { key: 'axe_1h_l', file: 'axe_1h.glb', slot: 'off_hand' },
    ],
  },
];

export const STAFF_ELEMENTS = {
  fire: {
    id: 'fire',
    label: 'Fire',
    primaryColor: '#fb7185',
    coreColor: '#fde047',
    accentColor: '#f97316',
    tipText: 'Fire majority equipped — Staff auto-attacks launch searing Ignis Bolts.',
  },
  water: {
    id: 'water',
    label: 'Water',
    primaryColor: '#0ea5e9',
    coreColor: '#e0f2fe',
    accentColor: '#0284c7',
    tipText: 'Water majority equipped — Staff auto-attacks surge with Tidal Bolts.',
  },
  ice: {
    id: 'ice',
    label: 'Ice',
    primaryColor: '#38bdf8',
    coreColor: '#e0f2fe',
    accentColor: '#0284c7',
    tipText: 'Ice majority equipped — Staff auto-attacks hurl Glacial Shards.',
  },
  lightning: {
    id: 'lightning',
    label: 'Lightning',
    primaryColor: '#facc15',
    coreColor: '#fef9c3',
    accentColor: '#60a5fa',
    tipText: 'Lightning majority equipped — Staff auto-attacks crackle with Volt Bolts.',
  },
  wind: {
    id: 'wind',
    label: 'Wind',
    primaryColor: '#34d399',
    coreColor: '#d1fae5',
    accentColor: '#2dd4bf',
    tipText: 'Wind majority equipped — Staff auto-attacks slice with Tempest Orbs.',
  },
  arcane: {
    id: 'arcane',
    label: 'Arcane',
    primaryColor: '#c084fc',
    coreColor: '#f5d0fe',
    accentColor: '#e879f9',
    tipText: 'Equal element split or neutral — Staff auto-attacks fire balanced Arcane Orbs.',
  },
};

export function getStaffElementDef(elementId) {
  return STAFF_ELEMENTS[elementId] || STAFF_ELEMENTS.arcane;
}

export const STAGING_WEAPON_STYLES = [
  // ================= SQUIRE =================
  {
    id: 'sword_1h',
    classId: 'squire',
    clipStyle: 'sword_1h',
    label: '1H Sword + Shield',
    shortLabel: '1H Swd',
    specBadge: 'Aegis / Vanguard',
    scalingStat: 'physAtk',
    scalingLabel: 'Physical Attack',
    rangeMode: 'melee',
    attackRange: 1.48,
    colorHex: '#38bdf8',
    accentHex: '#e0f2fe',
    combatProfile: { timeScale: 1.24, hitStopSec: 0.0, shakeAmp: 0.048, slashColor: '#38bdf8', slashScale: 1.05 },
    mounts: [
      { key: 'sword_1h', file: 'sword_1h.glb', slot: 'main_hand' },
      { key: 'shield', file: 'shield.glb', slot: 'off_hand' },
    ],
    autoChain: [
      { step: 1, clip: 'Wep_sword_1h_Auto1', name: 'Right-to-Left Slice', dmgMul: 0.85 },
      { step: 2, clip: 'Wep_sword_1h_Auto2', name: 'Left-to-Right Backhand', dmgMul: 0.95 },
      { step: 3, clip: 'Wep_sword_1h_Auto3', name: 'Overhead Sword Finisher', dmgMul: 1.25 },
    ],
    glyphs: [
      { id: 'vanguard_cleave', name: 'Vanguard Cleave', clip: 'Wep_sword_1h_Cleave', role: 'move', vfxKind: 'sword_cleave', desc: 'Crisp crescent sword sweep.' },
      { id: 'shield_bash', name: 'Shield Bash', clip: 'Wep_sword_1h_ShieldBash', role: 'move', vfxKind: 'shield_slam', desc: 'Staggering buckler impact wave.' },
      { id: 'vanguard_flurry', name: 'Vanguard Flurry', clip: 'Wep_sword_1h_Flurry', role: 'move', vfxKind: 'sword_flurry', desc: 'Rapid 3-slash & shield-check vanguard flurry.' },
      { id: 'valor_cry', name: 'Valor Cry', clip: 'Wep_sword_1h_Buff', role: 'buff', vfxKind: 'valor_pillar', desc: 'Rallying aura column & shock ring.' },
      { id: 'iron_guard', name: 'Iron Guard', clip: 'Wep_sword_1h_Guard', role: 'block', vfxKind: 'guard_dome', desc: 'Raise buckler for fortified Ward.' },
      { id: 'field_bandage', name: 'Field Bandage', clip: 'Wep_sword_1h_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Class recovery stitch (Sword stance).' },
    ],
  },
  {
    id: 'axe_1h',
    classId: 'squire',
    clipStyle: 'sword_1h',
    label: '1H Axe + Shield',
    shortLabel: '1H Axe',
    specBadge: 'Aegis / Vanguard',
    scalingStat: 'physAtk',
    scalingLabel: 'Physical Attack',
    rangeMode: 'melee',
    attackRange: 1.48,
    colorHex: '#fb923c',
    accentHex: '#fed7aa',
    combatProfile: { timeScale: 1.16, hitStopSec: 0.02, shakeAmp: 0.058, slashColor: '#fb923c', slashScale: 1.12 },
    mounts: [
      { key: 'axe_1h', file: 'axe_1h.glb', slot: 'main_hand' },
      { key: 'shield', file: 'shield.glb', slot: 'off_hand' },
    ],
    autoChain: [
      { step: 1, clip: 'Wep_sword_1h_Auto1', name: 'Bearded Chop', dmgMul: 0.88 },
      { step: 2, clip: 'Wep_sword_1h_Auto2', name: 'Hooking Cleave', dmgMul: 0.96 },
      { step: 3, clip: 'Wep_sword_1h_Auto3', name: 'Crushing Axe Drop', dmgMul: 1.28 },
    ],
    glyphs: [
      { id: 'rending_chop', name: 'Rending Chop', clip: 'Wep_sword_1h_Cleave', role: 'move', vfxKind: 'sword_cleave', desc: 'Armor-splitting bearded axe arc.' },
      { id: 'shield_bash_axe', name: 'Shield Bash', clip: 'Wep_sword_1h_ShieldBash', role: 'move', vfxKind: 'shield_slam', desc: 'Staggering buckler impact wave.' },
      { id: 'sunder_flurry', name: 'Sunder Flurry', clip: 'Wep_sword_1h_Flurry', role: 'move', vfxKind: 'sword_flurry', desc: 'Rapid bearded-axe chop & shield-check flurry.' },
      { id: 'iron_guard_axe', name: 'Iron Guard', clip: 'Wep_sword_1h_Guard', role: 'block', vfxKind: 'guard_dome', desc: 'Raise shield wall.' },
      { id: 'field_bandage_axe', name: 'Field Bandage', clip: 'Wep_sword_1h_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Class recovery stitch.' },
    ],
  },
  {
    id: 'sword_2h',
    classId: 'squire',
    clipStyle: 'sword_2h',
    label: '2H Greatsword (Aegis)',
    shortLabel: '2H Grtswd',
    specBadge: 'Aegis (Lv 50)',
    scalingStat: 'physAtk',
    scalingLabel: 'Physical Attack',
    rangeMode: 'melee',
    attackRange: 1.72,
    colorHex: '#60a5fa',
    accentHex: '#fde047',
    combatProfile: { timeScale: 0.92, hitStopSec: 0.055, shakeAmp: 0.085, slashColor: '#60a5fa', slashScale: 1.48 },
    mounts: [{ key: 'sword_2h', file: 'sword_2h.glb', slot: 'two_hand' }],
    autoChain: [
      { step: 1, clip: 'Wep_sword_2h_Auto1', name: 'Wide Horizontal Heave', dmgMul: 0.85 },
      { step: 2, clip: 'Wep_sword_2h_Auto2', name: 'Rising Reverse Greatsword', dmgMul: 0.98 },
      { step: 3, clip: 'Wep_sword_2h_Auto3', name: 'Crushing Earthsplitter', dmgMul: 1.38 },
    ],
    glyphs: [
      { id: 'colossus_cleave', name: 'Colossus Cleave', clip: 'Wep_sword_2h_HeavyCleave', role: 'move', vfxKind: 'greatsword_cleave', desc: 'Massive azure-gold greatsword arc.' },
      { id: 'earthbreaker_slam', name: 'Earthbreaker Slam', clip: 'Wep_sword_2h_Slam', role: 'move', vfxKind: 'greatsword_slam', desc: 'Seismic ground rupture around impact.' },
      { id: 'tempest_whirl', name: 'Aegis Whirlwind', clip: 'Wep_sword_2h_Whirlwind', role: 'move', vfxKind: 'whirlwind_ring', desc: '360° greatsword vortex sweep.' },
      { id: 'sundering_lunge', name: 'Sundering Lunge', clip: 'Wep_sword_2h_Lunge', role: 'move', vfxKind: 'pierce_lance', desc: 'Forward shoulder-set piercing drive.' },
      { id: 'greatsword_guard', name: 'Greathilt Parry', clip: 'Wep_sword_2h_Guard', role: 'block', vfxKind: 'guard_dome', desc: 'Crossed 2H parry wall.' },
      { id: 'field_bandage_2h', name: 'Field Bandage', clip: 'Wep_sword_2h_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Class recovery stitch (2H pose).' },
    ],
  },
  {
    id: 'dual_1h',
    classId: 'squire',
    clipStyle: 'dual_1h',
    label: 'Dual 1H (Reaver Lv 50)',
    shortLabel: 'Dual 1H',
    specBadge: 'Reaver (Lv 50)',
    supportsReaverPairing: true,
    scalingStat: 'physAtk',
    scalingLabel: 'Physical Attack',
    rangeMode: 'melee',
    attackRange: 1.52,
    colorHex: '#22d3ee',
    accentHex: '#facc15',
    combatProfile: { timeScale: 1.36, hitStopSec: 0.025, shakeAmp: 0.062, slashColor: '#22d3ee', slashScale: 1.18 },
    mounts: REAVER_PAIRINGS[1].mounts, // Default Swd + Axe preview for instant Reaver readability
    autoChain: [
      { step: 1, clip: 'Wep_dual_1h_Auto1', name: 'Right Slash Flash', dmgMul: 0.85 },
      { step: 2, clip: 'Wep_dual_1h_Auto2', name: 'Offhand Riposte Cut', dmgMul: 0.92 },
      { step: 3, clip: 'Wep_dual_1h_Auto3', name: 'Synchronized X-Cross', dmgMul: 1.34 },
    ],
    glyphs: [
      { id: 'twin_flurry', name: 'Twin Blade Flurry', clip: 'Wep_dual_1h_Flurry', role: 'move', vfxKind: 'dual_flurry', desc: 'Alternating high-speed dual cuts.' },
      { id: 'reaver_whirl', name: 'Crimson Whirl', clip: 'Wep_dual_1h_Whirlwind', role: 'move', vfxKind: 'whirlwind_ring', desc: 'Spinning twin-weapon cyclone.' },
      { id: 'x_execute', name: 'Reaver Execute', clip: 'Wep_dual_1h_Execute', role: 'move', vfxKind: 'dual_execute', desc: 'Scissor-X execution strike.' },
      { id: 'twin_riposte', name: 'Cross Riposte', clip: 'Wep_dual_1h_Riposte', role: 'move', vfxKind: 'dual_riposte', desc: 'Crimson parry-flash into twin diverging counter-rend.' },
      { id: 'dual_guard', name: 'Cross-Blade Guard', clip: 'Wep_dual_1h_Guard', role: 'block', vfxKind: 'guard_dome', desc: 'Scissor parry stance.' },
      { id: 'field_bandage_dual', name: 'Field Bandage', clip: 'Wep_dual_1h_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Class recovery stitch (Dual stance).' },
    ],
  },

  // ================= SCOUT =================
  {
    id: 'bow',
    classId: 'scout',
    clipStyle: 'bow',
    label: 'Bow (Wayfinder)',
    shortLabel: 'Bow',
    specBadge: 'Wayfinder',
    scalingStat: 'physAtk',
    scalingLabel: 'Physical Attack',
    rangeMode: 'ranged',
    attackRange: 4.35,
    colorHex: '#2dd4bf',
    accentHex: '#a7f3d0',
    combatProfile: { timeScale: 1.18, hitStopSec: 0.0, shakeAmp: 0.042, slashColor: '#2dd4bf', slashScale: 1.0 },
    mounts: [
      { key: 'bow', file: 'bow.glb', slot: 'two_hand' },
      { key: 'quiver', file: 'quiver.glb', slot: 'back_quiver' },
    ],
    autoChain: [
      { step: 1, clip: 'Wep_bow_Auto1', name: 'Quick Nock Shot', dmgMul: 0.88 },
      { step: 2, clip: 'Wep_bow_Auto2', name: 'Step-Back Snap Shot', dmgMul: 0.96 },
      { step: 3, clip: 'Wep_bow_Auto3', name: 'Drawn Piercing Arrow', dmgMul: 1.28 },
    ],
    glyphs: [
      { id: 'gale_arrow', name: 'Gale Arrow', clip: 'Wep_bow_PowerShot', role: 'move', vfxKind: 'bow_powershot', desc: 'High-velocity wind-wrapped arrow.' },
      { id: 'scatter_volley', name: 'Tempest Barrage', clip: 'Wep_bow_Volley', role: 'move', vfxKind: 'bow_volley', desc: 'Spread fan of skyborne arrows.' },
      { id: 'wayfinder_railshot', name: 'Wayfinder Railshot', clip: 'Wep_bow_Railshot', role: 'move', vfxKind: 'bow_railshot', desc: 'Piercing gale line beam & gale burst.' },
      { id: 'evasive_step', name: 'Evasive Step', clip: 'Wep_bow_Evade', role: 'block', vfxKind: 'guard_wind', desc: 'Agile sidestep wind barrier.' },
      { id: 'herbal_draught', name: 'Herbal Draught', clip: 'Wep_bow_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Scout field tonic (Bow stance).' },
    ],
  },
  {
    id: 'razor_fans',
    classId: 'scout',
    clipStyle: 'razor_fans',
    label: 'Razor Fans (Zephyr)',
    shortLabel: 'Razor Fans',
    specBadge: 'Zephyr',
    scalingStat: 'physAtk',
    scalingLabel: 'Physical Attack',
    rangeMode: 'melee',
    attackRange: 1.56,
    colorHex: '#34d399',
    accentHex: '#fde047',
    combatProfile: { timeScale: 1.38, hitStopSec: 0.0, shakeAmp: 0.048, slashColor: '#34d399', slashScale: 1.15 },
    mounts: [
      { key: 'razor_fan_r', file: 'razor_fan_r.glb', slot: 'main_hand' },
      { key: 'razor_fan_l', file: 'razor_fan_l.glb', slot: 'off_hand' },
    ],
    autoChain: [
      { step: 1, clip: 'Wep_razor_fans_Auto1', name: 'Forehand Fan Slice', dmgMul: 0.84 },
      { step: 2, clip: 'Wep_razor_fans_Auto2', name: 'Left Twin Reversal', dmgMul: 0.94 },
      { step: 3, clip: 'Wep_razor_fans_Auto3', name: 'Crossed Razor Scissor', dmgMul: 1.32 },
    ],
    glyphs: [
      { id: 'fan_flurry', name: 'Zephyr Flurry', clip: 'Wep_razor_fans_Flurry', role: 'move', vfxKind: 'fan_flurry', desc: 'Rapid twin silver-teal razor crescents.' },
      { id: 'cyclone_fans', name: 'Whirling Tempest', clip: 'Wep_razor_fans_Cyclone', role: 'move', vfxKind: 'fan_cyclone', desc: 'Spiral wind-razor vortex around target.' },
      { id: 'fan_snap_dive', name: 'Cross-Fan Finale', clip: 'Wep_razor_fans_FanSnap', role: 'move', vfxKind: 'fan_snap', desc: 'Giant locking X-scissor fan seal & burst.' },
      { id: 'fan_lunge', name: 'Gale Dash Cut', clip: 'Wep_razor_fans_Lunge', role: 'move', vfxKind: 'fan_lunge', desc: 'Dash-lunge hurling twin boomerang razor fans through target.' },
      { id: 'fan_evade', name: 'Zephyr Evade', clip: 'Wep_razor_fans_Guard', role: 'block', vfxKind: 'guard_wind', desc: 'Whirling fan deflection ward.' },
      { id: 'herbal_draught_fan', name: 'Herbal Draught', clip: 'Wep_razor_fans_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Scout field tonic (Fan stance).' },
    ],
  },

  // ================= ARCANIST =================
  {
    id: 'staff',
    classId: 'arcanist',
    clipStyle: 'staff',
    label: '2H Staff (Prismancer)',
    shortLabel: '2H Staff',
    specBadge: 'Prismancer',
    supportsStaffElement: true,
    scalingStat: 'elemAtk',
    scalingLabel: 'Magic Attack',
    rangeMode: 'ranged',
    attackRange: 4.35,
    colorHex: '#e879f9',
    accentHex: '#67e8f9',
    combatProfile: { timeScale: 1.12, hitStopSec: 0.0, shakeAmp: 0.056, slashColor: '#e879f9', slashScale: 1.25 },
    mounts: [{ key: 'staff', file: 'staff.glb', slot: 'two_hand' }],
    autoChain: [
      { step: 1, clip: 'Wep_staff_Auto1', name: 'Elemental Orb I', dmgMul: 0.88 },
      { step: 2, clip: 'Wep_staff_Auto2', name: 'Twin-Handed Bolt II', dmgMul: 0.96 },
      { step: 3, clip: 'Wep_staff_Auto3', name: 'Prismatic Surge III', dmgMul: 1.30 },
    ],
    glyphs: [
      { id: 'meteor_supernova', name: 'Meteor Supernova', clip: 'Wep_staff_Supernova', role: 'move', vfxKind: 'staff_fire_meteor', desc: 'Fire — Skyfall magma meteor & blazing flame pillar.' },
      { id: 'thunderstrike', name: 'Thunderstrike', clip: 'Wep_staff_Lightning', role: 'move', vfxKind: 'staff_lightning', desc: 'Lightning — Instant jagged sky-to-ground thunderbolt.' },
      { id: 'tidal_surge', name: 'Tidal Surge', clip: 'Wep_staff_WaterSurge', role: 'move', vfxKind: 'staff_water', desc: 'Water — Rising aqua geyser spire & crashing ripple waves.' },
      { id: 'gale_tempest', name: 'Gale Tempest', clip: 'Wep_staff_AirTempest', role: 'move', vfxKind: 'staff_air', desc: 'Air — Spiraling silver-cyan wind blades & gale vortex.' },
      { id: 'phase_ward_staff', name: 'Phase Ward', clip: 'Wep_staff_Guard', role: 'block', vfxKind: 'guard_dome', desc: '2H Staff magic deflection sphere.' },
      { id: 'lumen_sip_staff', name: 'Lumen Sip', clip: 'Wep_staff_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Arcanist mana draught (Staff).' },
    ],
  },
  {
    id: 'wand',
    classId: 'arcanist',
    clipStyle: 'wand',
    label: '1H Wand (Mindweaver)',
    shortLabel: '1H Wand',
    specBadge: 'Mindweaver',
    scalingStat: 'elemAtk',
    scalingLabel: 'Magic Attack',
    rangeMode: 'ranged',
    attackRange: 4.15,
    colorHex: '#a855f7',
    accentHex: '#f5d0fe',
    combatProfile: { timeScale: 1.24, hitStopSec: 0.0, shakeAmp: 0.054, slashColor: '#a855f7', slashScale: 1.15 },
    mounts: [{ key: 'wand', file: 'wand.glb', slot: 'main_hand' }],
    autoChain: [
      { step: 1, clip: 'Wep_wand_Auto1', name: 'Mental Flick I', dmgMul: 0.88 },
      { step: 2, clip: 'Wep_wand_Auto2', name: 'Psychic Pulse II', dmgMul: 0.96 },
      { step: 3, clip: 'Wep_wand_Auto3', name: 'Mental Strike Shatter III', dmgMul: 1.30 },
    ],
    glyphs: [
      { id: 'mental_strike', name: 'Mental Strike', clip: 'Wep_wand_MentalBolt', role: 'move', vfxKind: 'wand_mental', desc: 'Instant dark-violet psychic implosion directly on target.' },
      { id: 'psychic_shackle', name: 'Psychic Shackle', clip: 'Wep_wand_Shackle', role: 'move', vfxKind: 'wand_shackle', desc: 'Constricting violet mind-rings around target.' },
      { id: 'void_collapse', name: 'Void Collapse', clip: 'Wep_wand_Collapse', role: 'move', vfxKind: 'wand_collapse', desc: 'Dark-light gravity singularity on enemy.' },
      { id: 'psionic_barrier', name: 'Psionic Barrier', clip: 'Wep_wand_Barrier', role: 'move', vfxKind: 'wand_barrier', desc: 'Crystalline mind-surge pulse.' },
      { id: 'phase_ward_wand', name: 'Phase Ward', clip: 'Wep_wand_Guard', role: 'block', vfxKind: 'guard_psychic', desc: 'Violet rune ward sphere.' },
      { id: 'lumen_sip_wand', name: 'Lumen Sip', clip: 'Wep_wand_Heal', role: 'heal', vfxKind: 'heal_bloom', desc: 'Arcanist mana draught (Wand).' },
    ],
  },

  // ================= ACOLYTE =================
  {
    id: 'stick_2h',
    classId: 'acolyte',
    clipStyle: 'stick_2h',
    label: '2H Stick (Luminar)',
    shortLabel: '2H Stick',
    specBadge: 'Luminar',
    scalingStat: 'elemAtk',
    scalingLabel: 'Magic Attack',
    rangeMode: 'ranged',
    attackRange: 4.15,
    colorHex: '#fde047',
    accentHex: '#67e8f9',
    combatProfile: { timeScale: 1.18, hitStopSec: 0.0, shakeAmp: 0.052, slashColor: '#fde047', slashScale: 1.18 },
    mounts: [{ key: 'stick_2h', file: 'stick_2h.glb', slot: 'two_hand' }],
    autoChain: [
      { step: 1, clip: 'Wep_stick_2h_Auto1', name: 'Baton Twirl Smite I', dmgMul: 0.88 },
      { step: 2, clip: 'Wep_stick_2h_Auto2', name: 'Reverse Spin Smite II', dmgMul: 0.96 },
      { step: 3, clip: 'Wep_stick_2h_Auto3', name: 'Radiant Baton Finisher III', dmgMul: 1.30 },
    ],
    glyphs: [
      { id: 'mini_smite', name: 'Solar Smite', clip: 'Wep_stick_2h_Smite', role: 'move', vfxKind: 'stick_smite', desc: 'Vertical golden-white smite pillar on target.' },
      { id: 'holy_wave', name: 'Holy Wave', clip: 'Wep_stick_2h_HolyWave', role: 'move', vfxKind: 'stick_wave', desc: 'Sweeping golden baton shock wave.' },
      { id: 'radiant_hymn', name: 'Radiant Hymn', clip: 'Wep_stick_2h_Hymn', role: 'move', vfxKind: 'stick_hymn', desc: 'Elevated holy choir light columns.' },
      { id: 'sanctuary_pillar', name: 'Heavenly Sanctum', clip: 'Wep_stick_2h_BuffPillar', role: 'buff', vfxKind: 'valor_pillar', desc: 'Blessed beacon aura around party.' },
      { id: 'halo_guard_stick', name: 'Halo Guard', clip: 'Wep_stick_2h_Guard', role: 'block', vfxKind: 'guard_holy', desc: 'Crossed 2-sided baton holy ward.' },
      { id: 'mend_stick', name: 'Mend / Purify', clip: 'Wep_stick_2h_Heal', role: 'heal', vfxKind: 'heal_holy', desc: 'Soft golden light restoration.' },
    ],
  },
  {
    id: 'gauntlet',
    classId: 'acolyte',
    clipStyle: 'gauntlet',
    label: 'Gauntlets (Astralyst)',
    shortLabel: 'Gauntlets',
    specBadge: 'Astralyst',
    scalingStat: 'physAtk',
    scalingLabel: 'Physical Attack',
    rangeMode: 'melee',
    attackRange: 1.48,
    colorHex: '#fbbf24',
    accentHex: '#fef08a',
    combatProfile: { timeScale: 1.32, hitStopSec: 0.035, shakeAmp: 0.075, slashColor: '#fbbf24', slashScale: 1.24 },
    mounts: [
      { key: 'gauntlet_r', file: 'gauntlet_r.glb', slot: 'main_hand' },
      { key: 'gauntlet_l', file: 'gauntlet_l.glb', slot: 'off_hand' },
    ],
    autoChain: [
      { step: 1, clip: 'Wep_gauntlet_Auto1', name: 'Left Snap Jab', dmgMul: 0.84 },
      { step: 2, clip: 'Wep_gauntlet_Auto2', name: 'Right Power Cross', dmgMul: 0.96 },
      { step: 3, clip: 'Wep_gauntlet_Auto3', name: 'Rising Astral Uppercut', dmgMul: 1.34 },
    ],
    glyphs: [
      { id: 'knuckle_burst', name: 'Knuckle Burst', clip: 'Wep_gauntlet_KnuckleBurst', role: 'move', vfxKind: 'gauntlet_burst', desc: 'Charged fist shock-ring & golden sparks.' },
      { id: 'three_hit_rush', name: 'Astral Rush Combo', clip: 'Wep_gauntlet_Combo', role: 'move', vfxKind: 'gauntlet_combo', desc: 'Jab-Cross-Haymaker fist shockwaves.' },
      { id: 'starfall_slam', name: 'Starfall Asal Slam', clip: 'Wep_gauntlet_StarfallSlam', role: 'move', vfxKind: 'gauntlet_slam', desc: 'Leaping dual-fist earth crater.' },
      { id: 'tiger_lunge', name: 'Meteor Lunge', clip: 'Wep_gauntlet_Lunge', role: 'move', vfxKind: 'gauntlet_lunge', desc: 'Forward fist impact torpedo.' },
      { id: 'halo_guard_knuckle', name: 'Peekaboo Guard', clip: 'Wep_gauntlet_Guard', role: 'block', vfxKind: 'guard_holy', desc: 'High boxer guard with golden chi ward.' },
      { id: 'mend_gauntlet', name: 'Mend / Purify', clip: 'Wep_gauntlet_Heal', role: 'heal', vfxKind: 'heal_holy', desc: 'Hands-clasp golden restoration.' },
    ],
  },
];

export function getClassWeaponStyles(classId) {
  return STAGING_WEAPON_STYLES.filter((w) => w.classId === classId);
}

export function getWeaponStyleDef(styleId, fallbackClassId = 'acolyte') {
  return (
    STAGING_WEAPON_STYLES.find((w) => w.id === styleId) ||
    getClassWeaponStyles(fallbackClassId)[0] ||
    STAGING_WEAPON_STYLES[0]
  );
}

export function resolveStyleMounts(styleId, reaverPairing = 'swd_axe') {
  const def = getWeaponStyleDef(styleId);
  if (def.supportsReaverPairing) {
    const pair = REAVER_PAIRINGS.find((p) => p.id === reaverPairing) || REAVER_PAIRINGS[1];
    return pair.mounts;
  }
  return def.mounts || [];
}

export function getStyleGlyphs(styleId) {
  return getWeaponStyleDef(styleId).glyphs || [];
}
