import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

// ─── Configuration ────────────────────────────────────────────────────────────

const NIGHT_DURATION  = 90000  // 90 seconds in ms
const SEGMENT_COUNT   = 5
const FUEL_RESTORE    = 2       // segments restored per Add Fuel

// Drain interval in ms per quality segment lost.
// Keyed as `${campsiteQuality}_${groundCleared ? 'cleared' : 'dirty'}`.
const DRAIN_MS = {
  good_cleared: 12000,
  good_dirty:   10000,
  poor_cleared:  9000,
  poor_dirty:    7500,
}

// Flood event intervals (poor campsite only).
const FLOOD_INTERVAL_CLEARED = 20000
const FLOOD_INTERVAL_DIRTY   = 15000
const FLOOD_BG_DURATION      = 1200  // ms the flood background is shown

// Colour palette for the five fire-strength segments.
const SEG_COLOR_LIT  = 0xe8a020  // amber when active
const SEG_COLOR_DIM  = 0x3a2e18  // dark when empty
const BG_STRONG      = 0x1a0e04  // warm dark when fire is strong
const BG_WEAK        = 0x06080a  // cold dark when fire is weak
const BG_FLOOD       = 0x080f18  // blue-grey during flood flash

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FireSustainMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireSustainMinigame' })
  }

  init(data) {
    this.day = data?.day ?? 2

    this._fireStrength      = 0   // set in create() after reading ceiling
    this._fuelStock         = 5
    this._nightElapsed      = 0   // ms
    this._groundCleared     = false
    this._campsiteQuality   = 'good'
    this._strengthCeiling   = SEGMENT_COUNT
    this._floodLocked       = false  // brief lock after flood event
    this._nightComplete     = false  // guard against double completion

    this._bgRect      = null
    this._segRects    = []
    this._fuelText    = null
    this._progressBar = null
    this._nightBar    = null
    this._addFuelBtn  = null
    this._dialogueBg  = null
    this._dialogueText = null

    this._drainTimer  = null
    this._nightTimer  = null
    this._floodTimer  = null
    this._dialogueTimer = null
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // ── Read inputs ─────────────────────────────────────────────────────────
    const inkBridge = this.registry.get('inkBridge')
    this._campsiteQuality = inkBridge?.getVariable('campsite_quality') ?? 'good'

    this._groundCleared = this.registry.get('groundCleared') ?? false
    this._fuelStock     = this.registry.get('fuelStock') ?? 5

    // Fire strength ceiling: 5 minus the number of BAD materials collected
    // (BAD materials couldn't be sorted, so fewer fuel layers were built).
    const collected = this.registry.get('collectedMaterials') ?? []
    const badCount  = collected.filter(m => m.quality === 'BAD').length
    this._strengthCeiling = Math.max(1, SEGMENT_COUNT - badCount)
    this._fireStrength    = this._strengthCeiling  // starts at ceiling

    // ── UI ──────────────────────────────────────────────────────────────────
    this._buildBackground(W, H)
    this._buildStrengthBar(W, H)
    this._buildFuelCounter(W, H)
    this._buildNightProgressBar(W, H)
    this._buildFirePit(W, H)
    this._buildAddFuelButton(W, H)
    this._buildDialogueBox(W, H)

    this._refreshStrengthBar()
    this._refreshBackground()

    // ── Timers ──────────────────────────────────────────────────────────────
    this._startDrainTimer()
    this._startNightTimer()
    if (this._campsiteQuality === 'poor') this._startFloodTimer()
  }

  // ── Background ───────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    this._bgRect = this.add.rectangle(W / 2, H / 2, W, H, BG_STRONG)

    this.add.text(W / 2, 28, 'Keep the fire alive through the night.', {
      fontSize: '18px',
      fontFamily: 'Georgia, serif',
      fill: '#d0c098',
      stroke: '#1a0f00',
      strokeThickness: 3,
    }).setOrigin(0.5)
  }

  // ── Fire strength bar (5 segments) ───────────────────────────────────────────

  _buildStrengthBar(W) {
    const segW   = 60
    const segH   = 22
    const gap    = 6
    const totalW = SEGMENT_COUNT * segW + (SEGMENT_COUNT - 1) * gap
    const startX = W / 2 - totalW / 2 + segW / 2
    const barY   = 64

    this.add.text(W / 2, barY - 18, 'Fire Strength', {
      fontSize: '12px',
      fontFamily: 'monospace',
      fill: '#887050',
    }).setOrigin(0.5)

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const x   = startX + i * (segW + gap)
      const seg = this.add.rectangle(x, barY, segW, segH, SEG_COLOR_LIT)
        .setStrokeStyle(1, 0x5a4020)
      this._segRects.push(seg)
    }
  }

  _refreshStrengthBar() {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const lit = i < this._fireStrength
      this._segRects[i].setFillStyle(lit ? SEG_COLOR_LIT : SEG_COLOR_DIM)
    }
  }

  // ── Fuel counter ──────────────────────────────────────────────────────────────

  _buildFuelCounter(W) {
    this.add.text(W - 120, 54, '🪵 Fuel:', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fill: '#a08050',
    }).setOrigin(0.5)

    this._fuelText = this.add.text(W - 64, 54, `${this._fuelStock}`, {
      fontSize: '22px',
      fontFamily: 'monospace',
      fill: '#e8c870',
    }).setOrigin(0.5)
  }

  _refreshFuelCounter() {
    this._fuelText.setText(`${this._fuelStock}`)
  }

  // ── Night progress bar ────────────────────────────────────────────────────────

  _buildNightProgressBar(W, H) {
    const barY = H - 28
    const barW = W * 0.82

    this.add.text(W / 2, barY - 14, 'Rain night progress', {
      fontSize: '11px',
      fontFamily: 'monospace',
      fill: '#556688',
    }).setOrigin(0.5)

    // Background track
    this.add.rectangle(W / 2, barY, barW, 16, 0x151c24)
      .setStrokeStyle(1, 0x334455)

    // Fill bar (starts at width 0)
    this._nightBar = this.add.rectangle(
      W / 2 - barW / 2,
      barY,
      0,
      14,
      0x4488cc
    ).setOrigin(0, 0.5)

    this._barMaxW = barW
  }

  _refreshNightBar() {
    const pct = Math.min(this._nightElapsed / NIGHT_DURATION, 1)
    this._nightBar.setSize(this._barMaxW * pct, 14)
  }

  // ── Fire pit visual ───────────────────────────────────────────────────────────

  _buildFirePit(W, H) {
    const pitX = W / 2
    const pitY = H * 0.50

    this.add.circle(pitX, pitY, 68, 0x1a1208).setStrokeStyle(3, 0x6a5028)

    // Placeholder fire icon — in production swap for FIREPIT-LIT-STRONG sprite
    this._fireIcon = this.add.text(pitX, pitY, '🔥', { fontSize: '52px' })
      .setOrigin(0.5)
  }

  // ── Add Fuel button ───────────────────────────────────────────────────────────

  _buildAddFuelButton(W, H) {
    const btnX = W / 2 + 160
    const btnY = H * 0.50

    this._addFuelBg = this.add
      .rectangle(btnX, btnY, 130, 52, 0x3a2810)
      .setStrokeStyle(2, 0x9a7030)
      .setInteractive({ useHandCursor: true })

    this._addFuelLabel = this.add.text(btnX, btnY, '+ Add Fuel', {
      fontSize: '16px',
      fontFamily: 'Georgia, serif',
      fill: '#e8c870',
    }).setOrigin(0.5)

    this._addFuelBg.on('pointerover', () => this._addFuelBg.setFillStyle(0x4a3820))
    this._addFuelBg.on('pointerout',  () => this._addFuelBg.setFillStyle(0x3a2810))
    this._addFuelBg.on('pointerup',   () => this._onAddFuel())
  }

  _setAddFuelEnabled(enabled) {
    if (enabled) {
      this._addFuelBg.setInteractive({ useHandCursor: true }).setFillStyle(0x3a2810)
      this._addFuelLabel.setAlpha(1)
    } else {
      this._addFuelBg.disableInteractive().setFillStyle(0x1a1408)
      this._addFuelLabel.setAlpha(0.35)
    }
  }

  // ── Dialogue box ──────────────────────────────────────────────────────────────

  _buildDialogueBox(W, H) {
    const boxY = H * 0.88

    this._dialogueBg = this.add
      .rectangle(W / 2, boxY, W * 0.78, 52, 0x0d0a04, 0.88)
      .setStrokeStyle(1, 0x6b5020)
      .setVisible(false)

    this._dialogueText = this.add.text(W / 2, boxY, '', {
      fontSize: '15px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
      fill: '#f5e8c0',
      wordWrap: { width: W * 0.74 },
      align: 'center',
    }).setOrigin(0.5).setVisible(false)
  }

  // ── Timers ────────────────────────────────────────────────────────────────────

  _startDrainTimer() {
    const key      = `${this._campsiteQuality}_${this._groundCleared ? 'cleared' : 'dirty'}`
    const delayMs  = DRAIN_MS[key] ?? DRAIN_MS.good_cleared

    this._drainTimer = this.time.addEvent({
      delay: delayMs,
      callback: this._drainStrength,
      callbackScope: this,
      loop: true,
    })
  }

  _startNightTimer() {
    // Tick every 500ms to update the progress bar smoothly.
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

  // ── Drain ─────────────────────────────────────────────────────────────────────

  _drainStrength() {
    if (this._nightComplete) return
    this._adjustStrength(-1)
  }

  _adjustStrength(delta) {
    this._fireStrength = Phaser.Math.Clamp(
      this._fireStrength + delta,
      0,
      this._strengthCeiling
    )
    this._refreshStrengthBar()
    this._refreshBackground()

    if (this._fireStrength === 0) {
      this._onFireOut()
    }
  }

  // ── Night tick ────────────────────────────────────────────────────────────────

  _tickNight() {
    if (this._nightComplete) return

    this._nightElapsed += 500
    this._refreshNightBar()

    if (this._nightElapsed >= NIGHT_DURATION) {
      this._onNightComplete()
    }
  }

  // ── Flood event (poor campsite) ───────────────────────────────────────────────

  _applyFloodEvent() {
    if (this._nightComplete) return

    this._floodLocked = true

    // Background flash to flood close-up for FLOOD_BG_DURATION.
    this._bgRect.setFillStyle(BG_FLOOD)
    this.time.delayedCall(FLOOD_BG_DURATION, () => {
      this._floodLocked = false
      this._refreshBackground()
    })

    // Forced strength drop — cannot be offset by adding fuel during the lockout.
    this._adjustStrength(-1)
  }

  // ── Add Fuel ──────────────────────────────────────────────────────────────────

  _onAddFuel() {
    if (this._floodLocked) return      // lockout during flood flash
    if (this._fuelStock <= 0) return

    // Full fire: consume fuel but no strength gain.
    if (this._fireStrength >= this._strengthCeiling) {
      this._fuelStock--
      this._refreshFuelCounter()
      this._setAddFuelEnabled(this._fuelStock > 0)
      this._showDialogue('"Not yet — I\'ll smother it."')
      return
    }

    // Low fire: restore 2 segments and say something if critical.
    const wasCritical = this._fireStrength <= 2
    this._fuelStock--
    this._adjustStrength(FUEL_RESTORE)
    this._refreshFuelCounter()
    this._setAddFuelEnabled(this._fuelStock > 0)

    if (wasCritical) {
      this._showDialogue('"Barely."')
    }
  }

  // ── Background colour ─────────────────────────────────────────────────────────

  _refreshBackground() {
    if (this._floodLocked) return  // flood flash takes priority
    this._bgRect.setFillStyle(this._fireStrength >= 3 ? BG_STRONG : BG_WEAK)

    // Update fire icon to reflect strength.
    this._fireIcon.setAlpha(this._fireStrength >= 3 ? 1.0 : 0.45)
  }

  // ── Fire out ──────────────────────────────────────────────────────────────────

  _onFireOut() {
    this._stopAllTimers()
    this._setAddFuelEnabled(false)
    this._showDialogue('"It went out."')

    const stamina = this.registry.get('stamina')

    if (this._fuelStock > 0) {
      // Fuel remains — pay 1 stamina and send back to re-ignite.
      const alive = stamina?.deduct(1) ?? true

      if (!alive) {
        this.time.delayedCall(1000, () => this._emitDayFail())
        return
      }

      // TODO (pending Dev A confirmation): emit { score: 'relight' } so the
      // Ink story routes back to # minigame:fire_ignite. If Dev A confirms a
      // different contract, update the score value here.
      this.time.delayedCall(1200, () => {
        this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
          id:      'fire_sustain',
          success: false,
          score:   'relight',
        })
        this.scene.stop()
      })
      return
    }

    // No fuel left — pay 2 stamina and trigger day fail.
    stamina?.deduct(2)
    this.time.delayedCall(1000, () => this._emitDayFail())
  }

  _emitDayFail() {
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id:              'fire_sustain',
      success:         false,
      staminaDepleted: true,
    })
    this.scene.stop()
  }

  // ── Night complete ────────────────────────────────────────────────────────────

  _onNightComplete() {
    if (this._nightComplete) return
    this._nightComplete = true

    this._stopAllTimers()

    const fireQuality = this._fireStrength >= 3 ? 'strong' : 'weak'

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id:      'fire_sustain',
      success: true,
      score:   fireQuality,
    })

    this.scene.stop()
  }

  // ── Dialogue ──────────────────────────────────────────────────────────────────

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

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  _stopAllTimers() {
    if (this._drainTimer)   { this._drainTimer.remove();   this._drainTimer   = null }
    if (this._nightTimer)   { this._nightTimer.remove();   this._nightTimer   = null }
    if (this._floodTimer)   { this._floodTimer.remove();   this._floodTimer   = null }
    if (this._dialogueTimer){ this._dialogueTimer.remove(); this._dialogueTimer = null }
  }
}
