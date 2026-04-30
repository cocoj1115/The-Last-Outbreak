/**
 * Day2 fire — mock registry + Ink variables for local testing without narrative.
 *
 * How to use
 * 1. Set `DEV_MOCK_DAY2_FIRE = true` (keep `DEV_PATH_B_DAY2_FIRE = false` in BootScene).
 * 2. For the full fire-build loop without Ink, keep `fullChain: true` (default).
 *    Flow: FireCampsite (clear) → FireCollect → FireCampsite (sort → stack → ignite → sustain).
 * 3. For a single step, set `fullChain: false` and set `DAY2_FIRE_MOCK_START` (scene key below).
 * 4. Edit `DAY2_FIRE_MOCK` ink + registry when not using `fullChain` pre-filled materials.
 *
 * `DAY2_FIRE_MOCK_START` (when `fullChain` is false):
 *   FireCollectMinigame | FireCampsiteMinigame | …
 *   If you start `FireCampsiteMinigame`, set `campsiteStartStep` (e.g. `ignite`) to jump mid-flow.
 *
 * Notes
 * - `mg_fire_collect_score` must be EASY | MEDIUM | HARD (Collect overwrites when finished).
 * - With `fullChain`, `collectedMaterials` / `groundCleared` in registry are reset at boot.
 * - `devQuickFireChain`: Collect → Ignite only (skipped when `fullChain` is true).
 */

/** Set `true` while tuning Day2 fire minigames; keep `false` for normal boot. */
export const DEV_MOCK_DAY2_FIRE = false

/** Phaser scene key when `fullChain` is false. Ignored when `fullChain` is true (starts at Clear). */
export const DAY2_FIRE_MOCK_START = 'FireCollectMinigame'

/** Mock payload — edit fields here. */
export const DAY2_FIRE_MOCK = {
  day: 2,
  /**
   * Run: FireCampsite (clear → dev handoff to collect → sort → stack → ignite → sustain).
   */
  fullChain: true,
  /**
   * When starting `FireCampsiteMinigame` from mock, optional step override:
   * `clear` | `sort` | `stack` | `ignite` | `sustain`. Usually leave null (clear).
   */
  campsiteStartStep: null,
  /** Passed into a small inkBridge stub (same shape as Path B). */
  ink: {
    campsite_quality: 'good', // 'good' | 'poor' (poor + HARD = rain in Ignite)
    mg_fire_collect_score: 'MEDIUM', // EASY | MEDIUM | HARD — overwritten after Collect
  },
  /** Registry keys used by Clear / Sort / Ignite / Sustain. */
    registry: {
    fuelStock: 5,
    groundCleared: true,
    devQuickFireChain: false,
    collectedMaterials: [
      { id: 'dry_twigs', quality: 'GOOD' },
      { id: 'dry_leaves', quality: 'GOOD' },
      { id: 'thick_branch', quality: 'GOOD' },
      { id: 'pine_cone', quality: 'MID' },
    ],
  },
}

/** First scene after Boot when using mock mode. */
export function resolveDay2FireMockEntryScene() {
  if (DAY2_FIRE_MOCK.fullChain) return 'FireCampsiteMinigame'
  return DAY2_FIRE_MOCK_START
}

/** Payload for `scene.start(entry, payload)`. */
export function getDay2FireMockBootPayload() {
  const m = DAY2_FIRE_MOCK
  const payload = { day: m.day }
  const key = resolveDay2FireMockEntryScene()
  if (key === 'FireCampsiteMinigame' && m.campsiteStartStep) {
    payload.startStep = m.campsiteStartStep
  }
  return payload
}

function createInkBridgeStub(inkVars) {
  const _vars = { ...inkVars }
  return {
    getVariable(name) {
      return _vars[name]
    },
    setVariable(name, value) {
      _vars[name] = value
    },
  }
}

/**
 * @param {Phaser.Data.DataManager} registry `this.registry` from BootScene
 */
export function seedDay2FireMockRegistry(registry) {
  const mock = DAY2_FIRE_MOCK
  registry.set('inkBridge', createInkBridgeStub(mock.ink))

  const reg = { ...mock.registry }
  if (mock.fullChain) {
    reg.devQuickFireChain = false
    reg.devFireBuildChain = true
    reg.groundCleared = false
    reg.collectedMaterials = []
  } else {
    reg.devFireBuildChain = false
  }

  for (const [key, value] of Object.entries(reg)) {
    if (key === 'collectedMaterials' && Array.isArray(value)) {
      registry.set(
        key,
        value.map((m) => ({ ...m })),
      )
    } else {
      registry.set(key, value)
    }
  }
}
