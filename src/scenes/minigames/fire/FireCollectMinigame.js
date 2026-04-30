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

// ─── Material definitions ─────────────────────────────────────────────────────

// wetDuration: ms before quality degrades one level. null = already degraded on spawn.
// poorStartQuality: quality used instead of startQuality when campsite is poor.
const MATERIAL_DEFS = [
  {
    id: 'dry_leaves',
    label: 'Dry Leaves',
    line: 'Light. Crumbles when I press it.',
    startQuality: 'GOOD',
    poorStartQuality: 'MID',
    wetDuration: 4000,
  },
  {
    id: 'dry_twigs',
    label: 'Dry Twigs',
    line: 'Snaps cleanly.',
    startQuality: 'GOOD',
    poorStartQuality: 'GOOD',
    wetDuration: 6000,
  },
  {
    id: 'thick_branch',
    label: 'Thick Branch',
    line: 'Heavy. This will burn long.',
    startQuality: 'GOOD',
    poorStartQuality: 'GOOD',
    wetDuration: 8000,
  },
  {
    id: 'dry_grass',
    label: 'Dry Grass',
    line: 'This will catch fast.',
    startQuality: 'GOOD',
    poorStartQuality: 'MID',
    wetDuration: 3000,
  },
  {
    id: 'pine_cone',
    label: 'Pine Cone',
    line: 'Compact. Might work for fuel.',
    startQuality: 'MID',
    poorStartQuality: 'MID',
    wetDuration: 5000,
  },
  {
    id: 'damp_bark',
    label: 'Damp Bark',
    line: 'Already heavy. Getting wetter.',
    startQuality: 'MID',
    poorStartQuality: 'MID',
    wetDuration: null,  // already degraded — no timer
  },
  {
    id: 'wet_moss',
    label: 'Wet Moss',
    line: "Sticky. This won't catch.",
    startQuality: 'BAD',
    poorStartQuality: 'BAD',
    wetDuration: null,
  },
  {
    id: 'wet_log',
    label: 'Wet Log',
    line: 'Too waterlogged. Useless tonight.',
    startQuality: 'BAD',
    poorStartQuality: 'BAD',
    wetDuration: null,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDifficulty(collectedMaterials) {
  const bad = collectedMaterials.filter(m => m.quality === 'BAD').length
  const mid = collectedMaterials.filter(m => m.quality === 'MID').length
  if (bad >= 2) return 'HARD'
  if (bad === 1 || mid >= 2) return 'MEDIUM'
  return 'EASY'
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

    // Active material state, keyed by material id.
    // Each entry: { id, matDef, currentQuality, spawnPos, wetElapsed,
    //               wetDuration, dryColor, wetTween, wetTweenStarted,
    //               inPack, onScreen, sprite, label }
    this._onScreen  = {}

    // 4 backpack slots, each null or a material id.
    this._slots     = [null, null, null, null]

    // UI arrays populated in _buildBackpackPanel()
    this._slotBorders = []
    this._slotLabels  = []

    // Tracks which materials have had their first-click monologue played.
    this._inspected = new Set()

    // Tracks which BAD materials have already shown the bad-collect feedback.
    this._badFeedbackShown = new Set()

    this._dialogueTimer = null
    this._tickTimer     = null
    this._spawnTimer    = null
    this._ringGraphics  = null
  }

  preload() {
    // Art assets are loaded here when available:
    // this.load.image('bg_forest_rain', 'assets/BG-FOREST-RAIN.png')
    // MATERIAL_DEFS.forEach(d =>
    //   this.load.image(`mat_${d.id}`, `assets/MAT-${d.id.toUpperCase().replace(/_/g, '-')}.png`))
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // Read campsite quality from InkBridge (set by Dev A's Ink story).
    // Falls back to 'good' if InkBridge is not yet registered.
    const inkBridge = this.registry.get('inkBridge')
    this._isPoor = inkBridge?.getVariable('campsite_quality') === 'poor'

    // Shuffle pool — each run presents materials in a different order.
    this._pool = Phaser.Utils.Array.Shuffle([...MATERIAL_DEFS])

    this._buildBackground(W, H)
    this._buildBackpackPanel(W, H)
    this._buildDialogueBox(W, H)
    this._buildHeadBackButton(W, H)

    // Shared Graphics layer for all wet-timer rings (drawn above materials).
    this._ringGraphics = this.add.graphics().setDepth(10)

    // Spawn first material immediately, then one every 3 seconds.
    this._trySpawn()
    this._spawnTimer = this.time.addEvent({
      delay: 3000,
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
    const slotSize  = 72
    const gap       = 14
    const totalW    = 4 * slotSize + 3 * gap
    const startX    = W / 2 - totalW / 2 + slotSize / 2
    const slotY     = H * 0.82

    this.add.text(W / 2, slotY - 52, 'Pack — 4 slots', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fill: '#a08040',
    }).setOrigin(0.5)

    for (let i = 0; i < 4; i++) {
      const x = startX + i * (slotSize + gap)

      const border = this.add.rectangle(x, slotY, slotSize, slotSize, 0x1a120a)
        .setStrokeStyle(2, 0x8b6914)
        .setInteractive({ useHandCursor: true })

      border.on('pointerdown', () => this._ejectFromPack(i))

      const lbl = this.add.text(x, slotY, '', {
        fontSize: '11px',
        fontFamily: 'Georgia, serif',
        fill: '#e8d8a0',
        wordWrap: { width: slotSize - 8 },
        align: 'center',
      }).setOrigin(0.5)

      this._slotBorders.push(border)
      this._slotLabels.push(lbl)
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
      .setVisible(false)

    this._headBackBtnText = this.add.text(W - 110, H - 38, 'Head Back →', {
      fontSize: '16px',
      fontFamily: 'Georgia, serif',
      fill: '#c8e0a0',
    }).setOrigin(0.5).setVisible(false)

    this._headBackBtn.on('pointerover', () => this._headBackBtn.setFillStyle(0x3a4028))
    this._headBackBtn.on('pointerout',  () => this._headBackBtn.setFillStyle(0x2a3018))
    this._headBackBtn.on('pointerup',   () => this._onHeadBack())
  }

  // ── Spawn system ─────────────────────────────────────────────────────────────

  _trySpawn() {
    // Halt spawning once all 4 pack slots are full.
    if (this._slots.every(s => s !== null)) return

    // Count materials currently visible on screen (excludes packed items).
    const onScreenVisible = Object.values(this._onScreen).filter(
      s => s.onScreen && !s.inPack
    ).length
    if (onScreenVisible >= 4) return

    // Pool exhausted — all 8 materials have been spawned this session.
    if (this._pool.length === 0) return

    this._spawnMaterial(this._pool.shift())
  }

  _spawnMaterial(matDef) {
    const W = this.scale.width
    const H = this.scale.height

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

    const label = this.add.text(x, y + 52, matDef.label, {
      fontSize: '12px',
      fontFamily: 'Georgia, serif',
      fill: '#e8d8a0',
    }).setOrigin(0.5).setDepth(6)

    const state = {
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
    sprite.on('pointerup', () => this._onMaterialClick(matDef.id))

    this._onScreen[matDef.id] = state
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
  }

  // ── Click handling ────────────────────────────────────────────────────────────

  _onMaterialClick(id) {
    const state = this._onScreen[id]
    if (!state || state.inPack) return

    if (!this._inspected.has(id)) {
      // First click: Aiden's tactile observation.
      this._inspected.add(id)
      this._showMonologue(`"${state.matDef.line}"`)
      return
    }

    // Second click: attempt to add to pack.
    const emptySlot = this._slots.findIndex(s => s === null)
    if (emptySlot === -1) {
      this._showMonologue('"Pack is full."')
      return
    }

    this._addToPack(id, emptySlot)

    // Day 2 immediate feedback for BAD quality — plays once per material.
    if (state.currentQuality === 'BAD' && !this._badFeedbackShown.has(id)) {
      this._badFeedbackShown.add(id)
      this._showMonologue(
        '"That\'s already too wet — it won\'t catch. You can swap it out before heading back."'
      )
    }
  }

  // ── Pack management ──────────────────────────────────────────────────────────

  _addToPack(id, slotIndex) {
    const state = this._onScreen[id]
    state.inPack = true

    // Pause colour tween while sheltered in the pack.
    if (state.wetTween) state.wetTween.pause()

    // Hide sprite and label at ground position.
    state.sprite.setVisible(false)
    state.label.setVisible(false)

    // Update slot UI.
    this._slots[slotIndex] = id
    this._slotLabels[slotIndex].setText(state.matDef.label)
    this._slotBorders[slotIndex].setFillStyle(0x3a2e14)

    this._refreshHeadBackButton()

    // When all 4 slots full: fade remaining on-screen materials.
    if (this._slots.every(s => s !== null)) {
      this._fadeUnpackedMaterials()
    }
  }

  _ejectFromPack(slotIndex) {
    const id = this._slots[slotIndex]
    if (!id) return

    const state    = this._onScreen[id]
    state.inPack   = false

    // Resume colour tween (picks up where it paused).
    if (state.wetTween) state.wetTween.resume()

    // Restore sprite at original spawn position with current wet appearance.
    const { x, y } = state.spawnPos
    state.sprite.setPosition(x, y).setVisible(true)
    state.label.setPosition(x, y + 52).setVisible(true)

    // Clear slot UI.
    this._slots[slotIndex] = null
    this._slotLabels[slotIndex].setText('')
    this._slotBorders[slotIndex].setFillStyle(0x1a120a)

    this._refreshHeadBackButton()

    // Restore any materials that were faded when pack was full.
    this._restoreUnpackedMaterials()
  }

  _fadeUnpackedMaterials() {
    for (const state of Object.values(this._onScreen)) {
      if (!state.inPack && state.onScreen) {
        this.tweens.add({ targets: [state.sprite, state.label], alpha: 0.25, duration: 400 })
        state.sprite.disableInteractive()
      }
    }
  }

  _restoreUnpackedMaterials() {
    // Only called after ejecting — at least one slot is now empty.
    for (const state of Object.values(this._onScreen)) {
      if (!state.inPack && state.onScreen) {
        this.tweens.add({
          targets: [state.sprite, state.label],
          alpha: QUALITY_ALPHA[state.currentQuality],
          duration: 300,
        })
        state.sprite.setInteractive({ useHandCursor: true })
      }
    }
  }

  _refreshHeadBackButton() {
    const full = this._slots.every(s => s !== null)
    this._headBackBtn.setVisible(full)
    this._headBackBtnText.setVisible(full)
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
    const collectedMaterials = this._slots
      .filter(Boolean)
      .map(id => ({ id, quality: this._onScreen[id].currentQuality }))

    const difficulty = computeDifficulty(collectedMaterials)

    const inkBridge = this.registry.get('inkBridge')
    inkBridge?.setVariable?.('mg_fire_collect_score', difficulty)

    // Write internal game state to registry for downstream scenes.
    // Note: ignitionDifficulty is NOT written to registry — it flows
    // through the Ink story via MINIGAME_COMPLETE score → InkBridge.
    this.registry.set('collectedMaterials', collectedMaterials)
    this.registry.set('fuelStock', 5)

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_collect',
      success: true,
      score: difficulty,  // InkBridge writes this to mg_fire_collect_score in Ink
    })

    if (this.registry.get('devQuickFireChain')) {
      this.scene.stop('FireCollectMinigame')
      this.scene.start('FireIgniteMinigame', { day: this.day })
      return
    }

    this.scene.stop()
  }
}
