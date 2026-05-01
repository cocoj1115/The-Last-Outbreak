/**
 * Day 2 FireBuildingMinigame — dev mock config.
 *
 * Usage:
 *   1. Set DEV_MOCK_FIRE_BUILDING = false
 *   2. Change MOCK_CONFIG.startStep to jump to any step directly
 *      (`collect` → BootScene starts FireBuildingCollect; other steps → FireBuildingMinigame.)
 *   3. npm run dev / vite — BootScene picks this up and skips straight to the scene
 *
 * Keep DEV_MOCK_FIRE_BUILDING = false before committing.
 */

/** Master switch — set true to bypass OnboardingScene and jump straight to the minigame. */
export const DEV_MOCK_FIRE_BUILDING = true 

const STEP_ORDER = ['ren_intro', 'clear', 'collect', 'sort', 'stack', 'ignite', 'spread', 'sustain']

export const MOCK_CONFIG = {
  /** Which step to start from. One of STEP_ORDER above. */
  startStep:       'ignite',
  campsiteQuality: 'good',    // 'good' | 'poor'
  /** Passed to inkBridge `mg_fire_collect_score` — maps to DIFFICULTY_CONFIG (EASY|MEDIUM|HARD). */
  mockIgniteDifficulty: 'EASY', // 'EASY' | 'MEDIUM' | 'HARD'
  stamina:         5,

  // ── Pre-filled state for mid-flow starts ──────────────────────────────────

  /** Used when startStep >= 'sort' */
  mockCollectedMaterials: {
    items: [
      { id: 'dry_leaves',    type: 'tinder',    quality: 'GOOD' },
      { id: 'dry_grass',     type: 'tinder',    quality: 'GOOD' },
      { id: 'dry_grass_2',   type: 'tinder',    quality: 'GOOD' },
      { id: 'dry_twigs',     type: 'kindling',  quality: 'GOOD' },
      { id: 'thin_branch',   type: 'kindling',  quality: 'GOOD' },
      { id: 'thin_branch_2', type: 'kindling',  quality: 'GOOD' },
      { id: 'thick_branch',  type: 'fuel_wood', quality: 'GOOD' },
      { id: 'pine_cone',     type: 'fuel_wood', quality: 'MID'  },
    ],
    count: 8, tinder_count: 3, kindling_count: 3, fuel_count: 2,
  },

  /** Used when startStep >= 'stack' */
  mockSortedMaterials: {
    tinder:    [
      { id: 'dry_leaves',  quality: 'GOOD' },
      { id: 'dry_grass',   quality: 'GOOD' },
      { id: 'dry_grass_2', quality: 'GOOD' },
    ],
    kindling:  [
      { id: 'dry_twigs',     quality: 'GOOD' },
      { id: 'thin_branch',   quality: 'GOOD' },
      { id: 'thin_branch_2', quality: 'GOOD' },
    ],
    fuel_wood: [
      { id: 'thick_branch', quality: 'GOOD' },
      { id: 'pine_cone',    quality: 'MID'  },
    ],
  },

  /** Used when startStep >= 'ignite' */
  mockStackData: {
    bottom: [{ id: 'dry_leaves', quality: 'GOOD' }, { id: 'dry_grass', quality: 'GOOD' }],
    middle: [{ id: 'dry_twigs',  quality: 'GOOD' }],
    top:    [{ id: 'thick_branch', quality: 'GOOD' }],
  },
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

  registry.set('campsiteQuality', cfg.campsiteQuality)

  // groundCleared: set if we're past the clear step
  if (idx > STEP_ORDER.indexOf('clear')) {
    registry.set('groundCleared', true)
  }

  if (idx >= STEP_ORDER.indexOf('sort')) {
    registry.set('collectedMaterials', _deepClone(cfg.mockCollectedMaterials))
  }

  if (idx >= STEP_ORDER.indexOf('stack')) {
    registry.set('sortedMaterials', _deepClone(cfg.mockSortedMaterials))
  }

  if (idx >= STEP_ORDER.indexOf('ignite')) {
    registry.set('stackData',        _deepClone(cfg.mockStackData))
    registry.set('reserveMaterials', [])
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

/**
 * Payload for BootScene: FireBuildingMinigame for most steps; use startStep === 'collect'
 * to launch FireBuildingCollect instead (handled in BootScene).
 */
export function getFireBuildingMockPayload() {
  return {
    day:             2,
    startStep:       MOCK_CONFIG.startStep,
    campsiteQuality: MOCK_CONFIG.campsiteQuality,
  }
}

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
