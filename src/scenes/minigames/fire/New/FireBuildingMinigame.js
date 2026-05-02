import Phaser from 'phaser'
import { GameEvents } from '../../../../systems/GameEvents.js'
import { DialogueBox } from './DialogueBox.js'
import { COLLECT_SESSION_RESUME_CAMPSITE, COLLECT_TARGETS } from './FireBuildingCollect.js'
import { FIRE_CAMPSITE_SCENE_KEY } from './fireSceneKeys.js'

// ─── Sort configuration ───────────────────────────────────────────────────────

const CORRECT_ZONE = {
  dry_leaves:   'tinder',
  dry_grass:    'tinder',
  dry_twigs:    'kindling',
  pine_cone:    'fuel_wood',
  thick_branch: 'fuel_wood',
  thin_branch:  'kindling',
}

const SORT_ZONE_DEFS = [
  { id: 'tinder',    label: 'Tinder',    description: 'Catches the spark. Lightest, driest.', tint: 0x8a6020 },
  { id: 'kindling',  label: 'Kindling',  description: 'Grows the flame. Small and dry.',      tint: 0x6a5018 },
  { id: 'fuel_wood', label: 'Fuel Wood', description: 'Sustains the fire. Dense and heavy.',  tint: 0x4a3810 },
]

/** Fallback when id is not in CORRECT_ZONE — mirrors collect ids / dev suffix variants (e.g. dry_grass_2). */
function sortZoneFromCollectMaterialId(id) {
  if (!id || typeof id !== 'string') return null
  if (id === 'dry_twigs' || id.startsWith('dry_twigs')) return 'kindling'
  if (id === 'dry_leaves' || id.startsWith('dry_leaves')) return 'tinder'
  if (id === 'dry_grass' || id.startsWith('dry_grass')) return 'tinder'
  if (id === 'pine_cone' || id.startsWith('pine_cone')) return 'fuel_wood'
  if (id === 'thick_branch' || id.startsWith('thick_branch')) return 'fuel_wood'
  if (id.startsWith('thin_branch')) return 'kindling'
  return null
}

/** Registry / legacy payloads may use `fuel`; stack layers always use `fuel_wood`. */
function normalizeStackSortZoneId(z) {
  if (z === 'fuel') return 'fuel_wood'
  return z
}

/** Correct sort bucket for a material id (explicit map + collect-style suffix ids). */
function correctSortZoneForMatId(id) {
  return CORRECT_ZONE[id] ?? sortZoneFromCollectMaterialId(id)
}

/** Same buckets as FireCollectMinigame buildCollectCounts (registry shape). */
function collectRegistryCounts(items) {
  const count = { tinder: 0, kindling: 0, fuel: 0, unusable: 0, total: items.length }
  for (const m of items) {
    const id = m.id
    if (id === 'dry_leaves' || id === 'dry_grass') count.tinder++
    else if (id === 'dry_twigs') count.kindling++
    else if (id === 'pine_cone' || id === 'thick_branch') count.fuel++
    else count.unusable++
  }
  return count
}

/** Wrong drop: Ren 3 bubbles keyed `correctZone_attemptedZone` (day2_firemaking_dev_spec §4.3). */
const SORT_WRONG_REN_LINES = {
  kindling_tinder: [
    'Hmm — does this feel right? Tinder should crumble in my hand.',
    'This one... I can snap it, but it holds its shape.',
    'Maybe this belongs somewhere else.',
  ],
  tinder_fuel_wood: [
    'Wait. Fuel wood needs to burn for a long time.',
    'This is so light it would be gone in seconds.',
    'I do not think this is fuel.',
  ],
  fuel_wood_kindling: [
    'This feels heavy. Kindling should be thin, easy to snap.',
    'I can barely bend this.',
    'Maybe I should rethink where this goes.',
  ],
  tinder_kindling: [
    'This is pretty fine — crumbles right away.',
    'Kindling has more structure than that.',
    'This might be more useful somewhere else.',
  ],
  kindling_fuel_wood: [
    'This is not heavy enough to be fuel.',
    'It would burn through too fast to keep a fire going all night.',
    'Feels more like something in between.',
  ],
  fuel_wood_tinder: [
    'That is way too thick to catch a spark.',
    'Tinder needs to be the finest, lightest material.',
    'This one has a different purpose.',
  ],
}

/** First correct piece into each zone — Ren 2 bubbles (spec §4.3). */
const SORT_FIRST_CORRECT_REN = {
  tinder: [
    'Light, dry, falls apart in my fingers.',
    'Tinder — that is what catches a spark.',
  ],
  kindling: [
    'Thin enough to catch from tinder, strong enough to burn a little longer.',
    'That is good kindling.',
  ],
  fuel_wood: [
    'Heavy, solid.',
    'Fuel wood like this will keep the fire going once it is established.',
  ],
}

/** Sort complete — Ren closing lines (spec §4.3). */
const SORT_COMPLETE_REN_LINES = [
  'Good — tinder, kindling, fuel, all separated.',
  'Now when we build the lay, everything is right here, grouped and ready.',
  'No guessing, no wasting time.',
  'That is the difference between a fire that goes up smooth and one you are still fighting with when the rain hits.',
]

/** Lay complete summary — Ren (spec §4.4). */
const STACK_LAY_SUMMARY_REN_LINES = [
  'Bottom to top — fine to heavy. Air between each piece.',
  'That is a fire that will actually breathe.',
  'Nice.',
]

/** §4.4 wrong target layer while dragging — Ren lines. */
const STACK_BOTTOM_WRONG_REN = [
  'Think smaller.',
  'The spark lands here — what is the only thing fine enough to catch it?',
]
const STACK_MIDDLE_WRONG_REN = [
  'This layer bridges the flame upward.',
  'Too light and it is gone. Too heavy and it will not catch.',
  'What fits?',
]
const STACK_TOP_WRONG_REN = [
  'The top needs to burn long and slow.',
  'What is heavy enough for that?',
]

/** §4.2 first wet BAD pickup — forced Ren (reuse for sort/stack unusable taps). */
const WET_MATERIAL_REN_LINES = [
  'Feel that? Heavy. Damp inside.',
  'Wet material will smother a flame, not feed it.',
  'Leave it.',
]

function sortWrongRenLines(correctZone, attemptedZone) {
  return SORT_WRONG_REN_LINES[`${correctZone}_${attemptedZone}`] ?? []
}

function stackWrongLayerRenLines(needZone, attemptedZone) {
  if (
    needZone === 'tinder' &&
    (attemptedZone === 'kindling' || attemptedZone === 'fuel_wood')
  )
    return STACK_BOTTOM_WRONG_REN
  if (
    needZone === 'kindling' &&
    (attemptedZone === 'tinder' || attemptedZone === 'fuel_wood')
  )
    return STACK_MIDDLE_WRONG_REN
  if (
    needZone === 'fuel_wood' &&
    (attemptedZone === 'tinder' || attemptedZone === 'kindling')
  )
    return STACK_TOP_WRONG_REN
  return []
}

/** Wrong material category for the pit band being filled (want vs pit zone id). */
function stackMaterialMismatchRenLines(matZone, pitZone) {
  return stackWrongLayerRenLines(pitZone, matZone)
}

function assertSortedMaterialsShape(sorted, ctx = '') {
  if (!import.meta.env.DEV) return
  const ok =
    sorted &&
    typeof sorted === 'object' &&
    Array.isArray(sorted.tinder) &&
    Array.isArray(sorted.kindling) &&
    Array.isArray(sorted.fuel_wood)
  console.assert(ok, `[FireBuilding] sortedMaterials shape ${ctx}`, sorted)
}

function assertStackRegistryShape(registry, ctx = '') {
  if (!import.meta.env.DEV) return
  const sd = registry?.get?.('stackData')
  const rs = registry?.get?.('reserveMaterials')
  const sdOk =
    sd &&
    Array.isArray(sd.bottom) &&
    Array.isArray(sd.middle) &&
    Array.isArray(sd.top)
  console.assert(sdOk, `[FireBuilding] stackData shape ${ctx}`, sd)
  console.assert(Array.isArray(rs), `[FireBuilding] reserveMaterials array ${ctx}`, rs)
}

// ─── Stack configuration ─────────────────────────────────────────────────────

/** Which fire-pit layer each sort zone belongs on (ignite / feedback). */
const STACK_ZONE_TO_LAYER = {
  tinder:    'bottom',
  kindling:  'middle',
  fuel_wood: 'top',
}

/** Physical lay order: bottom → middle → top (matches sort-zone ids). */
const STACK_LAYER_ORDER = ['tinder', 'kindling', 'fuel_wood']

/** layerId on material state → stack zone (rebuild cross-section after trial ignite). */
const LAYER_ID_TO_STACK_ZONE = {
  bottom: 'tinder',
  middle: 'kindling',
  top: 'fuel_wood',
}

const STACK_MIN_BOTTOM = 2
const STACK_MIN_MIDDLE = 1
const STACK_MIN_TOP    = 1

const STACK_CARD_W = 142
const STACK_CARD_H = 40
const STACK_CS_SQ  = 14
const STACK_CS_GAP = 4

/** Stack cross-section square colour by sorted material category (placeholder icons). */
const STACK_MAT_VISUAL = {
  tinder:    0xf5e6a8,
  kindling:  0x8b7355,
  fuel_wood: 0x3a2418,
}

// Ring radii for pit guide graphics; also used as stack-step fallback hit targets (maps to Bottom/Middle/Top).
const STACK_BOTTOM_R = 45
const STACK_MIDDLE_R = 80
const STACK_TOP_R    = 115
/** Blow halo stroke sits just outside the ring for the active spark layer (matches STRIKE burst radius). */
const IGNITE_HALO_RING_PAD = 12

/** Ignite HUD progress bar sits just below outer pit ring (§4.5 UI). */
const IGNITE_BAR_RING_GAP = 18

// ─── Ignite configuration ────────────────────────────────────────────────────

/** Difficulty preset from collect score — mapped to decay + spark variance (§4.5). */
const DIFFICULTY_CONFIG = {
  EASY:   { decayMs: 1000, decayPerTick: 1, sparkMin: 1, sparkMax: 3, rainInterference: false },
  MEDIUM: { decayMs: 720, decayPerTick: 1, sparkMin: 1, sparkMax: 3, rainInterference: false },
  HARD:   { decayMs: 520, decayPerTick: 2, sparkMin: 1, sparkMax: 2, rainInterference: true },
}

const IGNITE_PROGRESS_MAX = 100
/** Fallback STRIKE+Blow cap when stackData.bottom is missing or empty (dev jump / guard). */
const MAX_CLICKS            = 36
function normalizeMatQualityTier(q) {
  const s = String(q ?? '').toUpperCase()
  if (s === 'GOOD' || s === 'MID' || s === 'BAD') return s
  return 'MID'
}

/** Ignite STRIKE+Blow budget contributed by one bottom-layer tinder (`registry.stackData.bottom`). */
function igniteClicksForBottomTinderItem(item) {
  const q = normalizeMatQualityTier(item?.quality)
  if (q === 'GOOD') return 10
  if (q === 'MID') return 6
  return 3
}

function sumIgniteClickBudgetFromBottom(bottomArr) {
  if (!Array.isArray(bottomArr)) return 0
  let t = 0
  for (const item of bottomArr) t += igniteClicksForBottomTinderItem(item)
  return t
}

/** §4.6 spread — aggregate layer material quality for auto outcome. */
function spreadLayerQualityScore(entries) {
  if (!Array.isArray(entries)) return 0
  let s = 0
  for (const m of entries) {
    const q = normalizeMatQualityTier(m?.quality)
    if (q === 'GOOD') s += 3
    else if (q === 'MID') s += 2
    else s += 1
  }
  return s
}

/** Placeholder BG keys — swap for BG-SPREAD-* assets later. */
const SPREAD_PLACEHOLDER = {
  spread1: { fill: 0x261810, caption: 'BG-SPREAD-1 — tinder burning' },
  spread2: { fill: 0x352018, caption: 'BG-SPREAD-2 — tinder + kindling' },
  spread3: { fill: 0x442818, caption: 'BG-SPREAD-3 — full fire' },
  stuck1:  { fill: 0x141016, caption: 'BG-SPREAD-STUCK-1 — flame at bottom' },
  stuck2:  { fill: 0x18141a, caption: 'BG-SPREAD-STUCK-2 — middle burns, top cold' },
}

const IDLE_THRESHOLD        = 2000

// ─── Sustain configuration ───────────────────────────────────────────────────

const SEGMENT_COUNT = 5

/** Fixed night length (§ rebalance): progress bar reaches full in 30s regardless of lay size. */
const SUSTAIN_NIGHT_TOTAL_MS = 30000

const DRAIN_MS = {
  good_cleared: 4000,
  good_dirty:   3500,
  poor_cleared: 3000,
  poor_dirty:   2500,
}

/** Flood loop interval when `_campsiteQuality === 'poor'` only (`_startFloodTimer`). */
const FLOOD_INTERVAL_CLEARED = 12000
const FLOOD_INTERVAL_DIRTY   = 10000
const FLOOD_BG_DURATION      = 1200

// ─── Background colours ──────────────────────────────────────────────────────

const BG_NIGHT       = 0x0a0c08
const BG_FIRE_STRONG = 0x1a0e04
const BG_FIRE_WEAK   = 0x06080a
const BG_FLOOD       = 0x080f18

// ─── Visual constants ────────────────────────────────────────────────────────

const MAT_COLOR     = { GOOD: 0x8a7050, MID: 0x5a4a30, BAD: 0x2a1e10 }
const ITEM_W        = 72
const ITEM_H        = 72
/** Legacy HUD anchor — kept for any `_sortPackUiNodes` cleanup; scatter uses screen-relative rects. */
const SORT_PACK_HUD_X              = 52
const SORT_PACK_HUD_Y_FROM_BOTTOM  = 48

const ZONE_W        = 210
const ZONE_H        = 100
/** Lay-preview placeholders (`sort` tutorial; `spread` remediation layout). Ignite uses live `_matStates` sprites only. */
const SORT_ZONE_LAY_PREVIEW_STEPS = ['sort', 'spread']
/** Stack-phase piles above STRIKE / BLOW (depth ~18) so pointer picks draggable fuel, not pit chrome. */
const STACK_SORTED_PILE_DEPTH = 24
/** Spread stuck-path spare drag — above DialogueBox (4500) + lay-preview (≤14) so hits reach real piles. */
const SPREAD_REMEDIATION_DRAG_DEPTH = 4620
/** Sustain reserve panels — below draggable pile sprites so wood receives drag. */
const SUSTAIN_RESERVE_PANEL_DEPTH = 22
/** Dim/unavailable reserve piles during sustain (BAD / not in backup keys). */
const SUSTAIN_RESERVE_DIM_PILE_DEPTH = 19
/** Active reserve wood — above panels so hits go to sprites. */
const SUSTAIN_RESERVE_PILE_DEPTH = 30
/** @deprecated label-only; panels use `SUSTAIN_RESERVE_PANEL_DEPTH`. */
const SUSTAIN_BACKUP_UI_DEPTH = SUSTAIN_RESERVE_PANEL_DEPTH

/** Pit-relative STRIKE/BLOW placement — stack lay preview + ignite mechanics share this geometry. */
const CAMPSITE_FLINT_OFF_X = 185
const CAMPSITE_FLINT_HALF_W = 55
const CAMPSITE_STRIKE_BLOW_GAP = 12
const CAMPSITE_BLOW_W = 88
const CAMPSITE_BLOW_H = 110
function campsiteBlowCenterX(pitX) {
  return pitX + CAMPSITE_FLINT_OFF_X + CAMPSITE_FLINT_HALF_W + CAMPSITE_STRIKE_BLOW_GAP + CAMPSITE_BLOW_W / 2
}
const SEG_COLOR_LIT = 0xe8a020
const SEG_COLOR_DIM = 0x3a2e18

// ─── Scene ───────────────────────────────────────────────────────────────────

/** Unified Day 2–3 fire campsite flow; registered under legacy Ink key (see `fireSceneKeys.js`). */
export class FireBuildingMinigame extends Phaser.Scene {
  constructor() {
    super({ key: FIRE_CAMPSITE_SCENE_KEY })
  }

  init(data) {
    this.day       = data?.day ?? 2
    this.step      = null
    this._startStep = data?.startStep ?? null
    /** Mock / QA: `'clean'` | `'stuck_kindling'` | `'stuck_fuel'` forces §4.6 branch. */
    this._spreadDevScenario = data?.spreadDevScenario ?? null
    this._resumeStackAfterCollect = data?.resumeStackAfterCollect === true
    /** Mid-campsite forest trip — explicit `{ id, quality }[]` delta (preferred over inferring from registry). */
    this._forestCollectNewItems = Array.isArray(data?.forestCollectNewItems)
      ? data.forestCollectNewItems.map((m) => ({
          id: m.id,
          quality: m.quality,
        }))
      : null

    // Material tracking — id → state object
    this._matStates   = {}
    this._sortableIds = []

    // Clear step
    this._debrisRemaining = 6
    this._debrisObjects   = []
    this._clearHandoffStarted = false
    this._clearCompleteTimer = null
    this._gatherDialogueTimer = null
    this._gatherDialogueDone = false
    this._forestHotspot = null
    this._forestPulseTween = null

    // Sort step
    this._sortedCount  = 0
    this._sortHadError = false
    this._sortFeedbackLocked = false
    /** First Ren praise per zone once player sorts correctly into that pile (spec §4.3). */
    this._sortRenZoneIntroShown = { tinder: false, kindling: false, fuel_wood: false }

    // Stack step — bottom boxes (same geometry as sort); counts per sort-zone id
    this._stackHadError           = false
    this._stackDropCount          = { tinder: 0, kindling: 0, fuel_wood: 0 }
    this._stackUnitIndexInZone    = { tinder: 0, kindling: 0, fuel_wood: 0 }
    this._stackBuildFireBg        = null
    this._stackBuildFireTxt       = null
    this._stackCategoryCards      = []
    this._stackCrossSectionCont   = null
    this._stackCrossSectionGeom   = null
    this._stackLayerPlacements     = { tinder: [], kindling: [], fuel_wood: [] }
    this._stackFreeHintFlags      = null
    this._stackActiveLayerIndex   = 0
    this._stackLayLockedComplete  = false
    this._stackSparkTargetZone    = 'tinder'
    this._stackLayerHighlightG    = null
    this._stackNextLayerBg        = null
    this._stackNextLayerTxt       = null
    this._stackPrevLayerBg        = null
    this._stackPrevLayerTxt       = null
    this._stackSparkLabel         = null
    this._stackSparkPickers       = []
    this._stackPreserveAfterIgniteTrial = false
    this._stackReenterPreserveLayout = false
    this._stackGoFindBg           = null
    this._stackGoFindTxt          = null
    this._stackStrikeGateHint     = null
    this._stackFinishLayPulseTween = null
    this._stackRenFeedbackLocked = false
    /** §693–703 summary Ren once per lay after FINISH when mins met. */
    this._stackLaySummaryRenShown = false

    /** After stack Ren proposal choices: pit tap opens lay UI (`_beginStack`). */
    this._stackAwaitingPitForLay     = false
    /** Dev/mock: skip Ren pit gate when jumping straight to stack (`startStep === 'stack'`). */
    this._stackDevJumpSkipPitPrompt = false
    this._stackPreserveLayoutPending = false
    this._stackPitPromptHit          = null
    this._stackPitPromptHintTxt      = null
    this._stackPitPromptTween        = null

    // Ignite state
    this._igniteTotalClicks = 0
    /** Blow phase (§4.5): no decay until first BLOW after smoke tutorial / dialogue beat. */
    this._igniteDecayHoldUntilNextBlow = false
    this._igniteLastClick   = 0
    this._igniteUseRain     = false
    this._igniteDifficulty  = null
    /** `spark` | `blow` — §4.5 two-phase ignite */
    this._igniteMechanicsPhase = null
    /** 0 … IGNITE_PROGRESS_MAX */
    this._igniteProgress          = 0
    this._igniteSmokeThresholdPct = 40
    this._igniteDecayPerTick      = 1
    this._igniteBlowGain          = 18
    /** Spark layer chosen via ignite chips (before mechanics). */
    this._igniteSparkTargetZone = 'tinder'

    /** Max STRIKE+Blow attempts this ignite — scales down when fewer tinder units on stack. */
    this._igniteClickBudget = MAX_CLICKS
    /** One-shot Ren when remaining attempts drop to ≤5 (§ ignite UX). */
    this._igniteRenTinderLowShown = false
    /** After forest collect — skip ignite Ren intro when player already began ignite. */
    this._igniteResumeFromForest = null
    this._igniteTinderBarGfx = null
    this._igniteTinderBarLabel = null
    this._igniteTinderBarPulseTween = null
    this._igniteTinderBarX = 0
    this._igniteTinderBarTopY = 0
    this._igniteTinderBarW = 16
    this._igniteTinderBarH = 128
    /** Ignite Ren proposal: pathA = three chips; pathB = only tinder chip active + highlighted. */
    this._igniteProposalPath = 'pathA'
    /** After dialogue: first STRIKE opens Spark-at chips; second STRIKE confirms layer → Ren → mechanics */
    this._igniteAwaitFirstStrikeForSparkUi = false
    /** Chips visible: adjust selection (path A); STRIKE confirms → Ren feedback */
    this._igniteAwaitingLayerStrike = false
    this._igniteSparkPickPhaseObjs = []
    this._igniteSparkPickLabel = null
    /** Spark-at phase: highlights pit ring matching chip (Base→bottom …). */
    this._igniteSparkPickRingGfx = null
    /** Blow phase: warm accent strokes on **bottom (tinder) ring only** above `_stackGraphics`. */
    this._igniteLayRingGlowGfx = null

    /** Lay locked: Blow sits beside STRIKE (dim until ignite smoke phase — same control as ignite HUD later). */
    this._stackLockedBlowBg = null
    this._stackLockedBlowTxt = null
    this._igniteBarBg               = null
    this._igniteBarFill             = null
    this._igniteBarInnerW           = 260
    this._igniteBarSmokeMarker      = null
    this._igniteBarFireMarker       = null
    this._igniteBlowBg              = null
    this._igniteBlowTxt             = null
    /** Read-only chips showing the `placed` lay inside sort zones (sort → sustain). */
    this._sortZoneLayPreviewNodes = []
    /** Blow phase smoke pulse: `bright` = good blow window (§4.5). */
    this._igniteSmokePulsePhase = 'bright'
    this._igniteSmokePulseTimer = null
    this._igniteSmokeRenShown       = false
    /** First wrong blow (dark window) Ren line shown */
    this._igniteBlowHardRenShown    = false
    /** First correct blow Ren line shown */
    this._igniteRenBlowCorrectShown = false
    this._igniteLastBlowTime        = 0
    /** Ignite: reserve tinder draggable alongside STRIKE/BLOW whenever mechanics are active (no refill gate). */
    this._decayTimer        = null
    this._rainTimer         = null
    this._idleTimer         = null
    this._effectiveDecayMs   = DIFFICULTY_CONFIG.EASY.decayMs

    /** §4.6 Spread — flame climb after ignite */
    this._spreadTimers        = []
    this._spreadAwaitingRemediation = false
    this._spreadRemediationZone = null // 'kindling' | 'fuel_wood'
    this._spreadRemediatedWeak = false
    this._spreadPlaceholderCapTxt = null
    this._spreadSymptomGfx = null
    this._spreadGlowGfx = null
    this._spreadPromptTxt = null
    this._spreadRingPulseTween = null

    // Sustain state
    this._fireStrength       = 0
    this._nightElapsed       = 0
    this._nightTotalMs       = SUSTAIN_NIGHT_TOTAL_MS
    /** Monotonic floor for night bar fill so extending _nightTotalMs never shrinks the bar. */
    this._nightBarProgressFloor = 0
    this._strengthCeiling     = SEGMENT_COUNT
    this._floodLocked        = false
    this._nightComplete      = false
    this._drainTimer         = null
    this._nightTimer         = null
    this._floodTimer         = null
    this._sustainTinderBurdenUntil = 0
    this._sustainFuelSlowUntil      = 0
    this._sustainBackupKeysByZone   = { tinder: [], kindling: [], fuel_wood: [] }
    this._sustainTimersStarted    = false
    this._sustainDragHintTxt      = null
    /** §4.7 — analytics + Ren one-shots */
    this._sustainFuelUsedCount      = 0
    this._sustainFireOutCount       = 0
    this._sustainRenHintThreeShown  = false
    this._sustainRenFloodIntroShown = false
    /** Full-lay pit ring glow after spread — spread FX is destroyed on exit. */
    this._sustainPitGlowGfx = null

    // Inputs
    this._campsiteQuality = 'good'
    this._groundCleared   = false
    this._collected       = []

    // Shared UI refs
    this._dialogueTimer  = null
    this._segRects       = []
    this._sortZones      = {}
    this._holdPositions  = []
    this._barMaxW        = 0

    this._sortPackUiNodes = []
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    this._ensureHudSceneVisible()

    this._readInputs()

    this._pitX = W / 2
    this._pitY = H * 0.46
    this._stackRingCX = this._pitX
    this._stackRingCY = this._pitY

    this._buildBackground(W, H)
    this._buildForestHotspot(W, H)
    this._buildFirePit(W, H)
    this._buildDebris(W, H)
    this._buildClearCounter(W, H)
    this._buildSortZones(W, H)
    this._buildMaterialPile(W, H)
    this._buildHoldingArea(W, H)
    this._buildStackRings(W, H)
    this._buildFlintButton()
    this._buildStrengthBar(W, H)
    this._buildNightBar(W, H)
    this._buildMoveOnButton(W, H)
    this._buildDialogueBox(W, H)
    this._setupDragListeners()

    this._enterHandlers = {
      ren_intro: () => this._enterRenIntro(),
      clear:     () => this._enterClear(),
      sort:      () => this._enterSort(),
      stack:     () => this._enterStack(),
      ignite:    () => this._enterIgnite(),
      spread:    () => this._enterSpread(),
      sustain:   () => this._enterSustain(),
    }

    this._exitHandlers = {
      ren_intro: () => {},
      clear:   () => this._exitClear(),
      sort:    () => this._exitSort(),
      stack:   () => this._exitStack(),
      ignite:  () => this._exitIgnite(),
      spread:  () => this._exitSpread(),
      sustain: () => this._exitSustain(),
    }

    // Tracks whether the Ren proposal for each step has already been shown
    // (prevents re-showing on re-entries, e.g. stack after ignite trial).
    this._stepProposalShown = {}

    let stackResumeHandled = false
    if (this._resumeStackAfterCollect) {
      const snap = this.registry.get('fireCampsiteStackResume')
      if (snap) {
        this._igniteResumeFromForest = snap.igniteResume ?? null
        this._applyStackResumeFromCollect(snap)
        this._syncSortedMaterialsRegistryLive()
        this._syncStackLayRegistry()
        if (import.meta.env.DEV) {
          const rs = this.registry.get('reserveMaterials')
          console.log('[DEBUG Collect → after merge]', {
            reserveAfter: JSON.stringify(rs),
            reserveCount: rs?.length,
            stackDropTinder: this._stackDropCount?.tinder,
            stackDropKindling: this._stackDropCount?.kindling,
            stackDropFuel: this._stackDropCount?.fuel_wood,
            collectedLen: this._collected?.length,
          })
        }
        this._stackReenterPreserveLayout = true
        this.registry.remove('fireCampsiteStackResume')
        stackResumeHandled = true
      }
      this._resumeStackAfterCollect = false
    }

    const entry = this._startStep ?? 'ren_intro'

    if (entry === 'stack') {
      this._stepProposalShown.stack = true
      this._stackDevJumpSkipPitPrompt = true
    }

    if (entry !== 'ren_intro' && entry !== 'clear' && !stackResumeHandled) {
      if (entry === 'ignite' || entry === 'spread' || entry === 'sustain') {
        this._hydratePlacedStackFromRegistryIfNeeded()
        this._hydrateSortedMaterialsFromRegistryIfNeeded(entry)
      } else {
        this._hydrateSortedMaterialsFromRegistryIfNeeded(entry)
        this._hydratePlacedStackFromRegistryIfNeeded()
      }
      if (entry === 'stack' || entry === 'ignite' || entry === 'spread' || entry === 'sustain') {
        this._ensureSortedMaterialsZoneLayout()
      }
    }

    if (entry === 'spread') {
      this.registry.set('ignitionSuccess', true)
      this._tinderSprite?.setAlpha(0)
      this._fireIcon?.setAlpha(1)
    }

    this._enterStep(entry)
  }

  /** HUDScene runs parallel to minigames; paths that skip NarrativeScene must still show stamina. */
  _ensureHudSceneVisible() {
    if (!this.scene.isActive('HUDScene')) {
      this.scene.launch('HUDScene')
    }
    // HUDScene hides flames until PROLOGUE_END (normally from NarrativeScene after prologue).
    this.game.events.emit(GameEvents.PROLOGUE_END)
  }

  // ── Inputs ───────────────────────────────────────────────────────────────────

  /** Phaser: `setDraggable` touches `sprite.input`; skip if interactive was never enabled or already torn down. */
  _safeSetDraggable(sprite, enabled = false) {
    if (!sprite?.input) return
    this.input.setDraggable(sprite, enabled)
  }

