import Phaser from 'phaser'
import { GameEvents } from '../../../../systems/GameEvents.js'
import { DialogueBox } from './DialogueBox.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const WET_TINT = 0x3a4a34  // dark damp green-grey: target colour for fully wet materials
const RING_RADIUS = 46      // px radius of the wet-timer arc around each material

const QUALITY_COLOR = {
  GOOD: 0x8a7050,   // warm dry brown
  MID:  0x5a4a30,   // muted, slightly darker
  BAD:  0x2a1e10,   // dark heavy
}

const QUALITY_ALPHA = { GOOD: 1, MID: 1, BAD: 0.85 }

// ─── Material definitions ─────────────────────────────────────────────────────

// wetDuration: ms before quality degrades one level. null = already degraded on spawn.
// poorStartQuality: quality used instead of startQuality when campsite is poor.
const MATERIAL_DEF_BY_ID = {
  dry_leaves: {
    id: 'dry_leaves',
    label: 'Dry Leaves',
    line: 'Light. Crumbles when I press it.',
    startQuality: 'GOOD',
    poorStartQuality: 'MID',
    wetDuration: 2400,
  },
  dry_twigs: {
    id: 'dry_twigs',
    label: 'Dry Twigs',
    line: 'Snaps cleanly.',
    startQuality: 'GOOD',
    poorStartQuality: 'GOOD',
    wetDuration: 3600,
  },
  thick_branch: {
    id: 'thick_branch',
    label: 'Thick Branch',
    line: 'Heavy. This will burn long.',
    startQuality: 'GOOD',
    poorStartQuality: 'GOOD',
    wetDuration: 4800,
  },
  dry_grass: {
    id: 'dry_grass',
    label: 'Dry Grass',
    line: 'This will catch fast.',
    startQuality: 'GOOD',
    poorStartQuality: 'MID',
    wetDuration: 1800,
  },
  pine_cone: {
    id: 'pine_cone',
    label: 'Pine Cone',
    line: 'Compact. Might work for fuel.',
    startQuality: 'MID',
    poorStartQuality: 'MID',
    wetDuration: 3000,
  },
  damp_bark: {
    id: 'damp_bark',
    label: 'Damp Bark',
    line: 'Already heavy. Getting wetter.',
    startQuality: 'MID',
    poorStartQuality: 'MID',
    wetDuration: null,
  },
  wet_moss: {
    id: 'wet_moss',
    label: 'Wet Moss',
    line: "Sticky. This won't catch.",
    startQuality: 'BAD',
    poorStartQuality: 'BAD',
    wetDuration: null,
  },
  wet_log: {
    id: 'wet_log',
    label: 'Wet Log',
    line: 'Too waterlogged. Useless tonight.',
    startQuality: 'BAD',
    poorStartQuality: 'BAD',
    wetDuration: null,
  },
}

/** 15 cards total; when empty, deck reshuffles (FireCollect continuous spawn). */
const MATERIAL_POOL_ROWS = [
  ['dry_leaves', 2],
  ['dry_grass', 2],
  ['dry_twigs', 3],
  ['thick_branch', 2],
  ['pine_cone', 2],
  ['wet_moss', 1],
  ['wet_log', 1],
  ['damp_bark', 1],
]

