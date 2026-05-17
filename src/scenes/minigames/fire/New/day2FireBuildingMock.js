/**
 * Day 2 FireBuildingMinigame — dev mock config.
 *
 * Usage:
 *   1. Set DEV_MOCK_FIRE_BUILDING = false before committing.
 *   2. Set MOCK_CONFIG.startStep — collect launches FireBuildingCollect; others → FireCampsiteMinigame.
 *   3. Optional MOCK_CONFIG.day — use `3` with `startStep: 'ignite'` for Day 3 cold-start from registry stack/sort.
 *   4. Use mockPreset `'ideal' | 'mixed' | 'bad'` for quantity‑consistent stacks / reserves / qualities.
 *   5. When active, FireBuildingMinigame emits DAY_ADVANCE so HUD shows the same day as MOCK_CONFIG.day.
 *   6. Day 3: `mockWindRingStones` seeds `day3WindRingRockPositions` (12 rocks); `mockExtraReserves` overrides
 *      reserve pile counts for sustain testing (when `startStep` ≥ ignite).
 *
 * Data flow (registry): Collect → collectedMaterials → Sort → sortedMaterials → Stack → stackData +
 * reserveMaterials → Ignite / Spread / Sustain (reserveMaterials stays live via `_syncStackLayRegistry`).
 */

/** Keep in sync with `DAY3_WIND_RING_INNER_R` / `DAY3_WIND_RING_OUTER_R` in FireBuildingMinigame.js */
const DAY3_WIND_RING_INNER_R = 148
const DAY3_WIND_RING_OUTER_R = 195

/**
 * Default scatter XY for rocks 0–11 — keep in sync with `_buildDay3Rocks` in FireBuildingMinigame.js
 * (pit-centred, `cx = W/2`, `cy = H * 0.46`).
 */
function _day3RockScatterPositions(W, H) {
  const cx = W / 2
  const cy = H * 0.46
  return [
    { x: cx - 400, y: cy + 135 },
    { x: cx - 315, y: cy + 198 },
    { x: cx - 230, y: cy + 152 },
    { x: cx - 135, y: cy + 225 },
    { x: cx - 40, y: cy + 188 },
    { x: cx + 55, y: cy + 232 },
    { x: cx + 150, y: cy + 168 },
    { x: cx + 238, y: cy + 215 },
    { x: cx + 330, y: cy + 158 },
    { x: cx + 418, y: cy + 198 },
    { x: cx - 360, y: cy + 95 },
    { x: cx + 360, y: cy + 102 },
  ]
}

/**
 * @param {number} W
 * @param {number} H
 * @param {number} nInRing 0 | 4 | 8
 * @returns {{ index: number, x: number, y: number }[]}
 */
function _buildDay3WindRingRockPositionsForMock(W, H, nInRing) {
  const scatter = _day3RockScatterPositions(W, H)
  const cx = W / 2
  const cy = H * 0.46
  const midR = (DAY3_WIND_RING_INNER_R + DAY3_WIND_RING_OUTER_R) / 2
  const out = []
  const ringIndices =
    nInRing === 8 ? [0, 1, 2, 3, 4, 5, 6, 7] : nInRing === 4 ? [0, 1, 2, 3] : []
  const scatterIndices = []
  for (let i = 0; i < 12; i++) {
    if (!ringIndices.includes(i)) scatterIndices.push(i)
  }
  for (let k = 0; k < ringIndices.length; k++) {
    const idx = ringIndices[k]
    const theta = (k / Math.max(ringIndices.length, 1)) * Math.PI * 2 - Math.PI / 2
    out.push({
      index: idx,
      x: cx + Math.cos(theta) * midR,
      y: cy + Math.sin(theta) * midR,
    })
  }
  for (const idx of scatterIndices) {
    const p = scatter[idx]
    out.push({ index: idx, x: p.x, y: p.y })
  }
  out.sort((a, b) => a.index - b.index)
  return out
}

/**
 * @param {{ tinder?: number, kindling?: number, fuel_wood?: number }} extra
 * @returns {Array<{ id: string, type: string, quality: string }>}
 */