  _readInputs() {
    const inkBridge = this.registry.get('inkBridge')
    const rawQ = inkBridge?.getVariable('campsite_quality')
    this._campsiteQuality =
      typeof rawQ === 'string' && rawQ.trim().toLowerCase() === 'poor' ? 'poor' : 'good'
    this.registry.set('campsiteQuality', this._campsiteQuality)
    const rawMat = this.registry.get('collectedMaterials') ?? []
    const newItems = Array.isArray(rawMat) ? rawMat : (rawMat?.items ?? [])
    const stackResumeSnap = this.registry.get('fireCampsiteStackResume')

    if (
      this._resumeStackAfterCollect &&
      stackResumeSnap != null &&
      Array.isArray(stackResumeSnap.matSnapshot)
    ) {
      const oldItems = stackResumeSnap.matSnapshot.map((s) => ({
        id: s.id,
        quality: s.quality,
      }))
      const tailItems =
        Array.isArray(this._forestCollectNewItems) && this._forestCollectNewItems.length > 0
          ? this._forestCollectNewItems
          : newItems
      this._collected = [...oldItems, ...tailItems]
      this.registry.set('collectedMaterials', {
        items: this._collected,
        count: collectRegistryCounts(this._collected),
      })
      this._forestCollectNewItems = null
    } else {
      this._collected = newItems
    }
    this._groundCleared   = this.registry.get('groundCleared') ?? false

    const badCount = this._collected.filter(m => m.quality === 'BAD').length
    this._strengthCeiling = Math.max(1, SEGMENT_COUNT - badCount)
    this._fireStrength    = this._strengthCeiling
  }

  _buildStackResumePayload() {
    const matSnapshot = this._collected
      .map((_, idx) => {
        const st = this._matStates[`pile_${idx}`]
        if (!st) return null
        return {
          id: st.id,
          quality: st.quality,
          phase: st.phase,
          sortZoneId: st.sortZoneId,
          layerId: st.layerId,
          greyed: st.greyed,
          zonePos: st.zonePos ? { x: st.zonePos.x, y: st.zonePos.y } : null,
          pitPos: st.pitPos ? { x: st.pitPos.x, y: st.pitPos.y } : null,
        }
      })
      .filter(Boolean)

    return {
      matSnapshot,
      resumeCampsiteStep: this.step === 'ignite' ? 'ignite' : 'stack',
      igniteResume: this.step === 'ignite' ? this._buildIgniteResumeSnapshot() : undefined,
      stackDropCount:       { ...this._stackDropCount },
      stackUnitIndexInZone: { ...this._stackUnitIndexInZone },
      stackActiveLayerIndex:   this._stackActiveLayerIndex,
      stackLayLockedComplete:  this._stackLayLockedComplete,
      stackSparkTargetZone:    this._stackSparkTargetZone,
      stackHadError:           this._stackHadError,
      stackTutorialFlags:      this._stackTutorialFlags ? { ...this._stackTutorialFlags } : null,
      stackFreeHintFlags:      this._stackFreeHintFlags ? { ...this._stackFreeHintFlags } : null,
    }
  }

  /** Serialized when leaving campsite for forest mid-ignite (Head Back resumes ignite dialogue/mechanics). */
  _buildIgniteResumeSnapshot() {
    if (this.step !== 'ignite') return undefined
    const igniteProposalComplete =
      !!this._stepProposalShown.ignite ||
      !!this._igniteMechanicsPhase ||
      this._igniteAwaitingLayerStrike ||
      this._igniteAwaitFirstStrikeForSparkUi
    return {
      igniteProposalComplete,
    }
  }

  _applyStackResumeFromCollect(snap) {
    const matSnapshot = Array.isArray(snap?.matSnapshot) ? snap.matSnapshot : []
    const nOld = matSnapshot.length

    this._stackDropCount       = { ...(snap.stackDropCount ?? { tinder: 0, kindling: 0, fuel_wood: 0 }) }
    this._stackUnitIndexInZone = { ...(snap.stackUnitIndexInZone ?? { tinder: 0, kindling: 0, fuel_wood: 0 }) }
    this._stackActiveLayerIndex   = snap.stackActiveLayerIndex ?? 0
    this._stackLayLockedComplete  = snap.stackLayLockedComplete ?? false
    this._stackSparkTargetZone     = snap.stackSparkTargetZone ?? 'tinder'
    this._stackHadError            = snap.stackHadError ?? false
    if (snap.stackTutorialFlags) this._stackTutorialFlags = { ...snap.stackTutorialFlags }
    if (snap.stackFreeHintFlags) this._stackFreeHintFlags = { ...snap.stackFreeHintFlags }

    for (let i = 0; i < nOld; i++) {
      const s = matSnapshot[i]
      const pileKey = `pile_${i}`
      const st = this._matStates[pileKey]
      if (!st) continue

      st.phase = s.phase
      st.sortZoneId = normalizeStackSortZoneId(s.sortZoneId)
      st.layerId = s.layerId
      st.greyed = s.greyed
      st.zonePos = s.zonePos ? { ...s.zonePos } : null
      st.pitPos = s.pitPos ? { ...s.pitPos } : null

      const visuallyGrey = s.greyed || st.quality === 'BAD'
      if (visuallyGrey) st.greyed = true

      if (st.phase === 'placed') {
        st.sprite.setAlpha(0)
        st.label.setAlpha(0)
      } else if (st.phase === 'burned' || st.phase === 'ignite_spent') {
        st.layerId = null
        st.pitPos = null
        st.sprite.setVisible(false)
        st.label?.setVisible(false)
      } else if (st.phase === 'sorted' && st.zonePos) {
        st.sprite.setPosition(st.zonePos.x, st.zonePos.y)
        st.label.setPosition(st.zonePos.x, st.zonePos.y + ITEM_H / 2 + 4)
        const a = visuallyGrey ? 0.3 : 1
        st.sprite.setAlpha(a)
        st.label.setAlpha(a)
      } else if (visuallyGrey) {
        st.sprite.setAlpha(0.3)
        st.label.setAlpha(0.3)
      }
    }

    for (let j = nOld; j < this._collected.length; j++) {
      const pileKey = `pile_${j}`
      const st = this._matStates[pileKey]
      if (!st) continue

      const z = normalizeStackSortZoneId(correctSortZoneForMatId(st.id))
      if (st.isSortable && z) {
        st.phase = 'sorted'
        st.sortZoneId = z
        const zone = this._sortZones[z]
        const offset = (j % 2 === 0) ? -16 : 16
        st.zonePos = { x: zone.x + offset, y: zone.y - 10 }
        st.sprite.setPosition(st.zonePos.x, st.zonePos.y)
        st.label.setPosition(st.zonePos.x, st.zonePos.y + ITEM_H / 2 + 4)
        st.sprite.setAlpha(1)
        st.label.setAlpha(1)
      } else {
        st.phase = 'pile'
        st.sortZoneId = null
        st.zonePos = null
        const { x, y } = st.homePos
        st.sprite.setPosition(x, y)
        st.label.setPosition(x, y + ITEM_H / 2 + 4)
        st.sprite.setAlpha(1)
        st.label.setAlpha(1)
        st.sprite.setInteractive({ useHandCursor: true })
        st.sprite.off('pointerup')
        st.sprite.on('pointerup', () => {
          if (this.step === 'stack') {
            this._showRenLines(WET_MATERIAL_REN_LINES, () => this._greyOut(st))
          }
        })
      }

      if (st.quality === 'BAD' && st.isSortable) {
        st.greyed = true
        st.sprite.setAlpha(0.3)
        st.label.setAlpha(0.3)
        this._safeSetDraggable(st.sprite, false)
        st.sprite.disableInteractive()
      }
    }

    this._sortedCount = this._sortableIds.length
  }

