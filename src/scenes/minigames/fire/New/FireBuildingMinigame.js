import Phaser from 'phaser'
import { GameEvents } from '../../../../systems/GameEvents.js'
import { DialogueBox } from './DialogueBox.js'

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
  const sd = registry?.stackData
  const rs = registry?.reserveMaterials
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
const MAX_CLICKS            = 30
const IDLE_THRESHOLD        = 2000

// ─── Sustain configuration ───────────────────────────────────────────────────

const SEGMENT_COUNT = 5

/** Base burn duration from materials on the stack (placed layers), before backup fuel. */
const SUSTAIN_SEC_PER_TOP    = 20
const SUSTAIN_SEC_PER_MIDDLE = 6
const SUSTAIN_SEC_PER_BOTTOM = 2
const SUSTAIN_NIGHT_MIN_SEC  = 20
const SUSTAIN_NIGHT_MAX_SEC  = 100

const DRAIN_MS = {
  good_cleared: 18000,
  good_dirty:   14000,
  poor_cleared: 11000,
  poor_dirty:    8000,
}

const FLOOD_INTERVAL_CLEARED = 20000
const FLOOD_INTERVAL_DIRTY   = 15000
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
/** Stack-phase piles above STRIKE / BLOW (depth ~18) so pointer picks draggable fuel, not pit chrome. */
const STACK_SORTED_PILE_DEPTH = 24
const SEG_COLOR_LIT = 0xe8a020
const SEG_COLOR_DIM = 0x3a2e18

// ─── Scene ───────────────────────────────────────────────────────────────────

