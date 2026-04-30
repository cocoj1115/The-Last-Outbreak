import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const WET_TINT = 0x3a4a34  // dark damp green-grey: target colour for fully wet materials
const RING_RADIUS = 46      // px radius of the wet-timer arc around each material

const QUALITY_COLOR = {
  GOOD: 0x8a7050,   // warm dry brown
  MID:  0x5a4a30,   // muted, slightly darker
  BAD:  0x2a1e10,   // dark heavy
}

const QUALITY_ALPHA = { GOOD: 1, MID: 1, BAD: 0.85 }

// Bottom-left pack HUD (matches FireCampsite sort unpack anchor).
const PACK_HUD_X         = 52
const PACK_HUD_Y_FROM_BT = 48

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

export class FireCollectMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireCollectMinigame' })
  }

  init(data) {
    this.day        = data?.day ?? 2
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
    // Every successful collect (into pack); not decremented on eject. Drives 8-warning + stamina tiers.
    this._lifetimeCollectCount = 0
    this._warnedEight = false
    this._staminaPenaltyTiersApplied = 0

    // Pack list row texts (rebuilt on add/eject)
    this._packListRows = []

    // Tracks which materials have had their first-click monologue played.
    this._inspected = new Set()

    // Tracks which BAD materials have already shown the bad-collect feedback.
    this._badFeedbackShown = new Set()

    this._tutorialTinderShown   = false
    this._tutorialKindlingShown = false
    this._tutorialFuelShown = false

    this._dialogueTimer = null
    this._tickTimer     = null
    this._spawnTimer    = null
    this._ringGraphics  = null

    this._packHudIcon   = null
    this._packHudBadge  = null
    this._packHudStroke = null
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

    this._pool = Phaser.Utils.Array.Shuffle(buildMaterialPoolDeck())

    this._buildBackground(W, H)
    this._buildBackpackPanel(W, H)
    this._buildPackCornerHud(W, H)
    this._buildDialogueBox(W, H)
    this._buildHeadBackButton(W, H)

    // Shared Graphics layer for all wet-timer rings (drawn above materials).
    this._ringGraphics = this.add.graphics().setDepth(10)

    // Spawn first material immediately, then every 1.5s.
    this._trySpawn()
    this._spawnTimer = this.time.addEvent({
      delay: 1500,
      callback: this._trySpawn,
      callbackScope: this,
      loop: true,
    })

    // 100 ms game-state tick: advance wet timers, update rings, trigger degradation.
    this._tickTimer = this.time.addEvent({
      delay: 100,
      callback: this._gameTick,
      callbackScope: this,
      loop: true,
    })
  }

  // ── Background ──────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    // Placeholder until BG-FOREST-RAIN art is ready.
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1208)

    this.add.text(W / 2, 30, 'Collect materials for the fire.', {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      fill: '#f0e6c8',
      stroke: '#1a0f00',
      strokeThickness: 4,
    }).setOrigin(0.5)

    // Rain overlay (placeholder semi-transparent layer)
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a1820, 0.18)
  }

  // ── Backpack panel ──────────────────────────────────────────────────────────

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
      lineSpacing: 4,
    }).setOrigin(0, 0).setDepth(uiDepth)

    this._packListTitle = this.add.text(W * 0.38, H * 0.74 - 22, 'Collected — click to drop:', {
      fontSize: '13px',
      fontFamily: 'Georgia, serif',
      fill: '#a08040',
    }).setOrigin(0, 0).setDepth(uiDepth)

    this._packListBaseY = H * 0.74
    this._refreshCategoryDisplay()
    this._rebuildPackListRows()
  }

  /** Fixed bottom-left backpack + total item count (visible for whole collect). */
  _buildPackCornerHud(W, H) {
    const depth = 16
    const y     = H - PACK_HUD_Y_FROM_BT

    this._packHudStroke = this.add
      .rectangle(PACK_HUD_X, y, 58, 52, 0x1a1208, 0.92)
      .setStrokeStyle(2, 0x7a9050)
      .setDepth(depth)

    this._packHudIcon = this.add
      .text(PACK_HUD_X - 2, y - 2, '🎒', { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(depth + 1)

    this._packHudBadge = this.add
      .text(PACK_HUD_X + 22, y - 20, '0', {
        fontSize: '14px',
        fontFamily: 'Georgia, serif',
        fill: '#f5e8c0',
        stroke: '#1a0f00',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(depth + 2)

    this._refreshPackHudCount()
  }

  _refreshPackHudCount() {
    if (this._packHudBadge) {
      this._packHudBadge.setText(String(this._packedOrder.length))
    }
  }

  _refreshCategoryDisplay() {
    const c = this._categoryCounts
    this._counterBlockText.setText(
      `Tinder:   ${c.tinder}\nKindling: ${c.kindling}\nFuel:      ${c.fuel}\nUnusable: ${c.unusable}`
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

  _buildDialogueBox(W, H) {
    const boxY = H * 0.68

    this._monoBg = this.add
      .rectangle(W / 2, boxY, W * 0.8, 52, 0x0d0a04, 0.88)
      .setStrokeStyle(1, 0x6b5020)
      .setVisible(false)

    this._monoText = this.add.text(W / 2, boxY, '', {
      fontSize: '15px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
      fill: '#f5e8c0',
      wordWrap: { width: W * 0.76 },
      align: 'center',
    }).setOrigin(0.5).setVisible(false)
  }

  // ── Head Back button ─────────────────────────────────────────────────────────

  _buildHeadBackButton(W, H) {
    this._headBackBtn = this.add
      .rectangle(W - 110, H - 38, 180, 44, 0x2a3018)
      .setStrokeStyle(2, 0x7a9050)
      .setInteractive({ useHandCursor: true })
      .setVisible(true)
      .setDepth(15)

    this._headBackBtnText = this.add.text(W - 110, H - 38, 'Head Back →', {
      fontSize: '16px',
      fontFamily: 'Georgia, serif',
      fill: '#c8e0a0',
    }).setOrigin(0.5).setVisible(true).setDepth(15)

    this._headBackBtn.on('pointerover', () => this._headBackBtn.setFillStyle(0x3a4028))
    this._headBackBtn.on('pointerout',  () => this._headBackBtn.setFillStyle(0x2a3018))
    this._headBackBtn.on('pointerup',   () => this._onHeadBack())
  }

  // ── Spawn system ─────────────────────────────────────────────────────────────

  _trySpawn() {
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
    const state = this._onScreen[instanceId]
    if (!state || state.inPack) return

    if (!this._inspected.has(instanceId)) {
      // First click: Aiden's tactile observation.
      this._inspected.add(instanceId)
      this._showMonologue(`"${state.matDef.line}"`)
      return
    }

    // Second click: add to pack (unlimited).
    this._addToPack(instanceId)

    // Day 2 immediate feedback for BAD quality — plays once per spawned item.
    if (state.currentQuality === 'BAD' && !this._badFeedbackShown.has(instanceId)) {
      this._badFeedbackShown.add(instanceId)
      this._showMonologue(
        '"That\'s already too wet — it won\'t catch. You can swap it out before heading back."'
      )
    }
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
    this._refreshPackHudCount()

    if (cat === 'tinder' && !this._tutorialTinderShown) {
      this._tutorialTinderShown = true
      this._showMonologue(
        '"Light and dry — I should grab a few more. This is what actually catches the spark."',
      )
    } else if (cat === 'kindling' && !this._tutorialKindlingShown) {
      this._tutorialKindlingShown = true
      this._showMonologue(
        '"Good kindling. I\'ll want two or three pieces — it bridges the spark into a real flame."',
      )
    } else if (cat === 'fuel' && !this._tutorialFuelShown) {
      this._tutorialFuelShown = true
      this._showMonologue(
        '"This keeps it going — a couple of pieces like this should be enough to sustain it."',
      )
    }

    this._refreshHeadBackButton()

    this._lifetimeCollectCount++
    if (this._lifetimeCollectCount === 8 && !this._warnedEight) {
      this._warnedEight = true
      this._showMonologue('"That should be enough. I should head back."')
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
    this._refreshPackHudCount()
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
    this._showMonologue('"I\'m carrying too much. This is slowing me down."')
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

  // ── Dialogue ─────────────────────────────────────────────────────────────────

  _showMonologue(text) {
    this._monoText.setText(text)
    this._monoBg.setVisible(true)
    this._monoText.setVisible(true)

    if (this._dialogueTimer) this._dialogueTimer.remove()
    this._dialogueTimer = this.time.delayedCall(3000, () => {
      this._monoText.setVisible(false)
      this._monoBg.setVisible(false)
      this._dialogueTimer = null
    })
  }

  // ── Completion ───────────────────────────────────────────────────────────────

  _onHeadBack() {
    // Capture current quality at collection time (may have degraded from rain).
    const items = this._packedOrder.map((instanceId) => ({
      id:      this._onScreen[instanceId].matDef.id,
      quality: this._onScreen[instanceId].currentQuality,
    }))

    const difficulty = computeDifficulty(items)

    const inkBridge = this.registry.get('inkBridge')
    inkBridge?.setVariable?.('mg_fire_collect_score', difficulty)

    // Write internal game state to registry for downstream scenes.
    // Note: ignitionDifficulty is NOT written to registry — it flows
    // through the Ink story via MINIGAME_COMPLETE score → InkBridge.
    const count = buildCollectCounts(items)
    this.registry.set('collectedMaterials', { items, count })
    this.registry.set('fuelStock', 5)
    console.log('collected:', this.registry.get('collectedMaterials'))

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_collect',
      success: true,
      score: difficulty,  // InkBridge writes this to mg_fire_collect_score in Ink
    })

    if (this.registry.get('fireCampsiteStackResume')) {
      this.scene.stop('FireCollectMinigame')
      this.scene.start('FireCampsiteMinigame', {
        day: this.day,
        startStep: 'stack',
        resumeStackAfterCollect: true,
      })
      return
    }

    if (this.registry.get('devQuickFireChain')) {
      this.scene.stop('FireCollectMinigame')
      this.scene.start('FireCampsiteMinigame', { day: this.day, startStep: 'ignite' })
      return
    }

    if (this.registry.get('devFireBuildChain')) {
      this.scene.stop('FireCollectMinigame')
      this.scene.start('FireCampsiteMinigame', { day: this.day, startStep: 'sort' })
      return
    }

    this.scene.stop()
  }
}