function _buildMockExtraReserveMaterials(extra) {
  const tinder = extra.tinder ?? 0
  const kindling = extra.kindling ?? 0
  const fuel = extra.fuel_wood ?? 0
  /** @type {Array<{ id: string, type: string, quality: string }>} */
  const arr = []
  const tIds = ['dry_leaves', 'dry_grass', 'dry_grass_2', 'dry_leaves_rsv4', 'dry_grass_rsv5']
  for (let i = 0; i < tinder; i++) {
    arr.push({
      id: tIds[i] ?? `dry_grass_rsv_${i}`,
      type: 'tinder',
      quality: 'GOOD',
    })
  }
  const kIds = ['dry_twigs', 'thin_branch', 'thin_branch_2', 'thin_branch_rsv3', 'thin_branch_rsv4', 'thin_branch_rsv5']
  for (let i = 0; i < kindling; i++) {
    arr.push({
      id: kIds[i] ?? `thin_branch_rsv_${i}`,
      type: 'kindling',
      quality: 'GOOD',
    })
  }
  const fIds = ['thick_branch', 'pine_cone', 'pine_cone_rsv2', 'pine_cone_rsv3', 'pine_cone_rsv4']
  for (let i = 0; i < fuel; i++) {
    const id = fIds[i] ?? `pine_cone_rsv_${i}`
    arr.push({
      id,
      type: 'fuel_wood',
      quality: id.includes('pine') ? 'MID' : 'GOOD',
    })
  }
  return arr
}

/** Master switch — set true to bypass OnboardingScene and jump straight to the minigame. */
export const DEV_MOCK_FIRE_BUILDING = false

const STEP_ORDER = ['ren_intro', 'clear', 'collect', 'sort', 'stack', 'ignite', 'spread', 'sustain']
// Ink day2/day3: `# minigame:fire_campsite` → ren_intro → clear; collect only inside campsite (`devFireBuildChain`), not an Ink minigame tag.