function buildMaterialPoolDeck() {
  const expanded = []
  for (const [id, count] of MATERIAL_POOL_ROWS) {
    const def = MATERIAL_DEF_BY_ID[id]
    if (!def) continue
    for (let i = 0; i < count; i++) expanded.push({ ...def })
  }
  if (expanded.length === 14) {
    expanded.push({ ...MATERIAL_DEF_BY_ID.dry_twigs })
  }
  return expanded
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDifficulty(collectedMaterials) {
  const bad = collectedMaterials.filter(m => m.quality === 'BAD').length
  const mid = collectedMaterials.filter(m => m.quality === 'MID').length
  if (bad >= 2) return 'HARD'
  if (bad === 1 || mid >= 2) return 'MEDIUM'
  return 'EASY'
}

/** Category counts for registry (FireCampsite reads after collect). */
function collectCategoryForMatId(id) {
  if (id === 'dry_leaves' || id === 'dry_grass') return 'tinder'
  if (id === 'dry_twigs') return 'kindling'
  if (id === 'pine_cone' || id === 'thick_branch') return 'fuel'
  return 'unusable'
}

function buildCollectCounts(items) {
  const count = { tinder: 0, kindling: 0, fuel: 0, unusable: 0, total: items.length }
  for (const m of items) {
    count[collectCategoryForMatId(m.id)]++
  }
  return count
}

/** Day 2 forest targets (day2_firemaking_dev_spec §4.2). */
export const COLLECT_TARGETS = { tinder: 3, kindling: 3, fuel: 2 }

/**
 * Scene data `collectSessionKind` — mid-campsite return from FireBuildingMinigame (stack / ignite).
 * Skips §4.2 camp tutorial; Head Back resumes campsite stack (via registry.fireCampsiteStackResume).
 */
export const COLLECT_SESSION_RESUME_CAMPSITE = 'resume_campsite'

/** §4.2 HUD toast duration / imbalance intervention (once per session). */
const COLLECT_TOAST_MS = 1400
const COLLECT_IMBALANCE_MIN_PICKUPS = 6

/** Label on ground / in pack when weathering dry fuels (sync with quality in _degradeQuality). */
function displayLabelForQuality(matDef, currentQuality) {
  const dampable =
    matDef.id === 'dry_leaves' ||
    matDef.id === 'dry_grass' ||
    matDef.id === 'dry_twigs' ||
    matDef.id === 'thick_branch'
  if (dampable && (currentQuality === 'MID' || currentQuality === 'BAD')) {
    const damp = {
      dry_leaves:   'Damp Leaves',
      dry_grass:    'Damp Grass',
      dry_twigs:    'Damp Twigs',
      thick_branch: 'Damp Branch',
    }
    return damp[matDef.id]
  }
  return matDef.label
}

// Linear interpolation between two hex colours.
function lerpColor(from, to, t) {
  const r = Math.round(((from >> 16) & 0xff) * (1 - t) + ((to >> 16) & 0xff) * t)
  const g = Math.round(((from >> 8)  & 0xff) * (1 - t) + ((to >> 8)  & 0xff) * t)
  const b = Math.round((from & 0xff) * (1 - t) + (to & 0xff) * t)
  return (r << 16) | (g << 8) | b
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FireBuildingCollect extends Phaser.Scene {
  constructor() {
    super({ key: 'FireBuildingCollect' })
  }

  init(data) {
    this.day        = data?.day ?? 2
    /** `'resume_campsite'` when returning from campsite mid-flow; set via scene.start or inferred from snapshot. */
    this._collectSessionKind =
      data?.collectSessionKind ??
      (this.registry.get('fireCampsiteStackResume') ? COLLECT_SESSION_RESUME_CAMPSITE : null)
    this._isResumeCampsiteSession = this._collectSessionKind === COLLECT_SESSION_RESUME_CAMPSITE
    this._isPoor    = false

    // Material pool (shuffled). Consumed one entry per spawn.
    this._pool      = []

    // Active material state, keyed by spawn instance id.
    // Each entry: { id, matDef, currentQuality, spawnPos, wetElapsed,
    //               wetDuration, dryColor, wetTween, wetTweenStarted,
    //               inPack, onScreen, sprite, label }
    this._onScreen  = {}

    // Packed materials: instance ids in collection order (unlimited).
    this._packedOrder  = []
    this._categoryCounts = { tinder: 0, kindling: 0, fuel: 0, unusable: 0 }
    this._spawnInstanceSeq = 0
    // Every successful collect (into pack); not decremented on eject. Drives stamina tiers (Day 3 pattern).
    this._lifetimeCollectCount = 0
    this._staminaPenaltyTiersApplied = 0

    // First BAD / wet material added to pack → Ren tutorial (spec §4.2).
    this._renBadPickupTutorialShown = false

    this._tutorialTinderShown   = false
    this._tutorialKindlingShown = false
    this._tutorialFuelShown = false

    /** Blocks ground collects while Ren dialogue sequence is active (click-through). */
    this._collectInputLocked = false

    /** Ref-count pauses spawn + wet tick (+ wet tweens) while dialogue runs. */
    this._forestSimPauseDepth = 0

    /** Ren lines after hitting 3/3/2 + trade-off (spec §4.2). */
    this._targetsMetDialogueShown = false

    /** §259–265 head-back praise suppressed when quota dialogue already ran. */
    this._headBackGoodFeedbackShown = false

    /** §247–257 mid-collect imbalance Ren (once). */
    this._collectImbalanceRenShown = false

    this._toastText = null
    this._toastTween = null

    this._dialogueTimer = null
    this._tickTimer     = null
    this._spawnTimer    = null
    this._ringGraphics  = null

    // Pack list row texts (rebuilt on add/eject)
    this._packListRows = []

    /** Clone of registry.fireCampsiteStackResume — survives accidental registry clears during Collect. */
    this._resumeSnapBackupCopy = null
    /** Per-session HUD quotas (`resume` subtracts campsite baseline from §4.2 totals). */
    this._sessionTargets = { ...COLLECT_TARGETS }
  }

  preload() {
    // Art assets are loaded here when available:
    // this.load.image('bg_forest_rain', 'assets/BG-FOREST-RAIN.png')
    // Object.values(MATERIAL_DEF_BY_ID).forEach(d =>
    //   this.load.image(`mat_${d.id}`, `assets/MAT-${d.id.toUpperCase().replace(/_/g, '-')}.png`))
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // Read campsite quality from InkBridge (set by Dev A's Ink story).
    // Falls back to 'good' if InkBridge is not yet registered.
    const inkBridge = this.registry.get('inkBridge')
    this._isPoor = inkBridge?.getVariable('campsite_quality') === 'poor'

    const resumeSnapRegistry = this.registry.get('fireCampsiteStackResume')
    if (this._isResumeCampsiteSession && resumeSnapRegistry) {
      try {
        this._resumeSnapBackupCopy = structuredClone(resumeSnapRegistry)
      } catch (_) {
        this._resumeSnapBackupCopy = JSON.parse(JSON.stringify(resumeSnapRegistry))
      }
    }

    this._sessionTargets = this._resolveSessionCollectTargets()

    this._pool = Phaser.Utils.Array.Shuffle(buildMaterialPoolDeck())

    if (this._isResumeCampsiteSession) {
      this._tutorialTinderShown = true
      this._tutorialKindlingShown = true
      this._tutorialFuelShown = true
    }

    this._buildBackground(W, H)
    this._buildBackpackPanel(W, H)
    this._buildDialogueBox(W, H)
    this._buildHeadBackButton(W, H)

    // Shared Graphics layer for all wet-timer rings (drawn above materials).
    this._ringGraphics = this.add.graphics().setDepth(10)

    // Spawn / wet tick stay paused until opening Ren lines finish (§4.2).
    this._spawnTimer = this.time.addEvent({
      delay: 1500,
      callback: this._trySpawn,
      callbackScope: this,
      loop: true,
    })
    this._spawnTimer.paused = true

    this._tickTimer = this.time.addEvent({
      delay: 100,
      callback: this._gameTick,
      callbackScope: this,
      loop: true,
    })
    this._tickTimer.paused = true

    this._runCollectEntryFlow()
  }

  /** §4.2 totals minus materials already carried at campsite (resume trips only). */
  _resolveSessionCollectTargets() {
    if (!this._isResumeCampsiteSession) return { ...COLLECT_TARGETS }

    const minsRaw = this.registry.get('collectForestMinimumAdds')
    if (minsRaw) this.registry.remove('collectForestMinimumAdds')

    const raw = this.registry.get('collectedMaterials')
    const items = Array.isArray(raw) ? raw : (raw?.items ?? [])
    const normalized = items.map((m) => ({
      id: m?.id,
      quality: m?.quality ?? 'GOOD',
    }))
    const baseline = buildCollectCounts(normalized)

    let session = {
      tinder: Math.max(0, COLLECT_TARGETS.tinder - baseline.tinder),
      kindling: Math.max(0, COLLECT_TARGETS.kindling - baseline.kindling),
      fuel: Math.max(0, COLLECT_TARGETS.fuel - baseline.fuel),
    }

    if (minsRaw) {
      session = {
        tinder: Math.max(session.tinder, minsRaw.tinder ?? 0),
        kindling: Math.max(session.kindling, minsRaw.kindling ?? 0),
        fuel: Math.max(session.fuel, minsRaw.fuel ?? 0),
      }
    }

    return session
  }

  _sessionForestQuotaTotal() {
    const s = this._sessionTargets
    return s.tinder + s.kindling + s.fuel
  }

  /**
   * §4.2: camp Ren proposal + paths when booting straight to Collect; forest mechanism lines; then spawn.
   * Skipped when flag set from FireBuildingMinigame clear handoff (`fireCollectCampProposalDone`).
   * Skipped when `collectSessionKind === resume_campsite` (forest run from stack / ignite).
   */
  _runCollectEntryFlow() {
    if (this._isResumeCampsiteSession) {
      this._runResumeForestEntryBriefing()
      return
    }

    if (this.registry.get('fireCollectCampProposalDone')) {
      this._startForestMechanismIntro()
      return
    }

    this._collectInputLocked = true
    this._pauseForestSimulationForDialogue()

    const finishCampPaths = () => {
      this.registry.set('fireCollectCampProposalDone', true)
      this._dialogue.hide()
      this._collectInputLocked = false
      this._resumeForestSimulationAfterDialogue()
      this._startForestMechanismIntro()
    }

    this._dialogue.showSequence(
      [
        { speaker: 'Ren', text: 'Right. We need wood.' },
        { speaker: 'Ren', text: 'Rain is picking up so whatever is dry out there will not stay dry for long.' },
        { speaker: 'Ren', text: 'You go ahead — you know what to grab, yeah?' },
      ],
      () => {
        this._dialogue.showChoices([
          {
            text: 'Of course. Three types — tinder, kindling, fuel wood.',
            onSelect: () => {
              this._dialogue.show({
                speaker: 'Ren',
                text: 'Alright, let us go then.',
                onComplete: finishCampPaths,
              })
            },
          },
          {
            text: 'Roughly, but remind me.',
            onSelect: () => {
              this._dialogue.showSequence(
                [
                  { speaker: 'Ren', text: 'Three types: tinder, kindling, and fuel wood.' },
                  { speaker: 'Ren', text: 'Tinder is the lightest, driest stuff — leaves, dry grass, anything that crumbles. That catches the spark.' },
                  { speaker: 'Ren', text: 'Kindling is thin sticks, things you can snap. They catch from the tinder and give the flame time to grow.' },
                  { speaker: 'Ren', text: 'Fuel wood is the thick pieces. Once the fire is going, that keeps it alive.' },
                  { speaker: 'Ren', text: 'Aim for three handfuls of tinder, three of kindling, and two good pieces of fuel.' },
                  { speaker: 'Ren', text: 'Do not grab anything heavy or damp — wet wood kills a fire before it starts.' },
                ],
                finishCampPaths,
              )
            },
          },
        ])
      },
    )
  }

  /** Short briefing when re-entering forest from campsite (no three-type tutorial / choices). */
  _runResumeForestEntryBriefing() {
    const tgt = this._sessionTargets
    const parts = []
    if (tgt.tinder > 0) parts.push(`${tgt.tinder} tinder`)
    if (tgt.kindling > 0) parts.push(`${tgt.kindling} kindling`)
    if (tgt.fuel > 0) parts.push(`${tgt.fuel} fuel`)

    const quotaLine =
      parts.length > 0
        ? `From here we still need ${parts.join(', ')} — whatever is already dry at camp counts toward that stack.`
        : 'Camp load already hits the usual mix — grab only if something spoiled in the rain.'

    const lines = [
      'Back into the rain — grab what we are short on.',
      quotaLine,
      'Dry tinder catches the spark first when we are thin there. Move fast — leave the soaked junk.',
    ]
    this._showRenDialogueSequence(lines, () => this._trySpawn())
  }

  /** §4.2 forest mechanism lines (after camp proposal or when resuming collect). */
  _startForestMechanismIntro() {
    this._showRenDialogueSequence(
      [
        'Rain is getting heavier. Whatever is dry now will not be for long.',
        'Move fast.',
      ],
      () => {
        this._trySpawn()
      },
    )
  }

  // ── Background ──────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    // Placeholder until BG-FOREST-RAIN art is ready.
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1208)

    this.add.text(W / 2, 60 * (window.devicePixelRatio || 1), 'Collect materials for the fire.', {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      fill: '#f0e6c8',
      stroke: '#1a0f00',
      strokeThickness: 4,
    }).setOrigin(0.5)

    // Rain overlay (placeholder semi-transparent layer)
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a1820, 0.18)
  }

  // ── Backpack panel (counts + list — corner backpack icon intentionally omitted) ──

  _buildBackpackPanel(W, H) {
    const uiDepth = 12

    this.add.text(24, H * 0.74 - 22, 'Pack', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fill: '#a08040',
    }).setOrigin(0, 0).setDepth(uiDepth)

    this._counterBlockText = this.add.text(24, H * 0.74, '', {
      fontSize: '13px',
      fontFamily: 'Georgia, serif',
      fill: '#e8d8a0',
      wordWrap: { width: Math.min(W - 48, 520) },
    }).setOrigin(0, 0).setDepth(uiDepth)

    this._toastText = this.add
      .text(W / 2, H * 0.52, '', {
        fontSize: '18px',
        fontFamily: 'Georgia, serif',
        fill: '#f5e6b8',
        stroke: '#1a1208',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(uiDepth + 2)
      .setAlpha(0)

    this._packListTitle = this.add.text(W * 0.38, H * 0.74 - 22, 'Collected — click to drop:', {
      fontSize: '13px',
      fontFamily: 'Georgia, serif',
      fill: '#a08040',
    }).setOrigin(0, 0).setDepth(uiDepth)

    this._packListBaseY = H * 0.74
    this._refreshCategoryDisplay()
    this._rebuildPackListRows()
  }

  _refreshCategoryDisplay() {
    const c = this._categoryCounts
    const t = this._sessionTargets
    const fmt = (label, key) => {
      const cap = t[key]
      if (cap <= 0) return `${label}: ✓`
      return `${label}: ${c[key]}/${cap}`
    }
    this._counterBlockText.setText(
      `${fmt('Tinder', 'tinder')}  |  ${fmt('Kindling', 'kindling')}  |  ${fmt('Fuel', 'fuel')}  |  Unusable: ${c.unusable}`,
    )
  }

  /** §337 — HUD toast after pickup (shown immediately, or after tutorial Ren finishes). */
  _flashCollectToastForPickupCategory(cat) {
    if (cat === 'tinder') this._flashCollectToast('+1 Tinder')
    else if (cat === 'kindling') this._flashCollectToast('+1 Kindling')
    else if (cat === 'fuel') this._flashCollectToast('+1 Fuel Wood')
    else if (cat === 'unusable') this._flashCollectToast('Too wet.')
  }

  _flashCollectToast(message) {
    if (!this._toastText || !message) return
    if (this._toastTween) {
      this._toastTween.stop()
      this._toastTween = null
    }
    this._toastText.setText(message).setAlpha(1).setVisible(true)
    this._toastTween = this.tweens.add({
      targets: this._toastText,
      alpha: { from: 1, to: 0 },
      delay: 320,
      duration: COLLECT_TOAST_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this._toastTween = null
      },
    })
  }

  /** §247–257 — rough mix / too much wet junk; once per run. */
  _maybeCollectImbalanceRen() {
    if (this._collectImbalanceRenShown || this._collectInputLocked) return
    if (this._lifetimeCollectCount < COLLECT_IMBALANCE_MIN_PICKUPS) return

    const c = this._categoryCounts
    const st = this._sessionTargets
    const looksWrong =
      c.unusable >= 4 ||
      (st.fuel > 0 && c.fuel >= 2 && c.tinder === 0 && c.kindling === 0) ||
      (st.tinder > 0 && c.tinder >= 5 && c.kindling === 0) ||
      (st.kindling > 0 && c.kindling >= 5 && c.tinder === 0)

    if (!looksWrong) return

    this._collectImbalanceRenShown = true
    this._showRenDialogueSequence(
      [
        'Hold on — look at what you have got so far.',
        'You are going to try to start a fire with that?',
        'You need the fine stuff — tinder — to catch the spark first.',
        'And enough kindling to bridge to the bigger pieces. Think about what is missing.',
      ],
      null,
    )
  }

  _rebuildPackListRows() {
    for (const row of this._packListRows) row.destroy()
    this._packListRows = []

    const W = this.scale.width
    const lineH = 15
    let y = this._packListBaseY

    for (const instanceId of this._packedOrder) {
      const state = this._onScreen[instanceId]
      if (!state) continue

      const t = this.add
        .text(W * 0.38, y, `• ${displayLabelForQuality(state.matDef, state.currentQuality)}`, {
          fontSize: '12px',
          fontFamily: 'Georgia, serif',
          fill: '#e8d8a0',
        })
        .setOrigin(0, 0)
        .setDepth(12)
        .setInteractive({ useHandCursor: true })

      t.on('pointerover', () => t.setStyle({ fill: '#fff8c8' }))
      t.on('pointerout', () => t.setStyle({ fill: '#e8d8a0' }))
      t.on('pointerup', () => this._ejectFromPackByInstance(instanceId))

      this._packListRows.push(t)
      y += lineH
    }
  }

  // ── Dialogue / monologue box ─────────────────────────────────────────────────

  _buildDialogueBox(_W, _H) {
    this._dialogue = new DialogueBox(this)
  }

  // ── Head Back button ─────────────────────────────────────────────────────────

  _buildHeadBackButton(W, H) {
    /** Above materials / rings; below DialogueBox (≈4500) so clicks register after dialogue closes. */
    const hbDepth = 4400

    this._headBackBtn = this.add
      .rectangle(W - 110, H - 52, 200, 48, 0x2a3018)
      .setStrokeStyle(2, 0x7a9050)
      .setInteractive({ useHandCursor: true })
      .setVisible(true)
      .setScrollFactor(0)
      .setDepth(hbDepth)

    this._headBackBtnText = this.add.text(W - 110, H - 52, 'Head Back →', {
      fontSize: '16px',
      fontFamily: 'Georgia, serif',
      fill: '#c8e0a0',
    }).setOrigin(0.5).setVisible(true).setScrollFactor(0).setDepth(hbDepth)

    this._headBackBtn.on('pointerover', () => this._headBackBtn.setFillStyle(0x3a4028))
    this._headBackBtn.on('pointerout',  () => this._headBackBtn.setFillStyle(0x2a3018))
    this._headBackBtn.on('pointerup',   () => this._onHeadBack())
  }

  // ── Spawn system ─────────────────────────────────────────────────────────────

  _trySpawn() {
    if (this._forestSimPauseDepth > 0) return

    if (this._pool.length === 0) {
      this._pool = Phaser.Utils.Array.Shuffle(buildMaterialPoolDeck())
    }
    const matDef = this._pool.shift()
    if (!matDef) return
    this._spawnMaterial(matDef)
  }

  _spawnMaterial(matDef) {
    if (!matDef) return
    const W = this.scale.width
    const H = this.scale.height
    const instanceId = `__m${++this._spawnInstanceSeq}`

    // Random position in the upper portion of the screen, away from UI.
    const x = Phaser.Math.Between(80, W - 80)
    const y = Phaser.Math.Between(100, H * 0.60)

    // Starting quality: degraded if poor campsite and material has poorStartQuality.
    const startQuality = (this._isPoor && matDef.poorStartQuality !== matDef.startQuality)
      ? matDef.poorStartQuality
      : matDef.startQuality

    const dryColor = QUALITY_COLOR[startQuality]

    // Sprite placeholder (swap for this.add.image when art assets arrive;
    // replace setFillStyle calls below with setTint calls on image sprites).
    const sprite = this.add
      .rectangle(x, y, 82, 82, dryColor)
      .setAlpha(QUALITY_ALPHA[startQuality])
      .setInteractive({ useHandCursor: true })
      .setDepth(5)

    const label = this.add.text(x, y + 52, displayLabelForQuality(matDef, startQuality), {
      fontSize: '12px',
      fontFamily: 'Georgia, serif',
      fill: '#e8d8a0',
    }).setOrigin(0.5).setDepth(6)

    const state = {
      instanceId,
      id:               matDef.id,
      matDef,
      currentQuality:   startQuality,
      spawnPos:         { x, y },
      wetElapsed:       0,
      wetDuration:      matDef.wetDuration,
      dryColor,
      wetTween:         null,
      wetTweenStarted:  false,
      inPack:           false,
      onScreen:         true,
      sprite,
      label,
    }

    // Materials that start already degraded get the wet appearance immediately.
    if (matDef.wetDuration === null) {
      sprite.setFillStyle(WET_TINT).setAlpha(QUALITY_ALPHA[startQuality])
    }

    sprite.on('pointerover', () => {
      if (!state.inPack) sprite.setStrokeStyle(2, 0xffd966)
    })
    sprite.on('pointerout', () => sprite.setStrokeStyle(0))
    sprite.on('pointerup', () => this._onMaterialClick(instanceId))

    this._onScreen[instanceId] = state
  }

  // ── 100 ms game-state tick ───────────────────────────────────────────────────

  _gameTick() {
    if (this._forestSimPauseDepth > 0) return

    const DT = 100 // ms per tick

    this._ringGraphics.clear()

    for (const state of Object.values(this._onScreen)) {
      // Skip packed, off-screen, or materials with no wet timer.
      if (state.inPack || !state.onScreen || !state.wetDuration) continue
      if (state.currentQuality === 'BAD') continue

      state.wetElapsed = Math.min(state.wetElapsed + DT, state.wetDuration)
      const pct = state.wetElapsed / state.wetDuration

      // Draw arc (clockwise from 12 o'clock).
      const { x, y } = state.spawnPos
      this._ringGraphics.lineStyle(2, 0xffffff, 0.65)
      this._ringGraphics.beginPath()
      this._ringGraphics.arc(
        x, y,
        RING_RADIUS,
        -Math.PI / 2,
        -Math.PI / 2 + pct * Math.PI * 2,
        false
      )
      this._ringGraphics.strokePath()

      // Start colour tween at the 50% mark.
      if (pct >= 0.5 && !state.wetTweenStarted) {
        state.wetTweenStarted = true
        this._startWetTween(state)
      }

      // Degrade quality at 100%.
      if (pct >= 1) {
        this._degradeQuality(state)
      }
    }
  }

  // ── Wet colour tween (runs at render frame rate via Phaser tween) ─────────────

  _startWetTween(state) {
    // The tween spans only the remaining time after the 50% threshold.
    const remainingMs = Math.max(state.wetDuration - state.wetElapsed, 100)
    const fromColor   = state.dryColor

    state.wetTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: remainingMs,
      ease: 'Linear',
      onUpdate: (tween) => {
        if (state.inPack) return
        const colour = lerpColor(fromColor, WET_TINT, tween.getValue())
        state.sprite.setFillStyle(colour)
      },
    })
  }

  // ── Quality degradation ───────────────────────────────────────────────────────

  _degradeQuality(state) {
    const next = { GOOD: 'MID', MID: 'BAD', BAD: 'BAD' }[state.currentQuality]
    if (next === state.currentQuality) return

    state.currentQuality  = next
    state.wetElapsed      = 0
    state.wetTweenStarted = false

    if (state.wetTween) {
      state.wetTween.stop()
      state.wetTween = null
    }

    const colour    = QUALITY_COLOR[next]
    state.dryColor  = colour
    state.sprite.setAlpha(QUALITY_ALPHA[next])

    if (next === 'BAD') {
      // BAD materials get the wet colour immediately; no further timer.
      state.wetDuration = null
      state.sprite.setFillStyle(WET_TINT)
    } else {
      state.sprite.setFillStyle(colour)
    }

    this._syncMaterialDisplayLabel(state)
  }

  _syncMaterialDisplayLabel(state) {
    const txt = displayLabelForQuality(state.matDef, state.currentQuality)
    state.label.setText(txt)
    if (state.inPack) this._rebuildPackListRows()
  }

  // ── Click handling ────────────────────────────────────────────────────────────

  _onMaterialClick(instanceId) {
    if (this._collectInputLocked) return
    const state = this._onScreen[instanceId]
    if (!state || state.inPack) return

    // §4.2 拾取交互：点击即收入背包（无 Aiden 检视独白）
    this._addToPack(instanceId)
  }

  // ── Pack management ──────────────────────────────────────────────────────────

  _addToPack(instanceId) {
    const state = this._onScreen[instanceId]
    state.inPack = true

    // Pause colour tween while sheltered in the pack.
    if (state.wetTween) state.wetTween.pause()

    // Hide sprite and label at ground position.
    state.sprite.setVisible(false)
    state.label.setVisible(false)

    this._packedOrder.push(instanceId)
    const cat = collectCategoryForMatId(state.matDef.id)
    this._categoryCounts[cat]++
    this._refreshCategoryDisplay()
    this._rebuildPackListRows()

    let tutorialLines = null
    if (cat === 'unusable' && state.currentQuality === 'BAD' && !this._renBadPickupTutorialShown) {
      this._renBadPickupTutorialShown = true
      tutorialLines = [
        'Feel that? Heavy. Damp inside.',
        'Wet material will smother a flame, not feed it.',
        'Leave it.',
      ]
    } else if (cat === 'tinder' && !this._tutorialTinderShown) {
      this._tutorialTinderShown = true
      tutorialLines = [
        'That is good tinder. See how it crumbles?',
        'Dry enough to catch a spark.',
      ]
    } else if (cat === 'kindling' && !this._tutorialKindlingShown) {
      this._tutorialKindlingShown = true
      tutorialLines = [
        'Thin and dry, snaps clean.',
        'Good kindling — it will catch from the tinder and keep the flame growing.',
      ]
    } else if (cat === 'fuel' && !this._tutorialFuelShown) {
      this._tutorialFuelShown = true
      tutorialLines = [
        'Solid piece. That is fuel wood.',
        'Once the fire is going, that is what keeps it alive through the night.',
      ]
    }

    this._refreshHeadBackButton()

    this._lifetimeCollectCount++

    const maybeShowTargetsMet = () => {
      if (this._targetsMetDialogueShown) return
      if (this._sessionForestQuotaTotal() <= 0) return
      const { tinder, kindling, fuel } = this._categoryCounts
      const tgt = this._sessionTargets
      if (tinder >= tgt.tinder && kindling >= tgt.kindling && fuel >= tgt.fuel) {
        this._targetsMetDialogueShown = true
        this._headBackGoodFeedbackShown = true
        const quotaLines = this._isResumeCampsiteSession
          ? [
              {
                speaker: 'Aiden',
                text: 'These should be enough. Better head back before this gets heavier.',
              },
            ]
          : [{ speaker: 'Aiden', text: 'These should be enough.' }]
        this._showDialogueSequence(quotaLines, null)
      }
    }

    const afterPickup = () => {
      maybeShowTargetsMet()
      this._maybeCollectImbalanceRen()
    }

    const finishPickupFeedback = () => {
      this._flashCollectToastForPickupCategory(cat)
      afterPickup()
    }

    if (tutorialLines?.length) {
      this._showRenDialogueSequence(tutorialLines, finishPickupFeedback)
    } else {
      finishPickupFeedback()
    }

    // Stamina: 12th, 15th, 18th… collect → one penalty each (tiers = floor((n-9)/3) for n≥12).
    const owedStaminaTiers = Math.max(0, Math.floor((this._lifetimeCollectCount - 9) / 3))
    if (this._staminaPenaltyTiersApplied < owedStaminaTiers) {
      this._staminaPenaltyTiersApplied++
      this._applyStaminaOverburdenPenalty()
    }
  }

  _ejectFromPackByInstance(instanceId) {
    const idx = this._packedOrder.indexOf(instanceId)
    if (idx === -1) return

    const state = this._onScreen[instanceId]
    if (!state) return

    this._packedOrder.splice(idx, 1)
    const cat = collectCategoryForMatId(state.matDef.id)
    this._categoryCounts[cat] = Math.max(0, this._categoryCounts[cat] - 1)

    state.inPack = false

    // Resume colour tween (picks up where it paused).
    if (state.wetTween) state.wetTween.resume()

    // Restore sprite at original spawn position with current wet appearance.
    const { x, y } = state.spawnPos
    state.sprite.setPosition(x, y).setVisible(true)
    state.label.setPosition(x, y + 52).setVisible(true)

    this._refreshCategoryDisplay()
    this._rebuildPackListRows()
    this._refreshHeadBackButton()
  }

  _refreshHeadBackButton() {
    this._headBackBtn.setVisible(true)
    this._headBackBtnText.setVisible(true)
  }

  _stopCollectTimers() {
    if (this._spawnTimer) {
      this._spawnTimer.remove()
      this._spawnTimer = null
    }
    if (this._tickTimer) {
      this._tickTimer.remove()
      this._tickTimer = null
    }
    if (this._dialogueTimer) {
      this._dialogueTimer.remove()
      this._dialogueTimer = null
    }
  }

  _applyStaminaOverburdenPenalty() {
    // Day 3+ overburden: spec has no Ren line here; stamina only.
    this.time.delayedCall(450, () => {
      const stamina = this.registry.get('stamina')
      const alive = stamina?.deduct(1) ?? true
      if (!alive) {
        this._stopCollectTimers()
        this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
          id: 'fire_collect',
          success: false,
          staminaDepleted: true,
        })
        this.scene.stop()
      }
    })
  }

  // ── Dialogue (Ren tutorials + protagonist beats — collect §4.2) ─────────────────

  _pauseForestSimulationForDialogue() {
    if (this._forestSimPauseDepth === 0) {
      if (this._spawnTimer) this._spawnTimer.paused = true
      if (this._tickTimer) this._tickTimer.paused = true
      for (const state of Object.values(this._onScreen)) {
        if (state.inPack || !state.onScreen || !state.wetTween) continue
        state.wetTween.pause()
        state._wetTweenHeldForDialogue = true
      }
    }
    this._forestSimPauseDepth++
  }

  _resumeForestSimulationAfterDialogue() {
    this._forestSimPauseDepth = Math.max(0, this._forestSimPauseDepth - 1)
    if (this._forestSimPauseDepth > 0) return
    if (this._spawnTimer) this._spawnTimer.paused = false
    if (this._tickTimer) this._tickTimer.paused = false
    for (const state of Object.values(this._onScreen)) {
      if (!state._wetTweenHeldForDialogue || !state.wetTween) continue
      if (!state.inPack && state.onScreen) state.wetTween.resume()
      state._wetTweenHeldForDialogue = false
    }
  }

  /**
   * Click-through dialogue; locks pickup until finished.
   * @param {{ speaker: string, text: string }[]} entries
   */
  _showDialogueSequence(entries, onComplete = null) {
    if (!entries?.length) {
      onComplete?.()
      return
    }
    this._collectInputLocked = true
    this._pauseForestSimulationForDialogue()
    this._dialogue.showSequence(entries, () => {
      this._dialogue.hide()
      this._collectInputLocked = false
      this._resumeForestSimulationAfterDialogue()
      onComplete?.()
    })
  }

  /**
   * Click-through Ren lines; locks material pickup until finished.
   * Pauses spawning + wet progression while the box is up.
   * @param {string[]} lines
   * @param {() => void} [onComplete]
   */
  _showRenDialogueSequence(lines, onComplete = null) {
    if (!lines?.length) {
      onComplete?.()
      return
    }
    this._showDialogueSequence(lines.map((text) => ({ speaker: 'Ren', text })), onComplete)
  }

  /**
   * Deferred handoff avoids pointer/update edge cases when transitioning from Collect.
   * @param {boolean} resumeStackAfterCollect
   */
  _deferSwitchToFireBuildingMinigame(resumeStackAfterCollect) {
    let startStep = 'stack'
    if (resumeStackAfterCollect) {
      const snap =
        this.registry.get('fireCampsiteStackResume') ?? this._resumeSnapBackupCopy ?? {}
      startStep = snap.resumeCampsiteStep === 'ignite' ? 'ignite' : 'stack'
    }
    this.time.delayedCall(0, () => {
      this.scene.stop('FireBuildingCollect')
      this.scene.start('FireBuildingMinigame', {
        day: this.day,
        startStep,
        resumeStackAfterCollect,
      })
    })
  }

  /** Dev chains — full payload for FireBuildingMinigame `init`. */
  _deferSwitchToFireBuildingMinigameRaw(payload) {
    this.time.delayedCall(0, () => {
      this.scene.stop('FireBuildingCollect')
      this.scene.start('FireBuildingMinigame', payload)
    })
  }

  // ── Completion ───────────────────────────────────────────────────────────────

  _onHeadBack() {
    // Capture current quality at collection time (may have degraded from rain).
    const items = this._packedOrder.map((instanceId) => ({
      id:      this._onScreen[instanceId].matDef.id,
      quality: this._onScreen[instanceId].currentQuality,
    }))

    const count = buildCollectCounts(items)
    const tgt = this._sessionTargets
    const quotaAny = this._sessionForestQuotaTotal() > 0
    const meetsTargets =
      quotaAny &&
      count.tinder >= tgt.tinder &&
      count.kindling >= tgt.kindling &&
      count.fuel >= tgt.fuel

    const difficulty = computeDifficulty(items)

    const proceedToCampsite = () => {
      const inkBridge = this.registry.get('inkBridge')
      inkBridge?.setVariable?.('mg_fire_collect_score', difficulty)

      // Write internal game state to registry for downstream scenes.
      // Note: ignitionDifficulty is NOT written to registry — it flows
      // through the Ink story via MINIGAME_COMPLETE score → InkBridge.
      this.registry.set('collectedMaterials', { items, count })
      this.registry.set('fuelStock', 5)
      console.log('collected:', this.registry.get('collectedMaterials'))

      const resumeSnapRaw =
        this.registry.get('fireCampsiteStackResume') ?? this._resumeSnapBackupCopy
      const resumeSnapPresent = !!resumeSnapRaw

      if (!this.registry.get('fireCampsiteStackResume') && resumeSnapRaw) {
        this.registry.set('fireCampsiteStackResume', resumeSnapRaw)
      }

      if (resumeSnapPresent) {
        this._deferSwitchToFireBuildingMinigame(true)
        return
      }

      if (this._isResumeCampsiteSession) {
        if (import.meta.env.DEV) {
          console.warn(
            '[FireBuildingCollect] resume_campsite session had no snapshot — returning without stack restore',
          )
        }
        this._deferSwitchToFireBuildingMinigame(false)
        return
      }

      this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
        id: 'fire_collect',
        success: true,
        score: difficulty,  // InkBridge writes this to mg_fire_collect_score in Ink
      })

      if (this.registry.get('devQuickFireChain')) {
        this._deferSwitchToFireBuildingMinigameRaw({ day: this.day, startStep: 'ignite' })
        return
      }

      if (this.registry.get('devFireBuildChain')) {
        this._deferSwitchToFireBuildingMinigameRaw({ day: this.day, startStep: 'sort' })
        return
      }

      this.time.delayedCall(0, () => this.scene.stop('FireBuildingCollect'))
    }

    // §259–265 — good load heading back (skip if quota dialogue already praised).
    if (meetsTargets && count.unusable <= 1 && !this._headBackGoodFeedbackShown) {
      this._headBackGoodFeedbackShown = true
      this._showDialogueSequence(
        [
          {
            speaker: 'Aiden',
            text: 'Solid haul — spark stuff, sticks to grow it, wood that will last. Back we go.',
          },
        ],
        proceedToCampsite,
      )
      return
    }

    proceedToCampsite()
  }
}
