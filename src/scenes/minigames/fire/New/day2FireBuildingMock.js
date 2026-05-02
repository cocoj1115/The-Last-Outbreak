/**
 * Day 2 FireBuildingMinigame — dev mock config.
 *
 * Usage:
 *   1. Set DEV_MOCK_FIRE_BUILDING = false before committing.
 *   2. Set MOCK_CONFIG.startStep — collect launches FireBuildingCollect; others → FireCampsiteMinigame.
 *   3. Use mockPreset `'ideal' | 'mixed' | 'bad'` for quantity‑consistent stacks / reserves / qualities.
 *
 * Data flow (registry): Collect → collectedMaterials → Sort → sortedMaterials → Stack → stackData +
 * reserveMaterials → Ignite / Spread / Sustain (reserveMaterials stays live via `_syncStackLayRegistry`).
 */

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
  startStep: 'ignite',
  /** `'ideal'` | `'mixed'` | `'bad'` — drives collected / sorted / stack / reserve coherence. */
  mockPreset: 'ideal',
  campsiteQuality: 'good',
  mockIgniteDifficulty: 'EASY',
  mockFireQuality: 'strong',
  stamina: 5,

  spreadDevScenario: null,
  spreadTestReserveKindling: false,
}

// ── Registry seeding ──────────────────────────────────────────────────────────

/**
 * Write mock state into the Phaser registry before launching the scene.
 * Called from BootScene.create() when DEV_MOCK_FIRE_BUILDING is true.
 * @param {Phaser.Data.DataManager} registry
 */
export function seedFireBuildingMockRegistry(registry) {
  const cfg = MOCK_CONFIG
  const idx = STEP_ORDER.indexOf(cfg.startStep)
  const presetKey = cfg.mockPreset ?? 'ideal'
  const preset = MOCK_PRESETS[presetKey] ?? MOCK_PRESETS.ideal

  registry.set('campsiteQuality', cfg.campsiteQuality)

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
    registry.set('reserveMaterials', _deepClone(preset.reserveMaterials))
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
  return {
    day:               2,
    startStep:         MOCK_CONFIG.startStep,
    campsiteQuality:   MOCK_CONFIG.campsiteQuality,
    spreadDevScenario: MOCK_CONFIG.spreadDevScenario ?? null,
    mockPreset:        MOCK_CONFIG.mockPreset ?? 'ideal',
  }
}

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