  /**
   * Apply registry `sortedMaterials` to `_matStates` for dev/mock jumps and after collect handoff.
   * Piles default to `pile` from `_buildMaterialPile`; placed rows are skipped via `_registryHydrated`.
   */
  _hydrateSortedMaterialsFromRegistryIfNeeded(startStep) {
    if (
      startStep !== 'stack' &&
      startStep !== 'ignite' &&
      startStep !== 'spread' &&
      startStep !== 'sustain'
    )
      return
    const sm = this.registry.get('sortedMaterials')
    if (!sm || typeof sm !== 'object') return

    const piles = Object.keys(this._matStates)
      .filter((k) => k.startsWith('pile_'))
      .map((k) => this._matStates[k])
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(String(a.pileKey).replace(/\D/g, ''), 10) || 0
        const nb = parseInt(String(b.pileKey).replace(/\D/g, ''), 10) || 0
        return na - nb
      })

    for (const st of piles) {
      delete st._sortedHydratedFromRegistry
    }

    const consume = (bucketKey, arr) => {
      if (!Array.isArray(arr)) return
      const z = normalizeStackSortZoneId(bucketKey)
      if (!z) return
      for (const entry of arr) {
        const cand =
          piles.find(
            (p) =>
              !p._sortedHydratedFromRegistry &&
              !p._registryHydrated &&
              p.phase !== 'placed' &&
              p.phase !== 'ignite_spent' &&
              p.phase !== 'burned' &&
              p.isSortable &&
              p.id === entry.id &&
              (!entry.quality || p.quality === entry.quality),
          ) ??
          piles.find(
            (p) =>
              !p._sortedHydratedFromRegistry &&
              !p._registryHydrated &&
              p.phase !== 'placed' &&
              p.phase !== 'ignite_spent' &&
              p.phase !== 'burned' &&
              p.isSortable &&
              p.id === entry.id,
          )
        if (!cand) continue
        cand._sortedHydratedFromRegistry = true
        cand.sortZoneId = z
        cand.phase = 'sorted'
      }
    }

    consume('tinder', sm.tinder)
    consume('kindling', sm.kindling)
    consume('fuel_wood', sm.fuel_wood ?? sm.fuel)
  }

  // ── Step machine ─────────────────────────────────────────────────────────────

  _enterStep(nextStep) {
    if (this.step && this._exitHandlers) this._exitHandlers[this.step]?.()
    this.step = nextStep
    this._enterHandlers[nextStep]?.()
    this._refreshSortZoneLayPreview()
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    this._bgRect = this.add.rectangle(W / 2, H / 2, W, H, BG_NIGHT).setDepth(0)

    this._titleText = this.add.text(W / 2, 60 * (window.devicePixelRatio || 1), `Day ${this.day} — Build the fire`, {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      fill: '#8a9a7a',
      stroke: '#1a0f00',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10)
  }

  /** Treeline gather hotspot — only active during the `clear` step. */
  _buildForestHotspot(W, H) {
    const x = W / 2
    const y = H * 0.15
    const rw = W * 0.78
    const rh = H * 0.22

    this._forestHotspot = this.add
      .rectangle(x, y, rw, rh, 0x1e3428, 0.22)
      .setStrokeStyle(2, 0x5a9a6a, 0.4)
      .setDepth(2)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
      .setAlpha(0)

    this._forestHotspot.on('pointerup', () => this._onForestHotspotClick())

    this._forestPulseTween = this.tweens.add({
      targets: this._forestHotspot,
      alpha: { from: 0.42, to: 0.78 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this._forestPulseTween.pause()
  }

  _refreshBackground() {
    if (this._floodLocked) return
    if (this.step === 'sustain') {
      this._bgRect.setFillStyle(this._fireStrength >= 3 ? BG_FIRE_STRONG : BG_FIRE_WEAK)
      this._fireIcon.setAlpha(this._fireStrength >= 3 ? 1.0 : 0.45)
      this._refreshSustainPitLayGlow()
    } else {
      this._bgRect.setFillStyle(BG_NIGHT)
    }
  }

  // ── Fire pit ─────────────────────────────────────────────────────────────────

  _buildFirePit() {
    const px = this._pitX
    const py = this._pitY

    this.add.circle(px, py, 68, 0x1a1208).setStrokeStyle(3, 0x5a4a28).setDepth(1)

    this._rockRing = this.add.circle(px, py, 84, 0x000000, 0)
      .setStrokeStyle(4, 0x7a6a50)
      .setDepth(1)
      .setVisible(false)

    // Shown during ignite step so rain flash has a target
    this._tinderSprite = this.add
      .text(px - 8, py + 4, '🌿', { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(2)
      .setAlpha(0)

    // Shown during sustain step
    this._fireIcon = this.add
      .text(px, py, '🔥', { fontSize: '52px' })
      .setOrigin(0.5)
      .setDepth(2)
      .setAlpha(0)
  }

  // ── Debris ───────────────────────────────────────────────────────────────────

  _buildDebris() {
    const cx = this._pitX
    const cy = this._pitY

    const positions = [
      { x: cx - 140, y: cy - 90 },
      { x: cx + 130, y: cy - 80 },
      { x: cx - 160, y: cy + 40 },
      { x: cx + 150, y: cy + 50 },
      { x: cx - 60,  y: cy + 120 },
      { x: cx + 80,  y: cy + 130 },
    ]

    const types = [
      { tint: 0x7a6a40, size: 28, label: '🍂' },
      { tint: 0x5a4a30, size: 18, label: '🌿' },
      { tint: 0x6a5a38, size: 32, label: '🍂' },
      { tint: 0x4a3a28, size: 22, label: '🌿' },
      { tint: 0x7a6040, size: 26, label: '🍂' },
      { tint: 0x5a4838, size: 20, label: '🌿' },
    ]

    positions.forEach((pos, i) => {
      const t = types[i]

      const circle = this.add.circle(pos.x, pos.y, t.size, t.tint)
        .setStrokeStyle(1, 0x9a8a60)
        .setDepth(3)
        .setAlpha(0)

      const icon = this.add.text(pos.x, pos.y, t.label, { fontSize: `${t.size}px` })
        .setOrigin(0.5)
        .setDepth(4)
        .setAlpha(0)

      circle.on('pointerover', () => circle.setFillStyle(0xb0a070))
      circle.on('pointerout',  () => circle.setFillStyle(t.tint))
      circle.on('pointerup',   () => this._onDebrisClick(i, circle, icon))

      this._debrisObjects.push({ circle, icon, removed: false, baseTint: t.tint })
    })
  }

  // ── Clear counter ─────────────────────────────────────────────────────────────

  _buildClearCounter(W) {
    this._clearCounterText = this.add.text(W / 2, 82 * (window.devicePixelRatio || 1), this._clearCounterLabel(), {
      fontSize: '15px', fontFamily: 'monospace', fill: '#aaaaaa',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)

    this._clearCheckmark = this.add.text(W / 2, 82 * (window.devicePixelRatio || 1), '✔  Area cleared', {
      fontSize: '15px', fontFamily: 'monospace', fill: '#7adf7a',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)
  }

  // ── Sort zones ────────────────────────────────────────────────────────────────

  _buildSortZones(W, H) {
    const totalW = 3 * ZONE_W + 2 * 24
    const startX = W / 2 - totalW / 2 + ZONE_W / 2
    const zoneY  = H * 0.80

    this._sortZoneParts = []

    SORT_ZONE_DEFS.forEach((def, i) => {
      const x = startX + i * (ZONE_W + 24)

      const rect = this.add.rectangle(x, zoneY, ZONE_W, ZONE_H, def.tint, 0.4)
        .setStrokeStyle(2, 0xaaaaaa)
        .setDepth(2)
        .setAlpha(0.3)

      const labelTxt = this.add.text(x, zoneY - ZONE_H / 2 + 14, def.label, {
        fontSize: '15px',
        fontFamily: 'Georgia, serif',
        fill: '#e0c870',
      }).setOrigin(0.5).setDepth(3).setAlpha(0.3)

      const descTxt = this.add.text(x, zoneY + 8, def.description, {
        fontSize: '11px',
        fontFamily: 'Georgia, serif',
        fill: '#887050',
        wordWrap: { width: ZONE_W - 16 },
        align: 'center',
      }).setOrigin(0.5).setDepth(3).setAlpha(0.3)

      const flash = this.add.rectangle(x, zoneY, ZONE_W, ZONE_H, 0xffffff, 0).setDepth(4)

      this._sortZones[def.id] = {
        x, y: zoneY,
        rect, flash,
        bounds: new Phaser.Geom.Rectangle(x - ZONE_W / 2, zoneY - ZONE_H / 2, ZONE_W, ZONE_H),
      }

      const countCy = zoneY + ZONE_H / 2 + 22
      const countSegments = [
        this.add.text(0, 0, '', {
          fontSize: '12px',
          fontFamily: 'Georgia, serif',
          fill: '#b0a080',
        }).setOrigin(0.5).setDepth(3).setAlpha(0.3),
        this.add.text(0, 0, '', {
          fontSize: '12px',
          fontFamily: 'Georgia, serif',
          fill: '#b0a080',
        }).setOrigin(0.5).setDepth(3).setAlpha(0.3),
        this.add.text(0, 0, ' · ', {
          fontSize: '12px',
          fontFamily: 'Georgia, serif',
          fill: '#b0a080',
        }).setOrigin(0.5).setDepth(3).setAlpha(0.3),
        this.add.text(0, 0, '', {
          fontSize: '12px',
          fontFamily: 'Georgia, serif',
          fill: '#807060',
        }).setOrigin(0.5).setDepth(3).setAlpha(0.3),
      ]

      this._sortZoneParts.push({
        rect,
        labelTxt,
        descTxt,
        countCy,
        countSegments,
      })
    })
    this._refreshSortZoneMaterialCounts()
  }

  /** Label + description + optional zone count line — keep alphas / tweens in sync. */
  _sortZoneHudLabelTargets(part) {
    const out = [part.labelTxt, part.descTxt]
    if (part.countSegments?.length) out.push(...part.countSegments)
    return out
  }

  _layoutSortZoneCountLine(cx, cy, segments) {
    if (!segments?.length) return
    let total = 0
    const widths = segments.map((t) => {
      const w = t.width
      total += w
      return w
    })
    let left = cx - total / 2
    segments.forEach((t, i) => {
      const w = widths[i]
      t.setPosition(left + w / 2, cy)
      left += w
    })
  }

  _getMaterialCounts() {
    const counts = {
      tinder: { placed: 0, sorted: 0, burned: 0 },
      kindling: { placed: 0, sorted: 0, burned: 0 },
      fuel_wood: { placed: 0, sorted: 0, burned: 0 },
    }
    for (const st of Object.values(this._matStates)) {
      const zone = correctSortZoneForMatId(st.id)
      if (!zone || !counts[zone]) continue
      if (st.phase === 'placed') counts[zone].placed++
      else if (st.phase === 'sorted' && st.isSortable) counts[zone].sorted++
      else if (st.phase === 'burned' || st.phase === 'ignite_spent') counts[zone].burned++
    }
    return counts
  }

  _refreshSortZoneMaterialCounts() {
    if (!this._sortZoneParts?.length) return
    const counts = this._getMaterialCounts()
    SORT_ZONE_DEFS.forEach((def, i) => {
      const part = this._sortZoneParts[i]
      const segs = part.countSegments
      if (!segs?.length) return
      const zone = this._sortZones[def.id]
      const cx = zone?.x ?? part.labelTxt.x
      const c = counts[def.id] ?? { placed: 0, sorted: 0 }
      const short =
        def.id === 'fuel_wood' ? 'Fuel' : def.label
      segs[0].setText(`${short}: `)
      segs[1].setText(`${c.placed} in pit`)
      segs[3].setText(`${c.sorted} spare`)
      this._layoutSortZoneCountLine(cx, part.countCy, segs)
    })
  }

  // ── Material pile ─────────────────────────────────────────────────────────────

  _buildMaterialPile(W, H) {
    const pileX = W * 0.13
    const pileY = H * 0.46
    const cols  = 2
    const cellW = ITEM_W + 12
    const cellH = ITEM_H + 28
    const packX = SORT_PACK_HUD_X
    const packY = H - SORT_PACK_HUD_Y_FROM_BOTTOM

    this._collected.forEach(({ id, quality }, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x   = pileX + (col - 0.5) * cellW
      const y   = pileY + (row - 0.5) * cellH

      const color = MAT_COLOR[quality] ?? 0x5a4a30

      const sprite = this.add
        .rectangle(packX, packY, ITEM_W, ITEM_H, color)
        .setDepth(5)
        .setAlpha(0)

      const label = this.add.text(packX, packY + ITEM_H / 2 + 4, id.replace(/_/g, ' '), {
        fontSize: '11px',
        fontFamily: 'Georgia, serif',
        fill: '#d8c898',
      }).setOrigin(0.5, 0).setDepth(6).setAlpha(0)

      const isSortable = correctSortZoneForMatId(id) != null
      if (isSortable) this._sortableIds.push(id)

      const pileKey = `pile_${idx}`
      this._matStates[pileKey] = {
        pileKey,
        id,
        quality,
        sprite,
        label,
        isSortable,
        phase: 'pile',
        homePos:    { x, y }, // staging grid; overridden when sort begins (random scatter left)
        zonePos:    null,
        holdPos:    null,
        pitPos:     null,
        sortZoneId: null,
        layerId:    null,
        greyed:     false,
      }
    })
  }

  // ── Holding area ─────────────────────────────────────────────────────────────

  _buildHoldingArea(W, H) {
    const baseX = this._pitX + 185
    const baseY = this._pitY
    const cellW = ITEM_W + 14
    const cellH = ITEM_H + 24

    const nSlots = Math.max(this._sortableIds.length, 4)
    const cols = 2
    this._holdPositions = []
    for (let i = 0; i < nSlots; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      this._holdPositions.push({
        x: baseX + (col - 0.5) * cellW,
        y: baseY + (row - 0.5) * cellH,
      })
    }

    this._holdSlots = this._holdPositions.map(pos =>
      this.add.rectangle(pos.x, pos.y, ITEM_W, ITEM_H, 0x1a1208)
        .setStrokeStyle(1, 0x4a3820)
        .setDepth(2)
        .setAlpha(0)
    )
  }

  // ── Stack rings ───────────────────────────────────────────────────────────────

  _buildStackRings() {
    const px = this._stackRingCX
    const py = this._stackRingCY

    this._stackGraphics = this.add.graphics().setDepth(3).setAlpha(0.3)
    this._drawStackRings()

    this._stackLabelTexts = [
      this.add.text(px + STACK_BOTTOM_R + 6, py + 4,  'Bottom', { fontSize: '10px', fontFamily: 'Georgia, serif', fill: '#7a6040' }).setOrigin(0, 0.5).setDepth(4).setAlpha(0.3),
      this.add.text(px + STACK_MIDDLE_R + 6, py - 8,  'Middle', { fontSize: '10px', fontFamily: 'Georgia, serif', fill: '#7a6040' }).setOrigin(0, 0.5).setDepth(4).setAlpha(0.3),
      this.add.text(px + STACK_TOP_R    + 6, py - 20, 'Top',    { fontSize: '10px', fontFamily: 'Georgia, serif', fill: '#7a6040' }).setOrigin(0, 0.5).setDepth(4).setAlpha(0.3),
    ]
  }

  _drawStackRings() {
    const g  = this._stackGraphics
    const px = this._stackRingCX
    const py = this._stackRingCY
    g.clear()
    g.lineStyle(2, 0x9a7a40, 0.7)
    g.strokeCircle(px, py, STACK_TOP_R)
    g.lineStyle(2, 0x8a6a30, 0.7)
    g.strokeCircle(px, py, STACK_MIDDLE_R)
    g.lineStyle(2, 0x7a5a20, 0.7)
    g.strokeCircle(px, py, STACK_BOTTOM_R)
  }

  // ── Flint button ──────────────────────────────────────────────────────────────

  _buildFlintButton() {
    const btnX = this._pitX + 185
    const btnY = this._pitY

    this._flintBg = this.add
      .rectangle(btnX, btnY, 110, 110, 0x3a2a18)
      .setStrokeStyle(3, 0xa08040)
      .setDepth(18)
      .setAlpha(0.4)

    this._flintIcon = this.add
      .text(btnX, btnY - 10, '🪨', { fontSize: '42px' })
      .setOrigin(0.5)
      .setDepth(19)
      .setAlpha(0.4)

    this._flintLabel = this.add.text(btnX, btnY + 36, 'STRIKE', {
      fontSize: '12px',
      fontFamily: 'monospace',
      fill: '#a08040',
    }).setOrigin(0.5).setDepth(19).setAlpha(0.4)

    this._flintBg.on('pointerover', () => {
      if (this.step === 'ignite' || this.step === 'stack')
        this._flintBg.setFillStyle(0x4a3a28)
    })
    this._flintBg.on('pointerout', () => {
      if (this.step === 'ignite' || this.step === 'stack')
        this._flintBg.setFillStyle(0x3a2a18)
    })
    this._flintBg.on('pointerup', () => this._onFlintClick())
    this._setFlintActive(false)
  }

  _deactivateFlintCompletely() {
    this._flintBg?.disableInteractive()
  }

  _maybeWarnIgniteTinderLow() {
    const budget = Math.max(0, this._igniteClickBudget ?? 0)
    const rem = budget - this._igniteTotalClicks
    if (rem > 5 || rem <= 0 || budget <= 0 || this._igniteRenTinderLowShown) return
    this._igniteRenTinderLowShown = true
    this._dialogue.showSequence(
      [
        {
          speaker: 'Ren',
          text: 'Running out of tinder. Make these last ones count.',
        },
      ],
      () => this._dialogue.hide(),
    )
  }

  _onFlintClick() {
    if (this.step === 'stack') {
      if (this._stackLayLockedComplete) this._beginIgniteFromStack()
      return
    }

    if (this.step !== 'ignite') return

    if (this._igniteAwaitFirstStrikeForSparkUi) {
      this._mountIgniteSparkPickUi()
      return
    }

    if (this._igniteAwaitingLayerStrike) {
      this._onIgniteStrikeAfterLayerPick()
      return
    }

    if (!this._igniteMechanicsPhase || this._igniteMechanicsPhase !== 'spark') return

    this._processIgniteSparkStrikeAtPit()
  }

  _processIgniteSparkStrikeAtPit() {
    if (this.step !== 'ignite') return
    if (!this._igniteMechanicsPhase || this._igniteMechanicsPhase !== 'spark') return
    if (typeof this._dialogue?.isBlocking === 'function' && this._dialogue.isBlocking())
      return

    if (!this._canIgniteSparkStrike()) return

    const { x: fx, y: fy } = this._randomIgniteSparkBurstPoint()

    this._igniteLastClick = this.time.now
    this._igniteTotalClicks++

    this._playIgniteSparkFx(fx, fy)

    const d = this._igniteDifficulty
    const gained = Phaser.Math.Between(d.sparkMin, d.sparkMax)
    this._igniteProgress = Math.min(
      IGNITE_PROGRESS_MAX,
      this._igniteProgress + gained,
    )
    this._refreshIgniteProgressUi()

    this._maybePromoteIgniteToBlowPhase()

    if (this._igniteProgress >= IGNITE_PROGRESS_MAX) {
      this._igniteSuccess()
      return
    }

    const budget = Math.max(0, this._igniteClickBudget ?? 0)
    if (budget > 0 && this._igniteTotalClicks >= budget) {
      this._igniteFail()
      return
    }

    this._maybeWarnIgniteTinderLow()
  }

  /**
   * @param {boolean} active
   * @param {object} [opts]
   * @param {boolean} [opts.igniteSparkingDisabled] — blow phase: dim STRIKE and block clicks (§4.5).
   */
  _setFlintActive(active, opts = {}) {
    const dimStrike = opts.igniteSparkingDisabled === true
    const a = active ? 1 : dimStrike ? 0.22 : 0.4
    if (!this._flintBg) return
    this._flintBg.setAlpha(a)
    this._flintIcon.setAlpha(a)
    this._flintLabel.setAlpha(a)
    if (active) {
      this._flintBg.setInteractive({ useHandCursor: true })
    } else {
      this._flintBg.disableInteractive()
    }
  }

  /** Fully hides STRIKE — `_setFlintActive(false)` leaves alpha 0.4 for stack-preview; spread/sustain need it gone. */
  _hideFlintUiCompletely() {
    if (!this._flintBg) return
    this._flintBg.setAlpha(0).disableInteractive()
    this._flintIcon?.setAlpha(0)
    this._flintLabel?.setAlpha(0)
  }

  _canIgniteSparkStrike() {
    const budget = Math.max(0, this._igniteClickBudget ?? 0)
    return (
      this._liveBottomTinderLayEntries().length > 0 &&
      this._igniteTotalClicks < budget
    )
  }

  /** Spark phase STRIKE — dim/disabled when pit has no tinder or tries exhausted. */
  _refreshIgniteStrikeAvailability() {
    if (this.step !== 'ignite') return
    if (
      this._igniteAwaitFirstStrikeForSparkUi ||
      this._igniteAwaitingLayerStrike ||
      this._igniteMechanicsPhase !== 'spark'
    )
      return
    if (this._canIgniteSparkStrike()) this._setFlintActive(true)
    else this._setFlintActive(false)
  }

  /** After bottom is emptied mid-mechanics — smoke pulse invalid without a live lay ring budget. */
  _igniteSnapToSparkWhenNoBottomTinder() {
    if (this._liveBottomTinderLayEntries().length > 0) return
    if (this._igniteMechanicsPhase === 'blow') {
      this._stopIgniteSmokePulse()
      this._setIgniteBlowInteractive(false)
    }
    if (this._igniteMechanicsPhase) {
      this._igniteMechanicsPhase = 'spark'
      this._igniteDecayHoldUntilNextBlow = false
      this._titleText.setText(
        'Ignite — Phase 1: Tap STRIKE to build heat (watch both bars).',
      )
      this._tinderSprite?.setAlpha(0.72)
    }
    this._refreshIgniteStrikeAvailability()
  }

  /** Day 2 — one-shot non-blocking Ren after returning from forest with spare tinder during ignite. */
  _maybeShowIgniteForestReturnHint(forestResume) {
    if (!forestResume || this.day !== 2) return
    if (!this._igniteHasSortedReserveTinder()) return
    if (this.registry.get('igniteForestTinderHintShown')) return
    this.registry.set('igniteForestTinderHintShown', true)
    this._dialogue.showSequence(
      [
        {
          speaker: 'Ren',
          text: 'Put the tinder in the base — all of it. We need every piece to catch the spark.',
        },
      ],
      () => this._dialogue.hide(),
      { modal: false },
    )
  }

  // ── Strength bar ──────────────────────────────────────────────────────────────

  _buildStrengthBar(W) {
    const segW   = 60
    const segH   = 22
    const gap    = 6
    const totalW = SEGMENT_COUNT * segW + (SEGMENT_COUNT - 1) * gap
    const startX = W / 2 - totalW / 2 + segW / 2
    const barY   = 64

    this._strengthLabel = this.add.text(W / 2, barY - 18, 'Fire Strength', {
      fontSize: '12px', fontFamily: 'monospace', fill: '#887050',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const x   = startX + i * (segW + gap)
      const seg = this.add.rectangle(x, barY, segW, segH, SEG_COLOR_LIT)
        .setStrokeStyle(1, 0x5a4020)
        .setDepth(10)
        .setAlpha(0)
      this._segRects.push(seg)
    }
  }

  _setStrengthBarVisible(v) {
    const a = v ? 1 : 0
    this._strengthLabel.setAlpha(a)
    this._segRects.forEach(s => s.setAlpha(a))
  }

  _refreshStrengthBar() {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      this._segRects[i].setFillStyle(i < this._fireStrength ? SEG_COLOR_LIT : SEG_COLOR_DIM)
    }
  }

  // ── Night bar ─────────────────────────────────────────────────────────────────

  _buildNightBar(W, H) {
    const barY = H - 28
    const barW = W * 0.82

    this._nightBarLabel = this.add.text(W / 2, barY - 14, 'Burn through the night', {
      fontSize: '11px', fontFamily: 'monospace', fill: '#556688',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)

    this._nightBarTrack = this.add.rectangle(W / 2, barY, barW, 16, 0x151c24)
      .setStrokeStyle(1, 0x334455)
      .setDepth(10)
      .setAlpha(0)

    this._nightBar = this.add.rectangle(W / 2 - barW / 2, barY, 0, 14, 0x4488cc)
      .setOrigin(0, 0.5)
      .setDepth(11)
      .setAlpha(0)

    this._barMaxW = barW
  }

  _setNightBarVisible(v) {
    const a = v ? 1 : 0
    this._nightBarLabel.setAlpha(a)
    this._nightBarTrack.setAlpha(a)
    this._nightBar.setAlpha(a)
  }

  _refreshNightBar() {
    const total = Math.max(this._nightTotalMs, 1)
    let pct = Math.min(this._nightElapsed / total, 1)
    // Extending burn time increases denominator only; keep fill from jumping backward.
    if (pct < this._nightBarProgressFloor) pct = this._nightBarProgressFloor
    else this._nightBarProgressFloor = pct
    this._nightBar.setSize(this._barMaxW * pct, 14)
  }

  // ── Move On button ────────────────────────────────────────────────────────────

  _buildMoveOnButton(W, H) {
    const btnX = W - 100
    const btnY = H - 40

    this._moveOnBg = this.add.rectangle(btnX, btnY, 160, 40, 0x2a2018)
      .setStrokeStyle(1, 0x7a6040)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
      .setAlpha(0)

    this._moveOnText = this.add.text(btnX, btnY, 'Move On →', {
      fontSize: '15px', fontFamily: 'Georgia, serif', fill: '#c8b870',
    }).setOrigin(0.5).setDepth(11).setAlpha(0)

    this._moveOnBg.on('pointerover', () => this._moveOnBg.setFillStyle(0x3a3028))
    this._moveOnBg.on('pointerout',  () => this._moveOnBg.setFillStyle(0x2a2018))
    this._moveOnBg.on('pointerup',   () => this._onMoveOn())
  }

  _setMoveOnVisible(v) {
    const a = v ? 1 : 0
    this._moveOnBg.setAlpha(a)
    this._moveOnText.setAlpha(a)
    if (v) {
      this._moveOnBg.setInteractive({ useHandCursor: true })
    } else {
      this._moveOnBg.disableInteractive()
    }
  }

  // ── Dialogue box ──────────────────────────────────────────────────────────────

  _buildDialogueBox(_W, _H) {
    this._dialogue = new DialogueBox(this)
  }

  /** Spec-only Ren sequence (day2_firemaking_dev_spec §4.x). Replaces legacy Aiden auto-hide lines. */
  _showRenLines(lines, onComplete = null) {
    if (!lines?.length) {
      onComplete?.()
      return
    }
    this._dialogue.showSequence(
      lines.map((text) => ({ speaker: 'Ren', text })),
      () => {
      this._dialogue.hide()
        onComplete?.()
      },
    )
  }

  // ── Drag system ───────────────────────────────────────────────────────────────

  _setupDragListeners() {
    this.input.on('dragstart', (_, sprite) => {
      const st = this._spriteToMatState(sprite)
      let topD = 20
      if (st?.phase === 'sorted' && this.step === 'sustain')
        topD = SUSTAIN_RESERVE_PILE_DEPTH + 8
      else if (st?.phase === 'sorted' && this.step === 'stack')
        topD = STACK_SORTED_PILE_DEPTH + 6
      else if (
        st?.phase === 'sorted' &&
        this.step === 'ignite' &&
        this._igniteMechanicsPhase &&
        correctSortZoneForMatId(st.id) === 'tinder' &&
        st.quality !== 'BAD'
      )
        topD = STACK_SORTED_PILE_DEPTH + 6
      else if (
        st?.phase === 'sorted' &&
        this.step === 'spread' &&
        this._spreadAwaitingRemediation
      )
        topD = SPREAD_REMEDIATION_DRAG_DEPTH + 8
      sprite.setDepth(topD)
      st?.label?.setDepth(topD + 1)
    })

    this.input.on('drag', (_, sprite, dragX, dragY) => {
      sprite.setPosition(dragX, dragY)
      const state = this._spriteToMatState(sprite)
      if (state) state.label.setPosition(dragX, dragY + ITEM_H / 2 + 4)
    })

    this.input.on('dragend', (pointer, sprite) => {
      const state = this._spriteToMatState(sprite)
      const wx = pointer.worldX
      const wy = pointer.worldY

      if (this.step === 'sustain' && state) {
        this._onSustainReserveDragEnd(state, wx, wy)
        const baseDepth =
          state.phase === 'sustain_used'
            ? SUSTAIN_RESERVE_DIM_PILE_DEPTH
            : SUSTAIN_RESERVE_PILE_DEPTH
      sprite.setDepth(baseDepth)
        state.label?.setDepth(baseDepth + 1)
        return
      }

      if (this.step === 'ignite') {
        const sortedTinderReserve =
          state &&
          state.phase === 'sorted' &&
          state.isSortable &&
          state.quality !== 'BAD' &&
          correctSortZoneForMatId(state.id) === 'tinder' &&
          this._igniteMechanicsPhase
        if (sortedTinderReserve) {
          this._onIgniteReserveTinderDragEnd(state, wx, wy)
        } else if (state) {
          this._bounceToStackOrHome(state)
        }
        const d = state?.phase === 'sorted' ? STACK_SORTED_PILE_DEPTH : 5
        sprite.setDepth(d)
        state?.label?.setDepth(d + 1)
        return
      }

      let baseDepth = 5
      if (state?.phase === 'sorted' && this.step === 'stack')
        baseDepth = STACK_SORTED_PILE_DEPTH
      else if (
        state?.phase === 'sorted' &&
        this.step === 'spread' &&
        this._spreadAwaitingRemediation
      )
        baseDepth = SPREAD_REMEDIATION_DRAG_DEPTH

      sprite.setDepth(baseDepth)
      state?.label?.setDepth(baseDepth + 1)

      if (!state) return

      if (this.step === 'sort') this._onSortDragEnd(state, wx, wy)
      else if (this.step === 'spread') this._onSpreadDragEnd(state, wx, wy)
      else if (this.step === 'stack') this._onStackDragEnd(state, wx, wy)
    })
  }

  _spriteToMatState(sprite) {
    for (const state of Object.values(this._matStates)) {
      if (state.sprite === sprite) return state
    }
    return null
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLEAR STEP
  // ════════════════════════════════════════════════════════════════════════════

  _enterRenIntro() {
    this._titleText.setText(`Day ${this.day} — The forest`)
    this._dialogue.showSequence([
      { speaker: 'Ren',   text: 'Huh. Do not see many people out this deep.' },
      { speaker: 'Ren',   text: 'Especially not before a storm.' },
      { speaker: 'Aiden', text: 'I could say the same about you.' },
      { speaker: 'Ren',   text: 'Fair enough.' },
      { speaker: 'Ren',   text: 'I am Ren — I hunt out here most seasons.' },
      { speaker: 'Ren',   text: 'You setting up camp for the night?' },
      { speaker: 'Aiden', text: 'I need to be here when the rain stops. There is an herb that only shows itself after a storm.' },
      { speaker: 'Ren',   text: 'Shimmerleaf? You are going to need a fire for that — you will never spot it in the dark.' },
      { speaker: 'Ren',   text: 'Tell you what — I will camp here tonight too. Two people keeping a fire alive beats one.' },
      { speaker: 'Aiden', text: 'I would not say no to that.' },
      { speaker: 'Ren',   text: 'Then let us get moving. Rain is not going to wait.' },
    ], () => {
      this._dialogue.hide()
      this._enterStep('clear')
    })
  }

  _enterClear() {
    this._titleText.setText(`Day ${this.day} — Clear the camp`)

    // Visual setup — not interactive yet
    this._debrisObjects.forEach(({ circle, icon }) => {
      circle.setAlpha(1)
      icon.setAlpha(1)
    })
    Object.values(this._sortZones).forEach(z => z.rect.setAlpha(0.3))
    this._stackGraphics.setAlpha(0.3)
    this._stackLabelTexts.forEach(t => t.setAlpha(0.3))
    this._setFlintActive(false)
    this._clearCounterText.setText(this._clearCounterLabel()).setAlpha(1)
    this._setMoveOnVisible(true)
    if (this._forestHotspot) {
      this._forestHotspot.setVisible(true).setAlpha(0.55)
    }

    if (this._stepProposalShown.clear) {
      this._beginClearInteraction()
      return
    }
    this._stepProposalShown.clear = true

    this._dialogue.showSequence([
      { speaker: 'Ren', text: 'First things first — help me clear this ground. Dead leaves, dry debris, anything loose.' },
      { speaker: 'Ren', text: 'One stray ember lands on that and suddenly the fire is everywhere except where you want it.' },
    ], () => {
        this._dialogue.hide()
        this._beginClearInteraction()
    })
  }

  _beginClearInteraction() {
    this._debrisObjects.forEach(({ circle }) => {
      circle.setInteractive({ useHandCursor: true })
    })
    if (this._forestHotspot) {
      this._forestHotspot.setInteractive({ useHandCursor: true })
      if (this._forestPulseTween) {
        this._forestPulseTween.restart()
        this._forestPulseTween.resume()
      }
    }
  }

  _exitClear() {
    if (this._clearCompleteTimer) {
      this._clearCompleteTimer.remove()
      this._clearCompleteTimer = null
    }
    if (this._gatherDialogueTimer) {
      this._gatherDialogueTimer.remove()
      this._gatherDialogueTimer = null
    }
    if (this._dialogueTimer) {
      this._dialogueTimer.remove()
      this._dialogueTimer = null
    }

    if (this._forestHotspot) {
      this._forestHotspot.disableInteractive().setVisible(false).setAlpha(0)
    }
    if (this._forestPulseTween) this._forestPulseTween.pause()
  }

  _onForestHotspotClick() {
    if (this.step !== 'clear') return

    if (this._debrisRemaining > 0) return

    if (this._gatherDialogueDone) {
      this.registry.set('devFireBuildChain', true)
      this.scene.stop(this.scene.key)
      this.scene.start('FireBuildingCollect', { day: this.day })
      return
    }

    if (this._clearHandoffStarted) return

    if (this._clearCompleteTimer) {
      this._clearCompleteTimer.remove()
      this._clearCompleteTimer = null
    }

    this._onMoveOn()
  }

  /**
   * After clear (devFireBuildChain): Ren §4.2 camp proposal; then player clicks forest → FireCollect.
   */
  _runGatherMaterialsDialogue() {
    if (this._dialogueTimer) {
      this._dialogueTimer.remove()
      this._dialogueTimer = null
    }

    const _activateForest = () => {
      this._dialogue.hide()
      this._gatherDialogueDone = true
      this.registry.set('fireCollectCampProposalDone', true)
      if (this._forestPulseTween) {
        this._forestPulseTween.restart()
        this._forestPulseTween.resume()
      }
    }

    this._dialogue.showSequence([
      { speaker: 'Ren', text: 'Right. We need wood.' },
      { speaker: 'Ren', text: 'Rain is picking up so whatever is dry out there will not stay dry for long.' },
      { speaker: 'Ren', text: 'You go ahead — you know what to grab, yeah?' },
    ], () => {
        this._dialogue.showChoices([
          {
          text: 'Of course. Three types — tinder, kindling, fuel wood.',
            onSelect: () => {
              this._dialogue.show({
                speaker: 'Ren',
              text: 'Alright, let us go then.',
                onComplete: _activateForest,
              })
            },
          },
          {
          text: 'Roughly, but remind me.',
            onSelect: () => {
            this._dialogue.showSequence([
              { speaker: 'Ren', text: 'Three types: tinder, kindling, and fuel wood.' },
              { speaker: 'Ren', text: 'Tinder is the lightest, driest stuff — leaves, dry grass, anything that crumbles. That catches the spark.' },
              { speaker: 'Ren', text: 'Kindling is thin sticks, things you can snap. They catch from the tinder and give the flame time to grow.' },
              { speaker: 'Ren', text: 'Fuel wood is the thick pieces. Once the fire is going, that keeps it alive.' },
              { speaker: 'Ren', text: 'Aim for three handfuls of tinder, three of kindling, and two good pieces of fuel.' },
              { speaker: 'Ren', text: 'Do not grab anything heavy or damp — wet wood kills a fire before it starts.' },
            ], _activateForest)
            },
          },
        ])
    })
  }

  _onDebrisClick(index, circle, icon) {
    const obj = this._debrisObjects[index]
    if (obj.removed) return

    obj.removed = true
    circle.disableInteractive().setVisible(false)
    icon.setVisible(false)

    this._debrisRemaining--
    this._clearCounterText?.setText(this._clearCounterLabel())

    if (this._debrisRemaining === 0) this._onAllDebrisCleared()
  }

  _onAllDebrisCleared() {
    this._groundCleared = true
    this._rockRing.setVisible(true)
    this._clearCounterText?.setVisible(false)
    this._clearCheckmark?.setVisible(true)

    this._clearCompleteTimer = this.time.delayedCall(500, () => {
      this._clearCompleteTimer = null
      this._dialogue.showSequence([
        { speaker: 'Ren', text: 'Good. Bare soil.' },
        { speaker: 'Ren', text: 'Now if a spark jumps, it has nowhere to go. That is how you keep a fire under control.' },
      ], () => {
          this._dialogue.hide()
          this._onMoveOn()
      })
    })
  }

  _onMoveOn() {
    if (this._clearHandoffStarted) return
    if (this._debrisRemaining > 0) return

    if (this._clearCompleteTimer) {
      this._clearCompleteTimer.remove()
      this._clearCompleteTimer = null
    }

    this._clearHandoffStarted = true
    this._groundCleared = true
    this.registry.set('groundCleared', this._groundCleared)

    /** Scene-only: never emit global MINIGAME_COMPLETE here (wakes Narrative mid-campsite). */
    this.events.emit('fire_clear_done', {
      success: true,
      score: 1,
    })

    this._setMoveOnVisible(false)
    this._clearCounterText?.setVisible(false)
    this._clearCheckmark?.setVisible(false)

    this._runGatherMaterialsDialogue()
  }

  _clearCounterLabel() {
    return `Clear the area: ${this._debrisRemaining} remaining`
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SORT STEP
  // ════════════════════════════════════════════════════════════════════════════

  _enterSort() {
    this._titleText.setText(`Day ${this.day} — Sort your materials`)

    if (this._stepProposalShown.sort) {
      this._beginSort()
      return
    }
    this._stepProposalShown.sort = true

    this._dialogue.showSequence([
      { speaker: 'Ren', text: 'Alright — before we build anything, let us sort through this.' },
      { speaker: 'Ren', text: 'Group them by type so when you build the lay you can grab what you need without thinking.' },
      { speaker: 'Ren', text: 'Trust me — fumbling for the right piece when your fire is dying is not fun.' },
      { speaker: 'Ren', text: 'Go ahead and separate them out. You remember which is which, right?' },
    ], () => {
        this._dialogue.showChoices([
          {
          text: 'Tinder, kindling, fuel wood. I got it.',
            onSelect: () => {
              this._dialogue.show({
                speaker: 'Ren',
              text: 'Go for it then.',
                onComplete: () => { this._dialogue.hide(); this._beginSort() },
              })
            },
          },
          {
          text: 'Walk me through it again.',
            onSelect: () => {
            this._dialogue.showSequence([
              { speaker: 'Ren', text: 'Sure. Three piles.' },
              { speaker: 'Ren', text: 'Tinder is fine and light — leaves, dry grass, anything that crumbles. That catches the spark.' },
              { speaker: 'Ren', text: 'Kindling is thin sticks you can snap. They catch from the tinder and keep the flame growing.' },
              { speaker: 'Ren', text: 'Fuel wood is the heavy stuff — thick branches. They burn slow and long through the night.' },
              { speaker: 'Ren', text: 'Pick each piece up. Ask yourself — crumbly light, thin snappy, or heavy solid?' },
            ], () => { this._dialogue.hide(); this._beginSort() })
            },
          },
        ])
    })
  }

  _beginSort() {
    const H = this.scale.height
    const W = this.scale.width
    const stashX = W * 0.12
    const stashY = H * 0.34

    Object.values(this._sortZones).forEach(z => {
      this.tweens.add({ targets: z.rect, alpha: 0.85, duration: 300 })
    })
    this._sortZoneParts.forEach((part) => {
      const tg = this._sortZoneHudLabelTargets(part)
      this.tweens.add({ targets: tg, alpha: 1, duration: 300 })
    })

    for (const state of Object.values(this._matStates)) {
      if (!state.sprite || !state.label) continue
      state.sprite.setPosition(stashX, stashY)
      state.label.setPosition(stashX, stashY + ITEM_H / 2 + 4)
      state.sprite.setAlpha(0)
      state.label.setAlpha(0)
      if (state.sprite.input) {
        this.input.setDraggable(state.sprite, false)
        state.sprite.disableInteractive()
      }
    }

    if (this._collected.length === 0) {
      this._destroySortPackHud()
      return
    }

    this._scatterSortMaterialsIntoLeft()
  }

  _destroySortPackHud() {
    for (const n of this._sortPackUiNodes) {
      n.destroy()
    }
    this._sortPackUiNodes.length = 0
  }

  /**
   * After forest collect: spread pile sprites randomly on the left playfield (no backpack / Take Out).
   */
  _scatterSortMaterialsIntoLeft() {
    this._destroySortPackHud()

    const W = this.scale.width
    const H = this.scale.height
    const pad = 44
    const left = pad
    const right = Math.round(W * 0.38)
    const top = Math.round(H * 0.14)
    const bottom = Math.round(H * 0.58)

    let ordered = this._collected
      .map((_, idx) => this._matStates[`pile_${idx}`])
      .filter(Boolean)
    ordered = Phaser.Utils.Array.Shuffle([...ordered])

    const placed = []
    const minD = 56

    const fits = (x, y) => {
      for (const p of placed) {
        const dx = x - p.x
        const dy = y - p.y
        if (dx * dx + dy * dy < minD * minD) return false
      }
      return true
    }

    ordered.forEach((state) => {
      let x = left
      let y = top
      let ok = false
      for (let t = 0; t < 48 && !ok; t++) {
        x = Phaser.Math.Between(left, right)
        y = Phaser.Math.Between(top, bottom)
        ok = fits(x, y)
      }
      placed.push({ x, y })

      state.homePos = { x, y }
      state.sprite.setPosition(x, y).setAlpha(1)
      state.label.setPosition(x, y + ITEM_H / 2 + 4).setAlpha(1)
    })

      this._enableSortInteractionAfterUnpack()
  }

  _enableSortInteractionAfterUnpack() {
    if (this._sortFeedbackLocked) return
    for (const state of Object.values(this._matStates)) {
      if (state.phase !== 'pile') continue

      if (state.isSortable) {
        state.sprite.setInteractive({ useHandCursor: true })
        this.input.setDraggable(state.sprite)
      } else {
        state.sprite.setInteractive({ useHandCursor: true })
        state.sprite.off('pointerup')
        state.sprite.on('pointerup', () => {
          if (this.step === 'sort') {
            this._showRenLines(WET_MATERIAL_REN_LINES, () => this._greyOut(state))
          }
        })
      }
    }
  }

  _disableSortPileDragForRenFeedback() {
    this._sortFeedbackLocked = true
    for (const state of Object.values(this._matStates)) {
      if (state.phase !== 'pile') continue
      if (!state.sprite.input) continue
      this.input.setDraggable(state.sprite, false)
      state.sprite.disableInteractive()
    }
  }

  _restoreSortPileDragAfterRenFeedback() {
    this._sortFeedbackLocked = false
    if (this.step !== 'sort') return
    this._enableSortInteractionAfterUnpack()
  }

  _exitSort() {
    this._sortFeedbackLocked = false
    this._destroySortPackHud()

    for (const state of Object.values(this._matStates)) {
      this.input.setDraggable(state.sprite, false)
      state.sprite.disableInteractive()
    }

    Object.values(this._sortZones).forEach(z => {
      this.tweens.killTweensOf(z.rect)
      this.tweens.add({ targets: z.rect, alpha: 0.3, duration: 300 })
    })
    this._sortZoneParts.forEach((part) => {
      const tg = this._sortZoneHudLabelTargets(part)
      this.tweens.killTweensOf(tg)
      this.tweens.add({ targets: tg, alpha: 0.3, duration: 300 })
    })
  }

  _onSortDragEnd(state, dropX, dropY) {
    for (const [zoneId, zone] of Object.entries(this._sortZones)) {
      if (zone.bounds.contains(dropX, dropY)) {
        this._trySortPlace(state, zoneId)
        return
      }
    }
    this._bounceBack(state)
  }

  _trySortPlace(state, zoneId) {
    const correctZone = correctSortZoneForMatId(state.id)

    if (correctZone == null) {
      this._bounceBack(state)
      this._showRenLines(WET_MATERIAL_REN_LINES, () => this._greyOut(state))
      return
    }

    if (zoneId === correctZone) {
      this._sortCorrect(state, zoneId)
    } else {
      this._sortWrong(state, zoneId)
    }
  }

  _sortCorrect(state, zoneId) {
    state.phase      = 'sorted'
    state.sortZoneId = normalizeStackSortZoneId(zoneId)
    state.sprite.disableInteractive()
    this.input.setDraggable(state.sprite, false)

    const zone   = this._sortZones[zoneId]
    const offset = (this._sortedCount % 2 === 0) ? -16 : 16
    const snapX  = zone.x + offset
    const snapY  = zone.y - 10
    state.zonePos = { x: snapX, y: snapY }

    const showRenIntro = !this._sortRenZoneIntroShown[zoneId]
    if (showRenIntro) this._sortRenZoneIntroShown[zoneId] = true

    this._sortedCount++
    this._refreshSortZoneMaterialCounts()

    const runAfterTween = () => {
      state.label.setPosition(snapX, snapY + ITEM_H / 2 + 4)
      if (showRenIntro) {
        this._flashZone(zoneId, 0x44dd44)
        this._disableSortPileDragForRenFeedback()
        const lines = SORT_FIRST_CORRECT_REN[zoneId] ?? SORT_FIRST_CORRECT_REN.tinder
        this._dialogue.showSequence(
          lines.map((text) => ({ speaker: 'Ren', text })),
          () => {
            this._dialogue.hide()
            this._restoreSortPileDragAfterRenFeedback()
            this._checkSortComplete()
          },
        )
      } else {
        this._flashZone(zoneId, 0x44dd44, 520)
        this._checkSortComplete()
      }
    }

    this.tweens.add({
      targets: [state.sprite, state.label],
      x: snapX, y: snapY,
      duration: 200, ease: 'Back.Out',
      onComplete: runAfterTween,
    })
  }

  _sortWrong(state, zoneId) {
    this._sortHadError = true
    const correctZone = correctSortZoneForMatId(state.id)
    const renLines = sortWrongRenLines(correctZone, zoneId)

    this._flashZone(zoneId, 0xdd4444)
    this._bounceBack(state)

    if (!renLines.length) {
      this._restoreSortPileDragAfterRenFeedback()
      return
    }

    this._disableSortPileDragForRenFeedback()
    this._dialogue.showSequence(
      renLines.map((text) => ({ speaker: 'Ren', text })),
      () => {
        this._dialogue.hide()
        this._restoreSortPileDragAfterRenFeedback()
      },
    )
  }

  _checkSortComplete() {
    if (this._sortedCount < this._sortableIds.length) return

    const sortedPayload = this._buildSortedMaterialsRegistryPayload()
    this.registry.set('sortedMaterials', sortedPayload)
    assertSortedMaterialsShape(sortedPayload, 'sortComplete')

    this._disableSortPileDragForRenFeedback()
    this._dialogue.showSequence(
      SORT_COMPLETE_REN_LINES.map((text) => ({ speaker: 'Ren', text })),
      () => {
        this._dialogue.hide()
        this._restoreSortPileDragAfterRenFeedback()
        this._enterStep('stack')
      },
    )
  }

  /** §559–563 registry shape — one entry per sorted pile slot from `_matStates`. */
  _buildSortedMaterialsRegistryPayload() {
    const out = { tinder: [], kindling: [], fuel_wood: [] }
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'sorted' || !st.isSortable || !st.sortZoneId) continue
      const z = normalizeStackSortZoneId(st.sortZoneId)
      if (!out[z]) continue
      out[z].push({ id: st.id, quality: st.quality })
    }
    return out
  }

  /** Keep registry `sortedMaterials` aligned with piles still in `sorted` phase (stack / spread remediation). */
  _syncSortedMaterialsRegistryLive() {
    const sortedPayload = this._buildSortedMaterialsRegistryPayload()
    this.registry.set('sortedMaterials', sortedPayload)
    if (import.meta.env.DEV) assertSortedMaterialsShape(sortedPayload, 'sortedMaterialsLive')
    this._refreshSortZoneMaterialCounts()
  }

  _bounceBack(state) {
    const { x, y } = state.homePos
    this.tweens.add({ targets: state.sprite, x, y, duration: 280, ease: 'Back.Out' })
    this.tweens.add({ targets: state.label,  x, y: y + ITEM_H / 2 + 4, duration: 280, ease: 'Back.Out' })
  }

  _flashZone(zoneId, color, restoreMs = 400) {
    const zone = this._sortZones[zoneId]
    zone.rect.setStrokeStyle(3, color)
    this.time.delayedCall(restoreMs, () => zone.rect.setStrokeStyle(2, 0xaaaaaa))
  }

  _greyOut(state) {
    if (state.greyed) return
    state.greyed = true
    state.sprite.disableInteractive()
    this.input.setDraggable(state.sprite, false)
    this.tweens.add({ targets: [state.sprite, state.label], alpha: 0.3, duration: 300 })
  }

  _destroyStackBuildFire() {
    this._stackBuildFireBg?.destroy()
    this._stackBuildFireTxt?.destroy()
    this._stackBuildFireBg  = null
    this._stackBuildFireTxt = null
  }

  _destroyStackCategoryCards() {
    for (const c of this._stackCategoryCards) {
      c.bg?.destroy()
      c.txt?.destroy()
    }
    this._stackCategoryCards = []
  }

  _destroyStackCrossSection() {
    if (this._stackCrossSectionCont) {
      this._stackCrossSectionCont.destroy(true)
      this._stackCrossSectionCont = null
    }
    this._stackCrossSectionGeom = null
    this._stackLayerPlacements = { tinder: [], kindling: [], fuel_wood: [] }
    this._stackLayerHighlightG = null
  }

  _stackSortedCategory(state) {
    const z = state.sortZoneId ?? correctSortZoneForMatId(state.id)
    return normalizeStackSortZoneId(z)
  }

  _stackRemainingInPile(zoneCat) {
    let n = 0
    for (const s of Object.values(this._matStates)) {
      if (s.phase !== 'sorted' || !s.isSortable) continue
      if (s.quality === 'BAD') continue
      if (this._stackSortedCategory(s) === zoneCat) n++
    }
    return n
  }

  /** Sorted-but-not-placed count per stack zone; mirrors `_buildSortZoneLayPreview` reserve rows (spread remediation excludes duplicate pile sprite). */
  _stackReserveCountInSortZone(zoneId) {
    let n = 0
    for (const s of Object.values(this._matStates)) {
      if (s.phase !== 'sorted' || !s.isSortable) continue
      const z = normalizeStackSortZoneId(s.sortZoneId ?? correctSortZoneForMatId(s.id))
      if (z !== zoneId) continue
      if (
        this.step === 'spread' &&
        this._spreadAwaitingRemediation &&
        this._spreadRemediationZone &&
        correctSortZoneForMatId(s.id) === this._spreadRemediationZone
      )
        continue
      n++
    }
    return n
  }

  _createStackCategoryCards(W, H) {
    this._destroyStackCategoryCards()
    const zoneY = H * 0.8
    const belowY = zoneY + ZONE_H / 2 + 14 + STACK_CARD_H / 2
    const gap = 14
    const totalW = 3 * STACK_CARD_W + 2 * gap
    let x = W / 2 - totalW / 2 + STACK_CARD_W / 2

    const defs = [
      { zoneId: 'tinder', label: 'Tinder' },
      { zoneId: 'kindling', label: 'Kindling' },
      { zoneId: 'fuel_wood', label: 'Fuel Wood' },
    ]
    for (const d of defs) {
      const bg = this.add
        .rectangle(x, belowY, STACK_CARD_W, STACK_CARD_H, 0x3a3020)
        .setStrokeStyle(2, 0x7a6a48)
        .setDepth(12)
      const txt = this.add
        .text(x, belowY, `${d.label} × 0`, {
          fontSize: '13px',
          fontFamily: 'Georgia, serif',
          fill: '#e8d8a8',
        })
        .setOrigin(0.5)
        .setDepth(13)
      this._stackCategoryCards.push({ zoneId: d.zoneId, label: d.label, bg, txt })
      x += STACK_CARD_W + gap
    }
    this._refreshStackCategoryCards()
  }

  /**
   * Stack / lay-build: counts pieces still in sort piles (`phase === 'sorted'`).
   * Ignite onward: placed on that layer **plus** spare still in the same sort bucket
   * (matches zone placeholders and collect inventory).
   */
  _refreshStackCategoryCards() {
    const layerIdByZone = { tinder: 'bottom', kindling: 'middle', fuel_wood: 'top' }
    const showOnLay =
      this.step === 'ignite' || this.step === 'spread' || this.step === 'sustain'

    for (const c of this._stackCategoryCards) {
      if (this.step === 'sustain') {
        c.bg.setVisible(false)
        c.txt.setVisible(false)
      } else {
        c.bg.setVisible(true)
        c.txt.setVisible(true)
      }
    }
    if (this.step === 'sustain') {
      this._refreshSortZoneLayPreview()
      return
    }

    for (const c of this._stackCategoryCards) {
      const placed = this._stackPlacedCountInLayer(layerIdByZone[c.zoneId])
      const spare = this._stackReserveCountInSortZone(c.zoneId)
      const n =
        this.step === 'ignite'
          ? placed
          : showOnLay
            ? placed + spare
            : this._stackRemainingInPile(c.zoneId)
      c.txt.setText(`${c.label} × ${n}`)
      const empty = n <= 0
      c.bg.setFillStyle(empty ? 0x1f1810 : 0x3a3020)
      c.bg.setStrokeStyle(2, empty ? 0x4a4030 : 0x7a6a48)
      c.bg.setAlpha(empty ? 0.5 : 1)
      c.txt.setAlpha(empty ? 0.4 : 1)
    }
    this._refreshSortZoneLayPreview()
  }

  /** World-space rectangle for the active stack layer band (green highlight while building). */
  _stackActiveLayerWorldBounds() {
    const cont = this._stackCrossSectionCont
    const geom = this._stackCrossSectionGeom
    if (!cont || !geom || this._stackLayLockedComplete) return null

    const zoneId = STACK_LAYER_ORDER[this._stackActiveLayerIndex] ?? 'tinder'
    const layerBandIndex = { fuel_wood: 0, kindling: 1, tinder: 2 }[zoneId]
    if (layerBandIndex === undefined) return null

    const y0 = geom.groundH + layerBandIndex * geom.layerH
    const fillH = geom.layerH - 3
    const pad = 10
    const innerLeft = 5 - pad
    const innerTop = y0 + 2 - pad
    const innerW = geom.pitW - 10 + 2 * pad
    const innerH = fillH + 2 * pad
    return new Phaser.Geom.Rectangle(
      cont.x + innerLeft,
      cont.y + innerTop,
      innerW,
      innerH,
    )
  }

  /** Full cross-section panel in world space (left of pit); drops here map by vertical band. */
  _stackCrossSectionWorldBounds() {
    const cont = this._stackCrossSectionCont
    const geom = this._stackCrossSectionGeom
    if (!cont || !geom) return null
    const h = geom.groundH + geom.bodyH
    return new Phaser.Geom.Rectangle(cont.x, cont.y, geom.pitW, h)
  }

  /** Band order matches _updateStackLayerHighlight: top = fuel_wood, mid = kindling, bottom = tinder. */
  _stackZoneIdAtCrossSectionWorldPos(wx, wy) {
    const cont = this._stackCrossSectionCont
    const geom = this._stackCrossSectionGeom
    if (!cont || !geom) return null
    const ly = wy - cont.y
    if (ly < 0 || ly > geom.groundH + geom.bodyH) return null
    if (ly < geom.groundH) return 'fuel_wood'
    const rel = ly - geom.groundH
    if (rel < geom.layerH) return 'fuel_wood'
    if (rel < 2 * geom.layerH) return 'kindling'
    return 'tinder'
  }

  _pitStackDropContains(wx, wy) {
    const dx = wx - this._pitX
    const dy = wy - this._pitY
    const r = STACK_TOP_R + 28
    return dx * dx + dy * dy <= r * r
  }

  /** Approximate layer by vertical offset from pit center (view: higher = more upper / fuel). */
  _stackZoneIdAtPitWorldPos(wx, wy) {
    const d = wy - this._pitY
    if (d < -36) return 'fuel_wood'
    if (d > 36) return 'tinder'
    return 'kindling'
  }

  _onStackDragEnd(state, dropX, dropY) {
    if (state.phase !== 'sorted' || !state.isSortable) return
    if (state.quality === 'BAD') return
    if (this.step !== 'stack') return

    if (this._stackLayLockedComplete) {
      this._bounceToStackOrHome(state)
      return
    }

    let targetZone = null
    for (const [zoneId, zone] of Object.entries(this._sortZones)) {
      if (zone.bounds.contains(dropX, dropY)) {
        targetZone = zoneId
        break
      }
    }
    if (!targetZone) {
      const csBounds = this._stackCrossSectionWorldBounds()
      if (csBounds && csBounds.contains(dropX, dropY)) {
        targetZone = this._stackZoneIdAtCrossSectionWorldPos(dropX, dropY)
      }
    }
    if (!targetZone && this._pitStackDropContains(dropX, dropY)) {
      targetZone = this._stackZoneIdAtPitWorldPos(dropX, dropY)
    }
    if (!targetZone) {
      this._bounceToStackOrHome(state)
      return
    }

    const need = STACK_LAYER_ORDER[this._stackActiveLayerIndex] ?? 'tinder'
    if (targetZone !== need) {
      this._stackHadError = true
      this._disableStackSortedDragForRen()
      const renLines = stackWrongLayerRenLines(need, targetZone)
      this._bounceToStackOrHome(state)
      if (!renLines.length) {
        this._restoreStackSortedDragAfterRen()
        return
      }
      this._dialogue.showSequence(
        renLines.map((text) => ({ speaker: 'Ren', text })),
        () => {
          this._dialogue.hide()
          this._restoreStackSortedDragAfterRen()
        },
      )
      return
    }

    this._tryStackPlace(state, targetZone)
  }

  /** Places sorted sprites over sort zones (visible). Needed when skipping sort via dev/mock jump. */
  _ensureSortedMaterialsZoneLayout() {
    for (const state of Object.values(this._matStates)) {
      if (state.phase !== 'sorted' || !state.isSortable || !state.sortZoneId || !state.sprite) continue
      const zone = this._sortZones[state.sortZoneId]
      if (!zone) continue
      if (!state.zonePos) {
        const h = (state.pileKey ?? '').length
        const offset = (h % 2 === 0) ? -16 : 16
        state.zonePos = { x: zone.x + offset, y: zone.y - 10 }
      }
      const dim = state.greyed || state.quality === 'BAD'
      state.sprite.setVisible(true)
      state.label?.setVisible(true)
      state.sprite.setPosition(state.zonePos.x, state.zonePos.y)
      state.label?.setPosition(state.zonePos.x, state.zonePos.y + ITEM_H / 2 + 4)
      state.sprite.setAlpha(dim ? 0.3 : 1)
      state.label?.setAlpha(dim ? 0.3 : 1)
    }
  }

  /**
   * Pit `placed` sprites visible on ignite/spread/sustain; stack keeps them alpha-0 (cross-section markers).
   */
  _refreshFireLaySpritePresentation() {
    const showPlacedInPit =
      this.step === 'ignite' || this.step === 'spread' || this.step === 'sustain'
    for (const st of Object.values(this._matStates)) {
      if (!st.sprite) continue
      if (st.phase === 'burned' || st.phase === 'ignite_spent') {
        st.sprite.setVisible(false)
        st.label?.setVisible(false)
        continue
      }
      if (st.phase !== 'placed' || !st.layerId || !st.pitPos) continue
      if (showPlacedInPit) {
        const dim = st.greyed || st.quality === 'BAD'
        const a = dim ? 0.35 : 1
        st.sprite.setPosition(st.pitPos.x, st.pitPos.y)
        st.label?.setPosition(st.pitPos.x, st.pitPos.y + ITEM_H / 2 + 4)
        st.sprite.setVisible(true).setAlpha(a)
        st.label?.setVisible(true).setAlpha(a)
        st.sprite.setDepth(15)
        st.label?.setDepth(16)
      } else {
        st.sprite.setAlpha(0)
        st.label?.setAlpha(0)
      }
    }
  }

  _syncStackSortedDraggability() {
    if (this.step === 'sustain') {
      this._syncSustainReserveDraggability()
      return
    }

    if (this.step === 'ignite') {
      this._syncIgniteSortedDraggability()
      return
    }

    if (
      this.step === 'spread' &&
      this._spreadAwaitingRemediation &&
      this._spreadRemediationZone
    ) {
      this._spreadApplyRemediationSortedDragState()
      return
    }

    if (this.step === 'stack' && this._stackRenFeedbackLocked) {
      for (const state of Object.values(this._matStates)) {
        if (!state.sprite) continue
        if (state.phase !== 'sorted' || !state.isSortable) continue
        this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
      }
      return
    }

    // Lay UI not built yet (Ren proposal / pit tap) — piles stay visible but non-draggable.
    if (this.step === 'stack' && !this._stackCrossSectionCont) {
      for (const state of Object.values(this._matStates)) {
        if (!state.sprite) continue
        if (state._stackTapHandler) {
          state.sprite.off('pointerup', state._stackTapHandler)
          state._stackTapHandler = null
        }
        if (state.phase === 'sorted' && state.isSortable) {
          this._safeSetDraggable(state.sprite, false)
          state.sprite.disableInteractive()
        }
      }
      return
    }

    for (const state of Object.values(this._matStates)) {
      if (!state.sprite) continue
      if (state._stackTapHandler) {
        state.sprite.off('pointerup', state._stackTapHandler)
        state._stackTapHandler = null
      }
      if (state.phase !== 'sorted' || !state.isSortable) {
        this._safeSetDraggable(state.sprite, false)
        continue
      }
      if (state.quality === 'BAD') {
        this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
        state.sprite.setDepth(5)
        state.label?.setDepth(6)
        continue
      }
      const z = this._stackSortedCategory(state)
      if (z == null) {
        this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
        state.sprite.setDepth(5)
        state.label?.setDepth(6)
        continue
      }
      const rem = this._stackRemainingInPile(z)
      if (rem <= 0) {
        this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
        state.sprite.setDepth(5)
        state.label?.setDepth(6)
      } else {
        const pileDepth = this.step === 'stack' ? STACK_SORTED_PILE_DEPTH : 5
        const labelDepth = this.step === 'stack' ? STACK_SORTED_PILE_DEPTH + 1 : 6
        state.sprite.setDepth(pileDepth)
        state.label?.setDepth(labelDepth)
        state.sprite.setInteractive({ useHandCursor: true })
        if (this.step === 'stack') {
          this._safeSetDraggable(state.sprite, true)
        } else {
          this._safeSetDraggable(state.sprite, false)
        }
      }
    }
  }

  /** Sustain — drag spare sorted piles onto the pit (`_onSustainReserveDragEnd`). */
  _syncSustainReserveDraggability() {
    for (const state of Object.values(this._matStates)) {
      if (!state.sprite) continue
      if (state._stackTapHandler) {
        state.sprite.off('pointerup', state._stackTapHandler)
        state._stackTapHandler = null
      }
      if (state.phase !== 'sorted' || !state.isSortable) {
        this._safeSetDraggable(state.sprite, false)
        continue
      }
      const zoneId = this._stackSortedCategory(state)
      const keys = zoneId ? this._sustainBackupKeysByZone[zoneId] : null
      const inReserve = !!(zoneId && keys?.includes(state.pileKey))
      const blocked =
        this._nightComplete ||
        this._floodLocked ||
        state.quality === 'BAD' ||
        !inReserve

      if (blocked) {
        this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
        state.sprite.setDepth(SUSTAIN_RESERVE_DIM_PILE_DEPTH)
        state.label?.setDepth(SUSTAIN_RESERVE_DIM_PILE_DEPTH + 1)
      } else {
        state.sprite.setDepth(SUSTAIN_RESERVE_PILE_DEPTH)
        state.label?.setDepth(SUSTAIN_RESERVE_PILE_DEPTH + 1)
        state.sprite.setInteractive({ useHandCursor: true })
        this._safeSetDraggable(state.sprite, true)
      }
    }
  }

  /** Ignite — reserve piles visible; only tinder becomes draggable while refilling bottom after fail. */
  _syncIgniteSortedDraggability() {
    for (const state of Object.values(this._matStates)) {
      if (!state.sprite) continue
      if (state._stackTapHandler) {
        state.sprite.off('pointerup', state._stackTapHandler)
        state._stackTapHandler = null
      }
      if (state.phase !== 'sorted' || !state.isSortable) {
        this._safeSetDraggable(state.sprite, false)
        continue
      }
      const allowDrag =
        this.step === 'ignite' &&
        this._igniteMechanicsPhase &&
        correctSortZoneForMatId(state.id) === 'tinder' &&
        state.quality !== 'BAD'
      const dim = state.greyed || state.quality === 'BAD'
      const pileDepth = STACK_SORTED_PILE_DEPTH
      state.sprite.setDepth(pileDepth)
      state.label?.setDepth(pileDepth + 1)
      if (allowDrag) {
        state.sprite.setInteractive({ useHandCursor: true })
        this._safeSetDraggable(state.sprite, true)
        state.sprite.setAlpha(dim ? 0.3 : 1)
        state.label?.setAlpha(dim ? 0.3 : 1)
      } else {
        this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
        state.sprite.setAlpha(dim ? 0.3 : 1)
        state.label?.setAlpha(dim ? 0.3 : 1)
      }
    }
  }

  _createStackCrossSection() {
    this._destroyStackCrossSection()

    const pitW = 120
    const groundH = 12
    const bodyH = 102
    const layerH = bodyH / 3
    const totalH = groundH + bodyH
    const cx = this._pitX - 128
    const cy = this._pitY - 56

    const cont = this.add.container(cx, cy).setDepth(3)

    const g = this.add.graphics()
    g.fillStyle(0x100c08, 1)
    g.fillRoundedRect(0, 0, pitW, totalH, 5)
    g.lineStyle(2, 0x5c4834, 1)
    g.strokeRoundedRect(0, 0, pitW, totalH, 5)

    g.fillStyle(0x16100c, 1)
    g.fillRect(4, 3, pitW - 8, groundH - 5)

    const layerFill = [0x2a1e14, 0x322318, 0x3a281c]
    for (let i = 0; i < 3; i++) {
      const y = groundH + i * layerH
      g.fillStyle(layerFill[i], 0.94)
      g.fillRect(4, y + 2, pitW - 8, layerH - 3)
      if (i < 2) {
        g.lineStyle(1, 0x4a3828, 1)
        g.lineBetween(4, y + layerH, pitW - 4, y + layerH)
      }
    }

    cont.add(g)

    const layerHg = this.add.graphics()
    cont.add(layerHg)
    this._stackLayerHighlightG = layerHg

    this._stackCrossSectionCont = cont
    this._stackCrossSectionGeom = { pitW, groundH, bodyH, layerH }
    this._updateStackLayerHighlight()
  }

  _updateStackLayerHighlight() {
    const geom = this._stackCrossSectionGeom
    const hg = this._stackLayerHighlightG
    if (!geom || !hg) return

    hg.clear()
    const zoneId = this._stackLayLockedComplete
      ? (this._stackSparkTargetZone ?? 'tinder')
      : STACK_LAYER_ORDER[this._stackActiveLayerIndex] ?? 'tinder'
    const layerBandIndex = { fuel_wood: 0, kindling: 1, tinder: 2 }[zoneId]
    if (layerBandIndex === undefined) return

    const y0 = geom.groundH + layerBandIndex * geom.layerH
    const fillH = geom.layerH - 3

    if (this._stackLayLockedComplete) {
      hg.fillStyle(0xffc864, 0.22)
      hg.lineStyle(2, 0xdd9838, 0.85)
    } else {
      hg.fillStyle(0x6acc88, 0.18)
      hg.lineStyle(2, 0x448866, 0.75)
    }
    hg.fillRect(5, y0 + 2, geom.pitW - 10, fillH)
    hg.strokeRect(5, y0 + 2, geom.pitW - 10, fillH)
  }

  _destroyStackLayerNavUi() {
    this._stackFinishLayPulseTween?.stop()
    this._stackFinishLayPulseTween = null
    this._stackLockedBlowBg?.destroy()
    this._stackLockedBlowTxt?.destroy()
    this._stackLockedBlowBg = null
    this._stackLockedBlowTxt = null
    this._stackNextLayerBg?.destroy()
    this._stackNextLayerTxt?.destroy()
    this._stackPrevLayerBg?.destroy()
    this._stackPrevLayerTxt?.destroy()
    this._stackSparkLabel?.destroy()
    for (const p of this._stackSparkPickers) {
      p.bg?.destroy()
      p.txt?.destroy()
    }
    this._stackNextLayerBg  = null
    this._stackNextLayerTxt = null
    this._stackPrevLayerBg  = null
    this._stackPrevLayerTxt = null
    this._stackSparkLabel  = null
    this._stackSparkPickers = []
  }

  _createStackLayerNavUi(W, H) {
    this._destroyStackLayerNavUi()

    const pxNext = this._pitX - 175
    const pxPrev = pxNext - 154
    const ny = H * 0.36

    this._stackPrevLayerBg = this.add
      .rectangle(pxPrev, ny, 140, 36, 0x2a2218)
      .setStrokeStyle(2, 0x6a6850)
      .setDepth(15)

    this._stackPrevLayerTxt = this.add
      .text(pxPrev, ny, 'Previous layer', {
        fontSize: '12px',
        fontFamily: 'Georgia, serif',
        fill: '#c8b8a0',
      })
      .setOrigin(0.5)
      .setDepth(16)

    this._stackPrevLayerBg.on('pointerover', () => {
      if (this.step !== 'stack' || !this._stackPrevLayerBg?.input?.enabled) return
      this._stackPrevLayerBg.setFillStyle(0x3a3028)
    })
    this._stackPrevLayerBg.on('pointerout', () => {
      if (this.step !== 'stack') return
      this._stackPrevLayerBg.setFillStyle(0x2a2218)
    })
    this._stackPrevLayerBg.on('pointerup', () => this._onStackPrevLayerClick())

    this._stackNextLayerBg = this.add
      .rectangle(pxNext, ny, 140, 36, 0x2a2218)
      .setStrokeStyle(2, 0x8a7848)
      .setDepth(15)
      .setInteractive({ useHandCursor: true })

    this._stackNextLayerTxt = this.add
      .text(pxNext, ny, 'Next layer', {
        fontSize: '13px',
        fontFamily: 'Georgia, serif',
        fill: '#d8c8a0',
      })
      .setOrigin(0.5)
      .setDepth(16)

    this._stackNextLayerBg.on('pointerover', () => {
      if (this.step === 'stack' && !this._stackLayLockedComplete)
        this._stackNextLayerBg.setFillStyle(0x3a3028)
    })
    this._stackNextLayerBg.on('pointerout', () => {
      if (this.step === 'stack' && !this._stackLayLockedComplete)
        this._stackNextLayerBg.setFillStyle(0x2a2218)
    })
    this._stackNextLayerBg.on('pointerup', () => this._onStackNextLayerClick())

    const sy = H * 0.22
    const sx0 = W / 2 - 100

    this._stackSparkLabel = this.add
      .text(sx0 - 72, sy, 'Spark at:', {
        fontSize: '12px',
        fontFamily: 'Georgia, serif',
        fill: '#9a8860',
      })
      .setOrigin(0, 0.5)
      .setDepth(16)
      .setVisible(false)

    const sparkDefs = [
      { zoneId: 'tinder', label: 'Base' },
      { zoneId: 'kindling', label: 'Mid' },
      { zoneId: 'fuel_wood', label: 'Top' },
    ]
    let sx = sx0
    for (const d of sparkDefs) {
      const bg = this.add
        .rectangle(sx, sy, 56, 28, 0x241a12)
        .setStrokeStyle(2, 0x5a4834)
        .setDepth(15)
        .setVisible(false)

      const txt = this.add
        .text(sx, sy, d.label, {
          fontSize: '11px',
          fontFamily: 'Georgia, serif',
          fill: '#c8b898',
        })
        .setOrigin(0.5)
        .setDepth(16)
        .setVisible(false)

      const zonePick = d.zoneId
      bg.on('pointerup', () => {
        if (this.step !== 'stack' || !this._stackLayLockedComplete) return
        this._stackSparkTargetZone = zonePick
        this._refreshStackSparkPickerStyles()
        this._updateStackLayerHighlight()
      })

      this._stackSparkPickers.push({ zoneId: d.zoneId, bg, txt })
      sx += 64
    }

    const blowCX = campsiteBlowCenterX(this._pitX)
    const blowCy = this._pitY
    this._stackLockedBlowBg = this.add
      .rectangle(blowCX, blowCy, CAMPSITE_BLOW_W, CAMPSITE_BLOW_H, 0x241810)
      .setStrokeStyle(2, 0x3a3028)
      .setDepth(18)
      .setAlpha(0.38)
      .setVisible(false)
    this._stackLockedBlowTxt = this.add
      .text(blowCX, blowCy + 28, 'BLOW', {
        fontSize: '13px',
        fontFamily: 'Georgia, serif',
        fill: '#5a5048',
      })
      .setOrigin(0.5)
      .setDepth(19)
      .setAlpha(0.42)
      .setVisible(false)

    this._updateStackNextLayerButtonLabel()
    this._updateStackPrevLayerButton()
    this._refreshStackNextLayerMinimumGate()
  }

  _destroyStackStrikeHint() {
    this._stackStrikeGateHint?.destroy()
    this._stackStrikeGateHint = null
  }

  /**
   * Lay incomplete: STRIKE + BLOW shown but disabled until FINISH LAY.
   * Lay locked: STRIKE enters ignite teaching + mechanics (same scene — internal step only).
   */
  _updateStackStrikeGateUi() {
    if (this.step !== 'stack' || !this._flintBg) return
    if (!this._stackStrikeGateHint) {
      const hintX = this._pitX + 242
      const hintY = this._pitY + 58
      this._stackStrikeGateHint = this.add
        .text(hintX, hintY, '', {
          fontSize: '11px',
          fontFamily: 'Georgia, serif',
          fill: '#cfa878',
          align: 'center',
          wordWrap: { width: 216 },
        })
        .setOrigin(0.5, 0)
        .setDepth(14)
    }
    if (this._stackLockedBlowBg && this._stackLockedBlowTxt) {
      this._stackLockedBlowBg.setVisible(true)
      this._stackLockedBlowTxt.setVisible(true)
    }
    if (this._stackLayLockedComplete) {
      this._setFlintActive(true)
      if (this._stackLockedBlowBg && this._stackLockedBlowTxt) {
        this._stackLockedBlowBg.setAlpha(0.42)
        this._stackLockedBlowTxt.setAlpha(0.48)
      }
      this._stackStrikeGateHint.setVisible(false)
      return
    }
    this._setFlintActive(false)
    if (this._stackLockedBlowBg && this._stackLockedBlowTxt) {
      this._stackLockedBlowBg.setAlpha(0.28)
      this._stackLockedBlowTxt.setAlpha(0.32)
    }
    const pitHint =
      this._stackActiveLayerIndex >= 2
        ? 'STRIKE / BLOW unlock after FINISH LAY.\nTap FINISH LAY above the pit (amber outline, pulsing).'
        : 'STRIKE / BLOW unlock after FINISH LAY.\nFill each band, Next layer, then FINISH LAY on the top band.'
    this._stackStrikeGateHint.setText(pitHint)
    this._stackStrikeGateHint.setVisible(true)
  }

  _beginIgniteFromStack() {
    if (this.step !== 'stack' || !this._stackLayLockedComplete) return
    this._syncStackLayRegistry()
    if (import.meta.env.DEV) {
      const reg = this.registry
      const sd = reg.get('stackData')
      const rs = reg.get('reserveMaterials')
      console.log('[DEBUG Stack → Ignite]', {
        stackData: JSON.stringify(sd),
        reserveMaterials: JSON.stringify(rs),
        stackBottom: sd?.bottom?.length,
        stackMiddle: sd?.middle?.length,
        stackTop: sd?.top?.length,
        reserveCount: rs?.length,
        total:
          (sd?.bottom?.length || 0) +
          (sd?.middle?.length || 0) +
          (sd?.top?.length || 0) +
          (rs?.length || 0),
      })
    }
    this._enterStep('ignite')
  }

  _refreshStackNextLayerButtonEmphasis() {
    if (!this._stackNextLayerBg || !this._stackNextLayerTxt) return
    if (this._stackLayLockedComplete || !this._stackNextLayerBg.visible) {
      this._stackFinishLayPulseTween?.stop()
      this._stackFinishLayPulseTween = null
      this._stackNextLayerBg.setScale(1)
      return
    }
    const lastBand = this._stackActiveLayerIndex >= 2
    if (!lastBand) {
      this._stackFinishLayPulseTween?.stop()
      this._stackFinishLayPulseTween = null
      this._stackNextLayerBg.setScale(1)
      this._stackNextLayerBg.setSize(140, 36)
      this._stackNextLayerBg.setFillStyle(0x2a2218)
      this._stackNextLayerBg.setStrokeStyle(2, 0x8a7848)
      this._stackNextLayerTxt.setStyle({
        fontSize: '13px',
        fontFamily: 'Georgia, serif',
        fill: '#d8c8a0',
        fontStyle: 'normal',
      })
      return
    }
    this._stackNextLayerBg.setSize(204, 42)
    this._stackNextLayerBg.setFillStyle(0x5a4018)
    this._stackNextLayerBg.setStrokeStyle(3, 0xf0d868)
    this._stackNextLayerTxt.setStyle({
      fontSize: '15px',
      fontFamily: 'Georgia, serif',
      fill: '#fff8e0',
      fontStyle: 'bold',
    })
    if (!this._stackFinishLayPulseTween) {
      this._stackFinishLayPulseTween = this.tweens.add({
        targets: this._stackNextLayerBg,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
  }

  _hideStackSparkControls() {
    this._stackSparkLabel?.setVisible(false)
    for (const p of this._stackSparkPickers) {
      p.bg.setVisible(false)
      p.bg.disableInteractive()
      p.txt.setVisible(false)
    }
  }

  /** Shows Previous layer, or Edit lay after Finish lay, and toggles hit targets. */
  _updateStackPrevLayerButton() {
    if (!this._stackPrevLayerBg || !this._stackPrevLayerTxt) return

    if (this._stackLayLockedComplete) {
      this._stackPrevLayerTxt.setText('Edit lay')
      this._stackPrevLayerBg.setVisible(true)
      this._stackPrevLayerTxt.setVisible(true)
      this._stackPrevLayerBg.setInteractive({ useHandCursor: true })
      return
    }

    const canPrev = this._stackActiveLayerIndex > 0
    this._stackPrevLayerTxt.setText('Previous layer')
    this._stackPrevLayerBg.setVisible(canPrev)
    this._stackPrevLayerTxt.setVisible(canPrev)
    if (canPrev) {
      this._stackPrevLayerBg.setInteractive({ useHandCursor: true })
    } else {
      this._stackPrevLayerBg.disableInteractive()
    }
  }

  _onStackPrevLayerClick() {
    if (this.step !== 'stack') return

    if (this._stackLayLockedComplete) {
      this._stackLayLockedComplete = false
      this._stackLaySummaryRenShown = false
      this._hideStackSparkControls()
      this._stackActiveLayerIndex = 2
      this._stackNextLayerBg?.setVisible(true)
      this._stackNextLayerTxt?.setVisible(true)
      this._stackNextLayerBg?.setInteractive({ useHandCursor: true })
      this._updateStackNextLayerButtonLabel()
      this._updateStackPrevLayerButton()
      this._updateStackLayerHighlight()
      this._syncStackSortedDraggability()
      this._refreshStackNextLayerMinimumGate()
      this._updateStackStrikeGateUi()
      return
    }

    if (this._stackActiveLayerIndex <= 0) return
    this._stackActiveLayerIndex--
    this._updateStackNextLayerButtonLabel()
    this._updateStackPrevLayerButton()
    this._updateStackLayerHighlight()
    this._syncStackSortedDraggability()
    this._refreshStackNextLayerMinimumGate()
    this._updateStackStrikeGateUi()
  }

  _updateStackNextLayerButtonLabel() {
    if (!this._stackNextLayerTxt) return
    const lastBand = this._stackActiveLayerIndex >= 2
    this._stackNextLayerTxt.setText(
      lastBand ? 'FINISH LAY' : 'Next layer',
    )
    this._refreshStackNextLayerButtonEmphasis()
    this._refreshStackNextLayerMinimumGate()
  }

  _refreshStackSparkPickerStyles() {
    for (const p of this._stackSparkPickers) {
      const sel = p.zoneId === this._stackSparkTargetZone
      p.bg.setStrokeStyle(sel ? 3 : 2, sel ? 0xeec866 : 0x5a4834)
    }
  }

  _onStackNextLayerClick() {
    if (this.step !== 'stack' || this._stackLayLockedComplete) return

    if (!this._stackMinimumMetForLayerIndex(this._stackActiveLayerIndex)) {
      return
    }

    if (this._stackActiveLayerIndex < 2) {
      this._stackActiveLayerIndex++
      this._updateStackNextLayerButtonLabel()
      this._updateStackLayerHighlight()
      this._updateStackPrevLayerButton()
      this._updateStackStrikeGateUi()
      return
    }

    const afterSummaryOrUnlock = () => {
      this._restoreStackSortedDragAfterRen()
    }

    this._stackLayLockedComplete = true
    this._stackNextLayerBg?.setVisible(false)
    this._stackNextLayerTxt?.setVisible(false)
    this._stackNextLayerBg?.disableInteractive()
    this._hideStackSparkControls()
    this._updateStackLayerHighlight()
    this._syncStackSortedDraggability()
    this._updateStackPrevLayerButton()
    this._updateStackStrikeGateUi()

    if (this._stackBuildFireMinimumMet() && !this._stackLaySummaryRenShown) {
      this._stackLaySummaryRenShown = true
      this._disableStackSortedDragForRen()
      this._dialogue.showSequence(
        STACK_LAY_SUMMARY_REN_LINES.map((text) => ({ speaker: 'Ren', text })),
        () => {
          this._dialogue.hide()
          afterSummaryOrUnlock()
        },
      )
    } else {
      afterSummaryOrUnlock()
    }
  }

  _relayoutStackLayerMarkers(zoneId) {
    const geom = this._stackCrossSectionGeom
    if (!geom || !this._stackCrossSectionCont) return

    const layerIndex = { fuel_wood: 0, kindling: 1, tinder: 2 }[zoneId]
    if (layerIndex === undefined) return

    const y0 = geom.groundH + layerIndex * geom.layerH
    const cy = y0 + geom.layerH / 2
    const left = 8
    for (const [i, entry] of this._stackLayerPlacements[zoneId].entries()) {
      const lx = left + i * (STACK_CS_SQ + STACK_CS_GAP)
      entry.marker.setPosition(lx + STACK_CS_SQ / 2, cy)
    }
  }

  _addStackCrossSectionMarker(zoneId, state) {
    if (!this._stackCrossSectionCont || !this._stackCrossSectionGeom) return

    const matCat = correctSortZoneForMatId(state.id)
    const col = STACK_MAT_VISUAL[matCat] ?? 0x888888

    const sq = this.add
      .rectangle(0, 0, STACK_CS_SQ, STACK_CS_SQ, col)
      .setStrokeStyle(1, 0x0a0604)
      .setInteractive({ useHandCursor: true })

    const pileKey = state.pileKey
    sq.on('pointerup', pointer => {
      pointer.event?.stopPropagation?.()
      if (this.step !== 'stack') return
      this._recallStackItem(zoneId, pileKey)
    })

    this._stackCrossSectionCont.add(sq)
    this._stackLayerPlacements[zoneId].push({ pileKey, marker: sq })
    this._relayoutStackLayerMarkers(zoneId)
  }

  _recallStackItem(zoneId, pileKey) {
    const arr = this._stackLayerPlacements[zoneId]
    const ix = arr.findIndex(e => e.pileKey === pileKey)
    if (ix < 0) return

    arr[ix].marker.destroy()
    arr.splice(ix, 1)
    this._stackDropCount[zoneId] = Math.max(0, this._stackDropCount[zoneId] - 1)
    this._stackUnitIndexInZone[zoneId] = this._stackDropCount[zoneId]
    this._relayoutStackLayerMarkers(zoneId)

    const st = this._matStates[pileKey]
    if (!st) return

    st.phase   = 'sorted'
    st.layerId = null
    st.pitPos  = null

    if (st.zonePos) {
      st.sprite.setPosition(st.zonePos.x, st.zonePos.y)
      st.label.setPosition(st.zonePos.x, st.zonePos.y + ITEM_H / 2 + 4)
    }
    st.sprite.setAlpha(1)
    st.label.setAlpha(1)

    this._refreshStackCategoryCards()
    this._syncStackSortedDraggability()
    this._updateStackLayerHighlight()
    this._refreshStackNextLayerMinimumGate()
  }

  _maybeStackFreePlacementHints(state, zoneId) {
    const want = correctSortZoneForMatId(state.id)
    if (!want || !this._stackFreeHintFlags) return
    if (want === zoneId) return
    if (this._stackFreeHintFlags.firstWrongPlacement) return
    this._stackFreeHintFlags.firstWrongPlacement = true
    const hintLines = stackMaterialMismatchRenLines(want, zoneId)
    if (!hintLines.length) return
    this._disableStackSortedDragForRen()
    this._dialogue.showSequence(
      hintLines.map((text) => ({ speaker: 'Ren', text })),
      () => {
        this._dialogue.hide()
        this._restoreStackSortedDragAfterRen()
      },
    )
  }

  _stackOnPlacedTutorial(zoneId, state) {
    const matCat = correctSortZoneForMatId(state.id)
    let lines = null

    if (
      zoneId === 'tinder' &&
      matCat === 'tinder' &&
      !this._stackTutorialFlags.firstTinderBottom
    ) {
      this._stackTutorialFlags.firstTinderBottom = true
      lines = [
        'Tinder at the base.',
        'That is where the spark catches.',
        'Good.',
      ]
    } else if (
      zoneId === 'kindling' &&
      matCat === 'kindling' &&
      !this._stackTutorialFlags.firstKindlingMiddle
    ) {
      this._stackTutorialFlags.firstKindlingMiddle = true
      lines = [
        'Kindling in the middle.',
        'It catches from the tinder and carries the flame up.',
      ]
    } else if (
      zoneId === 'fuel_wood' &&
      matCat === 'fuel_wood' &&
      !this._stackTutorialFlags.firstFuelTop
    ) {
      this._stackTutorialFlags.firstFuelTop = true
      lines = [
        'Fuel on top.',
        'Once everything below is burning, this keeps it going all night.',
      ]
    }

    if (!lines?.length) return

    this._disableStackSortedDragForRen()
    this._dialogue.showSequence(
      lines.map((text) => ({ speaker: 'Ren', text })),
      () => {
        this._dialogue.hide()
        this._restoreStackSortedDragAfterRen()
      },
    )
  }

  _restoreDefaultStackRings() {
    this._stackRingCX = this._pitX
    this._stackRingCY = this._pitY
    this._drawStackRings()
    const px = this._stackRingCX
    const py = this._stackRingCY
    this._stackLabelTexts[0].setPosition(px + STACK_BOTTOM_R + 6, py + 4)
    this._stackLabelTexts[1].setPosition(px + STACK_MIDDLE_R + 6, py - 8)
    this._stackLabelTexts[2].setPosition(px + STACK_TOP_R + 6, py - 20)
  }

  _applyStackStepZoneLabels() {
    const labels = [
      { title: 'Bottom', desc: 'Tinder — base of the lay.' },
      { title: 'Middle', desc: 'Kindling — middle layer.' },
      { title: 'Top', desc: 'Fuel wood — top layer.' },
    ]
    SORT_ZONE_DEFS.forEach((_, i) => {
      const p = this._sortZoneParts[i]
      p.labelTxt.setText(labels[i].title)
      p.descTxt.setText(labels[i].desc)
    })
  }

  _restoreSortZoneLabels() {
    SORT_ZONE_DEFS.forEach((def, i) => {
      const p = this._sortZoneParts[i]
      p.labelTxt.setText(def.label)
      p.descTxt.setText(def.description)
    })
  }

  _stackSlotInSortZone(zoneId, unitIndex) {
    const zone = this._sortZones[zoneId]
    const col = unitIndex % 3
    const row = Math.floor(unitIndex / 3)
    return {
      x: zone.x + (col - 1) * 28,
      y: zone.y - 10 + row * 16,
    }
  }

  /**
   * Harder ignition when tinder/kindling counts, material quality, and spark aim are weak.
   * Used when entering ignite from the stack step.
   */
  _computeStackIgniteTargetMultiplier() {
    const b = this._stackDropCount.tinder
    const m = this._stackDropCount.kindling
    const spark = this._stackSparkTargetZone ?? 'tinder'

    let mult = 1.0

    if (b === 0) mult *= 3.0
    else if (b === 1) mult *= 1.4
    else mult *= 1.0

    if (m === 0) mult *= 2.0
    else if (m === 1) mult *= 1.3
    else mult *= 1.0

    let badInBottom = 0
    let badInMiddle = 0
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'placed') continue
      if (st.quality === 'BAD') {
        if (st.layerId === 'bottom') badInBottom++
        else if (st.layerId === 'middle') badInMiddle++
      }
    }
    if (badInBottom > 0) mult *= 1.8 ** badInBottom
    if (badInMiddle > 0) mult *= 1.4 ** badInMiddle

    if (spark === 'tinder') {
      if (b === 0) mult *= 2.0
    } else if (spark === 'kindling') {
      mult *= 1.3
    } else {
      mult *= 1.5
    }

    return mult
  }

  _stackPlacedCountInLayer(layerId) {
    let n = 0
    for (const st of Object.values(this._matStates)) {
      if (st.phase === 'placed' && st.layerId === layerId) n++
    }
    return n
  }

  _sustainPitContains(wx, wy) {
    const dx = wx - this._pitX
    const dy = wy - this._pitY
    const r = STACK_TOP_R + 40
    return dx * dx + dy * dy <= r * r
  }

  /** Sustain spare wood — one entry per `sorted` non-BAD pile; registry mirrors this after `_syncStackLayRegistry`. */
  _rebuildSustainBackupKeysFromSortedMatStates() {
    this._sustainBackupKeysByZone = { tinder: [], kindling: [], fuel_wood: [] }
    const buckets = { tinder: [], kindling: [], fuel_wood: [] }
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'sorted' || !st.isSortable || st.quality === 'BAD') continue
      const z = this._stackSortedCategory(st)
      if (!buckets[z]) continue
      buckets[z].push(st)
    }
    const sortByPile = (a, b) => this._pileKeySortOrder(a, b)
    for (const z of Object.keys(buckets)) {
      buckets[z].sort(sortByPile)
      this._sustainBackupKeysByZone[z] = buckets[z].map((s) => s.pileKey)
    }
  }

  _sustainBackupRemainingCount() {
    let n = 0
    for (const arr of Object.values(this._sustainBackupKeysByZone)) n += arr.length
    return n
  }

  _hideSortZonesUnderSustainReservePanels(hide) {
    const ra = hide ? 0 : 0.3
    const ta = hide ? 0 : 0.3
    Object.values(this._sortZones).forEach(z => z.rect.setAlpha(ra))
    this._sortZoneParts.forEach((part) => {
      this._sortZoneHudLabelTargets(part).forEach((node) => node.setAlpha(ta))
    })
  }

  _destroySustainBackupUi() {
    if (this._sustainDragHintTxt) {
      this._sustainDragHintTxt.destroy()
      this._sustainDragHintTxt = null
    }
  }

  _ensureSustainDragHint(W, H) {
    if (this._sustainDragHintTxt?.scene) return
    const refZ = this._sortZones.kindling ?? this._sortZones.tinder
    const hintY = Math.min(
      (refZ?.y ?? H * 0.8) + ZONE_H / 2 + 44,
      H - 44,
    )
    this._sustainDragHintTxt = this.add
      .text(W / 2, hintY, 'Drag spare wood into the fire to raise the flame.', {
        fontSize: '13px',
        fontFamily: 'Georgia, serif',
        fill: '#c8b898',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(22)
  }

  _refreshSustainBackupUi() {
    const hint = this._sustainDragHintTxt
    if (hint && this.step === 'sustain') {
      const any = this._sustainBackupRemainingCount() > 0
      const show = any && !this._floodLocked && !this._nightComplete
      hint.setAlpha(show ? 1 : 0.34)
    }
    this._syncStackSortedDraggability()
  }

  _applySustainReserveSpritePresentation() {
    for (const st of Object.values(this._matStates)) {
      if (!st.sprite || st.phase !== 'sorted' || !st.isSortable) continue
      st.sprite.setVisible(true)
      st.label?.setVisible(true)
      const zoneId = this._stackSortedCategory(st)
      const keys = zoneId ? this._sustainBackupKeysByZone[zoneId] : null
      const inReserve = !!(zoneId && keys?.includes(st.pileKey))
      const usable = inReserve && st.quality !== 'BAD'
      if (usable) {
        st.sprite.setAlpha(1)
        st.label?.setAlpha(1)
      } else {
        st.sprite.setAlpha(0.22)
        st.label?.setAlpha(0.22)
      }
    }
  }

  _restoreSortedPilePresentationAfterSustain() {
    for (const st of Object.values(this._matStates)) {
      if (!st.sprite || st.phase !== 'sorted') continue
      const dim = st.greyed || st.quality === 'BAD'
      const a = dim ? 0.3 : 1
      st.sprite.setVisible(true).setAlpha(a)
      st.label?.setVisible(true).setAlpha(a)
      st.sprite.setDepth(STACK_SORTED_PILE_DEPTH)
      st.label?.setDepth(STACK_SORTED_PILE_DEPTH + 1)
    }
  }

  _consumeSustainBackupMat(pileKey) {
    const st = this._matStates[pileKey]
    if (!st?.sprite) return
    st.phase = 'sustain_used'
    st.sprite.setAlpha(0)
    st.label?.setAlpha(0)
    this.input.setDraggable(st.sprite, false)
  }

  _onSustainReserveDragEnd(state, wx, wy) {
    if (this.step !== 'sustain' || this._nightComplete || this._floodLocked) {
      this._bounceToStackOrHome(state)
      return
    }
    if (state.phase !== 'sorted' || !state.isSortable || state.quality === 'BAD') {
      this._bounceToStackOrHome(state)
      return
    }
    const zoneId = this._stackSortedCategory(state)
    const keys = zoneId ? this._sustainBackupKeysByZone[zoneId] : null
    const idx = keys?.indexOf(state.pileKey) ?? -1
    if (idx < 0) {
      this._bounceToStackOrHome(state)
      return
    }
    if (!this._sustainPitContains(wx, wy)) {
      this._bounceToStackOrHome(state)
      return
    }
    keys.splice(idx, 1)
    this._consumeSustainBackupMat(state.pileKey)
    this._applySustainBackupEffect(zoneId)
    this._syncStackLayRegistry()
    this._refreshSustainBackupUi()
    this._refreshNightBar()
  }

  /**
   * §4.7 backup timing + material modifiers.
   * Chip already consumed from `_sustainBackupKeysByZone`.
   */
  _applySustainBackupEffect(zoneId) {
    if (this._nightComplete) return

    this._sustainFuelUsedCount++

    const ceil = this._strengthCeiling
    const before = this._fireStrength
    const showRen = this.day < 3

    if (before >= ceil) {
      if (showRen) {
        this._dialogue.showSequence(
          [{ speaker: 'Ren', text: 'Wasted one. Save it for when it needs it.' }],
          () => this._dialogue.hide(),
        )
      }
      return
    }

    let gain = zoneId === 'tinder' ? 1 : 2
    const now = this.time.now
    if (zoneId === 'tinder') {
      this._sustainTinderBurdenUntil = Math.max(this._sustainTinderBurdenUntil, now + 6000)
      this._rescheduleDrainTimer()
    } else if (zoneId === 'fuel_wood') {
      this._sustainFuelSlowUntil = Math.max(this._sustainFuelSlowUntil, now + 10000)
      this._rescheduleDrainTimer()
    }

    this._fireStrength = Phaser.Math.Clamp(before + gain, 0, ceil)
    this._refreshStrengthBar()
    this._refreshBackground()

    if (showRen && before <= 2) {
      this._dialogue.showSequence(
        [{ speaker: 'Ren', text: 'Cutting it close.' }],
        () => this._dialogue.hide(),
      )
    }
  }

  _computeSustainDrainDelayMs() {
    const quality = this._campsiteQuality === 'poor' ? 'poor' : 'good'
    const key = `${quality}_${this._groundCleared ? 'cleared' : 'dirty'}`
    let d = DRAIN_MS[key] ?? DRAIN_MS.good_cleared
    const now = this.time.now
    if (now < this._sustainTinderBurdenUntil) d *= 0.5
    if (now < this._sustainFuelSlowUntil) d *= 1.25
    if (this.registry.get('fireQuality') === 'weak') d *= 0.88
    return Math.max(250, Math.floor(d))
  }

  _scheduleNextDrainTick() {
    if (this._nightComplete || this.step !== 'sustain') return
    if (this._drainTimer) {
      this._drainTimer.remove()
      this._drainTimer = null
    }
    const delay = this._computeSustainDrainDelayMs()
    this._drainTimer = this.time.delayedCall(delay, () => {
      this._drainStrength()
      this._scheduleNextDrainTick()
    })
  }

  _rescheduleDrainTimer() {
    if (this.step !== 'sustain' || this._nightComplete) return
    if (this._drainTimer) {
      this._drainTimer.remove()
      this._drainTimer = null
    }
    this._scheduleNextDrainTick()
  }

  _stackBuildFireMinimumMet() {
    return (
      this._stackDropCount.tinder >= STACK_MIN_BOTTOM &&
      this._stackDropCount.kindling >= STACK_MIN_MIDDLE &&
      this._stackDropCount.fuel_wood >= STACK_MIN_TOP
    )
  }

  /** §637–641 — minimum drops on the active band before Next / FINISH LAY. */
  _stackMinimumMetForLayerIndex(layerIndex) {
    const zoneId = STACK_LAYER_ORDER[layerIndex]
    if (!zoneId) return false
    const mins = {
      tinder: STACK_MIN_BOTTOM,
      kindling: STACK_MIN_MIDDLE,
      fuel_wood: STACK_MIN_TOP,
    }
    const min = mins[zoneId] ?? 0
    return this._stackDropCount[zoneId] >= min
  }

  /** §705–716 — written before ignite uses layout-driven counts. */
  _syncStackLayRegistry() {
    const stackData = { bottom: [], middle: [], top: [] }
    const reserveMaterials = []
    for (const st of Object.values(this._matStates)) {
      if (st.phase === 'placed' && st.layerId && stackData[st.layerId]) {
        stackData[st.layerId].push({ id: st.id, quality: st.quality })
      }
      if (st.phase === 'sorted' && st.isSortable && st.quality !== 'BAD') {
        const matType = normalizeStackSortZoneId(correctSortZoneForMatId(st.id))
        reserveMaterials.push({
          id: st.id,
          quality: st.quality,
          type: matType,
        })
      }
    }
    this.registry.set('stackData', stackData)
    this.registry.set('reserveMaterials', reserveMaterials)
    assertStackRegistryShape(this.registry, '_syncStackLayRegistry')
    this._refreshSortZoneMaterialCounts()
  }

  _disableStackSortedDragForRen() {
    this._stackRenFeedbackLocked = true
    for (const state of Object.values(this._matStates)) {
      if (state.phase !== 'sorted' || !state.isSortable || !state.sprite) continue
      this._safeSetDraggable(state.sprite, false)
      state.sprite.disableInteractive()
      state.sprite.setDepth(5)
      state.label?.setDepth(6)
    }
  }

  _restoreStackSortedDragAfterRen() {
    this._stackRenFeedbackLocked = false
    if (this.step === 'stack') this._syncStackSortedDraggability()
  }

  _refreshStackNextLayerMinimumGate() {
    if (!this._stackNextLayerBg || !this._stackNextLayerTxt) return
    if (this._stackLayLockedComplete || !this._stackNextLayerBg.visible) return
    const met = this._stackMinimumMetForLayerIndex(this._stackActiveLayerIndex)
    this._stackNextLayerBg.setAlpha(met ? 1 : 0.62)
    this._stackNextLayerTxt.setAlpha(met ? 1 : 0.72)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STACK STEP
  // ════════════════════════════════════════════════════════════════════════════

  _enterStack() {
    this._titleText.setText(`Day ${this.day} — Build the fire lay`)

    const W = this.scale.width
    const H = this.scale.height

    // Read and clear preserve flags immediately (timing-sensitive).
    const preserveIgniteTrial = this._stackPreserveAfterIgniteTrial
    const preserveLayout = preserveIgniteTrial || this._stackReenterPreserveLayout
    this._stackPreserveAfterIgniteTrial = false
    this._stackReenterPreserveLayout = false

    if (preserveIgniteTrial && this._stackFreeHintFlags) {
      this._stackFreeHintFlags.firstWrongPlacement = false
    }

    this._destroyStackBuildFire()
    this._destroyStackCategoryCards()
    this._destroyStackCrossSection()

    if (!preserveLayout) {
      this._stackDropCount       = { tinder: 0, kindling: 0, fuel_wood: 0 }
      this._stackUnitIndexInZone = { tinder: 0, kindling: 0, fuel_wood: 0 }
      this._stackHadError        = false
      this._stackLaySummaryRenShown = false
      this._stackTutorialFlags = {
        firstTinderBottom:   false,
        firstKindlingMiddle: false,
        firstFuelTop:        false,
      }
      this._stackFreeHintFlags = {
        firstWrongPlacement: false,
      }
      this._stackLayerPlacements = { tinder: [], kindling: [], fuel_wood: [] }
      this._stackActiveLayerIndex  = 0
      this._stackLayLockedComplete = false
      this._stackSparkTargetZone   = 'tinder'
    }

    this._applyStackStepZoneLabels()

    Object.values(this._sortZones).forEach(z => {
      this.tweens.killTweensOf(z.rect)
    })
    this._sortZoneParts.forEach((part) => {
      const tg = this._sortZoneHudLabelTargets(part)
      this.tweens.killTweensOf(tg)
      tg.forEach((node) => node.setAlpha(0))
    })

    Object.values(this._sortZones).forEach(z => {
      this.tweens.add({ targets: z.rect, alpha: 0.85, duration: 300 })
    })

    this._restoreDefaultStackRings()
    this._stackGraphics.setAlpha(0)
    this._stackLabelTexts.forEach(t => t.setAlpha(0))

    const hasStackables = Object.values(this._matStates).some(
      s => s.phase === 'sorted' && s.isSortable,
    )

    if (!hasStackables) {
      this._setFlintActive(false)
      this.time.delayedCall(400, () => this._enterStep('ignite'))
      return
    }

    this._ensureSortedMaterialsZoneLayout()
    this._setFlintActive(false)
    this._syncStackSortedDraggability()

    // Ignite trial: restore stack UI immediately (no dialogue / pit gate).
    if (preserveIgniteTrial) {
      this._stackAwaitingPitForLay = false
      this._destroyStackPitTapPrompt()
      this._beginStack(W, H, preserveLayout)
      return
    }

    // Resume mid-stack (e.g. forest → campsite): Ren + pit already done — restore UI only.
    if (this._stepProposalShown.stack && preserveLayout) {
      this._stackAwaitingPitForLay = false
      this._destroyStackPitTapPrompt()
      this._beginStack(W, H, preserveLayout)
      return
    }

    // First stack entry after sort: Ren proposal + choices first — pit prompt only after dialogue.
    if (!this._stepProposalShown.stack) {
    this._stepProposalShown.stack = true
      this._stackPreserveLayoutPending = preserveLayout
      this._runStackLayProposalDialogue()
      return
    }

    // Fallback: proposal already shown — if lay UI never built, wait for pit tap.
    this._stackPreserveLayoutPending = preserveLayout
    if (!this._stackCrossSectionCont && hasStackables) {
      if (this._stackDevJumpSkipPitPrompt) {
        this._stackDevJumpSkipPitPrompt = false
        this._stackAwaitingPitForLay = false
        this._destroyStackPitTapPrompt()
        this._beginStack(W, H, preserveLayout)
        return
      }
      this._stackAwaitingPitForLay = true
      this._destroyStackPitTapPrompt()
      this._showStackPitTapPrompt(W, H)
      return
    }

    this._stackAwaitingPitForLay = false
    this._destroyStackPitTapPrompt()
    this._beginStack(W, H, preserveLayout)
  }

  /** Semi-transparent pit hit zone + stroked pulse — tap opens `_beginStack`. */
  _showStackPitTapPrompt(W, H) {
    this._destroyStackPitTapPrompt()

    const px = this._pitX
    const py = this._pitY
    const hitR = Math.round(Math.min(W, H) * 0.11)

    this._stackPitPromptHit = this.add
      .circle(px, py, hitR, 0x3a2810, 0.42)
      .setStrokeStyle(4, 0xd4a84b, 0.95)
      .setDepth(120)
      .setInteractive({ useHandCursor: true })

    this._stackPitPromptHit.on('pointerup', () => this._onStackPitTapPrompt())

    this._stackPitPromptTween = this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 1300,
      repeat: -1,
      ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue()
        const strokeW = Math.round(3 + Math.sin(t) * 2)
        const strokeA = 0.65 + Math.sin(t + 0.5) * 0.28
        const scale = 1 + Math.sin(t * 1.05) * 0.065
        const fillA = 0.34 + Math.sin(t * 0.85) * 0.12
        const hit = this._stackPitPromptHit
        if (!hit?.active) return
        hit.setStrokeStyle(strokeW, 0xd4a84b, Phaser.Math.Clamp(strokeA, 0.35, 1))
        hit.setFillStyle(0x3a2810, Phaser.Math.Clamp(fillA, 0.18, 0.52))
        hit.setScale(scale, scale)
      },
    })

    this._stackPitPromptHintTxt = this.add
      .text(px, py + hitR + 36, 'Tap the fire pit to start placing the lay.', {
        fontSize: '15px',
        fontFamily: 'Georgia, serif',
        fill: '#e8dcc8',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(121)
  }

  _destroyStackPitTapPrompt() {
    if (this._stackPitPromptTween) {
      this._stackPitPromptTween.stop()
      this._stackPitPromptTween = null
    }
    this._stackPitPromptHit?.destroy()
    this._stackPitPromptHit = null
    this._stackPitPromptHintTxt?.destroy()
    this._stackPitPromptHintTxt = null
  }

  _onStackPitTapPrompt() {
    if (this.step !== 'stack' || !this._stackAwaitingPitForLay) return

    this._stackAwaitingPitForLay = false
    this._destroyStackPitTapPrompt()

    const W = this.scale.width
    const H = this.scale.height
    const preserveLayout = this._stackPreserveLayoutPending ?? false
    this._beginStack(W, H, preserveLayout)
  }

  _runStackLayProposalDialogue() {
    const finishProposalAndShowPitPrompt = () => {
      if (this.step !== 'stack') return
      this._dialogue.hide()
      const W = this.scale.width
      const H = this.scale.height
      const preserveLayout = this._stackPreserveLayoutPending ?? false
      this._stackPreserveLayoutPending = preserveLayout
      this._stackAwaitingPitForLay = true
      this._showStackPitTapPrompt(W, H)
    }

    this._dialogue.showSequence(
      [
        { speaker: 'Ren', text: 'Now we build. The order matters — and leave space between pieces.' },
        { speaker: 'Ren', text: 'Fire needs air.' },
        { speaker: 'Ren', text: 'Ready to lay it out?' },
      ],
      () => {
        this._dialogue.showChoices([
          {
            text: 'Bottom to top. I know.',
            onSelect: () => {
              this._dialogue.show({
                speaker: 'Ren',
                text: 'Alright, let us get it set up.',
                onComplete: finishProposalAndShowPitPrompt,
              })
            },
          },
          {
            text: 'What goes where?',
            onSelect: () => {
              this._dialogue.showSequence(
                [
                  { speaker: 'Ren', text: 'Tinder at the bottom — that is where the spark lands.' },
                  { speaker: 'Ren', text: 'Kindling on top of that — it catches from the tinder and grows the flame.' },
                  { speaker: 'Ren', text: 'Fuel wood on top — it burns slow and keeps you going.' },
                  { speaker: 'Ren', text: 'Leave gaps.' },
                  { speaker: 'Ren', text: 'Pack it too tight and you choke it.' },
                ],
                finishProposalAndShowPitPrompt,
              )
            },
          },
        ])
      },
    )
  }

  _beginStack(W, H, preserveLayout) {
    this._destroyStackPitTapPrompt()
    this._stackAwaitingPitForLay = false
    this._sortFeedbackLocked = false
    this._stackRenFeedbackLocked = false

    this._createStackCrossSection()
    if (preserveLayout) this._rebuildPlacedStackMarkers()

    this._createStackCategoryCards(W, H)
    this._createStackLayerNavUi(W, H)

    if (this._stackLayLockedComplete) {
      this._stackNextLayerBg?.setVisible(false)
      this._stackNextLayerTxt?.setVisible(false)
      this._stackNextLayerBg?.disableInteractive()
      this._hideStackSparkControls()
      this._updateStackPrevLayerButton()
      this._updateStackStrikeGateUi()
    }

    for (const state of Object.values(this._matStates)) {
      if (state.phase !== 'sorted' || !state.isSortable || !state.sprite) continue
      if (!state.zonePos && state.sortZoneId) {
        const zone = this._sortZones[state.sortZoneId]
        if (zone) {
          const h = (state.pileKey ?? '').length
          const offset = (h % 2 === 0) ? -16 : 16
          state.zonePos = { x: zone.x + offset, y: zone.y - 10 }
        }
      }
      state.sprite.setVisible(true)
      state.label?.setVisible(true)
      const dim = state.greyed || state.quality === 'BAD'
      state.sprite.setAlpha(dim ? 0.3 : 1)
      state.label?.setAlpha(dim ? 0.3 : 1)
      if (state.zonePos) {
        state.sprite.setPosition(state.zonePos.x, state.zonePos.y)
        state.label?.setPosition(state.zonePos.x, state.zonePos.y + ITEM_H / 2 + 4)
      }
      this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
    }

    this._buildStackGoFindMaterials(W, H)
    this._updateStackStrikeGateUi()
    this._holdSlots.forEach(s => s.setAlpha(0))

    if (this.step === 'stack') {
      this._syncStackSortedDraggability()
    }
    this.time.delayedCall(50, () => {
      if (this.step !== 'stack') return
      this._syncStackSortedDraggability()
      this._refreshStackNextLayerMinimumGate()
    })
  }

  _rebuildPlacedStackMarkers() {
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'placed' || !st.layerId) continue
      const z = LAYER_ID_TO_STACK_ZONE[st.layerId]
      if (z) this._addStackCrossSectionMarker(z, st)
    }
    for (const z of STACK_LAYER_ORDER) {
      this._relayoutStackLayerMarkers(z)
    }
    this._updateStackLayerHighlight()
  }

  _exitStack() {
    this._stackAwaitingPitForLay = false
    this._destroyStackPitTapPrompt()
    this._destroyStackStrikeHint()
    this._destroyStackLayerNavUi()
    this._destroyStackBuildFire()
    this._destroyStackCategoryCards()
    this._destroyStackCrossSection()
    this._restoreSortZoneLabels()
    this._restoreDefaultStackRings()

    this._setFlintActive(false)

    for (const state of Object.values(this._matStates)) {
      if (state.sprite) {
        state.sprite.setDepth(5)
        state.label?.setDepth(6)
      }
      if (state.sprite?.input) {
        this._safeSetDraggable(state.sprite, false)
        state.sprite.disableInteractive()
      }
    }

    this._holdSlots.forEach(s => { s.setAlpha(0) })

    Object.values(this._sortZones).forEach(z => {
      this.tweens.add({ targets: z.rect, alpha: 0.3, duration: 300 })
    })
    this._sortZoneParts.forEach((part) => {
      const tg = this._sortZoneHudLabelTargets(part)
      this.tweens.add({ targets: tg, alpha: 0.3, duration: 300 })
    })

    this._stackGraphics.setAlpha(0.3)
    this._stackLabelTexts.forEach(t => t.setAlpha(0.3))
  }

  _destroyStackGoFindMaterials() {
    this._stackGoFindBg?.destroy()
    this._stackGoFindTxt?.destroy()
    this._stackGoFindBg = null
    this._stackGoFindTxt = null
  }

  _hideCampsiteForestButton() {
    this._stackGoFindBg?.setVisible(false)
    this._stackGoFindTxt?.setVisible(false)
  }

  /** Stack + ignite share this scene — forest exit stays available until spread/sustain. */
  _ensureCampsiteForestButton(W, H) {
    if (!this._stackGoFindBg || !this._stackGoFindTxt) {
      this._buildStackGoFindMaterials(W, H)
    }
    this._stackGoFindBg.setVisible(true)
    this._stackGoFindTxt.setVisible(true)
  }

  _buildStackGoFindMaterials(W, H) {
    this._destroyStackGoFindMaterials()
    const x = 118
    const y = H - 36
    this._stackGoFindBg = this.add
      .rectangle(x, y, 200, 40, 0x1e3428)
      .setStrokeStyle(2, 0x5a9a6a)
      .setDepth(14)
      .setInteractive({ useHandCursor: true })
    this._stackGoFindTxt = this.add
      .text(x, y, 'Back to forest', {
        fontSize: '14px',
        fontFamily: 'Georgia, serif',
        fill: '#c8e8b8',
      })
      .setOrigin(0.5)
      .setDepth(15)
    this._stackGoFindBg.on('pointerover', () => this._stackGoFindBg.setFillStyle(0x2a4434))
    this._stackGoFindBg.on('pointerout', () => this._stackGoFindBg.setFillStyle(0x1e3428))
    this._stackGoFindBg.on('pointerup', () => this._onCampsiteForestClick())
  }

  _onCampsiteForestClick() {
    if (this.step !== 'stack' && this.step !== 'ignite') return

    const stamina = this.registry.get('stamina')
    const alive = stamina?.deduct(1) ?? true
    if (!alive) {
      this._emitDayFail('fire_campsite')
      return
    }

    if (this.step === 'ignite') {
      this.registry.set('collectForestMinimumAdds', {
        tinder: COLLECT_TARGETS.tinder,
        kindling: 0,
        fuel: 0,
      })
    }

    this.registry.set('fireCampsiteStackResume', this._buildStackResumePayload())
    this.scene.stop(this.scene.key)
    this.scene.start('FireBuildingCollect', {
      day: this.day,
      collectSessionKind: COLLECT_SESSION_RESUME_CAMPSITE,
    })
  }

  _tryStackPlace(state, zoneId) {
    if (state.quality === 'BAD') {
      this._bounceToStackOrHome(state)
      this._showRenLines(WET_MATERIAL_REN_LINES, () => this._greyOut(state))
      return
    }

    const correctZone = correctSortZoneForMatId(state.id)
    if (correctZone == null) {
      this._bounceToStackOrHome(state)
      this._showRenLines(WET_MATERIAL_REN_LINES, () => this._greyOut(state))
      return
    }

    this._maybeStackFreePlacementHints(state, zoneId)
    this._stackFreePlace(state, zoneId, {})
  }

  _stackFreePlace(state, zoneId, opts = {}) {
    const idx = this._stackUnitIndexInZone[zoneId]++
    this._stackDropCount[zoneId]++

    const pit = this._stackSlotInSortZone(zoneId, idx)

    state.phase   = 'placed'
    state.layerId = STACK_ZONE_TO_LAYER[zoneId]
    state.pitPos  = { x: pit.x, y: pit.y }
    this._safeSetDraggable(state.sprite, false)
    state.sprite.disableInteractive()

    this._addStackCrossSectionMarker(zoneId, state)

    this.tweens.add({
      targets: state.sprite,
      x: pit.x,
      y: pit.y,
      duration: 220,
      ease: 'Back.Out',
      onComplete: () => {
        if (this.step === 'stack') {
          state.sprite.setAlpha(0)
          state.label.setAlpha(0)
        } else {
          this._refreshFireLaySpritePresentation()
        }
      },
    })
    this.tweens.add({
      targets: state.label,
      x: pit.x,
      y: pit.y + ITEM_H / 2 + 4,
      duration: 220,
      ease: 'Back.Out',
      onComplete: () => {
        if (this.step === 'stack') {
          state.label.setAlpha(0)
        } else {
          this._refreshFireLaySpritePresentation()
        }
      },
    })

    this._flashZone(zoneId, 0x44dd44)
    if (!opts.skipStackTutorial) this._stackOnPlacedTutorial(zoneId, state)
    this._syncSortedMaterialsRegistryLive()
    this._refreshStackCategoryCards()
    this._syncStackSortedDraggability()
    this._updateStackLayerHighlight()
    this._refreshStackNextLayerMinimumGate()
  }

  _bounceToStackOrHome(state) {
    if (state.zonePos) {
      const { x, y } = state.zonePos
      this.tweens.add({ targets: state.sprite, x, y, duration: 280, ease: 'Back.Out' })
      this.tweens.add({
        targets: state.label,
        x,
        y: y + ITEM_H / 2 + 4,
        duration: 280,
        ease: 'Back.Out',
      })
      return
    }
    this._bounceBack(state)
  }

  /** Dev/jump `startStep` ignite|spread|sustain — apply registry `stackData` to placed materials + drop counts. */
  _hydratePlacedStackFromRegistryIfNeeded() {
    const entry = this._startStep
    if (!entry || (entry !== 'ignite' && entry !== 'spread' && entry !== 'sustain')) return

    const sd = this.registry.get('stackData')
    if (!sd || !Array.isArray(sd.bottom)) return

    const piles = Object.keys(this._matStates)
      .filter((k) => k.startsWith('pile_'))
      .map((k) => this._matStates[k])
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(String(a.pileKey).replace(/\D/g, ''), 10) || 0
        const nb = parseInt(String(b.pileKey).replace(/\D/g, ''), 10) || 0
        return na - nb
      })

    const assign = (entries, layerId) => {
      if (!entries?.length) return
      const zoneId = LAYER_ID_TO_STACK_ZONE[layerId]
      if (!zoneId) return
      let slot = 0
      for (const want of entries) {
        const cand =
          piles.find(
            (p) =>
              !p._registryHydrated &&
              p.isSortable &&
              p.id === want.id &&
              (!want.quality || p.quality === want.quality),
          ) ?? piles.find((p) => !p._registryHydrated && p.isSortable && p.id === want.id)
        if (!cand) continue
        cand._registryHydrated = true
        cand.phase = 'placed'
        cand.layerId = layerId
        const pit = this._stackSlotInSortZone(zoneId, slot++)
        cand.pitPos = { x: pit.x, y: pit.y }
      }
    }

    assign(sd.bottom, 'bottom')
    assign(sd.middle, 'middle')
    assign(sd.top, 'top')

    this._stackDropCount.tinder = sd.bottom?.length ?? 0
    this._stackDropCount.kindling = sd.middle?.length ?? 0
    this._stackDropCount.fuel_wood = sd.top?.length ?? 0
    this._stackUnitIndexInZone.tinder = this._stackDropCount.tinder
    this._stackUnitIndexInZone.kindling = this._stackDropCount.kindling
    this._stackUnitIndexInZone.fuel_wood = this._stackDropCount.fuel_wood
  }

  /**
   * `_stackDropCount` during stack uses incremental drops; ignite paths must reflect **current**
   * pit-only placed rows so burned/refill/resume cannot balloon totals (e.g. ×1.6 “too much tinder”).
   */
  _recalcStackDropCountFromPlaced() {
    this._stackDropCount = { tinder: 0, kindling: 0, fuel_wood: 0 }
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'placed' || !st.layerId) continue
      const zoneId = LAYER_ID_TO_STACK_ZONE[st.layerId]
      if (!zoneId || this._stackDropCount[zoneId] === undefined) continue
      this._stackDropCount[zoneId]++
    }
    this._stackUnitIndexInZone.tinder = this._stackDropCount.tinder
    this._stackUnitIndexInZone.kindling = this._stackDropCount.kindling
    this._stackUnitIndexInZone.fuel_wood = this._stackDropCount.fuel_wood
  }

  _configureIgniteDifficultyParams() {
    this._recalcStackDropCountFromPlaced()

    const inkBridge = this.registry.get('inkBridge')
    const rawDiff =
      inkBridge?.getVariable('mg_fire_collect_quality') ??
      inkBridge?.getVariable('mg_fire_collect_score') ??
      'EASY'
    const qualityRaw = inkBridge?.getVariable('campsite_quality') ?? 'good'
    const quality = String(qualityRaw).toLowerCase() === 'poor' ? 'poor' : 'good'

    this._igniteDifficulty = DIFFICULTY_CONFIG[rawDiff] ?? DIFFICULTY_CONFIG.EASY
    this._igniteUseRain = this._igniteDifficulty.rainInterference && quality === 'poor'

    let effectiveDecayMs = this._igniteDifficulty.decayMs
    const mDecay = Math.max(
      this._stackDropCount.kindling,
      this._stackPlacedCountInLayer('middle'),
    )
    if (mDecay === 0) effectiveDecayMs = Math.floor(effectiveDecayMs * 0.52)
    else if (mDecay === 1) effectiveDecayMs = Math.floor(effectiveDecayMs * 0.82)

    const badN = this._collected.filter((m) => m.quality === 'BAD').length
    effectiveDecayMs = Math.max(220, Math.floor(effectiveDecayMs - badN * 85))
    if (quality === 'poor') effectiveDecayMs = Math.floor(effectiveDecayMs * 0.88)

    const mult = this._computeStackIgniteTargetMultiplier()
    effectiveDecayMs = Math.floor(
      effectiveDecayMs * Phaser.Math.Clamp(2 - mult / 3.5, 0.55, 1.15),
    )

    this._effectiveDecayMs = effectiveDecayMs
    if (this.day <= 2) {
      this._effectiveDecayMs = Math.max(1200, this._effectiveDecayMs)
    }
    this._igniteDecayPerTick = this._igniteDifficulty.decayPerTick

    const tinderN = Math.max(
      this._stackPlacedCountInLayer('bottom'),
      this._stackDropCount.tinder || 0,
    )
    if (this.day <= 2) {
      this._igniteSmokeThresholdPct = tinderN >= 3 ? 25 : tinderN === 2 ? 40 : 55
    } else {
      this._igniteSmokeThresholdPct = tinderN >= 3 ? 40 : tinderN === 2 ? 55 : 70
    }

    const kindN = Math.max(
      this._stackPlacedCountInLayer('middle'),
      this._stackDropCount.kindling || 0,
    )
    if (this.day <= 2) {
      this._igniteBlowGain = kindN >= 3 ? 22 : kindN === 2 ? 18 : 14
    } else {
      this._igniteBlowGain = kindN >= 3 ? 18 : kindN === 2 ? 14 : 10
    }
    /** Blow mistake penalty — fewer kindling → larger dip (§4.5). */
    if (this.day <= 2) {
      this._igniteBlowPenalty = kindN >= 3 ? 5 : kindN === 2 ? 7 : 10
    } else {
      this._igniteBlowPenalty = kindN >= 3 ? 5 : kindN === 2 ? 8 : 12
    }
  }

  /** Live pit bottom-layer rows matching `_syncStackLayRegistry` → `stackData.bottom` shape (`{ id, quality }`). */
  _liveBottomTinderLayEntries() {
    const rows = []
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'placed' || st.layerId !== 'bottom') continue
      rows.push(st)
    }
    rows.sort((a, b) => this._pileKeySortOrder(a, b))
    return rows.map((st) => ({ id: st.id, quality: st.quality }))
  }

  /**
   * STRIKE+Blow attempt budget from `registry.stackData.bottom`:
   * GOOD→10, MID→6, BAD→3 per piece (see `sumIgniteClickBudgetFromBottom`).
   */
  _computeIgniteClickBudget() {
    this._syncStackLayRegistry()
    const liveBottom = this._liveBottomTinderLayEntries()
    if (liveBottom.length === 0) return 0
    return Math.max(1, sumIgniteClickBudgetFromBottom(liveBottom))
  }

  /** Vertical center for UI-IGNITE-BAR — below outer pit ring (§4.5). */
  _igniteBarCenterY() {
    return this._pitY + STACK_TOP_R + IGNITE_BAR_RING_GAP
  }

  _layoutIgniteBarHudPositions(cx, outerW) {
    const barY = this._igniteBarCenterY()
    this._igniteBarBg?.setPosition(cx, barY)
    this._igniteBarFill?.setPosition(cx - outerW / 2 + 4, barY)
    this._layoutIgniteThresholdMarkers(cx, barY, outerW)
    this._layoutIgniteTinderBurnBarPositions()
  }

  /** After `_configureIgniteDifficultyParams()` mid-ignite (e.g. drag spare tinder into pit), Smoke/Fire ticks must move with `_igniteSmokeThresholdPct`. */
  _relayoutIgniteHeatBarHud() {
    if (!this._igniteBarBg?.scene) return
    const cx = this.scale.width / 2
    const outerW = 300
    this._layoutIgniteBarHudPositions(cx, outerW)
  }

  _stopIgniteTinderBarPulse() {
    if (this._igniteTinderBarPulseTween) {
      this._igniteTinderBarPulseTween.stop()
      this._igniteTinderBarPulseTween = null
    }
    this._igniteTinderBarGfx?.setAlpha(1)
  }

  _layoutIgniteTinderBurnBarPositions() {
    if (!this._igniteTinderBarGfx || !this._igniteTinderBarLabel) return
    const bw = this._igniteTinderBarW
    const bh = this._igniteTinderBarH
    const left = this._pitX - STACK_TOP_R - 30
    const top = this._pitY - bh / 2
    this._igniteTinderBarX = left
    this._igniteTinderBarTopY = top
    this._igniteTinderBarLabel.setPosition(left + bw / 2, top - 12)
    this._refreshIgniteTinderBurnBar()
  }

  _refreshIgniteTinderBurnBar() {
    const gfx = this._igniteTinderBarGfx
    if (!gfx) return

    const bw = this._igniteTinderBarW
    const bh = this._igniteTinderBarH
    const px = this._igniteTinderBarX
    const pyTop = this._igniteTinderBarTopY

    gfx.clear()

    const tinderCount = this._liveBottomTinderLayEntries().length
    const budget = Math.max(0, this._igniteClickBudget ?? 0)
    const used = Phaser.Math.Clamp(this._igniteTotalClicks, 0, Math.max(budget, this._igniteTotalClicks))
    const remain = Math.max(0, budget - used)
    const frac = budget > 0 ? remain / budget : 0

    gfx.lineStyle(2, 0x8a8270, 0.92)
    gfx.strokeRect(px, pyTop, bw, bh)

    const pad = 3
    const innerW = bw - pad * 2
    const innerH = Math.max(0, bh - pad * 2)
    const fillH = innerH * frac
    const fillTop = pyTop + pad + (innerH - fillH)

    const warnLow = remain <= 5 && remain > 0 && budget > 0
    const fillCol = warnLow ? 0xff5533 : 0xf5eec8

    gfx.fillStyle(0x232018, 0.88)
    gfx.fillRect(px + pad, pyTop + pad, innerW, innerH)

    if (fillH > 0.5) {
      gfx.fillStyle(fillCol, warnLow ? 0.96 : 0.9)
      gfx.fillRect(px + pad, fillTop, innerW, fillH)
    }

    if (warnLow) {
      if (!this._igniteTinderBarPulseTween) {
        gfx.setAlpha(1)
        this._igniteTinderBarPulseTween = this.tweens.add({
          targets: gfx,
          alpha: { from: 1, to: 0.38 },
          duration: 270,
          yoyo: true,
          repeat: -1,
        })
      }
    } else {
      this._stopIgniteTinderBarPulse()
    }

    const triesWord = remain === 1 ? 'try' : 'tries'
    let barLabel = `Tinder ×${tinderCount} · ${remain} ${triesWord} left`
    if (budget <= 0 && tinderCount === 0 && this.step === 'ignite') {
      if (this._igniteHasSortedReserveTinder()) {
        barLabel = 'Pit empty — drag spare tinder into base'
      } else {
        barLabel = 'No tinder in pit · Back to forest'
      }
    }
    this._igniteTinderBarLabel?.setText(barLabel)
  }

  _ensureIgniteMechanicsHud(W, H) {
    if (this._igniteBarBg) return

    const cx = W / 2
    const barY = this._igniteBarCenterY()
    const outerW = 300
    const h = 18
    this._igniteBarInnerW = outerW - 8

    this._igniteBarBg = this.add
      .rectangle(cx, barY, outerW, h, 0x1a1410)
      .setStrokeStyle(2, 0x5a4838)
      .setDepth(25)
      .setVisible(false)

    this._igniteBarFill = this.add
      .rectangle(cx - outerW / 2 + 4, barY, 0, h - 6, 0xc87830)
      .setOrigin(0, 0.5)
      .setDepth(26)
      .setVisible(false)

    this._igniteBarSmokeMarker = this.add
      .rectangle(cx, barY, 2, h + 10, 0xa09070)
      .setDepth(27)
      .setAlpha(0.85)
      .setVisible(false)

    this._igniteBarFireMarker = this.add
      .rectangle(cx, barY, 2, h + 10, 0xffcc66)
      .setDepth(27)
      .setAlpha(0.95)
      .setVisible(false)

    const lblStyle = {
      fontSize: '10px',
      fontFamily: 'Georgia, serif',
      fill: '#8a7860',
    }
    this._igniteBarSmokeLbl = this.add
      .text(cx, barY - 14, 'Smoke', lblStyle)
      .setOrigin(0.5, 1)
      .setDepth(27)
      .setAlpha(0.9)
      .setVisible(false)
    this._igniteBarFireLbl = this.add
      .text(cx, barY - 14, 'Fire', lblStyle)
      .setOrigin(0.5, 1)
      .setDepth(27)
      .setAlpha(0.95)
      .setVisible(false)

    const bx = campsiteBlowCenterX(this._pitX)
    const by = this._pitY
    this._igniteBlowBg = this.add
      .rectangle(bx, by, CAMPSITE_BLOW_W, CAMPSITE_BLOW_H, 0x241810)
      .setStrokeStyle(2, 0x3a3028)
      .setDepth(18)
      .setVisible(false)

    this._igniteBlowTxt = this.add
      .text(bx, by + 28, 'BLOW', {
        fontSize: '13px',
        fontFamily: 'Georgia, serif',
        fill: '#5a5048',
      })
      .setOrigin(0.5)
      .setDepth(19)
      .setVisible(false)

    this._igniteBlowBg.on('pointerup', () => this._onIgniteBlowClick())

    this._igniteTinderBarGfx = this.add.graphics().setDepth(28).setVisible(false)
    this._igniteTinderBarLabel = this.add
      .text(0, 0, 'Tinder', {
        fontSize: '10px',
        fontFamily: 'Georgia, serif',
        fill: '#d8d4b8',
        align: 'center',
        wordWrap: { width: 84 },
      })
      .setOrigin(0.5, 1)
      .setDepth(28)
      .setVisible(false)
    this._layoutIgniteTinderBurnBarPositions()
  }

  _pitRadiusForSparkZone(zoneId) {
    if (zoneId === 'tinder') return STACK_BOTTOM_R
    if (zoneId === 'kindling') return STACK_MIDDLE_R
    return STACK_TOP_R
  }

  /** Random point on the pit ring for `_igniteSparkTargetZone` (same geometry as `_refreshIgniteSparkPickPitHighlight`). */
  _randomIgniteSparkBurstPoint() {
    const zone = this._igniteSparkTargetZone ?? 'tinder'
    const r = this._pitRadiusForSparkZone(zone)
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2)
    return {
      x: this._pitX + Math.cos(ang) * r,
      y: this._pitY + Math.sin(ang) * r,
    }
  }

  /** Redraw amber ring on pit for current `_igniteSparkTargetZone` (Spark-at chips). */
  _refreshIgniteSparkPickPitHighlight() {
    const gfx = this._igniteSparkPickRingGfx
    if (!gfx || !gfx.scene) return
    gfx.clear()
    const px = this._pitX
    const py = this._pitY
    const r = this._pitRadiusForSparkZone(this._igniteSparkTargetZone)
    gfx.lineStyle(8, 0xffcc44, 0.35)
    gfx.strokeCircle(px, py, r)
    gfx.lineStyle(4, 0xffe8a8, 0.98)
    gfx.strokeCircle(px, py, r)
    gfx.lineStyle(2, 0xffdca8, 0.72)
    gfx.strokeCircle(px, py, r - 2)
  }

  _destroyIgniteSparkPickPhaseUi() {
    if (this._stackGraphics && this.step === 'ignite') {
      this._stackGraphics.setAlpha(0.3)
      this._stackLabelTexts?.forEach((t) => t.setAlpha(0.3))
    }
    this._igniteSparkPickRingGfx?.destroy()
    this._igniteSparkPickRingGfx = null
    for (const o of this._igniteSparkPickPhaseObjs) {
      o.bg?.destroy()
      o.txt?.destroy()
    }
    this._igniteSparkPickPhaseObjs = []
    this._igniteSparkPickLabel?.destroy()
    this._igniteSparkPickLabel = null
  }

  _destroyIgniteLayerPickUi() {
    this._destroyIgniteSparkPickPhaseUi()
  }

  _startIgniteLayerStrikePhase() {
    if (this.step !== 'ignite') return
    this._igniteAwaitFirstStrikeForSparkUi = true
    this._igniteAwaitingLayerStrike = false
    this._stopIgniteTimers()
    this._igniteMechanicsPhase = null
    this._igniteProgress = 0
    this._igniteTotalClicks = 0
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)

    this._destroyIgniteSparkPickPhaseUi()
    this._destroyStackPitTapPrompt()

    this._tinderSprite.setAlpha(0.72)
    this._tinderSprite.clearTint()
    this._setFlintActive(true)

    this._titleText.setText(
      'Ignite — Tap STRIKE to choose spark layer (chips), then tap STRIKE again to confirm.',
    )

    this._igniteSparkTargetZone = this._stackSparkTargetZone ?? 'tinder'
  }

  _refreshIgniteSparkPickChipStyles() {
    const pathB = this._igniteProposalPath === 'pathB'
    for (const p of this._igniteSparkPickPhaseObjs) {
      const sel = p.zoneId === this._igniteSparkTargetZone
      if (pathB) {
        const isTinder = p.zoneId === 'tinder'
        if (isTinder) {
          p.bg.setStrokeStyle(sel ? 3 : 2, sel ? 0xeec866 : 0x5a4834)
          p.bg.setAlpha(1)
          p.txt.setAlpha(1)
        } else {
          p.bg.setStrokeStyle(2, 0x2a2218)
          p.bg.setAlpha(0.32)
          p.txt.setAlpha(0.35)
        }
      } else {
        p.bg.setStrokeStyle(sel ? 3 : 2, sel ? 0xeec866 : 0x5a4834)
        p.bg.setAlpha(1)
        p.txt.setAlpha(1)
      }
    }
    this._refreshIgniteSparkPickPitHighlight()
  }

  /** After first STRIKE — Spark-at chips (path B = only Base/tinder selectable). */
  _mountIgniteSparkPickUi() {
    if (this.step !== 'ignite') return

    this._igniteAwaitFirstStrikeForSparkUi = false
    this._igniteAwaitingLayerStrike = true

    const pathB = this._igniteProposalPath === 'pathB'
    this._igniteSparkTargetZone = pathB ? 'tinder' : (this._stackSparkTargetZone ?? 'tinder')

    this._destroyIgniteSparkPickPhaseUi()
    this._destroyStackPitTapPrompt()

    this._stackGraphics?.setAlpha(0.58)
    this._stackLabelTexts?.forEach((t) => t.setAlpha(0.62))

    this._igniteSparkPickRingGfx = this.add.graphics().setDepth(48)

    const cx = this._pitX
    const sy = this._pitY - STACK_TOP_R - 24
    const chipGap = 68
    const chipCenters = [cx - chipGap, cx, cx + chipGap]

    this._igniteSparkPickLabel = this.add
      .text(chipCenters[0] - 34, sy, 'Spark at:', {
        fontSize: '12px',
        fontFamily: 'Georgia, serif',
        fill: '#c8b090',
      })
      .setOrigin(1, 0.5)
      .setDepth(140)

    const sparkDefs = [
      { zoneId: 'tinder', label: 'Base' },
      { zoneId: 'kindling', label: 'Mid' },
      { zoneId: 'fuel_wood', label: 'Top' },
    ]
    for (let i = 0; i < sparkDefs.length; i++) {
      const d = sparkDefs[i]
      const sx = chipCenters[i]
      const locked = pathB && d.zoneId !== 'tinder'
      const bg = this.add
        .rectangle(sx, sy, 56, 28, 0x241a12)
        .setStrokeStyle(2, 0x5a4834)
        .setDepth(139)

      if (!locked) {
        bg.setInteractive({ useHandCursor: true })
      }

      const txt = this.add
        .text(sx, sy, d.label, {
          fontSize: '11px',
          fontFamily: 'Georgia, serif',
          fill: '#c8b898',
        })
        .setOrigin(0.5)
        .setDepth(141)

      const zonePick = d.zoneId
      if (!locked) {
        bg.on('pointerup', () => {
          if (this.step !== 'ignite' || !this._igniteAwaitingLayerStrike) return
          this._igniteSparkTargetZone = zonePick
          this._refreshIgniteSparkPickChipStyles()
        })
      }

      this._igniteSparkPickPhaseObjs.push({ zoneId: d.zoneId, bg, txt })
    }
    this._refreshIgniteSparkPickChipStyles()

    this._titleText.setText(
      pathB
        ? 'Ignite — Tap STRIKE to confirm spark on Base (tinder).'
        : 'Ignite — Pick Base / Mid / Top, then tap STRIKE to confirm.',
    )
    this._setFlintActive(true)
  }

  _onIgniteStrikeAfterLayerPick() {
    if (this.step !== 'ignite' || !this._igniteAwaitingLayerStrike) return

    const zoneId = this._igniteSparkTargetZone

    if (zoneId !== 'tinder') {
      this._dialogue.showSequence(
        [
          {
            speaker: 'Ren',
            text: 'Think about it — can a small spark catch on something that thick?',
          },
          { speaker: 'Ren', text: 'You want the finest, driest layer.' },
        ],
        () => this._dialogue.hide(),
      )
      return
    }

    const lines = [
      { speaker: 'Ren', text: 'Tinder. Right.' },
      {
        speaker: 'Ren',
        text: 'That is the only layer fine enough to catch a spark.',
      },
    ]

    this._dialogue.showSequence(lines, () => {
      this._dialogue.hide()
      this._igniteAwaitingLayerStrike = false
      this._destroyIgniteSparkPickPhaseUi()
      this._beginIgniteMechanics()
    })
  }

  /** Day 1–2: bright 1.5s / dark 1.0s (~60% good blow window); tighter on later days. */
  _igniteSmokePulseBrightMs() {
    return this.day >= 3 ? 800 : 1500
  }

  _igniteSmokePulseDarkMs() {
    return this.day >= 3 ? 1200 : 1000
  }

  _stopIgniteSmokePulse() {
    if (this._igniteSmokePulseTimer) {
      this._igniteSmokePulseTimer.remove(false)
      this._igniteSmokePulseTimer = null
    }
    if (this._tinderSprite) {
      this._tinderSprite.clearTint()
      this._tinderSprite.setScale(1)
    }
    this._igniteSmokeHalo?.setVisible(false)
    this._igniteLayRingGlowGfx?.clear()
    if (this.step === 'ignite') this._stackGraphics?.setAlpha(0.3)
  }

  _ensureIgniteLayRingGlowGfx() {
    if (!this._igniteLayRingGlowGfx || !this._igniteLayRingGlowGfx.scene) {
      this._igniteLayRingGlowGfx = this.add.graphics().setDepth(4)
    }
  }

  /** Blow phase: ember accent on **bottom / tinder ring only** (Mid/Top stay faint `_stackGraphics` guides). */
  _drawIgniteBlowLayRingGlow(bright) {
    this._ensureIgniteLayRingGlowGfx()
    const g = this._igniteLayRingGlowGfx
    if (!g) return
    g.clear()
    const px = this._pitX
    const py = this._pitY
    this._stackGraphics?.setAlpha(0.32)
    const r = STACK_BOTTOM_R
    if (bright) {
      g.lineStyle(12, 0xff5200, 0.26)
      g.strokeCircle(px, py, r)
      g.lineStyle(6, 0xff9933, 0.76)
      g.strokeCircle(px, py, r)
      g.lineStyle(2, 0xffcc66, 0.94)
      g.strokeCircle(px, py, r)
    } else {
      g.lineStyle(5, 0xb86838, 0.42)
      g.strokeCircle(px, py, r)
      g.lineStyle(2, 0x7a5030, 0.58)
      g.strokeCircle(px, py, r)
    }
  }

  /** §4.5 phase 1 — localized ember sparks at strike point (no camera flash). */
  _playIgniteSparkFx(atX, atY) {
    const depth = 96
    const px = atX
    const py = atY
    const n = Phaser.Math.Between(10, 18)
    for (let i = 0; i < n; i++) {
      const sz = Phaser.Math.FloatBetween(1.2, 4)
      const c = Phaser.Math.RND.pick([
        0xffeecc,
        0xffcc66,
        0xff8844,
        0xff5522,
        0xffffff,
      ])
      const dot = this.add.circle(px, py, sz, c, 1).setDepth(depth)
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.Between(16, 78)
      this.tweens.add({
        targets: dot,
        x: px + Math.cos(ang) * dist,
        y: py + Math.sin(ang) * dist,
        alpha: 0,
        scaleX: 0.08,
        scaleY: 0.08,
        duration: Phaser.Math.Between(110, 260),
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy(),
      })
    }
    const core = this.add.circle(px, py, 9, 0xfff0c8, 0.52).setDepth(depth - 1)
    this.tweens.add({
      targets: core,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 145,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy(),
    })
  }

  _scheduleIgniteSmokePulseTick() {
    if (this._igniteMechanicsPhase !== 'blow') return
    const dur =
      this._igniteSmokePulsePhase === 'bright'
        ? this._igniteSmokePulseBrightMs()
        : this._igniteSmokePulseDarkMs()
    if (this._igniteSmokePulseTimer) {
      this._igniteSmokePulseTimer.remove(false)
      this._igniteSmokePulseTimer = null
    }
    this._igniteSmokePulseTimer = this.time.delayedCall(dur, () => {
      if (this._igniteMechanicsPhase !== 'blow') return
      this._igniteSmokePulsePhase =
        this._igniteSmokePulsePhase === 'bright' ? 'dark' : 'bright'
      this._refreshIgniteSmokePulseVisual()
      this._scheduleIgniteSmokePulseTick()
    })
  }

  _startIgniteSmokePulse() {
    this._stopIgniteSmokePulse()
    this._igniteSmokePulsePhase = 'bright'
    this._refreshIgniteSmokePulseVisual()
    this._scheduleIgniteSmokePulseTick()
  }

  _refreshIgniteSmokePulseVisual() {
    if (!this._tinderSprite) return

    if (this._igniteMechanicsPhase !== 'blow') {
      this._tinderSprite.clearTint()
      this._tinderSprite.setScale(1)
      this._igniteSmokeHalo?.setVisible(false)
      this._igniteLayRingGlowGfx?.clear()
      if (this.step === 'ignite') this._stackGraphics?.setAlpha(0.3)
      return
    }
    const bright = this._igniteSmokePulsePhase === 'bright'
    if (bright) {
      this._tinderSprite.setTint(0xff9966)
      this._tinderSprite.setScale(1.14)
    } else {
      this._tinderSprite.setTint(0x778899)
      this._tinderSprite.setScale(0.88)
    }
    const zone = this._igniteSparkTargetZone ?? 'tinder'
    const haloR = this._pitRadiusForSparkZone(zone) + IGNITE_HALO_RING_PAD
    if (!this._igniteSmokeHalo || !this._igniteSmokeHalo.scene) {
      this._igniteSmokeHalo = this.add
        .circle(this._pitX, this._pitY, haloR, 0x000000, 0)
        .setStrokeStyle(3, 0xffcc66, 0.5)
        .setDepth(1)
    }
    this._igniteSmokeHalo.setPosition(this._pitX, this._pitY)
    this._igniteSmokeHalo.setRadius(haloR)
    this._igniteSmokeHalo.setVisible(true)
    this._igniteSmokeHalo.setStrokeStyle(
      bright ? 4 : 2,
      bright ? 0xffe8a8 : 0x6a7a8a,
      bright ? 0.72 : 0.42,
    )
    this._drawIgniteBlowLayRingGlow(bright)
  }

  _layoutIgniteThresholdMarkers(cx, barY, outerW) {
    if (!this._igniteBarSmokeMarker || !this._igniteBarFireMarker) return
    const inner = this._igniteBarInnerW
    const left = cx - outerW / 2 + 4
    const smx = left + (inner * this._igniteSmokeThresholdPct) / IGNITE_PROGRESS_MAX
    const fmx = left + inner
    this._igniteBarSmokeMarker.setPosition(smx, barY)
    this._igniteBarFireMarker.setPosition(fmx, barY)
    this._igniteBarSmokeLbl?.setPosition(smx, barY - 14)
    this._igniteBarFireLbl?.setPosition(fmx, barY - 14)
  }

  _setIgniteMechanicsHudVisible(v) {
    const vis = v === true
    this._igniteBarBg?.setVisible(vis)
    this._igniteBarFill?.setVisible(vis)
    this._igniteBarSmokeMarker?.setVisible(vis)
    this._igniteBarFireMarker?.setVisible(vis)
    this._igniteBarSmokeLbl?.setVisible(vis)
    this._igniteBarFireLbl?.setVisible(vis)
    this._igniteBlowBg?.setVisible(vis)
    this._igniteBlowTxt?.setVisible(vis)
    this._igniteTinderBarGfx?.setVisible(vis)
    this._igniteTinderBarLabel?.setVisible(vis)
    if (!vis) this._stopIgniteTinderBarPulse()
  }

  _refreshIgniteProgressUi() {
    if (!this._igniteBarFill || !this._tinderSprite) return
    const inner = this._igniteBarInnerW
    const w = inner * Phaser.Math.Clamp(this._igniteProgress / IGNITE_PROGRESS_MAX, 0, 1)
    this._igniteBarFill.width = Math.max(0, w)

    const smoky = this._igniteMechanicsPhase === 'blow'
    const pitHasBottomTinder = this._liveBottomTinderLayEntries().length > 0
    let ta = smoky ? 0.94 : 0.72 + Math.min(0.2, this._igniteProgress / 220)
    if (!pitHasBottomTinder && !smoky) ta *= 0.42
    this._tinderSprite?.setAlpha(ta)

    const blowReady = smoky
    const blowLit = blowReady && this._igniteBlowBg?.input?.enabled
    this._igniteBlowTxt?.setStyle({
      fontSize: '13px',
      fontFamily: 'Georgia, serif',
      fill: blowLit ? '#d8ecc8' : '#5a5048',
    })
    this._igniteBlowBg?.setStrokeStyle(2, blowLit ? 0x8acb80 : 0x4a4038)
    this._refreshIgniteSmokePulseVisual()
    this._refreshIgniteTinderBurnBar()
    this._refreshIgniteStrikeAvailability()
  }

  _setIgniteBlowInteractive(active) {
    if (!this._igniteBlowBg) return
    if (active) {
      this._igniteBlowBg.setInteractive({ useHandCursor: true })
      this._igniteBlowBg.setFillStyle(0x3a3428)
    } else {
      this._igniteBlowBg.disableInteractive()
      this._igniteBlowBg.setFillStyle(0x2a2218)
    }
    this._refreshIgniteProgressUi()
  }

  // ════════════════════════════════════════════════════════════════════════════
  // IGNITE STEP
  // ════════════════════════════════════════════════════════════════════════════

  /** Ignite uses live pile sprites + sort-zone chrome only (no duplicate category chips / lay-preview rects). */
  _igniteEnsureReserveHud(W, H) {
    this._applyStackStepZoneLabels()
    Object.values(this._sortZones).forEach(z => {
      this.tweens.killTweensOf(z.rect)
      this.tweens.add({ targets: z.rect, alpha: 0.85, duration: 300 })
    })
    this._sortZoneParts.forEach((part) => {
      const tg = this._sortZoneHudLabelTargets(part)
      this.tweens.killTweensOf(tg)
      this.tweens.add({ targets: tg, alpha: 1, duration: 300 })
    })
    this._ensureSortedMaterialsZoneLayout()
  }

  _destroySortZoneLayPreview() {
    for (const n of this._sortZoneLayPreviewNodes) {
      n?.destroy?.()
    }
    this._sortZoneLayPreviewNodes = []
  }

  /** Show lay preview on these steps; hide and destroy nodes when leaving the fire-lay HUD. */
  _refreshSortZoneLayPreview() {
    this._syncSortZoneHudSortedSpriteVisibility()
    if (SORT_ZONE_LAY_PREVIEW_STEPS.includes(this.step)) {
      this._buildSortZoneLayPreview()
    } else {
      this._destroySortZoneLayPreview()
    }
    const spreadRemediationActive =
      this.step === 'spread' &&
      this._spreadAwaitingRemediation &&
      this._spreadRemediationZone
    if (spreadRemediationActive) {
      this._spreadApplyRemediationSortedDragState()
    } else if (['stack', 'spread', 'ignite', 'sustain'].includes(this.step)) {
      this._syncStackSortedDraggability()
    }
    this._refreshSortZoneMaterialCounts()
  }

  /**
   * Spread: sorted sprites hidden except remediation lane.
   * Ignite: sorted piles visible at zone positions (single `_matStates` view).
   * Sustain: sorted spare piles styled via `_applySustainReserveSpritePresentation` — skipped here.
   */
  _syncSortZoneHudSortedSpriteVisibility() {
    for (const st of Object.values(this._matStates)) {
      if (!st.sprite || !st.isSortable || st.phase !== 'sorted') continue

      const remediationDrag =
        this.step === 'spread' &&
        this._spreadAwaitingRemediation &&
        this._spreadRemediationZone &&
        correctSortZoneForMatId(st.id) === this._spreadRemediationZone

      if (this.step === 'spread') {
        if (remediationDrag) {
          const dim = st.greyed || st.quality === 'BAD'
          const a = dim ? 0.3 : 1
          st.sprite.setVisible(true).setAlpha(a)
          st.label?.setVisible(true).setAlpha(a)
        } else {
          st.sprite.setVisible(false)
          st.label?.setVisible(false)
        }
        continue
      }

      if (this.step === 'ignite') {
        const dim = st.greyed || st.quality === 'BAD'
        const a = dim ? 0.3 : 1
        st.sprite.setVisible(true).setAlpha(a)
        st.label?.setVisible(true).setAlpha(a)
        continue
      }

      if (this.step === 'sustain') continue

      const dim = st.greyed || st.quality === 'BAD'
      const a = dim ? 0.3 : 1
      st.sprite.setVisible(true).setAlpha(a)
      st.label?.setVisible(true).setAlpha(a)
    }
  }

  /** Stable ordering for pit / pile placeholders (matches recall & registry). */
  _pileKeySortOrder(a, b) {
    const na = parseInt(String(a.pileKey).replace(/\D/g, ''), 10) || 0
    const nb = parseInt(String(b.pileKey).replace(/\D/g, ''), 10) || 0
    return na - nb
  }

  /** Same base string as `_buildMaterialPile` labels (`id.replace(/_/g, ' ')`), clipped for narrow scaled rects. */
  _truncateSortZonePlaceholderLabel(id) {
    if (!id || typeof id !== 'string') return ''
    const s = id.replace(/_/g, ' ')
    const maxLen = 20
    if (s.length <= maxLen) return s
    return `${s.slice(0, maxLen - 1).trimEnd()}…`
  }

  /**
   * Read-only placeholders matching `_buildMaterialPile`: MAT_COLOR rects + Georgia labels.
   * Steps: sort / spread only (`SORT_ZONE_LAY_PREVIEW_STEPS`). Ignite shows pit sprites via presenter.
   */
  _buildSortZoneLayPreview() {
    this._destroySortZoneLayPreview()

    const padX = 12
    const gap = 8
    const rowGap = 10
    const zoneBottomPad = 8
    const labelBelow = 4

    for (const def of SORT_ZONE_DEFS) {
      const layerId = STACK_ZONE_TO_LAYER[def.id]
      if (!layerId) continue
      const zone = this._sortZones[def.id]
      if (!zone) continue

      const placed = Object.values(this._matStates).filter(
        (s) => s.phase === 'placed' && s.layerId === layerId && s.isSortable,
      )
      placed.sort((a, b) => this._pileKeySortOrder(a, b))

      let reserves = Object.values(this._matStates).filter((s) => {
        if (s.phase !== 'sorted' || !s.isSortable) return false
        const z = normalizeStackSortZoneId(s.sortZoneId ?? correctSortZoneForMatId(s.id))
        if (z !== def.id) return false
        if (
          this.step === 'spread' &&
          this._spreadAwaitingRemediation &&
          this._spreadRemediationZone &&
          correctSortZoneForMatId(s.id) === this._spreadRemediationZone
        )
          return false
        return true
      })
      reserves.sort((a, b) => this._pileKeySortOrder(a, b))

      const combined = [...placed, ...reserves]
      if (!combined.length) continue

      const innerW = ZONE_W - padX * 2
      const n = combined.length

      let cols = n
      let rows = 1
      let scale = innerW / (cols * ITEM_W + (cols - 1) * gap)
      if (scale < 0.38 && n > 2) {
        rows = 2
        cols = Math.ceil(n / 2)
        scale = innerW / (cols * ITEM_W + (cols - 1) * gap)
      }
      scale = Phaser.Math.Clamp(scale, 0.32, 0.68)

      const w = ITEM_W * scale
      const h = ITEM_H * scale
      const fontPx = Math.max(8, Math.min(11, Math.round(11 * scale)))
      const rowLaneH = h + labelBelow + fontPx + 2

      const zoneBottom = zone.y + ZONE_H / 2 - zoneBottomPad
      const blockH = rows * rowLaneH + (rows - 1) * rowGap

      for (let r = 0; r < rows; r++) {
        const rowItems = combined.slice(r * cols, r * cols + cols)
        const rowLen = rowItems.length
        const rowW = rowLen * w + (rowLen - 1) * gap
        const rowCenterY =
          zoneBottom - blockH + r * (rowLaneH + rowGap) + h / 2

        for (let c = 0; c < rowLen; c++) {
          const st = rowItems[c]
          const cx =
            zone.x - rowW / 2 + w / 2 + c * (w + gap)
          const color = MAT_COLOR[st.quality] ?? 0x5a4a30
          const dim = st.greyed || st.quality === 'BAD'
          const alpha = dim ? 0.35 : 1

          const bg = this.add
            .rectangle(cx, rowCenterY, w, h, color)
            .setDepth(13)
            .setAlpha(alpha)

          const txt = this.add
            .text(cx, rowCenterY + h / 2 + labelBelow, this._truncateSortZonePlaceholderLabel(st.id), {
              fontSize: `${fontPx}px`,
              fontFamily: 'Georgia, serif',
              fill: '#d8c898',
              align: 'center',
              wordWrap: { width: Math.ceil(w + gap) },
            })
            .setOrigin(0.5, 0)
            .setDepth(14)
            .setAlpha(alpha)

          this._sortZoneLayPreviewNodes.push(bg, txt)
        }
      }
    }
  }

  _enterIgnite() {
    this._titleText.setText('Catch the spark — heat, smoke, then breathe.')

    if (import.meta.env.DEV) {
      const reg = this.registry
      const sd = reg.get('stackData')
      const rs = reg.get('reserveMaterials')
      console.log('[DEBUG Ignite init]', {
        stackData: JSON.stringify(sd),
        reserveMaterials: JSON.stringify(rs),
        stackBottom: sd?.bottom?.length,
        stackMiddle: sd?.middle?.length,
        stackTop: sd?.top?.length,
        reserveCount: rs?.length,
      })
    }

    this._syncStackLayRegistry()
    if (import.meta.env.DEV) {
      const sd2 = this.registry.get('stackData')
      const rs2 = this.registry.get('reserveMaterials')
      console.log('[DEBUG Ignite after _syncStackLayRegistry]', {
        stackBottom: sd2?.bottom?.length,
        stackMiddle: sd2?.middle?.length,
        stackTop: sd2?.top?.length,
        reserveCount: rs2?.length,
        stackData: JSON.stringify(sd2),
      })
    }
    this._configureIgniteDifficultyParams()

    const W = this.scale.width
    const H = this.scale.height

    this._igniteEnsureReserveHud(W, H)
    this._ensureCampsiteForestButton(W, H)
    this._ensureIgniteMechanicsHud(W, H)

    const forestResume = this._igniteResumeFromForest
    this._igniteResumeFromForest = null

    this._igniteMechanicsPhase = null
    this._igniteProgress = 0
    this._igniteTotalClicks = 0
    this._igniteLastClick = this.time.now
    this._igniteSmokeRenShown = false
    this._igniteBlowHardRenShown = false
    this._igniteRenBlowCorrectShown = false
    this._igniteLastBlowTime = 0

    this._igniteDecayHoldUntilNextBlow = false

    this._igniteAwaitingLayerStrike = false
    this._igniteAwaitFirstStrikeForSparkUi = false
    this._destroyIgniteLayerPickUi()

    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)
    this._refreshBackground()

    this._refreshFireLaySpritePresentation()
    this._syncSortZoneHudSortedSpriteVisibility()
    this._syncStackSortedDraggability()

    const skipRenIntro =
      this._stepProposalShown.ignite ||
      forestResume?.igniteProposalComplete === true

    if (skipRenIntro) {
      this._stepProposalShown.ignite = true
      this._destroyIgniteLayerPickUi()
      this._maybeShowIgniteForestReturnHint(forestResume)
      this._beginIgniteMechanics()
      return
    }

    this._stepProposalShown.ignite = true

    this._dialogue.showSequence(
      [
        { speaker: 'Ren', text: 'Alright, fire is built. Let us get a spark going.' },
      ],
      () => {
        this._dialogue.showChoices([
          {
            text: 'Let us do this.',
            onSelect: () => {
              this._igniteProposalPath = 'pathA'
              this._dialogue.show({
                speaker: 'Ren',
                text: 'Go for it.',
                onComplete: () => {
                  this._dialogue.hide()
                  this._startIgniteLayerStrikePhase()
                },
              })
            },
          },
          {
            text: 'Where should the spark go?',
            onSelect: () => {
              this._igniteProposalPath = 'pathB'
              this._dialogue.showSequence(
                [
                  {
                speaker: 'Ren',
                    text: 'Bottom. The tinder. It is the only thing fine enough to catch a spark — everything else is too thick.',
                  },
                ],
                () => {
                  this._dialogue.hide()
                  this._startIgniteLayerStrikePhase()
                },
              )
            },
          },
        ])
      },
    )
  }

  _beginIgniteMechanics() {
    this._igniteAwaitingLayerStrike = false
    this._igniteAwaitFirstStrikeForSparkUi = false
    this._destroyIgniteSparkPickPhaseUi()
    this._stopIgniteTimers()

    this._igniteDecayHoldUntilNextBlow = false

    this._configureIgniteDifficultyParams()
    this._igniteClickBudget = this._computeIgniteClickBudget()
    this._igniteRenTinderLowShown = false

    this._igniteMechanicsPhase = 'spark'
    this._igniteProgress = Math.min(this._igniteProgress, IGNITE_PROGRESS_MAX)
    this._igniteLastClick = this.time.now
    this._igniteLastBlowTime = 0

    const W = this.scale.width
    const cx = W / 2
    const outerW = 300
    this._layoutIgniteBarHudPositions(cx, outerW)

    this._setIgniteMechanicsHudVisible(true)
    this._refreshIgniteProgressUi()

    this._titleText.setText(
      'Ignite — Phase 1: Tap STRIKE to build heat (watch both bars).',
    )

    this._tinderSprite?.setAlpha(0.72)
    this._setIgniteBlowInteractive(false)
    this._refreshIgniteStrikeAvailability()

    this._decayTimer = this.time.addEvent({
      delay: this._effectiveDecayMs,
      callback: this._igniteDecayTick,
      callbackScope: this,
      loop: true,
    })

    if (this._igniteUseRain) {
      this._rainTimer = this.time.addEvent({
        delay: 4000,
        callback: this._applyRainInterference,
        callbackScope: this,
        loop: true,
      })
    }

    this._idleTimer = this.time.addEvent({
      delay: 500,
      callback: this._checkIdle,
      callbackScope: this,
      loop: true,
    })
  }

  _maybePromoteIgniteToBlowPhase() {
    if (this._igniteMechanicsPhase !== 'spark') return
    if (this._igniteProgress < this._igniteSmokeThresholdPct) return

    this._igniteMechanicsPhase = 'blow'
    this._setFlintActive(false, { igniteSparkingDisabled: true })
    this._setIgniteBlowInteractive(true)
    this._startIgniteSmokePulse()

    this._titleText.setText(
      'Ignite — Phase 2: Blow when smoke glows bright (warm tint), not when dim (grey).',
    )

    if (this.day >= 2 && !this._igniteSmokeRenShown) {
      this._igniteSmokeRenShown = true
      this._igniteDecayHoldUntilNextBlow = true
      this._dialogue.showSequence(
        [
          {
            speaker: 'Ren',
            text: 'Smoke. See how it glows and fades? When it is bright, give it a little air.',
          },
        ],
        () => this._dialogue.hide(),
      )
    }
    this._refreshIgniteProgressUi()
  }

  _maybeDemoteIgniteFromBlowPhase() {
    if (this._igniteMechanicsPhase !== 'blow') return
    if (this._igniteProgress >= this._igniteSmokeThresholdPct) return

    this._igniteMechanicsPhase = 'spark'
    this._stopIgniteSmokePulse()
    this._setIgniteBlowInteractive(false)
    this._igniteDecayHoldUntilNextBlow = false
    this._tinderSprite?.setAlpha(0.72)
    this._titleText.setText(
      'Ignite — Phase 1: Tap STRIKE again (smoke faded — rebuild heat).',
    )
    this._refreshIgniteProgressUi()
  }

  _exitIgnite() {
    this._hideCampsiteForestButton()
    this._stopIgniteTimers()
    this._stopIgniteSmokePulse()
    this._igniteAwaitingLayerStrike = false
    this._igniteAwaitFirstStrikeForSparkUi = false
    this._destroyIgniteLayerPickUi()
    this._setFlintActive(false)
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)
    this._tinderSprite.setAlpha(0)
    this._igniteMechanicsPhase = null
  }

  _onIgniteBlowClick() {
    if (this.step !== 'ignite') return
    if (this._igniteMechanicsPhase !== 'blow') return
    if (typeof this._dialogue?.isBlocking === 'function' && this._dialogue.isBlocking())
      return

    this._igniteDecayHoldUntilNextBlow = false

    const now = this.time.now
    this._igniteTotalClicks++
    this._igniteLastClick = now

    const bright = this._igniteSmokePulsePhase === 'bright'

    if (bright) {
      this._igniteProgress = Math.min(
        IGNITE_PROGRESS_MAX,
        this._igniteProgress + this._igniteBlowGain,
      )
      if (this.day >= 2 && !this._igniteRenBlowCorrectShown) {
        this._igniteRenBlowCorrectShown = true
        this._dialogue.showSequence(
          [{ speaker: 'Ren', text: 'That is it. Right when it glows.' }],
          () => this._dialogue.hide(),
        )
      }
      this.tweens.add({
        targets: this._tinderSprite,
        alpha: 1,
        duration: 140,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => this._refreshIgniteProgressUi(),
      })
    } else {
      const pen = this._igniteBlowPenalty ?? 14
      this._igniteProgress = Math.max(0, this._igniteProgress - pen)
      if (this.day >= 2 && !this._igniteBlowHardRenShown) {
        this._igniteBlowHardRenShown = true
        this._dialogue.showSequence(
          [
            {
              speaker: 'Ren',
              text: 'Wait for the glow. When the ember is bright, that is when it wants air.',
            },
          ],
          () => this._dialogue.hide(),
        )
      }
      this.cameras.main.shake(180, 0.004)
      this._tinderSprite.setTint(0xbbbbcc)
      this.time.delayedCall(140, () => {
        if (this._igniteMechanicsPhase === 'blow')
          this._refreshIgniteSmokePulseVisual()
        else this._tinderSprite.clearTint()
      })
    }

    this._maybeDemoteIgniteFromBlowPhase()
    this._refreshIgniteProgressUi()

    if (this._igniteMechanicsPhase === 'blow' && this._igniteProgress >= IGNITE_PROGRESS_MAX) {
      this._igniteSuccess()
      return
    }

    const budget = Math.max(0, this._igniteClickBudget ?? 0)
    if (budget > 0 && this._igniteTotalClicks >= budget) {
      this._igniteFail()
      return
    }

    this._maybeWarnIgniteTinderLow()
  }

  /** Pause decay / rain during dialogue or until first BLOW after smoke tutorial (§4.5 UX). */
  _igniteEnvironmentalEffectsPaused() {
    if (this.step !== 'ignite' || !this._igniteMechanicsPhase) return true
    if (typeof this._dialogue?.isBlocking === 'function' && this._dialogue.isBlocking())
      return true
    if (
      this._igniteMechanicsPhase === 'blow' &&
      this._igniteDecayHoldUntilNextBlow
    )
      return true
    return false
  }

  _igniteDecayTick() {
    if (!this._igniteMechanicsPhase) return
    if (this._igniteEnvironmentalEffectsPaused()) return

    let amt = this._igniteDecayPerTick
    if (this._igniteMechanicsPhase === 'blow') {
      amt *= this.day <= 2 ? 0.25 : 0.5
    }

    this._igniteProgress = Math.max(0, this._igniteProgress - amt)
    this._maybeDemoteIgniteFromBlowPhase()
    this._refreshIgniteProgressUi()
  }

  _applyRainInterference() {
    if (this.step !== 'ignite' || !this._igniteMechanicsPhase) return
    if (this._igniteEnvironmentalEffectsPaused()) return

    this._igniteProgress = Math.max(0, this._igniteProgress - 9)
    this._maybeDemoteIgniteFromBlowPhase()
    this._refreshIgniteProgressUi()

    this.tweens.add({
      targets: this._tinderSprite,
      alpha: 0.1,
      duration: 300,
      yoyo: true,
      ease: 'Linear',
    })
  }

  _checkIdle() {
    if (this.step !== 'ignite' || !this._igniteMechanicsPhase) return
    if (this.time.now - this._igniteLastClick >= IDLE_THRESHOLD) {
      this._igniteLastClick = this.time.now
    }
  }

  _igniteSuccess() {
    this.registry.set('ignitionSuccess', true)
    /** §4.6 — final `fireQuality` set after spread (strong / weak); cleared here so sustain reads registry truth. */
    this.registry.set('fireQuality', null)

      this._stopIgniteTimers()
    this._stopIgniteSmokePulse()
    this._deactivateFlintCompletely()
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)

      this._tinderSprite.setAlpha(0)
    this._fireIcon.setAlpha(1).setScale(1)
    this.tweens.add({
      targets: this._fireIcon,
      scale: { from: 1, to: 1.28 },
      duration: 260,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => this._fireIcon.setScale(1),
    })

    this.time.delayedCall(800, () => {
      this._enterStep('spread')
    })
  }

  _igniteBurnAllBottomTinderOnFail() {
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'placed' || st.layerId !== 'bottom') continue
      st.phase = 'burned'
      st.layerId = null
      st.pitPos = null
      st.sortZoneId = null
      if (st.sprite?.input) {
        this._safeSetDraggable(st.sprite, false)
        st.sprite.disableInteractive()
      }
      st.sprite?.setVisible(false)
      st.label?.setVisible(false)
    }
    this._stackDropCount.tinder = 0
    this._stackUnitIndexInZone.tinder = 0
    this._syncStackLayRegistry()
  }

  _igniteHasSortedReserveTinder() {
    return Object.values(this._matStates).some(
      (st) =>
        st.phase === 'sorted' &&
        st.isSortable &&
        st.quality !== 'BAD' &&
        correctSortZoneForMatId(st.id) === 'tinder',
    )
  }

  _pulseForestButtonBriefly() {
    const bg = this._stackGoFindBg
    if (!bg?.scene) return
    this.tweens.add({
      targets: bg,
      scaleX: { from: 1, to: 1.06 },
      scaleY: { from: 1, to: 1.06 },
      duration: 220,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
    })
  }

  _onIgniteReserveTinderDragEnd(state, wx, wy) {
    if (state.phase !== 'sorted' || !state.isSortable || state.quality === 'BAD') {
      this._bounceToStackOrHome(state)
      return
    }
    if (correctSortZoneForMatId(state.id) !== 'tinder') {
      this._bounceToStackOrHome(state)
      return
    }
    if (!this._pitStackDropContains(wx, wy) || this._stackZoneIdAtPitWorldPos(wx, wy) !== 'tinder') {
      this._bounceToStackOrHome(state)
      return
    }

    const idx = this._stackUnitIndexInZone.tinder++
    const pit = this._stackSlotInSortZone('tinder', idx)
    state.phase = 'placed'
    state.layerId = 'bottom'
    state.sortZoneId = null
    state.zonePos = null
    state.pitPos = { x: pit.x, y: pit.y }
    this._safeSetDraggable(state.sprite, false)
    state.sprite.disableInteractive()

    state.sprite.setPosition(pit.x, pit.y)
    state.label?.setPosition(pit.x, pit.y + ITEM_H / 2 + 4)

    this._syncStackLayRegistry()
    this._configureIgniteDifficultyParams()
    this._relayoutIgniteHeatBarHud()
    this._igniteClickBudget = this._computeIgniteClickBudget()
    this._refreshIgniteTinderBurnBar()

    this._refreshFireLaySpritePresentation()
    this._syncSortZoneHudSortedSpriteVisibility()
    this._refreshSortZoneMaterialCounts()
    this._syncIgniteSortedDraggability()

    this._maybePromoteIgniteToBlowPhase()
    this._refreshIgniteProgressUi()
  }

  _igniteFail() {
    this._stopIgniteSmokePulse()

    this._igniteAwaitFirstStrikeForSparkUi = false
    this._igniteAwaitingLayerStrike = false
    this._destroyIgniteSparkPickPhaseUi()

    this._igniteBurnAllBottomTinderOnFail()
    this._refreshFireLaySpritePresentation()

    const stamina = this.registry.get('stamina')
    const alive = stamina?.deduct(1) ?? true
    if (!alive) {
      this._stopIgniteTimers()
      this.time.delayedCall(800, () => this._emitDayFail('fire_campsite'))
      return
    }

    this._configureIgniteDifficultyParams()
    this._relayoutIgniteHeatBarHud()
    this._igniteClickBudget = this._computeIgniteClickBudget()
    this._igniteSnapToSparkWhenNoBottomTinder()

    this._setIgniteMechanicsHudVisible(true)
    this._refreshIgniteProgressUi()

    const hasReserveTinder = this._igniteHasSortedReserveTinder()

    const lines = [
      {
        speaker: 'Ren',
        text: 'Tinder is spent. We need more at the base before we can try again.',
      },
    ]
    if (hasReserveTinder) {
      lines.push({
        speaker: 'Ren',
        text: 'Drag some from your spare wood into the base.',
      })
    } else {
      lines.push({
        speaker: 'Ren',
        text: 'We need more tinder.',
      })
    }

    this._dialogue.showSequence(lines, () => {
      this._dialogue.hide()
      this._refreshFireLaySpritePresentation()
      this._syncSortZoneHudSortedSpriteVisibility()
      this._syncStackSortedDraggability()
      if (!hasReserveTinder) this._pulseForestButtonBriefly()
    })
  }

  _stopIgniteTimers() {
    if (this._decayTimer) {
      this._decayTimer.remove()
      this._decayTimer = null
    }
    if (this._rainTimer) {
      this._rainTimer.remove()
      this._rainTimer = null
    }
    if (this._idleTimer) {
      this._idleTimer.remove()
      this._idleTimer = null
    }
    this._stopIgniteSmokePulse()
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SPREAD STEP (§4.6)
  // ════════════════════════════════════════════════════════════════════════════

  _spreadSchedule(delayMs, cb) {
    const ev = this.time.delayedCall(delayMs, cb)
    this._spreadTimers.push(ev)
    return ev
  }

  _clearSpreadTimers() {
    for (const ev of this._spreadTimers) {
      try {
        ev.remove()
      } catch (_) {
        /* noop */
      }
    }
    this._spreadTimers = []
  }

  /** Day 3+ reuses mechanics with no Ren lines (spec §4.6). */
  _spreadRenEnabled() {
    return this.day < 3
  }

  _applySpreadPlaceholder(key) {
    const spec = SPREAD_PLACEHOLDER[key]
    if (!spec || !this._bgRect) return
    this._bgRect.setFillStyle(spec.fill)
    this._spreadPlaceholderCapTxt?.setText(spec.caption).setAlpha(0.92)
    this._spreadSyncGlowFromPlaceholderKey(key)
  }

  /** Maps BG placeholder keys to pit-ring “fire climbing” glow (clean + stuck paths). */
  _spreadSyncGlowFromPlaceholderKey(key) {
    if (key === 'spread1' || key === 'stuck1') this._spreadDrawProgressGlow(1)
    else if (key === 'spread2' || key === 'stuck2') this._spreadDrawProgressGlow(2)
    else if (key === 'spread3') this._spreadDrawProgressGlow(3)
  }

  /**
   * Progressive ring emphasis: inner (tinder) → middle → outer (fuel).
   * Drawn above faint `_stackGraphics` so spread reads clearly vs §4.6 Ren beats.
   */
  _spreadDrawProgressGlow(stage) {
    if (this.step !== 'spread') return
    if (!Number.isFinite(stage) || stage < 1 || stage > 3) return
    this._ensureSpreadFxUi()
    const g = this._spreadGlowGfx
    if (!g) return
    g.clear()
    const px = this._pitX
    const py = this._pitY
    const rings = [
      { r: STACK_BOTTOM_R, lit: stage >= 1 },
      { r: STACK_MIDDLE_R, lit: stage >= 2 },
      { r: STACK_TOP_R, lit: stage >= 3 },
    ]
    for (const { r, lit } of rings) {
      if (lit) {
        g.lineStyle(14, 0xff5200, 0.2)
        g.strokeCircle(px, py, r)
        g.lineStyle(6, 0xff9933, 0.72)
        g.strokeCircle(px, py, r)
        g.lineStyle(2, 0xfff0cc, 0.95)
        g.strokeCircle(px, py, r)
      } else {
        g.lineStyle(2, 0x4a4038, 0.42)
        g.strokeCircle(px, py, r)
      }
    }
    if (this._fireIcon) {
      this.tweens.killTweensOf(this._fireIcon)
      this.tweens.add({
        targets: this._fireIcon,
        scale: { from: 1, to: stage >= 3 ? 1.26 : 1.18 },
        duration: stage >= 3 ? 340 : 280,
        yoyo: true,
        ease: 'Sine.Out',
      })
    }
  }

  _ensureSpreadFxUi() {
    const W = this.scale.width
    const H = this.scale.height
    if (!this._spreadPlaceholderCapTxt) {
      this._spreadPlaceholderCapTxt = this.add
        .text(W / 2, H - 52, '', {
          fontSize: '13px',
          fontFamily: 'Georgia, serif',
          fill: '#c8c8b8',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: W - 80 },
        })
        .setOrigin(0.5)
        .setDepth(11)
    }
    if (!this._spreadSymptomGfx) {
      this._spreadSymptomGfx = this.add.graphics().setDepth(9)
    }
    if (!this._spreadGlowGfx) {
      this._spreadGlowGfx = this.add.graphics().setDepth(8)
    }
    if (!this._spreadPromptTxt) {
      this._spreadPromptTxt = this.add
        .text(W / 2, H * 0.72, '', {
          fontSize: '15px',
          fontFamily: 'Georgia, serif',
          fill: '#e8dcc8',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: W - 120 },
        })
        .setOrigin(0.5)
        .setDepth(12)
    }
  }

  _destroySpreadFxUi() {
    if (this._spreadRingPulseTween) {
      this._spreadRingPulseTween.stop()
      this._spreadRingPulseTween = null
    }
    this._spreadPlaceholderCapTxt?.destroy()
    this._spreadPlaceholderCapTxt = null
    this._spreadSymptomGfx?.destroy()
    this._spreadSymptomGfx = null
    this._spreadGlowGfx?.destroy()
    this._spreadGlowGfx = null
    this._spreadPromptTxt?.destroy()
    this._spreadPromptTxt = null
  }

  _spreadDrawSymptom(mode) {
    const g = this._spreadSymptomGfx
    if (!g) return
    g.clear()
    const px = this._pitX
    const py = this._pitY
    if (mode === 'bottom') {
      g.fillStyle(0xff6600, 0.35)
      g.fillCircle(px, py + 28, STACK_BOTTOM_R + 8)
      g.fillStyle(0x444444, 0.5)
      g.fillCircle(px, py - 18, STACK_TOP_R + 4)
    } else if (mode === 'middle') {
      g.fillStyle(0xff8800, 0.38)
      g.fillCircle(px, py + 6, STACK_MIDDLE_R + 10)
      g.fillStyle(0x333344, 0.55)
      g.fillCircle(px, py - 28, STACK_TOP_R + 6)
    }
    if (!this._spreadRenEnabled()) {
      g.fillStyle(0x222226, 0.42)
      for (let i = 0; i < 8; i++) {
        const ox = px + (i - 3.5) * 34
        const oy = py - 88 - i * 4
        g.fillEllipse(ox, oy, 40 + i * 5, 24 + i * 3)
      }
    }
  }

  _spreadClearSymptom() {
    this._spreadSymptomGfx?.clear()
  }

  _spreadReserveHasKindling() {
    this._syncStackLayRegistry()
    const rs = this.registry.get('reserveMaterials') ?? []
    return rs.some((m) => correctSortZoneForMatId(m.id) === 'kindling')
  }

  _spreadReserveHasFuel() {
    this._syncStackLayRegistry()
    const rs = this.registry.get('reserveMaterials') ?? []
    return rs.some((m) => correctSortZoneForMatId(m.id) === 'fuel_wood')
  }

  _evaluateSpreadBranches(sd) {
    const dev = this._spreadDevScenario
    if (dev === 'clean') return { mode: 'clean' }
    if (dev === 'stuck_kindling') return { mode: 'stuckKindling' }
    if (dev === 'stuck_fuel') return { mode: 'stuckFuel' }

    const middle = sd?.middle ?? []
    const top = sd?.top ?? []
    const kPts = spreadLayerQualityScore(middle)
    const kindlingOk = middle.length >= 2 && kPts >= 5
    const fuelPts = spreadLayerQualityScore(top)
    const allFuelBad =
      top.length > 0 &&
      top.every((m) => normalizeMatQualityTier(m?.quality) === 'BAD')
    const fuelOk =
      top.length >= STACK_MIN_TOP && !allFuelBad && fuelPts >= 3

    if (!kindlingOk) return { mode: 'stuckKindling' }
    if (!fuelOk) return { mode: 'stuckFuel' }
    return { mode: 'clean' }
  }

  _spreadDisableSortedDragAll() {
    for (const state of Object.values(this._matStates)) {
      if (!state.sprite || state.phase !== 'sorted') continue
      this._safeSetDraggable(state.sprite, false)
      if (state.sprite.input) state.sprite.disableInteractive()
    }
  }

  /** Enable drag only for spare piles matching `_spreadRemediationZone` — must run after lay-preview rebuild (see `_refreshSortZoneLayPreview`). */
  _spreadApplyRemediationSortedDragState() {
    const want = this._spreadRemediationZone
    const topD = SPREAD_REMEDIATION_DRAG_DEPTH
    for (const state of Object.values(this._matStates)) {
      if (!state.sprite) continue
      if (state.phase !== 'sorted' || !state.isSortable || state.quality === 'BAD') {
        this._safeSetDraggable(state.sprite, false)
        if (state.sprite.input) state.sprite.disableInteractive()
        continue
      }
      const cat = correctSortZoneForMatId(state.id)
      const ok =
        this.step === 'spread' &&
        this._spreadAwaitingRemediation &&
        want &&
        cat === want
      if (!ok) {
        this._safeSetDraggable(state.sprite, false)
        if (state.sprite.input) state.sprite.disableInteractive()
        continue
      }
      state.sprite.setVisible(true).setAlpha(1)
      state.label?.setVisible(true).setAlpha(1)
      state.sprite.setInteractive({ useHandCursor: true })
      state.sprite.setDepth(topD)
      state.label?.setDepth(topD + 1)
      if (this.input) this.input.setDraggable(state.sprite, true)
    }
  }

  _spreadSyncRemediationDrag() {
    this._refreshSortZoneLayPreview()
  }

  _spreadPulseRemediationPrompt() {
    if (!this._spreadPromptTxt) return
    if (this._spreadRingPulseTween) {
      this._spreadRingPulseTween.stop()
      this._spreadRingPulseTween = null
    }
    this._spreadPromptTxt.setAlpha(1)
    this._spreadRingPulseTween = this.tweens.add({
      targets: this._spreadPromptTxt,
      alpha: { from: 0.55, to: 1 },
      duration: 560,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  }

  _spreadRenSeq(lines, then) {
    if (!lines?.length) {
      then?.()
      return
    }
    if (!this._spreadRenEnabled()) {
      const ms = 520 + lines.length * 380
      this._spreadSchedule(ms, () => then?.())
      return
    }
    this._dialogue.showSequence(
      lines.map((text) => ({ speaker: 'Ren', text })),
      () => {
        this._dialogue.hide()
        then?.()
      },
    )
  }

  _enterSpread() {
    this._clearSpreadTimers()
    this._spreadAwaitingRemediation = false
    this._spreadRemediationZone = null

    this._hideFlintUiCompletely()
    this._stackGraphics?.setAlpha(0.78)

    this._syncStackLayRegistry()
    this._ensureSpreadFxUi()
    this._spreadDisableSortedDragAll()
    this._refreshFireLaySpritePresentation()

    this._titleText.setText('Spread — flame climbs the lay.')

    const sd = this.registry.get('stackData')
    const branch = this._evaluateSpreadBranches(sd)

    if (branch.mode === 'clean') this._runSpreadCleanVisualSequence({})
    else if (branch.mode === 'stuckKindling') this._runSpreadStuckKindling()
    else this._runSpreadStuckFuel()
  }

  _exitSpread() {
    this._clearSpreadTimers()
    this._spreadAwaitingRemediation = false
    this._spreadRemediationZone = null
    if (this._spreadRingPulseTween) {
      this._spreadRingPulseTween.stop()
      this._spreadRingPulseTween = null
    }
    this._destroySpreadFxUi()
    this._spreadClearSymptom()
    this._stackGraphics?.setAlpha(0.3)
    this._spreadDisableSortedDragAll()
  }

  _spreadFinishStrongWeakThenSustain() {
    const fq = this._spreadRemediatedWeak ? 'weak' : 'strong'
    this.registry.set('fireQuality', fq)
    if (import.meta.env.DEV) assertStackRegistryShape(this.registry, '_spreadFinish')
    this._enterStep('sustain')
  }

  _runSpreadCleanVisualSequence(opts = {}) {
    if (!opts.preserveWeak) this._spreadRemediatedWeak = false
    this._applySpreadPlaceholder('spread1')
    this._spreadClearSymptom()

    this._spreadRenSeq(
      [
        'Flame is moving up to the kindling.',
        'The spacing is letting it breathe.',
      ],
      () => {
        this._spreadSchedule(480, () => {
          this._applySpreadPlaceholder('spread2')
          this._spreadRenSeq(['Fuel is catching.', 'That is a fire.'], () => {
            this._spreadSchedule(520, () => {
              this._applySpreadPlaceholder('spread3')
              this._spreadRenSeq(
                [
                  'Tinder catches the spark, kindling spreads it, fuel keeps it alive.',
                  'Skip a step and it falls apart.',
                ],
                () => this._spreadFinishStrongWeakThenSustain(),
              )
            })
          })
        })
      },
    )
  }

  _runSpreadWeakBypassVisual() {
    this._spreadAwaitingRemediation = false
    this._spreadRemediationZone = null
    this._spreadPromptTxt?.setText('')
    if (this._spreadRingPulseTween) {
      this._spreadRingPulseTween.stop()
      this._spreadRingPulseTween = null
    }
    this._spreadDisableSortedDragAll()
    this._spreadClearSymptom()
    this._spreadRemediatedWeak = true

    this._applySpreadPlaceholder('spread2')
    this._spreadSchedule(420, () => {
      this._applySpreadPlaceholder('spread3')
      this._spreadSchedule(620, () => this._spreadFinishStrongWeakThenSustain())
    })
  }

  _runSpreadStuckKindling() {
    this._applySpreadPlaceholder('stuck1')
    this._spreadDrawSymptom('bottom')

    const openRemediationOrPenalty = () => {
      if (this._spreadReserveHasKindling()) {
        if (!this._spreadRenEnabled())
          this._spreadPromptTxt?.setText(
            '[Placeholder] Drag spare KINDLING to the middle pit band.',
          )
        else
          this._spreadPromptTxt?.setText(
            'Drag one spare kindling onto the middle ring.',
          )
        this._spreadAwaitingRemediation = true
        this._spreadRemediationZone = 'kindling'
        this._spreadPulseRemediationPrompt()
        this._spreadSyncRemediationDrag()
        return
      }
      const stamina = this.registry.get('stamina')
      const alive = stamina?.deduct(1) ?? true
      if (!alive) {
        this.time.delayedCall(400, () => this._emitDayFail('fire_campsite'))
        return
      }
      if (this._spreadRenEnabled())
        this._spreadRenSeq(
          [
            'No spare kindling in reach. Push through — it will be a thin fire.',
          ],
          () => this._runSpreadWeakBypassVisual(),
        )
      else this._runSpreadWeakBypassVisual()
    }

    this._spreadRenSeq(
      [
        'Flame is stuck at the bottom.',
        'Not enough kindling up there — the fire has nothing to grab onto.',
      ],
      openRemediationOrPenalty,
    )
  }

  _runSpreadStuckFuel() {
    this._applySpreadPlaceholder('stuck2')
    this._spreadDrawSymptom('middle')

    const openRemediationOrPenalty = () => {
      if (this._spreadReserveHasFuel()) {
        if (!this._spreadRenEnabled())
          this._spreadPromptTxt?.setText(
            '[Placeholder] Drag spare FUEL to the top pit band.',
          )
        else
          this._spreadPromptTxt?.setText(
            'Drag one spare fuel piece onto the top ring.',
          )
        this._spreadAwaitingRemediation = true
        this._spreadRemediationZone = 'fuel_wood'
        this._spreadPulseRemediationPrompt()
        this._spreadSyncRemediationDrag()
        return
      }
      const stamina = this.registry.get('stamina')
      const alive = stamina?.deduct(1) ?? true
      if (!alive) {
        this.time.delayedCall(400, () => this._emitDayFail('fire_campsite'))
        return
      }
      if (this._spreadRenEnabled())
        this._spreadRenSeq(
          [
            'No spare fuel here. We nurse what we have — thin flame into the night.',
          ],
          () => this._runSpreadWeakBypassVisual(),
        )
      else this._runSpreadWeakBypassVisual()
    }

    this._spreadRenSeq(
      [
        'Kindling is burning but the fuel is not catching.',
        'It might be too wet, or too heavy for what is below it.',
      ],
      openRemediationOrPenalty,
    )
  }

  _onSpreadDragEnd(state, dropX, dropY) {
    if (!this._spreadAwaitingRemediation || this.step !== 'spread') {
      this._bounceToStackOrHome(state)
      return
    }
    const need = this._spreadRemediationZone
    if (state.phase !== 'sorted' || !state.isSortable || state.quality === 'BAD') {
      this._bounceToStackOrHome(state)
      return
    }
    if (correctSortZoneForMatId(state.id) !== need) {
      this._bounceToStackOrHome(state)
      return
    }

    let targetZone = null
    if (this._pitStackDropContains(dropX, dropY))
      targetZone = this._stackZoneIdAtPitWorldPos(dropX, dropY)
    if (!targetZone) {
      const csBounds = this._stackCrossSectionWorldBounds()
      if (csBounds?.contains(dropX, dropY))
        targetZone = this._stackZoneIdAtCrossSectionWorldPos(dropX, dropY)
    }

    if (targetZone !== need) {
      this._bounceToStackOrHome(state)
      const hint =
        need === 'kindling'
          ? ['Aim for the middle band — kindling catches above the tinder.']
          : ['Top band — fuel waits until the ladder is burning.']
      if (this._spreadRenEnabled()) this._spreadRenSeq(hint, () => {})
      return
    }

    this._dialogue.hide()
    this._clearSpreadTimers()
    this._spreadAwaitingRemediation = false
    this._spreadRemediationZone = null
    this._spreadPromptTxt?.setText('')
    if (this._spreadRingPulseTween) {
      this._spreadRingPulseTween.stop()
      this._spreadRingPulseTween = null
    }

    this._spreadRemediatedWeak = true
    this._stackFreePlace(state, need, { skipStackTutorial: true })
    this._syncStackLayRegistry()
    this._spreadClearSymptom()
    this._spreadDisableSortedDragAll()

    const branch = this._evaluateSpreadBranches(this.registry.get('stackData'))
    if (branch.mode === 'clean')
      this._runSpreadCleanVisualSequence({ preserveWeak: true })
    else if (branch.mode === 'stuckFuel') this._runSpreadStuckFuel()
    else if (branch.mode === 'stuckKindling') this._runSpreadStuckKindling()
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUSTAIN STEP
  // ════════════════════════════════════════════════════════════════════════════

  /** §4.7 — All three pit bands read as burning (spread3-style), vigor scales with flame strength. */
  _refreshSustainPitLayGlow() {
    if (this.step !== 'sustain' || this._floodLocked) return
    if (!this._sustainPitGlowGfx || !this._sustainPitGlowGfx.scene) {
      this._sustainPitGlowGfx = this.add.graphics().setDepth(7)
    }
    const g = this._sustainPitGlowGfx
    g.clear()
    const px = this._pitX
    const py = this._pitY
    const cap = Math.max(1, this._strengthCeiling)
    const vig = Phaser.Math.Clamp(this._fireStrength / cap, 0.22, 1)
    const rings = [STACK_BOTTOM_R, STACK_MIDDLE_R, STACK_TOP_R]
    for (const r of rings) {
      g.lineStyle(14, 0xff5200, (0.14 + 0.12 * vig) * vig)
      g.strokeCircle(px, py, r)
      g.lineStyle(6, 0xff9933, (0.55 + 0.22 * vig) * vig)
      g.strokeCircle(px, py, r)
      g.lineStyle(2, 0xffcc66, (0.82 + 0.12 * vig) * vig)
      g.strokeCircle(px, py, r)
    }
  }

  _destroySustainPitGlowGfx() {
    this._sustainPitGlowGfx?.destroy()
    this._sustainPitGlowGfx = null
  }

  _enterSustain() {
    const W = this.scale.width
    const H = this.scale.height

    this._titleText.setText('Keep the fire alive through the night.')

    const badCount = this._collected.filter(m => m.quality === 'BAD').length
    const placedKindling = this._stackPlacedCountInLayer('middle')
    const placedTinder = this._stackPlacedCountInLayer('bottom')

    let ceilingPenalty = badCount
    if (placedKindling === 0) ceilingPenalty += 2
    if (placedTinder === 0) ceilingPenalty += 1

    this._strengthCeiling = Math.max(1, SEGMENT_COUNT - ceilingPenalty)
    this._fireStrength = this._strengthCeiling
    if (this.registry.get('fireQuality') === 'weak')
      this._fireStrength = Math.min(this._fireStrength, 3)
    this._nightElapsed = 0
    this._nightComplete = false
    this._nightBarProgressFloor = 0

    this._nightTotalMs = SUSTAIN_NIGHT_TOTAL_MS
    this._sustainTinderBurdenUntil = 0
    this._sustainFuelSlowUntil = 0
    this._sustainFuelUsedCount = 0
    this._sustainRenHintThreeShown = false
    this._sustainRenFloodIntroShown = false

    this._syncStackLayRegistry()
    this._rebuildSustainBackupKeysFromSortedMatStates()
    this._applySustainReserveSpritePresentation()

    this._fireIcon.setAlpha(1).setDepth(32)
    this._tinderSprite.setAlpha(0)

    this._setStrengthBarVisible(true)
    this._refreshStrengthBar()
    this._setNightBarVisible(true)
    this._refreshNightBar()

    this._hideFlintUiCompletely()

    this._stackGraphics?.setAlpha(0)
    this._stackLabelTexts?.forEach((t) => {
      t.setAlpha(0.78)
      t.setStyle({ fill: '#e8c898', fontFamily: 'Georgia, serif', fontSize: '10px' })
    })

    this._refreshBackground()

    if (this.day >= 3) {
      this._stepProposalShown.sustain = true
      this._beginSustain()
      return
    }

    if (this._stepProposalShown.sustain) {
      this._beginSustain()
      return
    }
    this._stepProposalShown.sustain = true

    this._dialogue.showSequence([
      { speaker: 'Ren', text: 'Fire is up. Now we keep it alive through the night.' },
      { speaker: 'Ren', text: 'When it gets low, drag spare wood into the fire.' },
      { speaker: 'Ren', text: 'But not too early — we do not have wood to waste.' },
    ], () => {
        this._dialogue.showChoices([
          {
          text: 'I will watch it. How hard can it be?',
            onSelect: () => {
              this._dialogue.show({
                speaker: 'Ren',
              text: 'Alright, I will rest first then.',
                onComplete: () => { this._dialogue.hide(); this._beginSustain() },
              })
            },
          },
          {
          text: 'How do I know when to add more?',
            onSelect: () => {
            this._dialogue.showSequence([
              { speaker: 'Ren', text: 'Watch the flame.' },
              { speaker: 'Ren', text: 'When it drops to about halfway, that is when you add.' },
              { speaker: 'Ren', text: 'Too early, wasted wood.' },
              { speaker: 'Ren', text: 'Too late, you are relighting in the rain.' },
            ], () => { this._dialogue.hide(); this._beginSustain() })
            },
          },
        ])
    })
  }

  _beginSustain() {
    const W = this.scale.width
    const H = this.scale.height

    const beginTimers = () => {
      if (this._sustainTimersStarted) return
      this._sustainTimersStarted = true
      this._startDrainTimer()
      this._startNightTimer()
      if (this._campsiteQuality === 'poor') this._startFloodTimer()
    }

    this._hideSortZonesUnderSustainReservePanels(false)
    this._ensureSustainDragHint(W, H)
    this._applySustainReserveSpritePresentation()
    this._refreshFireLaySpritePresentation()
    beginTimers()
    this._refreshSustainBackupUi()
  }

  _exitSustain() {
    this._stopSustainTimers()
    this._sustainTimersStarted = false
    this._destroySustainBackupUi()
    this._hideSortZonesUnderSustainReservePanels(false)
    this._destroySustainPitGlowGfx()
    this._fireIcon.setDepth(2)
    this._stackGraphics?.setAlpha(0.3)
    this._stackLabelTexts?.forEach((t) => {
      t.setAlpha(0.3)
      t.setStyle({ fill: '#7a6040', fontFamily: 'Georgia, serif', fontSize: '10px' })
    })
    this._restoreSortedPilePresentationAfterSustain()
    this._setStrengthBarVisible(false)
    this._setNightBarVisible(false)
  }

  _startDrainTimer() {
    this._scheduleNextDrainTick()
  }

  _startNightTimer() {
    this._nightTimer = this.time.addEvent({
      delay: 500,
      callback: this._tickNight,
      callbackScope: this,
      loop: true,
    })
  }

  _startFloodTimer() {
    const interval = this._groundCleared ? FLOOD_INTERVAL_CLEARED : FLOOD_INTERVAL_DIRTY

    this._floodTimer = this.time.addEvent({
      delay: interval,
      callback: this._applyFloodEvent,
      callbackScope: this,
      loop: true,
    })
  }

  _drainStrength() {
    if (this._nightComplete) return
    this._adjustStrength(-1)
  }

  _adjustStrength(delta) {
    const prev = this._fireStrength
    this._fireStrength = Phaser.Math.Clamp(
      this._fireStrength + delta, 0, this._strengthCeiling
    )
    this._refreshStrengthBar()
    this._refreshBackground()

    if (
      delta < 0 &&
      this.step === 'sustain' &&
      !this._nightComplete &&
      this.day < 3 &&
      prev > 3 &&
      this._fireStrength === 3 &&
      !this._sustainRenHintThreeShown
    ) {
      this._sustainRenHintThreeShown = true
      this.time.delayedCall(420, () => {
        if (this.step !== 'sustain' || this._nightComplete) return
        this._dialogue.showSequence(
          [{ speaker: 'Ren', text: 'Now. Add one.' }],
          () => this._dialogue.hide(),
        )
      })
    }

    if (this._fireStrength === 0) this._onFireOut()
  }

  _tickNight() {
    if (this._nightComplete) return
    this._nightElapsed += 500
    this._refreshNightBar()
    if (this._nightElapsed >= this._nightTotalMs) this._onNightComplete()
  }

  _applyFloodEvent() {
    if (this._nightComplete) return

    if (this.day < 3 && !this._sustainRenFloodIntroShown) {
      this._sustainRenFloodIntroShown = true
      this._dialogue.showSequence(
        [
          { speaker: 'Ren', text: 'Water getting in.' },
          { speaker: 'Ren', text: 'Low ground — nothing we can do about it now.' },
        ],
        () => this._dialogue.hide(),
      )
    }

    this._floodLocked = true
    this._bgRect.setFillStyle(BG_FLOOD)
    this._refreshSustainBackupUi()

    this.time.delayedCall(FLOOD_BG_DURATION, () => {
      this._floodLocked = false
      this._refreshBackground()
      if (this.step === 'sustain') this._refreshSustainBackupUi()
    })

    this._adjustStrength(-1)
  }

  _onFireOut() {
    this._stopSustainTimers()

    this._sustainFireOutCount++

    const stamina = this.registry.get('stamina')

    const goRelightFromBackup = () => {
      const alive = stamina?.deduct(1) ?? true
      if (!alive) {
        this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
        return
      }
      this.time.delayedCall(1200, () => {
        this._setStrengthBarVisible(false)
        this._setNightBarVisible(false)
        this._fireIcon.setAlpha(0)
        this.step = 'sustain'
        this._enterStep('ignite')
      })
    }

    if (this._sustainBackupRemainingCount() > 0) {
      if (this.day < 3) {
        this._dialogue.showSequence(
          [{ speaker: 'Ren', text: 'It is out. Should have added sooner.' }],
          () => {
            this._dialogue.hide()
            goRelightFromBackup()
          },
        )
      } else {
        goRelightFromBackup()
      }
      return
    }

    if (this.day < 3) {
      this._dialogue.showSequence(
        [{ speaker: 'Ren', text: 'No fuel, no fire. That is it.' }],
        () => {
          this._dialogue.hide()
    stamina?.deduct(2)
          this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
        },
      )
    } else {
    stamina?.deduct(2)
    this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
    }
  }

  _onNightComplete() {
    if (this._nightComplete) return
    this._nightComplete = true

    this._stopSustainTimers()

    const fireQuality = this._fireStrength >= 3 ? 'strong' : 'weak'

    const finishOutcome = () => {
      this.registry.set('sustainResult', {
        success: true,
        score: fireQuality,
        fuelUsed: this._sustainFuelUsedCount,
        fireOutCount: this._sustainFireOutCount,
      })
    console.log('[FireCampsite] emitting MINIGAME_COMPLETE', true)
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
        id: 'fire_campsite',
      success: true,
        score: fireQuality,
      staminaDepleted: false,
    })
    this.scene.stop()
    }

    if (this.day < 3) {
      this._dialogue.showSequence(
        [
          { speaker: 'Ren', text: 'That is it. Fire made it through the night.' },
          { speaker: 'Ren', text: 'Rain is slowing down too.' },
        ],
        () => {
          this._dialogue.hide()
          finishOutcome()
        },
      )
      return
    }

    finishOutcome()
  }

  _stopSustainTimers() {
    if (this._drainTimer) { this._drainTimer.remove(); this._drainTimer = null }
    if (this._nightTimer) { this._nightTimer.remove(); this._nightTimer = null }
    if (this._floodTimer) { this._floodTimer.remove(); this._floodTimer = null }
  }

  // ── Day fail ──────────────────────────────────────────────────────────────────

  _emitDayFail(id) {
    if (this.step === 'sustain') {
      this.registry.set('sustainResult', {
        success: false,
        score: null,
        fuelUsed: this._sustainFuelUsedCount,
        fireOutCount: this._sustainFireOutCount,
      })
    }
    console.log('[FireCampsite] emitting MINIGAME_COMPLETE', false)
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id,
      success:         false,
      staminaDepleted: true,
    })
    this.scene.stop()
  }
}
