import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

// ─── Sort configuration ───────────────────────────────────────────────────────

const CORRECT_ZONE = {
  dry_leaves:   'tinder',
  dry_grass:    'tinder',
  dry_twigs:    'kindling',
  pine_cone:    'fuel_wood',
  thick_branch: 'fuel_wood',
}

const SORT_ZONE_DEFS = [
  { id: 'tinder',    label: 'Tinder',    description: 'Catches the spark. Lightest, driest.', tint: 0x8a6020 },
  { id: 'kindling',  label: 'Kindling',  description: 'Grows the flame. Small and dry.',      tint: 0x6a5018 },
  { id: 'fuel_wood', label: 'Fuel Wood', description: 'Sustains the fire. Dense and heavy.',  tint: 0x4a3810 },
]

/** Fallback when id is not in CORRECT_ZONE — mirrors FireCollectMinigame collectCategoryForMatId → sort zone. */
function sortZoneFromCollectMaterialId(id) {
  if (id === 'dry_leaves' || id === 'dry_grass') return 'tinder'
  if (id === 'dry_twigs') return 'kindling'
  if (id === 'pine_cone' || id === 'thick_branch') return 'fuel_wood'
  return null
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

const WRONG_SORT_FEEDBACK = {
  dry_grass:    { fuel_wood: 'Too light to sustain anything — burns up in seconds.',                       kindling:  'Too fine for kindling — keep it at the base as tinder.' },
  thick_branch: { tinder:   'Too dense to catch a spark — it needs smaller material underneath it first.', kindling:  'Too thick for the middle — it needs fuel wood position on top.' },
  pine_cone:    { tinder:   'Too compact for tinder — save it for fuel once the flame is going.',          kindling:  'Too dense for the middle layer — it goes with the fuel wood.' },
  dry_twigs:    { fuel_wood: 'Too thin to sustain the fire — it needs to go in the middle, not on top.',  tinder:    'Too coarse for tinder — put the lightest material at the base.' },
  dry_leaves:   { kindling:  'Too fragile for kindling — put it at the base beneath the twigs.',           fuel_wood: 'Too light to sustain anything — burns up in seconds.' },
}

// ─── Stack configuration ─────────────────────────────────────────────────────

/** Which fire-pit layer each sort zone belongs on (ignite / feedback). */
const STACK_ZONE_TO_LAYER = {
  tinder:    'bottom',
  kindling:  'middle',
  fuel_wood: 'top',
}

/** Stack-step drop zone titles for logging / UI (maps sort zone id → layer name). */
const STACK_ZONE_DROP_DISPLAY = {
  tinder:    'Bottom',
  kindling:  'Middle',
  fuel_wood: 'Top',
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

// ─── Ignite configuration ────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  EASY:   { target: 10, decayMs: 800,  rainInterference: false },
  MEDIUM: { target: 15, decayMs: 600,  rainInterference: false },
  HARD:   { target: 20, decayMs: 500,  rainInterference: true  },
}

const MAX_CLICKS     = 30
const IDLE_THRESHOLD = 2000

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
/** Same anchor as FireCollectMinigame pack HUD — materials fly from here into the sort pile. */
const SORT_PACK_HUD_X              = 52
const SORT_PACK_HUD_Y_FROM_BOTTOM  = 48
const SORT_UNPACK_STAGGER_MS       = 80
const SORT_UNPACK_FLY_DURATION_MS  = 420

const ZONE_W        = 210
const ZONE_H        = 100
const SEG_COLOR_LIT = 0xe8a020
const SEG_COLOR_DIM = 0x3a2e18

// ─── Scene ───────────────────────────────────────────────────────────────────

export class FireCampsiteMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireCampsiteMinigame' })
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
    this._debrisClicked   = false
    this._clearHandoffStarted = false
    this._clearCompleteTimer = null
    this._gatherDialogueTimer = null
    this._gatherDialogueDone = false
    this._forestHotspot = null
    this._forestPulseTween = null

    // Sort step
    this._sortedCount  = 0
    this._sortHadError = false

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
    this._igniteEarlyLayAttempt   = false
    this._stackPreserveAfterIgniteTrial = false
    this._stackReenterPreserveLayout = false
    this._stackGoFindBg           = null
    this._stackGoFindTxt          = null
    this._stackStrikeGateHint     = null
    this._stackFinishLayPulseTween = null

    // Ignite state
    this._igniteSparks      = 0
    this._igniteTotalClicks = 0
    this._igniteRetryUsed   = false
    this._igniteMidWarning  = false
    this._igniteLastClick   = 0
    this._igniteTarget      = 0
    this._igniteUseRain     = false
    this._igniteDifficulty  = null
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
    this._sortUnpackRunning = false
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
      clear:   () => this._enterClear(),
      sort:    () => this._enterSort(),
      stack:   () => this._enterStack(),
      ignite:  () => this._enterIgnite(),
      sustain: () => this._enterSustain(),
    }

    this._exitHandlers = {
      clear:   () => this._exitClear(),
      sort:    () => this._exitSort(),
      stack:   () => this._exitStack(),
      ignite:  () => this._exitIgnite(),
      sustain: () => this._exitSustain(),
    }

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

    const entry = this._startStep ?? 'clear'

    if (entry !== 'clear' && !stackResumeHandled) {
      this._seedMatPhasesForDevStart(entry)
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
      st.sortZoneId = s.sortZoneId
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

      const z = CORRECT_ZONE[st.id] ?? sortZoneFromCollectMaterialId(st.id)
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
            this._showDialogue('"This is too wet for any role tonight."')
            this._greyOut(st)
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
          const z = CORRECT_ZONE[state.id]
          if (z) state.sortZoneId = z
        }
      }
    }
    if (startStep === 'stack' || startStep === 'ignite' || startStep === 'sustain') {
      this._sortedCount = this._sortableIds.length
    }
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

      const isSortable = CORRECT_ZONE[id] !== undefined
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
        homePos:    { x, y }, // sort pile grid target (after unpack fly-in)
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
      .setDepth(7)
      .setAlpha(0.4)

    this._flintIcon = this.add.text(btnX, btnY - 10, '🪨', { fontSize: '42px' })
      .setOrigin(0.5).setDepth(8).setAlpha(0.4)

    this._flintLabel = this.add.text(btnX, btnY + 36, 'STRIKE', {
      fontSize: '12px', fontFamily: 'monospace', fill: '#a08040',
    }).setOrigin(0.5).setDepth(8).setAlpha(0.4)

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

  _buildDialogueBox(W, H) {
    const boxY = H * 0.90

    this._dialogueBg = this.add
      .rectangle(W / 2, boxY, W * 0.78, 52, 0x0d0a04, 0.88)
      .setStrokeStyle(1, 0x6b5020)
      .setDepth(20)
      .setVisible(false)

    this._dialogueText = this.add.text(W / 2, boxY, '', {
      fontSize: '15px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
      fill: '#f5e8c0',
      wordWrap: { width: W * 0.74 },
      align: 'center',
    }).setOrigin(0.5).setDepth(21).setVisible(false)
  }

  _showDialogue(text) {
    this._dialogueBg.setVisible(true)
    this._dialogueText.setText(text).setVisible(true)

    if (this._dialogueTimer) this._dialogueTimer.remove()
    this._dialogueTimer = this.time.delayedCall(3500, () => {
      this._dialogueBg.setVisible(false)
      this._dialogueText.setVisible(false)
      this._dialogueTimer = null
    })
  }

  // ── Drag system ───────────────────────────────────────────────────────────────

  _setupDragListeners() {
    this.input.on('dragstart', (_, sprite) => {
      sprite.setDepth(sprite._sustainBackupZoneId ? 22 : 20)
    })

    this.input.on('drag', (_, sprite, dragX, dragY) => {
      sprite.setPosition(dragX, dragY)
      const state = this._spriteToMatState(sprite)
      if (state) state.label.setPosition(dragX, dragY + ITEM_H / 2 + 4)
    })

    this.input.on('dragend', (pointer, sprite) => {
      const baseDepth = sprite._sustainBackupZoneId ? 12 : 5
      sprite.setDepth(baseDepth)
      if (sprite._sustainBackupZoneId) {
        this._onSustainBackupChipDragEnd(sprite, pointer.worldX, pointer.worldY)
        return
      }
      const state = this._spriteToMatState(sprite)
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

  _enterClear() {
    this._titleText.setText(`Day ${this.day} — Clear the camp`)

    // Show debris, enable interaction
    this._debrisObjects.forEach(({ circle, icon }) => {
      circle.setAlpha(1).setInteractive({ useHandCursor: true })
      icon.setAlpha(1)
    })

    // Sort zones: muted
    Object.values(this._sortZones).forEach(z => z.rect.setAlpha(0.3))

    // Stack rings: muted
    this._stackGraphics.setAlpha(0.3)
    this._stackLabelTexts.forEach(t => t.setAlpha(0.3))

    // Flint: greyed
    this._setFlintActive(false)

    // Show counter
    this._clearCounterText.setText(this._clearCounterLabel()).setAlpha(1)
    this._setMoveOnVisible(true)

    if (this._forestHotspot) {
      this._forestHotspot.setVisible(true).setAlpha(0.55)
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

    if (this._debrisRemaining > 0) {
      this._showDialogue('Aiden: "I should tidy up here first."')
      return
    }

    if (this._gatherDialogueDone) {
      this.scene.stop('FireCampsiteMinigame')
      this.scene.start('FireCollectMinigame', { day: this.day })
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
   * Aiden lines after clear (devFireBuildChain). Player must click the forest hotspot to enter FireCollect.
   */
  _runGatherMaterialsDialogue() {
    const LINE_MS = 2800

    if (this._dialogueTimer) this._dialogueTimer.remove()
    this._dialogueTimer = null

    this._dialogueBg.setVisible(true)
    this._dialogueText
      .setText('Aiden: "Good. Now I need to gather materials."')
      .setVisible(true)

    this._gatherDialogueTimer = this.time.delayedCall(LINE_MS, () => {
      this._gatherDialogueTimer = null
      this._dialogueText.setText('Aiden: "There should be something useful in the trees nearby."')

      this._gatherDialogueTimer = this.time.delayedCall(LINE_MS, () => {
        this._gatherDialogueTimer = null
        this._dialogueBg.setVisible(false)
        this._dialogueText.setVisible(false)
        this._gatherDialogueDone = true
        if (this._forestPulseTween) {
          this._forestPulseTween.restart()
          this._forestPulseTween.resume()
        }
      })
    })
  }

  _onDebrisClick(index, circle, icon) {
    const obj = this._debrisObjects[index]
    if (obj.removed) return

    if (!this._debrisClicked) {
      this._debrisClicked = true
      this._showDialogue('"Clear the area before lighting anything. Dry debris near a fire spreads fast."')
    }

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

    this._clearCompleteTimer = this.time.delayedCall(1200, () => {
      this._clearCompleteTimer = null
      this._onMoveOn()
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

    if (this.registry.get('devFireBuildChain')) {
      this._runGatherMaterialsDialogue()
      return
    }

    this._enterStep('sort')
  }

  _clearCounterLabel() {
    return `Clear the area: ${this._debrisRemaining} remaining`
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SORT STEP
  // ════════════════════════════════════════════════════════════════════════════

  _enterSort() {
    const H = this.scale.height
    const packX = SORT_PACK_HUD_X
    const packY = H - SORT_PACK_HUD_Y_FROM_BOTTOM

    this._titleText.setText(`Day ${this.day} — Sort your materials`)
    this._sortUnpackRunning = false

    Object.values(this._sortZones).forEach(z => {
      this.tweens.add({ targets: z.rect, alpha: 0.85, duration: 300 })
    })
    this._sortZoneParts.forEach(({ labelTxt, descTxt }) => {
      this.tweens.add({ targets: [labelTxt, descTxt], alpha: 1, duration: 300 })
    })

    for (const state of Object.values(this._matStates)) {
      if (!state.sprite || !state.label) continue
      state.sprite.setPosition(packX, packY)
      state.label.setPosition(packX, packY + ITEM_H / 2 + 4)
      state.sprite.setAlpha(0)
      state.label.setAlpha(0)
      // Pile sprites are not interactive until after unpack; setDraggable(false)
      // on a game object with no input hits Phaser's InputPlugin (null input).
      if (state.sprite.input) {
        this.input.setDraggable(state.sprite, false)
        state.sprite.disableInteractive()
      }
    }

    if (this._collected.length === 0) {
      this._destroySortPackHud()
      return
    }

    this._buildSortPackHud(packX, packY)
  }

  _destroySortPackHud() {
    for (const n of this._sortPackUiNodes) {
      n.destroy()
    }
    this._sortPackUiNodes.length = 0
  }

  _buildSortPackHud(packX, packY) {
    this._destroySortPackHud()
    const depth = 30

    const stroke = this.add
      .rectangle(packX, packY, 58, 52, 0x1a1208, 0.92)
      .setStrokeStyle(2, 0x7a9050)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true })

    const icon = this.add
      .text(packX - 2, packY - 2, '🎒', { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(depth + 1)

    const badge = this.add
      .text(packX + 22, packY - 20, String(this._collected.length), {
        fontSize: '14px',
        fontFamily: 'Georgia, serif',
        fill: '#f5e8c0',
        stroke: '#1a0f00',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(depth + 2)

    let expanded = false
    let expandBg = null
    let takeBtn = null
    let takeLabel = null

    const collapseExpand = () => {
      expanded = false
      for (const n of [expandBg, takeBtn, takeLabel]) {
        if (!n) continue
        const idx = this._sortPackUiNodes.indexOf(n)
        if (idx !== -1) this._sortPackUiNodes.splice(idx, 1)
        n.destroy()
      }
      expandBg = takeBtn = takeLabel = null
    }

    const showExpand = () => {
      if (expanded || this._sortUnpackRunning) return
      expanded = true
      expandBg = this.add
        .rectangle(packX + 86, packY - 72, 132, 76, 0x120d08, 0.94)
        .setStrokeStyle(2, 0x6b5020)
        .setDepth(depth + 3)
      takeBtn = this.add
        .rectangle(packX + 86, packY - 58, 96, 32, 0x2a3018)
        .setStrokeStyle(2, 0x7a9050)
        .setDepth(depth + 4)
        .setInteractive({ useHandCursor: true })
      takeLabel = this.add
        .text(packX + 86, packY - 58, 'Take Out', {
          fontSize: '15px',
          fontFamily: 'Georgia, serif',
          fill: '#c8e0a0',
        })
        .setOrigin(0.5)
        .setDepth(depth + 5)

      takeBtn.on('pointerover', () => takeBtn.setFillStyle(0x3a4028))
      takeBtn.on('pointerout', () => takeBtn.setFillStyle(0x2a3018))
      takeBtn.on('pointerup', (pointer) => {
        pointer.event?.stopPropagation?.()
        if (this.step !== 'sort' || this._sortUnpackRunning) return
        collapseExpand()
        this._runSortUnpackFromBackpack(packX, packY)
      })

      this._sortPackUiNodes.push(expandBg, takeBtn, takeLabel)
    }

    stroke.on('pointerup', () => {
      if (this._sortUnpackRunning) return
      if (expanded) {
        collapseExpand()
      } else {
        showExpand()
      }
    })

    this._sortPackUiNodes.push(stroke, icon, badge)
  }

  _runSortUnpackFromBackpack(packX, packY) {
    if (this._sortUnpackRunning) return
    this._sortUnpackRunning = true
    this._destroySortPackHud()

    const ordered = this._collected
      .map((_, idx) => this._matStates[`pile_${idx}`])
      .filter(Boolean)

    const n = ordered.length
    if (n === 0) {
      this._sortUnpackRunning = false
      this._enableSortInteractionAfterUnpack()
      return
    }

    let finished = 0
    const doneOne = () => {
      finished++
      if (finished >= n) {
        this._sortUnpackRunning = false
        this._enableSortInteractionAfterUnpack()
      }
    }

    ordered.forEach((state, i) => {
      const { x: hx, y: hy } = state.homePos
      const delay = i * SORT_UNPACK_STAGGER_MS
      const ly = hy + ITEM_H / 2 + 4

      state.sprite.setPosition(packX, packY).setAlpha(0)
      state.label.setPosition(packX, packY + ITEM_H / 2 + 4).setAlpha(0)

      let parts = 0
      const partDone = () => {
        parts++
        if (parts === 2) doneOne()
      }

      this.tweens.add({
        targets: state.sprite,
        x: hx,
        y: hy,
        alpha: 1,
        delay,
        duration: SORT_UNPACK_FLY_DURATION_MS,
        ease: 'Quad.Out',
        onComplete: partDone,
      })
      this.tweens.add({
        targets: state.label,
        x: hx,
        y: ly,
        alpha: 1,
        delay,
        duration: SORT_UNPACK_FLY_DURATION_MS,
        ease: 'Quad.Out',
        onComplete: partDone,
      })
    })
  }

  _enableSortInteractionAfterUnpack() {
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
            this._showDialogue('"This is too wet for any role tonight."')
            this._greyOut(state)
          }
        })
      }
    }
  }

  _exitSort() {
    this._destroySortPackHud()

    for (const state of Object.values(this._matStates)) {
      this.input.setDraggable(state.sprite, false)
      state.sprite.disableInteractive()
    }

    Object.values(this._sortZones).forEach(z => {
      this.tweens.add({ targets: z.rect, alpha: 0.3, duration: 300 })
    })
    this._sortZoneParts.forEach(({ labelTxt, descTxt }) => {
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
    const correctZone = CORRECT_ZONE[state.id]

    if (correctZone === undefined) {
      this._showDialogue('"This is too wet for any role tonight."')
      this._bounceBack(state)
      this._greyOut(state)
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
    state.sortZoneId = zoneId
    state.sprite.disableInteractive()
    this.input.setDraggable(state.sprite, false)

    const zone   = this._sortZones[zoneId]
    const offset = (this._sortedCount % 2 === 0) ? -16 : 16
    const snapX  = zone.x + offset
    const snapY  = zone.y - 10
    state.zonePos = { x: snapX, y: snapY }

    this.tweens.add({
      targets: [state.sprite, state.label],
      x: snapX, y: snapY,
      duration: 200, ease: 'Back.Out',
    })
    state.label.setPosition(snapX, snapY + ITEM_H / 2 + 4)

    this._flashZone(zoneId, 0x44dd44)
    this._showDialogue('"Good."')
    this._sortedCount++
    this._checkSortComplete()
  }

  _sortWrong(state, zoneId) {
    this._sortHadError = true
    const specific = WRONG_SORT_FEEDBACK[state.id]?.[zoneId]
    const text = specific ? `"${specific}"` : '"That doesn\'t belong there."'
    this._showDialogue(text)
    this._flashZone(zoneId, 0xdd4444)
    this._bounceBack(state)
  }

  _checkSortComplete() {
    if (this._sortedCount < this._sortableIds.length) return
    if (this._sortHadError) this._showDialogue('"Had to rethink that."')
    this.time.delayedCall(1000, () => this._enterStep('stack'))
  }

  _bounceBack(state) {
    const { x, y } = state.homePos
    this.tweens.add({ targets: state.sprite, x, y, duration: 280, ease: 'Back.Out' })
    this.tweens.add({ targets: state.label,  x, y: y + ITEM_H / 2 + 4, duration: 280, ease: 'Back.Out' })
  }

  _flashZone(zoneId, color) {
    const zone = this._sortZones[zoneId]
    zone.rect.setStrokeStyle(3, color)
    this.time.delayedCall(400, () => zone.rect.setStrokeStyle(2, 0xaaaaaa))
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
    return state.sortZoneId ?? CORRECT_ZONE[state.id]
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
      if (this.day === 2) {
        this._showDialogue(
          '"Lay is locked in — adjust pieces from the pit cross-section, or pick spark target and strike."',
        )
      }
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
      this._showDialogue(
        `"${STACK_ZONE_DROP_DISPLAY[need]} layer next — that drop goes in the wrong band."`,
      )
      this._bounceToStackOrHome(state)
      return
    }

    this._tryStackPlace(state, targetZone)
  }

  _syncStackSortedDraggability() {
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
        continue
      }
      const z = this._stackSortedCategory(state)
      const rem = this._stackRemainingInPile(z)
      if (rem <= 0) {
        this.input.setDraggable(state.sprite, false)
        state.sprite.disableInteractive()
      } else {
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

    this._updateStackNextLayerButtonLabel()
    this._updateStackPrevLayerButton()
  }

  _destroyStackStrikeHint() {
    this._stackStrikeGateHint?.destroy()
    this._stackStrikeGateHint = null
  }

  /**
   * Strike stays disabled until Finish lay — avoids accidental early ignite + brutal spark target.
   */
  _updateStackStrikeGateUi() {
    if (this.step !== 'stack' || !this._flintBg) return
    if (!this._stackStrikeGateHint) {
      const hintX = this._pitX + 185
      const hintY = this._pitY + 58
      this._stackStrikeGateHint = this.add
        .text(hintX, hintY, '', {
          fontSize: '11px',
          fontFamily: 'Georgia, serif',
          fill: '#cfa878',
          align: 'center',
          wordWrap: { width: 148 },
        })
        .setOrigin(0.5, 0)
        .setDepth(14)
    }
    if (this._stackLayLockedComplete) {
      this._setFlintActive(true)
      this._stackStrikeGateHint.setVisible(false)
      return
    }
    this._setFlintActive(false)
    this._stackStrikeGateHint.setText(
      'Strike is locked.\nTap the FINISH LAY button above the pit first (amber outline, pulsing).',
    )
    this._stackStrikeGateHint.setVisible(true)
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
      this._hideStackSparkControls()
      this._stackActiveLayerIndex = 2
      this._stackNextLayerBg?.setVisible(true)
      this._stackNextLayerTxt?.setVisible(true)
      this._stackNextLayerBg?.setInteractive({ useHandCursor: true })
      this._updateStackNextLayerButtonLabel()
      this._updateStackPrevLayerButton()
      this._updateStackLayerHighlight()
      this._syncStackSortedDraggability()
      this._showDialogue(
        '"Back to editing — use Previous layer to move down, add or remove pieces, then Finish lay again."',
      )
      this._updateStackStrikeGateUi()
      return
    }

    if (this._stackActiveLayerIndex <= 0) return
    this._stackActiveLayerIndex--
    this._updateStackNextLayerButtonLabel()
    this._updateStackPrevLayerButton()
    this._updateStackLayerHighlight()
    this._syncStackSortedDraggability()
    this._updateStackStrikeGateUi()
  }

  _updateStackNextLayerButtonLabel() {
    if (!this._stackNextLayerTxt) return
    const lastBand = this._stackActiveLayerIndex >= 2
    this._stackNextLayerTxt.setText(
      lastBand ? 'FINISH LAY' : 'Next layer',
    )
    this._refreshStackNextLayerButtonEmphasis()
  }

  _refreshStackSparkPickerStyles() {
    for (const p of this._stackSparkPickers) {
      const sel = p.zoneId === this._stackSparkTargetZone
      p.bg.setStrokeStyle(sel ? 3 : 2, sel ? 0xeec866 : 0x5a4834)
    }
  }

  _revealStackSparkControls() {
    this._stackSparkLabel?.setVisible(true)
    for (const p of this._stackSparkPickers) {
      p.bg.setVisible(true).setInteractive({ useHandCursor: true })
      p.txt.setVisible(true)
    }
    this._refreshStackSparkPickerStyles()
  }

  _onStackNextLayerClick() {
    if (this.step !== 'stack' || this._stackLayLockedComplete) return

    if (this._stackActiveLayerIndex < 2) {
      this._stackActiveLayerIndex++
      this._updateStackNextLayerButtonLabel()
      this._updateStackLayerHighlight()
      this._updateStackPrevLayerButton()
      this._showDialogue(
        this._stackActiveLayerIndex === 1
          ? '"Middle layer — build it how you like."'
          : '"Top layer — last chance to shape the lay."',
      )
      this._updateStackStrikeGateUi()
      return
    }

    this._stackLayLockedComplete = true
    this._stackNextLayerBg?.setVisible(false)
    this._stackNextLayerTxt?.setVisible(false)
    this._stackNextLayerBg?.disableInteractive()
    this._revealStackSparkControls()
    this._updateStackLayerHighlight()
    this._syncStackSortedDraggability()
    this._showDialogue(
        '"Pick where the spark lands — base, middle, or top — then strike. A bad spot may never catch."',
    )
    this._updateStackPrevLayerButton()
    this._updateStackStrikeGateUi()
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

    const matCat = CORRECT_ZONE[state.id]
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
  }

  _maybeStackFreePlacementHints(state, zoneId) {
    const want = CORRECT_ZONE[state.id]
    if (!want || !this._stackFreeHintFlags) return
    if (want === zoneId) return
    if (this._stackFreeHintFlags.firstWrongPlacement) return
    this._stackFreeHintFlags.firstWrongPlacement = true
    const line = WRONG_SORT_FEEDBACK[state.id]?.[zoneId]
    const text = line
      ? `"${line}"`
      : '"That layer isn\'t ideal for this piece — lightest at the base, midsize in the middle, heaviest on top. I can still place it if I want."'
    this._showDialogue(text)
  }

  _stackOnPlacedTutorial(zoneId, state) {
    const matCat = CORRECT_ZONE[state.id]
    let primary = null

    if (
      zoneId === 'tinder' &&
      matCat === 'tinder' &&
      !this._stackTutorialFlags.firstTinderBottom
    ) {
      this._stackTutorialFlags.firstTinderBottom = true
      primary =
        'Aiden: "Tinder at the base. This is what catches the spark first."'
    } else if (
      zoneId === 'kindling' &&
      matCat === 'kindling' &&
      !this._stackTutorialFlags.firstKindlingMiddle
    ) {
      this._stackTutorialFlags.firstKindlingMiddle = true
      primary =
        'Aiden: "Kindling in the middle. It needs air to grow — don\'t pack it too tight."'
    } else if (
      zoneId === 'fuel_wood' &&
      matCat === 'fuel_wood' &&
      !this._stackTutorialFlags.firstFuelTop
    ) {
      this._stackTutorialFlags.firstFuelTop = true
      primary =
        'Aiden: "Fuel on top. This is what keeps it going through the night."'
    }

    const meets = this._stackBuildFireMinimumMet()
    let secondary = null
    if (meets && !this._stackTutorialFlags.minRequirementsMet) {
      this._stackTutorialFlags.minRequirementsMet = true
      secondary = 'Aiden: "That should be enough to get it started."'
    }

    if (primary) this._showDialogue(primary)
    if (secondary) {
      const delay = primary ? 3800 : 0
      this.time.delayedCall(delay, () => {
        if (this.step === 'stack') this._showDialogue(secondary)
      })
    }
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

  /** After early lay strike (success or fail): burn tinder, lose half of kindling on stack. */
  _consumeEarlyStrikeMaterials() {
    const bottomKeys = []
    const middleKeys = []
    for (const st of Object.values(this._matStates)) {
      if (st.phase !== 'placed' || !st.layerId) continue
      if (st.layerId === 'bottom') bottomKeys.push(st.pileKey)
      else if (st.layerId === 'middle') middleKeys.push(st.pileKey)
    }
    bottomKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    middleKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    const toRecall = [...bottomKeys]
    const kindlingConsume = Math.ceil(middleKeys.length / 2)
    for (let i = 0; i < kindlingConsume; i++) {
      toRecall.push(middleKeys[i])
    }

    const recallSet = new Set(toRecall)

    for (const zoneId of ['tinder', 'kindling']) {
      const arr = this._stackLayerPlacements?.[zoneId]
      if (!arr?.length) continue
      for (let i = arr.length - 1; i >= 0; i--) {
        if (recallSet.has(arr[i].pileKey)) {
          arr[i].marker.destroy()
          arr.splice(i, 1)
        }
      }
    }

    for (const pileKey of toRecall) {
      const st = this._matStates[pileKey]
      if (!st || st.phase !== 'placed') continue
      const zoneId = LAYER_ID_TO_STACK_ZONE[st.layerId]
      if (zoneId) {
        this._stackDropCount[zoneId] = Math.max(0, this._stackDropCount[zoneId] - 1)
      }
      st.phase = 'consumed'
      st.layerId = null
      st.pitPos = null
      st.sprite?.setAlpha(0)
      st.label?.setAlpha(0)
    }

    this._stackUnitIndexInZone.tinder = this._stackDropCount.tinder
    this._stackUnitIndexInZone.kindling = this._stackDropCount.kindling

    if (this._stackCrossSectionCont && this._stackCrossSectionGeom) {
      this._relayoutStackLayerMarkers('tinder')
      this._relayoutStackLayerMarkers('kindling')
    }

    if (this._stackCategoryCards.length) {
      this._refreshStackCategoryCards()
    }
    if (this.step === 'stack') {
      this._syncStackSortedDraggability()
      this._updateStackLayerHighlight()
    }
  }

  _stackBuildFireMinimumMet() {
    return (
      this._stackDropCount.tinder >= STACK_MIN_BOTTOM &&
      this._stackDropCount.kindling >= STACK_MIN_MIDDLE &&
      this._stackDropCount.fuel_wood >= STACK_MIN_TOP
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STACK STEP
  // ════════════════════════════════════════════════════════════════════════════

  _enterStack() {
    this._titleText.setText(`Day ${this.day} — Build the fire lay`)

    const W = this.scale.width
    const H = this.scale.height

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
      this._stackTutorialFlags = {
        firstTinderBottom:   false,
        firstKindlingMiddle: false,
        firstFuelTop:        false,
        minRequirementsMet:  false,
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

    this._sortZoneParts.forEach(({ labelTxt, descTxt }) => {
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

    this._createStackCrossSection()
    if (preserveLayout) this._rebuildPlacedStackMarkers()

    this._createStackCategoryCards(W, H)
    this._createStackLayerNavUi(W, H)

    if (this._stackLayLockedComplete) {
      this._stackNextLayerBg?.setVisible(false)
      this._stackNextLayerTxt?.setVisible(false)
      this._stackNextLayerBg?.disableInteractive()
      this._revealStackSparkControls()
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
      if (state.sprite.input) {
        this.input.setDraggable(state.sprite, false)
        state.sprite.disableInteractive()
      }
    }

    this._buildStackGoFindMaterials(W, H)

    this._updateStackStrikeGateUi()

    this._holdSlots.forEach(s => s.setAlpha(0))

    this.time.delayedCall(350, () => {
      if (this.step !== 'stack') return
      this._syncStackSortedDraggability()
    })

    if (!preserveLayout) {
      this._showDialogue(
        '"Drag pieces onto the pit cross-section or the rings. Use Next layer until the big button reads FINISH LAY — tap that before Strike. Strike stays dim until then."',
      )
    }
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

    this._showDialogue('Aiden: "Not enough to work with. I need to find more."')

    const stamina = this.registry.get('stamina')
    const alive = stamina?.deduct(1) ?? true
    if (!alive) {
      this._emitDayFail('fire_campsite')
      return
    }

    this.registry.set('fireCampsiteStackResume', this._buildStackResumePayload())
    this.scene.stop('FireCampsiteMinigame')
    this.scene.start('FireCollectMinigame', { day: this.day })
  }

  _tryStackPlace(state, zoneId) {
    if (state.quality === 'BAD') {
      this._showDialogue('"This is too wet for any role tonight."')
      this._bounceToStackOrHome(state)
      this._greyOut(state)
      return
    }

    const correctZone = CORRECT_ZONE[state.id]
    if (correctZone === undefined) {
      this._showDialogue('"This is too wet for any role tonight."')
      this._bounceToStackOrHome(state)
      this._greyOut(state)
      return
    }

    this._maybeStackFreePlacementHints(state, zoneId)
    this._stackFreePlace(state, zoneId)
  }

  _stackFreePlace(state, zoneId) {
    const idx = this._stackUnitIndexInZone[zoneId]++
    this._stackDropCount[zoneId]++
    const zoneName = STACK_ZONE_DROP_DISPLAY[zoneId]
    console.log('dropped', state.id, 'into', zoneName, 'count now:', this._stackDropCount[zoneId])

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

  // ════════════════════════════════════════════════════════════════════════════
  // IGNITE STEP
  // ════════════════════════════════════════════════════════════════════════════

  _enterIgnite() {
    this._titleText.setText('Strike the flint — reach the spark target.')

    // Re-read inkBridge for difficulty (written by InkBridge after fire_collect score)
    const inkBridge = this.registry.get('inkBridge')
    const rawDiff   = inkBridge?.getVariable('mg_fire_collect_score') ?? 'EASY'
    const quality   = inkBridge?.getVariable('campsite_quality') ?? 'good'

    this._igniteDifficulty  = DIFFICULTY_CONFIG[rawDiff] ?? DIFFICULTY_CONFIG.EASY
    const baseTarget = this._igniteDifficulty.target
    const mult = this._computeStackIgniteTargetMultiplier()
    let target = Math.ceil(baseTarget * mult)
    if (this._igniteEarlyLayAttempt) {
      target = Math.max(target + 22, Math.ceil(baseTarget * mult * 3.2))
    }
    this._igniteTarget = Phaser.Math.Clamp(target, 8, 60)
    this._igniteUseRain     = this._igniteDifficulty.rainInterference && quality === 'poor'

    const mDecay = this._stackDropCount.kindling
    let effectiveDecayMs = this._igniteDifficulty.decayMs
    if (mDecay === 0) effectiveDecayMs = Math.floor(effectiveDecayMs * 0.5)
    else if (mDecay === 1) effectiveDecayMs = Math.floor(effectiveDecayMs * 0.8)
    // mDecay >= 2: base decayMs (sparks hold normally)
    this._effectiveDecayMs = effectiveDecayMs

    // Reset ignite state
    this._igniteSparks      = 0
    this._igniteTotalClicks = 0
    this._igniteMidWarning  = false
    this._igniteLastClick   = this.time.now

    // Show fire lay in pit / tinder indicator
    this._tinderSprite.setAlpha(0.7)

    // Activate flint
    this._setFlintActive(true)

    // Show spark counter
    this._setSparkCounterVisible(true)
    this._refreshSparkCounter()

    // Start timers
    this._decayTimer = this.time.addEvent({
      delay: this._effectiveDecayMs,
      callback: this._decaySpark,
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

    // Background: still night until ignite succeeds
    this._refreshBackground()
  }

  _exitIgnite() {
    this._stopIgniteTimers()
    this._setFlintActive(false)
    this._setSparkCounterVisible(false)
    this._tinderSprite.setAlpha(0)
  }

  _onFlintClick() {
    if (this.step === 'stack') {
      const early = !this._stackLayLockedComplete
      this._igniteEarlyLayAttempt = early
      if (early) {
        this._stackSparkTargetZone =
          STACK_LAYER_ORDER[this._stackActiveLayerIndex] ?? 'tinder'
      }
      this._flintBg.disableInteractive()

      if (!early) {
        if (this._stackHadError) this._showDialogue('"That took a few tries."')
      }

      let delay = 200
      if (!early && this._stackHadError) delay = 900
      this.time.delayedCall(delay, () => {
        if (this.step === 'stack') this._enterStep('ignite')
      })
      return
    }

    if (this.step !== 'ignite') {
      this._showDialogue('"I can\'t use the flint right now."')
      return
    }

    this._igniteLastClick = this.time.now
    this._igniteTotalClicks++

    const gained = Phaser.Math.Between(1, 3)
    this._igniteSparks += gained
    this._refreshSparkCounter()

    if (
      this._igniteTotalClicks >= 15 &&
      this._igniteSparks < this._igniteTarget * 0.5 &&
      !this._igniteMidWarning
    ) {
      this._igniteMidWarning = true
      this._showDialogue('"The material is slowing this down. Wet tinder needs more sparks to catch."')
    }

    if (this._igniteSparks >= this._igniteTarget) {
      this._igniteSuccess()
      return
    }

    if (this._igniteTotalClicks >= MAX_CLICKS) {
      this._igniteFail()
    }
  }

  _decaySpark() {
    if (this._igniteSparks > 0) {
      this._igniteSparks = Math.max(0, this._igniteSparks - 1)
      this._refreshSparkCounter()
    }
  }

  _applyRainInterference() {
    this._igniteSparks = Math.max(0, this._igniteSparks - 3)
    this._refreshSparkCounter()

    this.tweens.add({
      targets: this._tinderSprite,
      alpha: 0.1,
      duration: 300,
      yoyo: true,
      ease: 'Linear',
    })
  }

  _checkIdle() {
    if (this.time.now - this._igniteLastClick >= IDLE_THRESHOLD) {
      this._showDialogue('"Keep going — sparks die fast in this rain."')
      this._igniteLastClick = this.time.now
    }
  }

  _igniteSuccess() {
    if (this._igniteEarlyLayAttempt) {
      this._igniteEarlyLayAttempt = false
      this._stopIgniteTimers()
      this._flintBg.disableInteractive()
      this._setSparkCounterVisible(false)
      this._tinderSprite.setAlpha(0)
      this._showDialogue(
        '"Only a faint flash — the lay isn\'t finished, so nothing can hold the spark. Finish each layer, touch Finish lay, then strike for real."',
      )
      this._consumeEarlyStrikeMaterials()
      const staminaEarly = this.registry.get('stamina')
      const aliveEarly = staminaEarly?.deduct(1) ?? true
      if (!aliveEarly) {
        this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
        return
      }
      this._stackPreserveAfterIgniteTrial = true
      this.time.delayedCall(1000, () => {
        if (this.step === 'ignite') this._enterStep('stack')
      })
      return
    }

    this._stopIgniteTimers()
    this._flintBg.disableInteractive()
    this._showDialogue('"There it is."')

    this.time.delayedCall(800, () => {
      this._enterStep('sustain')
    })
  }

  _igniteFail() {
    if (this._igniteEarlyLayAttempt) {
      this._igniteEarlyLayAttempt = false
      this._stopIgniteTimers()
      this._flintBg.disableInteractive()
      this._setSparkCounterVisible(false)
      this._tinderSprite.setAlpha(0)
      this._showDialogue(
        '"The lay isn\'t finished — the spark had nothing solid to catch. Keep building (Next layer), tap Finish lay when you\'re done, then strike again."',
      )
      this._consumeEarlyStrikeMaterials()
      const staminaEarly = this.registry.get('stamina')
      const aliveEarly = staminaEarly?.deduct(1) ?? true
      if (!aliveEarly) {
        this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
        return
      }
      this._stackPreserveAfterIgniteTrial = true
      this.time.delayedCall(1000, () => {
        if (this.step === 'ignite') this._enterStep('stack')
      })
      return
    }

    this._stopIgniteTimers()
    this._flintBg.disableInteractive()
    this._showDialogue('"The spark won\'t hold."')

    const stamina = this.registry.get('stamina')
    const alive   = stamina?.deduct(1) ?? true

    if (!alive) {
      this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
      return
    }

    if (!this._igniteRetryUsed) {
      this._igniteRetryUsed = true
      this.time.delayedCall(1400, () => this._igniteRetry())
      return
    }

    this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
  }

  _igniteRetry() {
    this._igniteSparks      = 0
    this._igniteTotalClicks = 0
    this._igniteMidWarning  = false
    this._igniteLastClick   = this.time.now
    this._refreshSparkCounter()
    this._showDialogue('"Try again."')

    this._setFlintActive(true)

    this._decayTimer = this.time.addEvent({
      delay: this._effectiveDecayMs,
      callback: this._decaySpark,
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

  _stopIgniteTimers() {
    if (this._decayTimer) { this._decayTimer.remove(); this._decayTimer = null }
    if (this._rainTimer)  { this._rainTimer.remove();  this._rainTimer  = null }
    if (this._idleTimer)  { this._idleTimer.remove();  this._idleTimer  = null }
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
    this._showDialogue('"It went out."')

    const stamina = this.registry.get('stamina')

    if (this._sustainBackupRemainingCount() > 0) {
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
      return
    }

    stamina?.deduct(2)
    this.time.delayedCall(1000, () => this._emitDayFail('fire_campsite'))
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