export class FireBuildingMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireBuildingMinigame' })
  }

  init(data) {
    this.day       = data?.day ?? 2
    this.step      = null
    this._startStep = data?.startStep ?? null
    this._resumeStackAfterCollect = data?.resumeStackAfterCollect === true

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
    this._igniteSparks      = 0
    this._igniteTotalClicks = 0
    this._igniteRetryUsed   = false
    this._igniteLastClick   = 0
    this._igniteTarget      = 0
    this._igniteUseRain     = false
    this._igniteDifficulty  = null
    /** `spark` | `blow` — §4.5 two-phase ignite */
    this._igniteMechanicsPhase = null
    /** 0 … IGNITE_PROGRESS_MAX */
    this._igniteProgress          = 0
    this._igniteSmokeThresholdPct = 40
    this._igniteDecayPerTick      = 1
    this._igniteBlowGain          = 12
    /** Spark layer selected before mechanics — pit-ring pick (§4.5). */
    this._igniteSparkTargetZone = 'tinder'
    /** Ignite Ren proposal branch: pathA = three rings; pathB = tinder-only highlight (§4.5). */
    this._igniteProposalPath = 'pathA'
    /** Hit circle + ring highlights during pit layer pick */
    this._ignitePitPickHit = null
    this._ignitePitPickGraphics = null
    /** After proposal: awaiting pit-ring tap for spark layer */
    this._igniteAwaitingLayerStrike = false
    this._igniteSparkPickPhaseObjs = []
    this._igniteSparkPickLabel = null

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
    /** Blow phase smoke pulse: `bright` = good blow window (§4.5). */
    this._igniteSmokePulsePhase = 'bright'
    this._igniteSmokePulseTimer = null
    this._igniteSmokeRenShown       = false
    /** First wrong blow (dark window) Ren line shown */
    this._igniteBlowHardRenShown    = false
    /** First correct blow Ren line shown */
    this._igniteRenBlowCorrectShown = false
    this._igniteLastBlowTime        = 0
    this._decayTimer        = null
    this._rainTimer         = null
    this._idleTimer         = null
    this._effectiveDecayMs   = DIFFICULTY_CONFIG.EASY.decayMs

    // Sustain state
    this._fireStrength       = 0
    this._nightElapsed       = 0
    this._nightTotalMs       = 60000
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
    this._sustainBackupUi         = null

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
    this._buildFlintButton(W, H)
    this._buildSparkCounter(W, H)
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
      sustain:   () => this._enterSustain(),
    }

    this._exitHandlers = {
      ren_intro: () => {},
      clear:   () => this._exitClear(),
      sort:    () => this._exitSort(),
      stack:   () => this._exitStack(),
      ignite:  () => this._exitIgnite(),
      sustain: () => this._exitSustain(),
    }

    // Tracks whether the Ren proposal for each step has already been shown
    // (prevents re-showing on re-entries, e.g. stack after ignite trial).
    this._stepProposalShown = {}

    let stackResumeHandled = false
    if (this._resumeStackAfterCollect) {
      const snap = this.registry.get('fireCampsiteStackResume')
      if (snap?.matSnapshot?.length) {
        this._applyStackResumeFromCollect(snap)
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
      this._seedMatPhasesForDevStart(entry)
      this._hydrateSortedMaterialsFromRegistryIfNeeded(entry)
      this._hydratePlacedStackFromRegistryIfNeeded()
      if (entry === 'stack') {
        this._ensureSortedMaterialsZoneLayout()
      }
    }

    this._enterStep(entry)
  }

  // ── Inputs ───────────────────────────────────────────────────────────────────

  _readInputs() {
    const inkBridge = this.registry.get('inkBridge')
    this._campsiteQuality = inkBridge?.getVariable('campsite_quality') ?? 'good'
    const rawMat = this.registry.get('collectedMaterials') ?? []
    const newItems = Array.isArray(rawMat) ? rawMat : (rawMat?.items ?? [])
    const stackResumeSnap = this.registry.get('fireCampsiteStackResume')

    if (this._resumeStackAfterCollect && stackResumeSnap?.matSnapshot?.length) {
      const oldItems = stackResumeSnap.matSnapshot.map(s => ({ id: s.id, quality: s.quality }))
      this._collected = [...oldItems, ...newItems]
      this.registry.set('collectedMaterials', {
        items: this._collected,
        count: collectRegistryCounts(this._collected),
      })
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

  _applyStackResumeFromCollect(snap) {
    const nOld = snap.matSnapshot.length

    this._stackDropCount       = { ...snap.stackDropCount }
    this._stackUnitIndexInZone = { ...snap.stackUnitIndexInZone }
    this._stackActiveLayerIndex   = snap.stackActiveLayerIndex ?? 0
    this._stackLayLockedComplete  = snap.stackLayLockedComplete ?? false
    this._stackSparkTargetZone     = snap.stackSparkTargetZone ?? 'tinder'
    this._stackHadError            = snap.stackHadError ?? false
    if (snap.stackTutorialFlags) this._stackTutorialFlags = { ...snap.stackTutorialFlags }
    if (snap.stackFreeHintFlags) this._stackFreeHintFlags = { ...snap.stackFreeHintFlags }

    for (let i = 0; i < nOld; i++) {
      const s = snap.matSnapshot[i]
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
        st.sprite.disableInteractive()
        this.input.setDraggable(st.sprite, false)
      }
    }

    this._sortedCount = this._sortableIds.length
  }

  _seedMatPhasesForDevStart(startStep) {
    // When jumping to stack/ignite/sustain, mark sortable materials as if
    // they went through the earlier steps so _enterStack etc. can find them.
    const phaseMap = { sort: 'pile', stack: 'sorted', ignite: 'placed', sustain: 'placed' }
    const phase = phaseMap[startStep] ?? 'pile'
    for (const state of Object.values(this._matStates)) {
      if (state.isSortable) {
        state.phase = phase
        if (startStep === 'stack' && !state.sortZoneId) {
          const z = normalizeStackSortZoneId(correctSortZoneForMatId(state.id))
          if (z) state.sortZoneId = z
        }
      }
    }
    if (startStep === 'stack' || startStep === 'ignite' || startStep === 'sustain') {
      this._sortedCount = this._sortableIds.length
    }
  }

  /**
   * Dev jump `startStep === 'stack'`: apply registry `sortedMaterials` so each pile's `sortZoneId`
   * matches the mock buckets (runs after `_seedMatPhasesForDevStart`).
   */
  _hydrateSortedMaterialsFromRegistryIfNeeded(startStep) {
    if (startStep !== 'stack') return
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
              p.isSortable &&
              p.id === entry.id &&
              (!entry.quality || p.quality === entry.quality),
          ) ??
          piles.find(
            (p) =>
              !p._sortedHydratedFromRegistry &&
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
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    this._bgRect = this.add.rectangle(W / 2, H / 2, W, H, BG_NIGHT).setDepth(0)

    this._titleText = this.add.text(W / 2, 28, `Day ${this.day} — Build the fire`, {
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
    this._clearCounterText = this.add.text(W / 2, 64, this._clearCounterLabel(), {
      fontSize: '15px', fontFamily: 'monospace', fill: '#aaaaaa',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)

    this._clearCheckmark = this.add.text(W / 2, 64, '✔  Area cleared', {
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

      this._sortZoneParts.push({ rect, labelTxt, descTxt })
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
      .setInteractive({ useHandCursor: true })
      .setDepth(18)
      .setAlpha(0.4)

    this._flintIcon = this.add.text(btnX, btnY - 10, '🪨', { fontSize: '42px' })
      .setOrigin(0.5).setDepth(19).setAlpha(0.4)

    this._flintLabel = this.add.text(btnX, btnY + 36, 'STRIKE', {
      fontSize: '12px', fontFamily: 'monospace', fill: '#a08040',
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
  }

  _setFlintActive(active) {
    const a = active ? 1 : 0.4
    this._flintBg.setAlpha(a)
    this._flintIcon.setAlpha(a)
    this._flintLabel.setAlpha(a)
    if (active) {
      this._flintBg.setInteractive({ useHandCursor: true })
    } else {
      this._flintBg.disableInteractive()
    }
  }

  // ── Spark counter ─────────────────────────────────────────────────────────────

  _buildSparkCounter(W, H) {
    const cx = W / 2
    const cy = H * 0.20

    this._sparkTitleText = this.add.text(cx, cy, 'Sparks', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fill: '#887050',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)

    this._sparkCountText = this.add.text(cx, cy + 46, '0 / 0', {
      fontSize: '38px', fontFamily: 'monospace', fill: '#ffcc44',
      stroke: '#331a00', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10).setAlpha(0)

    this._sparkClickText = this.add.text(cx, cy + 82, `Clicks: 0 / ${MAX_CLICKS}`, {
      fontSize: '13px', fontFamily: 'monospace', fill: '#665038',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)
  }

  _setSparkCounterVisible(v) {
    const a = v ? 1 : 0
    this._sparkTitleText.setAlpha(a)
    this._sparkCountText.setAlpha(a)
    this._sparkClickText.setAlpha(a)
  }

  _refreshSparkCounter() {
    this._sparkCountText.setText(`${this._igniteSparks} / ${this._igniteTarget}`)
    this._sparkClickText.setText(`Clicks: ${this._igniteTotalClicks} / ${MAX_CLICKS}`)
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
      if (sprite._sustainBackupZoneId) topD = 22
      else if (st?.phase === 'sorted' && this.step === 'stack')
        topD = STACK_SORTED_PILE_DEPTH + 6
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
      let baseDepth = 5
      if (sprite._sustainBackupZoneId) baseDepth = 12
      else if (state?.phase === 'sorted' && this.step === 'stack')
        baseDepth = STACK_SORTED_PILE_DEPTH

      sprite.setDepth(baseDepth)
      state?.label?.setDepth(baseDepth + 1)

      if (sprite._sustainBackupZoneId) {
        this._onSustainBackupChipDragEnd(sprite, pointer.worldX, pointer.worldY)
        return
      }
      if (!state) return

      const wx = pointer.worldX
      const wy = pointer.worldY
      if (this.step === 'sort') this._onSortDragEnd(state, wx, wy)
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
      this.scene.stop('FireBuildingMinigame')
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
    this._clearHandoffStarted = true

    if (this._clearCompleteTimer) {
      this._clearCompleteTimer.remove()
      this._clearCompleteTimer = null
    }

    this._groundCleared = this._debrisRemaining === 0
    this.registry.set('groundCleared', this._groundCleared)

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_clear',
      success: true,
      score: this._groundCleared ? 1 : 0,
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
    this._sortZoneParts.forEach(({ labelTxt, descTxt }) => {
      this.tweens.add({ targets: [labelTxt, descTxt], alpha: 1, duration: 300 })
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
        state.        sprite.on('pointerup', () => {
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
    this._sortZoneParts.forEach(({ labelTxt, descTxt }) => {
      this.tweens.killTweensOf([labelTxt, descTxt])
      this.tweens.add({ targets: [labelTxt, descTxt], alpha: 0.3, duration: 300 })
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

  _refreshStackCategoryCards() {
    for (const c of this._stackCategoryCards) {
      const n = this._stackRemainingInPile(c.zoneId)
      c.txt.setText(`${c.label} × ${n}`)
      const empty = n <= 0
      c.bg.setFillStyle(empty ? 0x1f1810 : 0x3a3020)
      c.bg.setStrokeStyle(2, empty ? 0x4a4030 : 0x7a6a48)
      c.bg.setAlpha(empty ? 0.5 : 1)
      c.txt.setAlpha(empty ? 0.4 : 1)
    }
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
      if (state.phase !== 'sorted' || !state.isSortable || !state.sortZoneId) continue
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

  _syncStackSortedDraggability() {
    if (this.step === 'stack' && this._stackRenFeedbackLocked) {
      for (const state of Object.values(this._matStates)) {
        if (!state.sprite) continue
        if (state.phase !== 'sorted' || !state.isSortable) continue
        this.input.setDraggable(state.sprite, false)
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
          this.input.setDraggable(state.sprite, false)
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
        this.input.setDraggable(state.sprite, false)
        continue
      }
      if (state.quality === 'BAD') {
        this.input.setDraggable(state.sprite, false)
        state.sprite.disableInteractive()
        state.sprite.setDepth(5)
        state.label?.setDepth(6)
        continue
      }
      const z = this._stackSortedCategory(state)
      if (z == null) {
        this.input.setDraggable(state.sprite, false)
        state.sprite.disableInteractive()
        state.sprite.setDepth(5)
        state.label?.setDepth(6)
        continue
      }
      const rem = this._stackRemainingInPile(z)
      if (rem <= 0) {
        this.input.setDraggable(state.sprite, false)
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
          this.input.setDraggable(state.sprite, true)
        } else {
          this.input.setDraggable(state.sprite, false)
        }
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

    const blowCX = this._pitX + 185 + 55 + 12 + 44
    const blowCy = this._pitY
    this._stackLockedBlowBg = this.add
      .rectangle(blowCX, blowCy, 88, 110, 0x241810)
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
    else if (b <= 3) mult *= 1.0
    else mult *= 1.6

    if (m === 0) mult *= 2.0
    else if (m === 1) mult *= 1.3
    else if (m <= 3) mult *= 1.0
    else mult *= 1.4

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

  _computeSustainBaseNightDurationSec() {
    const fuel = this._stackPlacedCountInLayer('top')
    const kind = this._stackPlacedCountInLayer('middle')
    const tind = this._stackPlacedCountInLayer('bottom')
    const sec =
      fuel * SUSTAIN_SEC_PER_TOP +
      kind * SUSTAIN_SEC_PER_MIDDLE +
      tind * SUSTAIN_SEC_PER_BOTTOM
    return Phaser.Math.Clamp(sec, SUSTAIN_NIGHT_MIN_SEC, SUSTAIN_NIGHT_MAX_SEC)
  }

  _sustainPitContains(wx, wy) {
    const dx = wx - this._pitX
    const dy = wy - this._pitY
    const r = STACK_TOP_R + 40
    return dx * dx + dy * dy <= r * r
  }

  _rebuildSustainBackupKeysFromSorted() {
    this._sustainBackupKeysByZone = { tinder: [], kindling: [], fuel_wood: [] }
    const buckets = { tinder: [], kindling: [], fuel_wood: [] }
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'sorted' || !st.isSortable || st.quality === 'BAD') continue
      const z = this._stackSortedCategory(st)
      if (!buckets[z]) continue
      buckets[z].push(st)
    }
    const sortByPile = (a, b) => {
      const na = parseInt(String(a.pileKey).replace(/\D/g, ''), 10) || 0
      const nb = parseInt(String(b.pileKey).replace(/\D/g, ''), 10) || 0
      return na - nb
    }
    for (const z of Object.keys(buckets)) {
      buckets[z].sort(sortByPile)
      this._sustainBackupKeysByZone[z] = buckets[z].map(s => s.pileKey)
    }
  }

  _sustainBackupRemainingCount() {
    let n = 0
    for (const arr of Object.values(this._sustainBackupKeysByZone)) n += arr.length
    return n
  }

  _destroySustainBackupUi() {
    if (!this._sustainBackupUi) return
    for (const c of this._sustainBackupUi.chips) {
      this.input.setDraggable(c.container, false)
    }
    this._sustainBackupUi.root.destroy(true)
    this._sustainBackupUi = null
  }

  _createSustainBackupUi(W, H) {
    this._destroySustainBackupUi()
    const zoneY = H * 0.79
    const gap = 14
    const chipW = 108
    const chipH = 56
    const totalW = 3 * chipW + 2 * gap
    const x0 = W / 2 - totalW / 2 + chipW / 2
    const root = this.add.container(0, 0).setDepth(12)
    const chips = []

    for (let i = 0; i < 3; i++) {
      const zoneId = STACK_LAYER_ORDER[i]
      const cx = x0 + i * (chipW + gap)
      const cy = zoneY
      const cont = this.add.container(cx, cy)
      const col = STACK_MAT_VISUAL[zoneId]
      const bg = this.add.rectangle(0, 0, chipW, chipH, col).setStrokeStyle(2, 0x3a2a18)
      const def = SORT_ZONE_DEFS.find(d => d.id === zoneId)
      const title = this.add
        .text(0, -16, def?.label ?? zoneId, {
          fontSize: '11px', fontFamily: 'monospace', fill: '#1a1208',
        })
        .setOrigin(0.5)
      const countTxt = this.add
        .text(0, 12, '0', { fontSize: '18px', fontFamily: 'monospace', fill: '#0a0806' })
        .setOrigin(0.5)
      cont.add([bg, title, countTxt])
      cont.setSize(chipW, chipH)
      cont.setInteractive({ draggable: true, useHandCursor: true })
      cont._sustainBackupZoneId = zoneId
      cont._sustainHomeX = cx
      cont._sustainHomeY = cy
      cont._sustainCountText = countTxt
      this.input.setDraggable(cont, true)
      root.add(cont)
      chips.push({ zoneId, container: cont, countTxt })
    }

    this._sustainBackupUi = { root, chips }
    this._refreshSustainBackupUi()
  }

  _refreshSustainBackupUi() {
    if (!this._sustainBackupUi) return
    for (const c of this._sustainBackupUi.chips) {
      const n = this._sustainBackupKeysByZone[c.zoneId]?.length ?? 0
      c.countTxt.setText(`${n}`)
      const active =
        n > 0 &&
        !this._floodLocked &&
        this.step === 'sustain' &&
        !this._nightComplete
      c.container.setAlpha(active ? 1 : 0.38)
      if (active) {
        c.container.setInteractive({ draggable: true, useHandCursor: true })
        this.input.setDraggable(c.container, true)
      } else {
        this.input.setDraggable(c.container, false)
        c.container.disableInteractive()
      }
    }
  }

  _setSortedPileSpritesHiddenForSustain(hide) {
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'sorted') continue
      if (hide) {
        st.sprite?.setAlpha(0)
        st.label?.setAlpha(0)
      } else {
        const a = st.greyed ? 0.3 : 1
        st.sprite?.setAlpha(a)
        st.label?.setAlpha(a)
      }
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

  _onSustainBackupChipDragEnd(chip, wx, wy) {
    if (this.step !== 'sustain' || this._nightComplete || this._floodLocked) {
      this.tweens.add({
        targets: chip,
        x: chip._sustainHomeX,
        y: chip._sustainHomeY,
        duration: 160,
      })
      return
    }
    const zoneId = chip._sustainBackupZoneId
    const keys = this._sustainBackupKeysByZone[zoneId]
    if (!keys?.length || !this._sustainPitContains(wx, wy)) {
      this.tweens.add({
        targets: chip,
        x: chip._sustainHomeX,
        y: chip._sustainHomeY,
        duration: 160,
      })
      return
    }
    const pileKey = keys.shift()
    this._consumeSustainBackupMat(pileKey)
    this._applySustainBackupEffect(zoneId)
    chip.setPosition(chip._sustainHomeX, chip._sustainHomeY)
    this._refreshSustainBackupUi()
    this._refreshNightBar()
  }

  _applySustainBackupEffect(zoneId) {
    if (this._nightComplete) return
    if (this._fireStrength < this._strengthCeiling) {
      this._fireStrength++
      this._refreshStrengthBar()
      this._refreshBackground()
    }
    const now = this.time.now
    if (zoneId === 'tinder') {
      this._sustainTinderBurdenUntil = Math.max(this._sustainTinderBurdenUntil, now + 6000)
      this._rescheduleDrainTimer()
    } else if (zoneId === 'kindling') {
      this._nightTotalMs += 10000
    } else if (zoneId === 'fuel_wood') {
      this._nightTotalMs += 20000
      this._sustainFuelSlowUntil = Math.max(this._sustainFuelSlowUntil, now + 20000)
      this._rescheduleDrainTimer()
    }
  }

  _computeSustainDrainDelayMs() {
    const key = `${this._campsiteQuality}_${this._groundCleared ? 'cleared' : 'dirty'}`
    let d = DRAIN_MS[key] ?? DRAIN_MS.good_cleared
    const now = this.time.now
    if (now < this._sustainTinderBurdenUntil) d *= 0.5
    if (now < this._sustainFuelSlowUntil) d *= 1.25
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
        reserveMaterials.push({ id: st.id, quality: st.quality })
      }
    }
    this.registry.set('stackData', stackData)
    this.registry.set('reserveMaterials', reserveMaterials)
    assertStackRegistryShape(this.registry, '_syncStackLayRegistry')
  }

  _disableStackSortedDragForRen() {
    this._stackRenFeedbackLocked = true
    for (const state of Object.values(this._matStates)) {
      if (state.phase !== 'sorted' || !state.isSortable || !state.sprite) continue
      this.input.setDraggable(state.sprite, false)
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
    this._sortZoneParts.forEach(({ labelTxt, descTxt }) => {
      this.tweens.killTweensOf([labelTxt, descTxt])
      labelTxt.setAlpha(0)
      descTxt.setAlpha(0)
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
      if (state.phase !== 'sorted' || !state.isSortable) continue
      if (!state.zonePos && state.sortZoneId) {
        const zone = this._sortZones[state.sortZoneId]
        if (zone) {
          const h = (state.pileKey ?? '').length
          const offset = (h % 2 === 0) ? -16 : 16
          state.zonePos = { x: zone.x + offset, y: zone.y - 10 }
        }
      }
      state.sprite.setVisible(true)
      state.label.setVisible(true)
      const dim = state.greyed || state.quality === 'BAD'
      state.sprite.setAlpha(dim ? 0.3 : 1)
      state.label.setAlpha(dim ? 0.3 : 1)
      if (state.zonePos) {
        state.sprite.setPosition(state.zonePos.x, state.zonePos.y)
        state.label.setPosition(state.zonePos.x, state.zonePos.y + ITEM_H / 2 + 4)
      }
      this.input.setDraggable(state.sprite, false)
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
    this._destroyStackGoFindMaterials()
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
        this.input.setDraggable(state.sprite, false)
        state.sprite.disableInteractive()
      }
    }

    this._holdSlots.forEach(s => { s.setAlpha(0) })

    Object.values(this._sortZones).forEach(z => {
      this.tweens.add({ targets: z.rect, alpha: 0.3, duration: 300 })
    })
    this._sortZoneParts.forEach(({ labelTxt, descTxt }) => {
      this.tweens.add({ targets: [labelTxt, descTxt], alpha: 0.3, duration: 300 })
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
    this._stackGoFindBg.on('pointerup', () => this._onStackGoFindMaterials())
  }

  _onStackGoFindMaterials() {
    if (this.step !== 'stack') return

    const stamina = this.registry.get('stamina')
    const alive = stamina?.deduct(1) ?? true
    if (!alive) {
      this._emitDayFail('fire_campsite')
      return
    }

    this.registry.set('fireCampsiteStackResume', this._buildStackResumePayload())
    this.scene.stop('FireBuildingMinigame')
    this.scene.start('FireBuildingCollect', { day: this.day })
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
    this._stackFreePlace(state, zoneId)
  }

  _stackFreePlace(state, zoneId) {
    const idx = this._stackUnitIndexInZone[zoneId]++
    this._stackDropCount[zoneId]++

    const pit = this._stackSlotInSortZone(zoneId, idx)

    state.phase   = 'placed'
    state.layerId = STACK_ZONE_TO_LAYER[zoneId]
    state.pitPos  = { x: pit.x, y: pit.y }
    state.sprite.disableInteractive()
    this.input.setDraggable(state.sprite, false)

    this._addStackCrossSectionMarker(zoneId, state)

    this.tweens.add({
      targets: state.sprite,
      x: pit.x,
      y: pit.y,
      duration: 220,
      ease: 'Back.Out',
      onComplete: () => {
        state.sprite.setAlpha(0)
        state.label.setAlpha(0)
      },
    })
    this.tweens.add({
      targets: state.label,
      x: pit.x,
      y: pit.y + ITEM_H / 2 + 4,
      duration: 220,
      ease: 'Back.Out',
      onComplete: () => {
        state.label.setAlpha(0)
      },
    })

    this._flashZone(zoneId, 0x44dd44)
    this._stackOnPlacedTutorial(zoneId, state)
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

  /** Dev/jump `startStep` ignite|sustain — apply registry `stackData` to placed materials + drop counts. */
  _hydratePlacedStackFromRegistryIfNeeded() {
    const entry = this._startStep
    if (!entry || (entry !== 'ignite' && entry !== 'sustain')) return

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
        cand.sprite?.setAlpha(0)
        cand.label?.setAlpha(0)
      }
    }

    assign(sd.bottom, 'bottom')
    assign(sd.middle, 'middle')
    assign(sd.top, 'top')

    this._stackDropCount.tinder = sd.bottom?.length ?? 0
    this._stackDropCount.kindling = sd.middle?.length ?? 0
    this._stackDropCount.fuel_wood = sd.top?.length ?? 0
  }

  _configureIgniteDifficultyParams() {
    const inkBridge = this.registry.get('inkBridge')
    const rawDiff = inkBridge?.getVariable('mg_fire_collect_score') ?? 'EASY'
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
    this._igniteDecayPerTick = this._igniteDifficulty.decayPerTick

    const tinderN = Math.max(
      this._stackPlacedCountInLayer('bottom'),
      this._stackDropCount.tinder || 0,
    )
    this._igniteSmokeThresholdPct = tinderN >= 3 ? 40 : tinderN === 2 ? 55 : 70

    const kindN = Math.max(
      this._stackPlacedCountInLayer('middle'),
      this._stackDropCount.kindling || 0,
    )
    this._igniteBlowGain = kindN >= 3 ? 15 : kindN === 2 ? 11 : 7
    /** Blow mistake penalty — fewer kindling → larger dip (§4.5). */
    this._igniteBlowPenalty = kindN >= 3 ? 9 : kindN === 2 ? 13 : 17

    this._igniteTarget = IGNITE_PROGRESS_MAX
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

    const bx = this._pitX + 210
    const by = this._pitY + 95
    this._igniteBlowBg = this.add
      .rectangle(bx, by, 96, 72, 0x2a2218)
      .setStrokeStyle(2, 0x4a4038)
      .setDepth(130)
      .setVisible(false)

    this._igniteBlowTxt = this.add
      .text(bx, by, 'Blow 💨', {
        fontSize: '14px',
        fontFamily: 'Georgia, serif',
        fill: '#7a7060',
      })
      .setOrigin(0.5)
      .setDepth(131)
      .setVisible(false)

    this._igniteBlowBg.on('pointerup', () => this._onIgniteBlowClick())
  }

  _destroyIgniteSparkPickPhaseUi() {
    for (const o of this._igniteSparkPickPhaseObjs) {
      o.bg?.destroy()
      o.txt?.destroy()
    }
    this._igniteSparkPickPhaseObjs = []
    this._igniteSparkPickLabel?.destroy()
    this._igniteSparkPickLabel = null
    this._ignitePitPickHit?.destroy()
    this._ignitePitPickHit = null
    this._ignitePitPickGraphics?.destroy()
    this._ignitePitPickGraphics = null
  }

  _destroyIgniteLayerPickUi() {
    this._destroyIgniteSparkPickPhaseUi()
  }

  /** Remove stack-phase pit overlay / recall chips that would sit above the igniter hit target. */
  _igniteDisableConflictingStackHitTargets() {
    this._destroyStackPitTapPrompt()
    this._stackAwaitingPitForLay = false
    for (const zoneId of Object.keys(this._stackLayerPlacements ?? {})) {
      const arr = this._stackLayerPlacements[zoneId]
      if (!Array.isArray(arr)) continue
      for (const e of arr) {
        e.marker?.disableInteractive?.()
      }
    }
  }

  _flashIgniteTapPitReminder() {
    const hint = this._igniteSparkPickLabel
    if (hint && hint.scene) {
      this.tweens.add({
        targets: hint,
        scale: { from: 1, to: 1.12 },
        duration: 100,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      })
    }
    this._titleText.setText(
      'Ignite — Tap the pit rings first (inner = tinder). STRIKE comes after.',
    )
  }

  _startIgniteLayerStrikePhase() {
    if (this.step !== 'ignite') return
    this._igniteAwaitingLayerStrike = true
    this._stopIgniteTimers()
    this._igniteMechanicsPhase = null
    this._igniteProgress = 0
    this._igniteSparks = 0
    this._igniteTotalClicks = 0
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)

    this._destroyIgniteSparkPickPhaseUi()

    this._tinderSprite.setAlpha(0.72)
    this._tinderSprite.clearTint()
    this._setFlintActive(true)

    this._titleText.setText(
      'Ignite — Tap the inner ring (tinder) or pick another layer (path A).',
    )

    this._igniteSparkTargetZone = this._stackSparkTargetZone ?? 'tinder'
    this._mountIgnitePitLayerPickUi()
  }

  /** §4.5 — tap concentric pit rings to choose spark layer (path A = all rings; path B = tinder only). */
  _mountIgnitePitLayerPickUi() {
    if (this.step !== 'ignite') return

    this._destroyIgniteSparkPickPhaseUi()
    this._igniteDisableConflictingStackHitTargets()

    const px = this._pitX
    const py = this._pitY
    const pathB = this._igniteProposalPath === 'pathB'
    const ringDepth = 380
    const hitDepth = 400

    const g = this.add.graphics().setDepth(ringDepth)
    this._ignitePitPickGraphics = g
    if (pathB) {
      g.lineStyle(4, 0xeec866, 0.95)
      g.strokeCircle(px, py, STACK_BOTTOM_R)
      g.lineStyle(2, 0x4a4038, 0.28)
      g.strokeCircle(px, py, STACK_MIDDLE_R)
      g.strokeCircle(px, py, STACK_TOP_R)
    } else {
      g.lineStyle(2, 0x8a7860, 0.55)
      g.strokeCircle(px, py, STACK_BOTTOM_R)
      g.strokeCircle(px, py, STACK_MIDDLE_R)
      g.strokeCircle(px, py, STACK_TOP_R)
    }

    const hitR = pathB ? STACK_BOTTOM_R + 10 : STACK_TOP_R + 14
    const pick = (pointer) => {
      if (this.step !== 'ignite' || !this._igniteAwaitingLayerStrike) return
      this._onIgnitePitLayerSelected(pointer.worldX, pointer.worldY, pathB)
    }

    const hit = this.add
      .circle(px, py, hitR, 0x4a3820, 0.14)
      .setStrokeStyle(2, 0xc4a060, 0.55)
      .setDepth(hitDepth)
      .setInteractive({ useHandCursor: true })

    hit.on('pointerup', pick)
    this._ignitePitPickHit = hit

    const hint = pathB
      ? 'Tap the tinder (inner) ring.'
      : 'Tap a fire-pit layer — only tinder catches a spark.'
    this._igniteSparkPickLabel = this.add
      .text(px, py - STACK_TOP_R - 36, hint, {
        fontSize: '12px',
        fontFamily: 'Georgia, serif',
        fill: '#c8b8a0',
      })
      .setOrigin(0.5)
      .setDepth(hitDepth + 1)
  }

  _onIgnitePitLayerSelected(worldX, worldY, pathB) {
    const dx = worldX - this._pitX
    const dy = worldY - this._pitY
    const d = Math.hypot(dx, dy)

    if (pathB) {
      if (d > STACK_BOTTOM_R + 10) return
      this._igniteSparkTargetZone = 'tinder'
      this._finishIgniteLayerPickSuccess()
      return
    }

    let zoneId
    if (d <= STACK_BOTTOM_R) zoneId = 'tinder'
    else if (d <= STACK_MIDDLE_R) zoneId = 'kindling'
    else if (d <= STACK_TOP_R + 14) zoneId = 'fuel_wood'
    else return

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

    this._igniteSparkTargetZone = 'tinder'
    this._finishIgniteLayerPickSuccess()
  }

  _finishIgniteLayerPickSuccess() {
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
    if (this._tinderSprite) this._tinderSprite.clearTint()
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
    if (this._igniteMechanicsPhase !== 'blow') {
      this._tinderSprite.clearTint()
      return
    }
    if (this._igniteSmokePulsePhase === 'bright') {
      this._tinderSprite.setTint(0xffaa88)
    } else {
      this._tinderSprite.setTint(0x8899aa)
    }
  }

  _layoutIgniteThresholdMarkers(cx, barY, outerW) {
    const inner = this._igniteBarInnerW
    const left = cx - outerW / 2 + 4
    const smx = left + (inner * this._igniteSmokeThresholdPct) / IGNITE_PROGRESS_MAX
    const fmx = left + inner
    this._igniteBarSmokeMarker.setPosition(smx, barY)
    this._igniteBarFireMarker.setPosition(fmx, barY)
  }

  _setIgniteMechanicsHudVisible(v) {
    const vis = v === true
    this._igniteBarBg?.setVisible(vis)
    this._igniteBarFill?.setVisible(vis)
    this._igniteBarSmokeMarker?.setVisible(vis)
    this._igniteBarFireMarker?.setVisible(vis)
    this._igniteBlowBg?.setVisible(vis)
    this._igniteBlowTxt?.setVisible(vis)
  }

  _refreshIgniteProgressUi() {
    if (!this._igniteBarFill) return
    const inner = this._igniteBarInnerW
    const w = inner * Phaser.Math.Clamp(this._igniteProgress / IGNITE_PROGRESS_MAX, 0, 1)
    this._igniteBarFill.width = Math.max(0, w)

    const smoky = this._igniteMechanicsPhase === 'blow'
    this._tinderSprite.setAlpha(smoky ? 0.94 : 0.72 + Math.min(0.2, this._igniteProgress / 220))

    const blowReady = smoky
    const blowLit = blowReady && this._igniteBlowBg?.input?.enabled
    this._igniteBlowTxt?.setStyle({
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fill: blowLit ? '#d8ecc8' : '#5a5048',
    })
    this._igniteBlowBg?.setStrokeStyle(2, blowLit ? 0x8acb80 : 0x4a4038)
    this._refreshIgniteSmokePulseVisual()
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

  _enterIgnite() {
    this._titleText.setText('Catch the spark — heat, smoke, then breathe.')

    this._igniteRetryUsed = false

    this._syncStackLayRegistry()
    this._configureIgniteDifficultyParams()

    const W = this.scale.width
    const H = this.scale.height
    this._ensureIgniteMechanicsHud(W, H)

    this._igniteMechanicsPhase = null
    this._igniteProgress = 0
    this._igniteSparks = 0
    this._igniteTotalClicks = 0
    this._igniteLastClick = this.time.now
    this._igniteSmokeRenShown = false
    this._igniteBlowHardRenShown = false
    this._igniteRenBlowCorrectShown = false
    this._igniteLastBlowTime = 0

    this._igniteAwaitingLayerStrike = false
    this._destroyIgniteLayerPickUi()

    this._setSparkCounterVisible(false)
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)
    this._refreshBackground()

    if (this._stepProposalShown.ignite) {
      this._destroyIgniteLayerPickUi()
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
    this._destroyIgniteSparkPickPhaseUi()
    this._stopIgniteTimers()

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

    this._setSparkCounterVisible(true)
    this._refreshSparkCounter()

    this._titleText.setText(
      'Ignite — Phase 1: STRIKE flint to build heat (watch the bar).',
    )

    this._tinderSprite.setAlpha(0.72)
    this._setFlintActive(true)
    this._setIgniteBlowInteractive(false)

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
    this._setIgniteBlowInteractive(true)
    this._startIgniteSmokePulse()

    this._titleText.setText(
      'Ignite — Phase 2: Blow when smoke glows bright (warm tint), not when dim (grey).',
    )

    if (this.day >= 2 && !this._igniteSmokeRenShown) {
      this._igniteSmokeRenShown = true
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
    this._tinderSprite.setAlpha(0.72)
    this._titleText.setText(
      'Ignite — Phase 1: STRIKE flint again (smoke faded — rebuild heat).',
    )
    this._refreshIgniteProgressUi()
  }

  _exitIgnite() {
    this._stopIgniteTimers()
    this._igniteAwaitingLayerStrike = false
    this._destroyIgniteLayerPickUi()
    this._setFlintActive(false)
    this._setSparkCounterVisible(false)
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)
    this._tinderSprite.setAlpha(0)
    this._igniteMechanicsPhase = null
  }

  _onFlintClick() {
    if (this.step === 'stack') {
      if (this._stackLayLockedComplete) this._beginIgniteFromStack()
      return
    }

    if (this.step !== 'ignite') return

    if (this._igniteAwaitingLayerStrike) {
      this._flashIgniteTapPitReminder()
      return
    }

    if (!this._igniteMechanicsPhase || this._igniteMechanicsPhase !== 'spark') return

    this._igniteLastClick = this.time.now
    this._igniteTotalClicks++

    const d = this._igniteDifficulty
    const gained = Phaser.Math.Between(d.sparkMin, d.sparkMax)
    this._igniteProgress = Math.min(
      IGNITE_PROGRESS_MAX,
      this._igniteProgress + gained,
    )
    this._igniteSparks = Math.floor(this._igniteProgress)
    this._refreshIgniteProgressUi()

    this._maybePromoteIgniteToBlowPhase()

    if (this._igniteProgress >= IGNITE_PROGRESS_MAX) {
      this._igniteSuccess()
      return
    }

    if (this._igniteTotalClicks >= MAX_CLICKS) {
      this._igniteFail()
    }
  }

  _onIgniteBlowClick() {
    if (this.step !== 'ignite') return
    if (this._igniteMechanicsPhase !== 'blow') return

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
    }

    this._igniteSparks = Math.floor(this._igniteProgress)
    this._maybeDemoteIgniteFromBlowPhase()
    this._refreshIgniteProgressUi()

    if (this._igniteMechanicsPhase === 'blow' && this._igniteProgress >= IGNITE_PROGRESS_MAX) {
      this._igniteSuccess()
      return
    }

    if (this._igniteTotalClicks >= MAX_CLICKS) {
      this._igniteFail()
    }
  }

  _igniteDecayTick() {
    if (!this._igniteMechanicsPhase) return

    let amt = this._igniteDecayPerTick
    if (this._igniteMechanicsPhase === 'blow') {
      amt = Math.max(1, Math.ceil(amt * 0.62))
    }

    this._igniteProgress = Math.max(0, this._igniteProgress - amt)
    this._igniteSparks = Math.floor(this._igniteProgress)
    this._maybeDemoteIgniteFromBlowPhase()
    this._refreshIgniteProgressUi()
  }

  _applyRainInterference() {
    if (this.step !== 'ignite' || !this._igniteMechanicsPhase) return

    this._igniteProgress = Math.max(0, this._igniteProgress - 9)
    this._igniteSparks = Math.floor(this._igniteProgress)
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
    this.registry.set(
      'fireQuality',
      MAX_CLICKS - this._igniteTotalClicks >= 12 ? 'strong' : 'weak',
    )

    this._stopIgniteTimers()
    this._flintBg.disableInteractive()
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)
    this._setSparkCounterVisible(false)

    this.time.delayedCall(800, () => {
      this._enterStep('sustain')
    })
  }

  _igniteFail() {
    this._stopIgniteTimers()
    this._flintBg.disableInteractive()
    this._setIgniteMechanicsHudVisible(false)
    this._setIgniteBlowInteractive(false)
    this._setSparkCounterVisible(false)

    const stamina = this.registry.get('stamina')

    if (!this._igniteRetryUsed) {
      this._igniteRetryUsed = true
      this._dialogue.showSequence(
        [
          { speaker: 'Ren', text: 'Spark will not hold.' },
          {
            speaker: 'Ren',
            text: 'That is alright — we have got enough tinder to try again.',
          },
        ],
        () => {
          this._dialogue.hide()
          const alive = stamina?.deduct(1) ?? true
          if (!alive) {
            this.time.delayedCall(800, () => this._emitDayFail('fire_campsite'))
            return
          }
          this.time.delayedCall(400, () => this._igniteRetry())
        },
      )
      return
    }

    const aliveSecond = stamina?.deduct(2) ?? true
    if (!aliveSecond) {
      this.time.delayedCall(800, () => this._emitDayFail('fire_campsite'))
      return
    }
    this.time.delayedCall(600, () => this._emitDayFail('fire_campsite'))
  }

  _igniteRetry() {
    this._igniteProgress = 0
    this._igniteSparks = 0
    this._igniteTotalClicks = 0
    this._igniteSmokeRenShown = false
    this._igniteBlowHardRenShown = false
    this._igniteRenBlowCorrectShown = false
    this._igniteLastClick = this.time.now
    this._igniteLastBlowTime = 0
    this._refreshIgniteProgressUi()

    this._dialogue.hide()
    this._beginIgniteMechanics()
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
  // SUSTAIN STEP
  // ════════════════════════════════════════════════════════════════════════════

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
    this._nightElapsed = 0
    this._nightComplete = false
    this._nightBarProgressFloor = 0

    const baseSec = this._computeSustainBaseNightDurationSec()
    this._nightTotalMs = baseSec * 1000
    this._sustainTinderBurdenUntil = 0
    this._sustainFuelSlowUntil = 0

    this._rebuildSustainBackupKeysFromSorted()
    this._setSortedPileSpritesHiddenForSustain(true)
    this._createSustainBackupUi(W, H)

    this._fireIcon.setAlpha(1)
    this._tinderSprite.setAlpha(0)

    this._setStrengthBarVisible(true)
    this._refreshStrengthBar()
    this._setNightBarVisible(true)
    this._refreshNightBar()

    this._setFlintActive(false)
    this._refreshBackground()

    if (this._stepProposalShown.sustain) {
      this._beginSustain()
      return
    }
    this._stepProposalShown.sustain = true

    this._dialogue.showSequence([
      { speaker: 'Ren', text: 'Fire is up. Now we keep it alive through the night.' },
      { speaker: 'Ren', text: 'When it gets low, add fuel.' },
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
    this._startDrainTimer()
    this._startNightTimer()
    if (this._campsiteQuality === 'poor') this._startFloodTimer()
  }

  _exitSustain() {
    this._stopSustainTimers()
    this._destroySustainBackupUi()
    this._setSortedPileSpritesHiddenForSustain(false)
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
    this._fireStrength = Phaser.Math.Clamp(
      this._fireStrength + delta, 0, this._strengthCeiling
    )
    this._refreshStrengthBar()
    this._refreshBackground()

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
      this._dialogue.showSequence(
        [{ speaker: 'Ren', text: 'It is out. Should have added sooner.' }],
        () => {
          this._dialogue.hide()
          goRelightFromBackup()
        },
      )
      return
    }

    this._dialogue.showSequence(
      [{ speaker: 'Ren', text: 'No fuel, no fire. That is it.' }],
      () => {
        this._dialogue.hide()
        stamina?.deduct(2)
        this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
      },
    )
  }

  _onNightComplete() {
    if (this._nightComplete) return
    this._nightComplete = true

    this._stopSustainTimers()

    const fireQuality = this._fireStrength >= 3 ? 'strong' : 'weak'

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id:      'fire_campsite',
      success: true,
      score:   fireQuality,
    })

    this.scene.stop()
  }

  _stopSustainTimers() {
    if (this._drainTimer) { this._drainTimer.remove(); this._drainTimer = null }
    if (this._nightTimer) { this._nightTimer.remove(); this._nightTimer = null }
    if (this._floodTimer) { this._floodTimer.remove(); this._floodTimer = null }
  }

  // ── Day fail ──────────────────────────────────────────────────────────────────

  _emitDayFail(id) {
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id,
      success:         false,
      staminaDepleted: true,
    })
    this.scene.stop()
  }
}