/** Lay + reserve payloads keyed by QA preset — counts always sum to collectedMaterials.items.length (8). */
export const MOCK_PRESETS = {
  /** Full GOOD-ish lay; ignite reserve matches user spec (thin_branch_2 + pine_cone). */
  ideal: {
    collectedMaterials: {
      items: [
        { id: 'dry_leaves', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass_2', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_twigs', type: 'kindling', quality: 'GOOD' },
        { id: 'thin_branch', type: 'kindling', quality: 'GOOD' },
        { id: 'thin_branch_2', type: 'kindling', quality: 'GOOD' },
        { id: 'thick_branch', type: 'fuel_wood', quality: 'GOOD' },
        { id: 'pine_cone', type: 'fuel_wood', quality: 'MID' },
      ],
      count: 8,
      tinder_count: 3,
      kindling_count: 3,
      fuel_count: 2,
    },
    sortedMaterials: {
      tinder: [
        { id: 'dry_leaves', quality: 'GOOD' },
        { id: 'dry_grass', quality: 'GOOD' },
        { id: 'dry_grass_2', quality: 'GOOD' },
      ],
      kindling: [
        { id: 'dry_twigs', quality: 'GOOD' },
        { id: 'thin_branch', quality: 'GOOD' },
        { id: 'thin_branch_2', quality: 'GOOD' },
      ],
      fuel_wood: [
        { id: 'thick_branch', quality: 'GOOD' },
        { id: 'pine_cone', quality: 'MID' },
      ],
    },
    stackData: {
      bottom: [
        { id: 'dry_leaves', quality: 'GOOD' },
        { id: 'dry_grass', quality: 'GOOD' },
        { id: 'dry_grass_2', quality: 'GOOD' },
      ],
      middle: [
        { id: 'dry_twigs', quality: 'GOOD' },
        { id: 'thin_branch', quality: 'GOOD' },
      ],
      top: [{ id: 'thick_branch', quality: 'GOOD' }],
    },
    reserveMaterials: [
      { id: 'thin_branch_2', type: 'kindling', quality: 'GOOD' },
      { id: 'pine_cone', type: 'fuel_wood', quality: 'MID' },
    ],
  },

  /** Softer MID pieces — tighter ignite clicks, spread margin lower. */
  mixed: {
    collectedMaterials: {
      items: [
        { id: 'dry_leaves', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass_2', type: 'tinder', quality: 'MID' },
        { id: 'dry_twigs', type: 'kindling', quality: 'GOOD' },
        { id: 'thin_branch', type: 'kindling', quality: 'MID' },
        { id: 'thin_branch_2', type: 'kindling', quality: 'GOOD' },
        { id: 'thick_branch', type: 'fuel_wood', quality: 'GOOD' },
        { id: 'pine_cone', type: 'fuel_wood', quality: 'MID' },
      ],
      count: 8,
      tinder_count: 3,
      kindling_count: 3,
      fuel_count: 2,
    },
    sortedMaterials: {
      tinder: [
        { id: 'dry_leaves', quality: 'GOOD' },
        { id: 'dry_grass', quality: 'GOOD' },
        { id: 'dry_grass_2', quality: 'MID' },
      ],
      kindling: [
        { id: 'dry_twigs', quality: 'GOOD' },
        { id: 'thin_branch', quality: 'MID' },
        { id: 'thin_branch_2', quality: 'GOOD' },
      ],
      fuel_wood: [
        { id: 'thick_branch', quality: 'GOOD' },
        { id: 'pine_cone', quality: 'MID' },
      ],
    },
    stackData: {
      bottom: [
        { id: 'dry_leaves', quality: 'GOOD' },
        { id: 'dry_grass', quality: 'GOOD' },
        { id: 'dry_grass_2', quality: 'MID' },
      ],
      middle: [
        { id: 'dry_twigs', quality: 'GOOD' },
        { id: 'thin_branch', quality: 'MID' },
      ],
      top: [{ id: 'thick_branch', quality: 'GOOD' }],
    },
    reserveMaterials: [
      { id: 'thin_branch_2', type: 'kindling', quality: 'GOOD' },
      { id: 'pine_cone', type: 'fuel_wood', quality: 'MID' },
    ],
  },

  /**
   * BAD kindling on lay → spread tends stuck‑kindling; spare GOOD kindling in reserve for remediation.
   * Sustain reserve only MID pine — tight backup wood.
   */
  bad: {
    collectedMaterials: {
      items: [
        { id: 'dry_leaves', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass_2', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_twigs', type: 'kindling', quality: 'GOOD' },
        { id: 'thin_branch', type: 'kindling', quality: 'BAD' },
        { id: 'thin_branch_2', type: 'kindling', quality: 'BAD' },
        { id: 'thick_branch', type: 'fuel_wood', quality: 'GOOD' },
        { id: 'pine_cone', type: 'fuel_wood', quality: 'MID' },
      ],
      count: 8,
      tinder_count: 3,
      kindling_count: 3,
      fuel_count: 2,
    },
    sortedMaterials: {
      tinder: [
        { id: 'dry_leaves', quality: 'GOOD' },
        { id: 'dry_grass', quality: 'GOOD' },
        { id: 'dry_grass_2', quality: 'GOOD' },
      ],
      kindling: [
        { id: 'dry_twigs', quality: 'GOOD' },
        { id: 'thin_branch', quality: 'BAD' },
        { id: 'thin_branch_2', quality: 'BAD' },
      ],
      fuel_wood: [
        { id: 'thick_branch', quality: 'GOOD' },
        { id: 'pine_cone', quality: 'MID' },
      ],
    },
    stackData: {
      bottom: [
        { id: 'dry_leaves', quality: 'GOOD' },
        { id: 'dry_grass', quality: 'GOOD' },
        { id: 'dry_grass_2', quality: 'GOOD' },
      ],
      middle: [
        { id: 'thin_branch', quality: 'BAD' },
        { id: 'thin_branch_2', quality: 'BAD' },
      ],
      top: [{ id: 'thick_branch', quality: 'GOOD' }],
    },
    reserveMaterials: [
      { id: 'dry_twigs', type: 'kindling', quality: 'GOOD' },
      { id: 'pine_cone', type: 'fuel_wood', quality: 'MID' },
    ],
  },
}

export const MOCK_CONFIG = {
  /** `2` | `3` — set to 3 to run Day 3 flow. */
  day: 3,
  startStep: 'ignite',
  /** `'ideal'` | `'mixed'` | `'bad'` — drives collected / sorted / stack / reserve coherence. */
  mockPreset: 'ideal',
  campsiteQuality: 'good',
  mockIgniteDifficulty: 'EASY',
  mockFireQuality: 'strong',
  stamina: 5,

  spreadDevScenario: null,
  spreadTestReserveKindling: false,

  // Day 3 fields (only used when day === 3)
  /** `'north'` | `'south'` | `'east'` | `'west'` | null (random) */
  windDirection: null,
  /** Dev-only sustain tests: freeze windShield outcome (`'good'` | `'partial'` | `'none'`). */
  mockWindShield: null,
  /**
   * Seeds `day3WindRingRockPositions` when day 3 and `startStep` ≥ ignite — rock layout for wind ring QA.
   * `'full'` (8 in ring) | `'partial'` (4) | `'none'` | `null` (skip, legacy behavior).
   */
  mockWindRingStones: /** @type {'full' | 'partial' | 'none' | null} */ ('full'),
  /**
   * Overrides preset `reserveMaterials` with explicit counts (unique reserve ids for hydration).
   * Default gives 7 pieces for 45s sustain tests: tinder 2, kindling 3, fuel 2.
   */
  mockExtraReserves: /** @type {{ tinder: number, kindling: number, fuel_wood: number } | null} */ ({
    tinder:    2,
    kindling:  3,
    fuel_wood: 2,
  }),
}

// ── Registry seeding ──────────────────────────────────────────────────────────

/**
 * Write mock state into the Phaser registry before launching the scene.
 * Called from BootScene.create() when DEV_MOCK_FIRE_BUILDING is true.
 * @param {Phaser.Data.DataManager} registry
 * @param {{ width: number, height: number }} [view] — pass `this.scale.width/height` so ring rock XY match the campsite pit.
 */
export function seedFireBuildingMockRegistry(registry, view) {
  const cfg = MOCK_CONFIG
  const idx = STEP_ORDER.indexOf(cfg.startStep)
  const presetKey = cfg.mockPreset ?? 'ideal'
  const preset = MOCK_PRESETS[presetKey] ?? MOCK_PRESETS.ideal

  registry.set('campsiteQuality', cfg.campsiteQuality)

  const day = cfg.day ?? 2
  if (day >= 3 && cfg.mockWindShield && ['good', 'partial', 'none'].includes(cfg.mockWindShield)) {
    registry.set('windShield', cfg.mockWindShield)
  }

  if (cfg.startStep === 'clear') {
    registry.set('groundCleared', false)
  } else if (cfg.startStep === 'collect') {
    registry.set('groundCleared', true)
  } else if (idx > STEP_ORDER.indexOf('clear')) {
    registry.set('groundCleared', true)
  }

  if (idx >= STEP_ORDER.indexOf('sort')) {
    registry.set('collectedMaterials', _deepClone(preset.collectedMaterials))
  }

  if (idx >= STEP_ORDER.indexOf('stack')) {
    registry.set('sortedMaterials', _deepClone(preset.sortedMaterials))
  }

  if (idx >= STEP_ORDER.indexOf('ignite')) {
    let sd = _deepClone(preset.stackData)
    if (cfg.spreadTestReserveKindling) {
      sd.middle = [
        { id: 'thin_branch', quality: 'BAD' },
        { id: 'thin_branch_2', quality: 'BAD' },
      ]
    }
    registry.set('stackData', sd)
    let reserves = _deepClone(preset.reserveMaterials)
    if (day >= 3 && cfg.mockExtraReserves && typeof cfg.mockExtraReserves === 'object') {
      reserves = _buildMockExtraReserveMaterials(cfg.mockExtraReserves)
    }
    registry.set('reserveMaterials', reserves)
  }

  if (
    day >= 3 &&
    idx >= STEP_ORDER.indexOf('ignite') &&
    cfg.mockWindRingStones !== null &&
    typeof cfg.mockWindRingStones === 'string'
  ) {
    const W = view?.width ?? 1280
    const H = view?.height ?? 720
    const mode = cfg.mockWindRingStones
    const nInRing = mode === 'full' ? 8 : mode === 'partial' ? 4 : 0
    registry.set('day3WindRingRockPositions', _buildDay3WindRingRockPositionsForMock(W, H, nInRing))
  }

  if (idx >= STEP_ORDER.indexOf('spread')) {
    registry.set('ignitionSuccess', true)
    registry.set('fireQuality', cfg.mockFireQuality ?? 'strong')
  }

  const cq = cfg.campsiteQuality === 'poor' ? 'poor' : 'good'
  const vars = {
    campsite_quality: cq,
    mg_fire_collect_score: cfg.mockIgniteDifficulty ?? 'EASY',
  }
  registry.set('inkBridge', {
    getVariable: (key) => vars[key] ?? null,
    setVariable: (key, value) => {
      vars[key] = value
    },
  })
}

export function getFireBuildingMockPayload() {
  const WIND_DIRS = ['north', 'south', 'east', 'west']
  const windDirection =
    MOCK_CONFIG.windDirection ??
    WIND_DIRS[Math.floor(Math.random() * WIND_DIRS.length)]

  return {
    day:                 MOCK_CONFIG.day ?? 2,
    startStep:           MOCK_CONFIG.startStep,
    campsiteQuality:     MOCK_CONFIG.campsiteQuality,
    spreadDevScenario:   MOCK_CONFIG.spreadDevScenario ?? null,
    mockPreset:          MOCK_CONFIG.mockPreset ?? 'ideal',
    windDirection:       (MOCK_CONFIG.day ?? 2) >= 3 ? windDirection : undefined,
    mockWindShield:      (MOCK_CONFIG.day ?? 2) >= 3 ? MOCK_CONFIG.mockWindShield : undefined,
    mockWindRingStones:  (MOCK_CONFIG.day ?? 2) >= 3 ? MOCK_CONFIG.mockWindRingStones : undefined,
    mockExtraReserves:   (MOCK_CONFIG.day ?? 2) >= 3 ? MOCK_CONFIG.mockExtraReserves : undefined,
  }
}

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
