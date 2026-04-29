import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

// ─── Difficulty configuration ─────────────────────────────────────────────────

// Rain interference only applies when difficulty = HARD AND campsite = poor.
const DIFFICULTY_CONFIG = {
  EASY:   { target: 10, decayMs: 800,  rainInterference: false },
  MEDIUM: { target: 15, decayMs: 600,  rainInterference: false },
  HARD:   { target: 20, decayMs: 500,  rainInterference: true  },
}

const MAX_CLICKS     = 30    // total clicks allowed before fail
const IDLE_THRESHOLD = 2000  // ms of no input before idle warning fires

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FireIgniteMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireIgniteMinigame' })
  }

  init(data) {
    this.day = data?.day ?? 2

    this._sparks      = 0
    this._totalClicks = 0
    this._retryUsed   = false
    this._fuelStock   = 5

    this._decayTimer           = null
    this._rainTimer            = null
    this._idleCheckTimer       = null
    this._dialogueTimer        = null
    this._lastClickTime        = 0
    this._midClickWarningShown = false

    this._difficulty = null
    this._target     = 0
    this._useRain    = false
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // ── Read inputs ─────────────────────────────────────────────────────────
    // Difficulty comes from the Ink story variable written by InkBridge
    // after FireCollectMinigame completes (mg_fire_collect_score).
    // campsite_quality is set by Dev A's Ink story after campsite selection.
    const inkBridge = this.registry.get('inkBridge')
    const rawDiff   = inkBridge?.getVariable('mg_fire_collect_score') ?? 'EASY'
    const quality   = inkBridge?.getVariable('campsite_quality') ?? 'good'

    this._difficulty = DIFFICULTY_CONFIG[rawDiff] ?? DIFFICULTY_CONFIG.EASY
    this._target     = this._difficulty.target
    this._useRain    = this._difficulty.rainInterference && quality === 'poor'
    this._fuelStock  = this.registry.get('fuelStock') ?? 5

    // ── UI ──────────────────────────────────────────────────────────────────
    this._buildBackground(W, H)
    this._buildFirePit(W, H)
    this._buildFlintButton(W, H)
    this._buildSparkCounter(W, H)
    this._buildDialogueBox(W, H)

    // ── Timers ──────────────────────────────────────────────────────────────
    this._startDecayTimer()
    if (this._useRain) this._startRainTimer()

    this._idleCheckTimer = this.time.addEvent({
      delay: 500,
      callback: this._checkIdle,
      callbackScope: this,
      loop: true,
    })

    this._lastClickTime = this.time.now
  }

  // ── Background ───────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0d08)

    this.add.text(W / 2, 28, 'Strike the flint — reach the spark target.', {
      fontSize: '18px',
      fontFamily: 'Georgia, serif',
      fill: '#d0c098',
      stroke: '#1a0f00',
      strokeThickness: 3,
    }).setOrigin(0.5)
  }

  // ── Fire pit visual ───────────────────────────────────────────────────────────

  _buildFirePit(W, H) {
    const pitX = W / 2 - 80
    const pitY = H * 0.44

    this.add.circle(pitX, pitY, 65, 0x1a1208).setStrokeStyle(3, 0x5a4a28)

    // Tinder layer — flashes dark during rain interference (HARD + poor).
    this._tinderSprite = this.add
      .text(pitX, pitY, '🌿', { fontSize: '36px' })
      .setOrigin(0.5)
      .setAlpha(0.7)
  }

  // ── Flint button ──────────────────────────────────────────────────────────────

  _buildFlintButton(W, H) {
    const btnX = W / 2 + 100
    const btnY = H * 0.44

    this._flintBg = this.add
      .rectangle(btnX, btnY, 110, 110, 0x3a2a18)
      .setStrokeStyle(3, 0xa08040)
      .setInteractive({ useHandCursor: true })

    this.add.text(btnX, btnY - 10, '🪨', { fontSize: '42px' }).setOrigin(0.5)

    this.add.text(btnX, btnY + 36, 'STRIKE', {
      fontSize: '12px',
      fontFamily: 'monospace',
      fill: '#a08040',
    }).setOrigin(0.5)

    this._flintBg.on('pointerover', () => this._flintBg.setFillStyle(0x4a3a28))
    this._flintBg.on('pointerout',  () => this._flintBg.setFillStyle(0x3a2a18))
    this._flintBg.on('pointerup',   () => this._onFlintClick())
  }

  // ── Spark counter ─────────────────────────────────────────────────────────────

  _buildSparkCounter(W, H) {
    this.add.text(W / 2, H * 0.22, 'Sparks', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fill: '#887050',
    }).setOrigin(0.5)

    this._counterText = this.add.text(W / 2, H * 0.30, this._counterLabel(), {
      fontSize: '38px',
      fontFamily: 'monospace',
      fill: '#ffcc44',
      stroke: '#331a00',
      strokeThickness: 5,
    }).setOrigin(0.5)

    this._clicksText = this.add.text(W / 2, H * 0.38, `Clicks: 0 / ${MAX_CLICKS}`, {
      fontSize: '13px',
      fontFamily: 'monospace',
      fill: '#665038',
    }).setOrigin(0.5)
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

  _startDecayTimer() {
    this._decayTimer = this.time.addEvent({
      delay: this._difficulty.decayMs,
      callback: this._decaySpark,
      callbackScope: this,
      loop: true,
    })
  }

  _startRainTimer() {
    this._rainTimer = this.time.addEvent({
      delay: 4000,
      callback: this._applyRainInterference,
      callbackScope: this,
      loop: true,
    })
  }

  // ── Spark mechanics ───────────────────────────────────────────────────────────

  _onFlintClick() {
    this._lastClickTime = this.time.now
    this._totalClicks++

    const gained = Phaser.Math.Between(1, 3)
    this._sparks += gained

    this._refreshUI()

    // Mid-click feedback: 15 clicks and sparks still below half the target.
    if (
      this._totalClicks >= 15 &&
      this._sparks < this._target * 0.5 &&
      !this._midClickWarningShown
    ) {
      this._midClickWarningShown = true
      this._showDialogue(
        '"The material is slowing this down. Wet tinder needs more sparks to catch."'
      )
    }

    // Check win.
    if (this._sparks >= this._target) {
      this._onSuccess()
      return
    }

    // Check fail (exhausted all clicks).
    if (this._totalClicks >= MAX_CLICKS) {
      this._onFail()
    }
  }

  _decaySpark() {
    if (this._sparks > 0) {
      this._sparks = Math.max(0, this._sparks - 1)
      this._refreshUI()
    }
  }

  _applyRainInterference() {
    this._sparks = Math.max(0, this._sparks - 3)
    this._refreshUI()

    // Tinder sprite flashes dark for 0.6 s to show a raindrop hit.
    this.tweens.add({
      targets:  this._tinderSprite,
      alpha:    0.15,
      duration: 300,
      yoyo:     true,
      ease:     'Linear',
    })
  }

  _checkIdle() {
    const elapsed = this.time.now - this._lastClickTime
    if (elapsed >= IDLE_THRESHOLD) {
      this._showDialogue('"Keep going — sparks die fast in this rain."')
      // Reset so the warning only fires once per idle period.
      this._lastClickTime = this.time.now
    }
  }

  // ── Outcomes ──────────────────────────────────────────────────────────────────

  _onSuccess() {
    this._stopAllTimers()
    this._flintBg.disableInteractive()
    this._showDialogue('"There it is."')

    this.time.delayedCall(800, () => {
      this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
        id:      'fire_ignite',
        success: true,
        score:   0,
      })

      // GDD Step 4 → Step 5: sustain begins immediately after ignition succeeds.
      // Without starting the next scene, only DebugScene stays up → apparent black screen.
      this.scene.stop('FireIgniteMinigame')
      this.scene.start('FireSustainMinigame', { day: this.day })
    })
  }

  _onFail() {
    this._stopAllTimers()
    this._flintBg.disableInteractive()
    this._showDialogue('"The spark won\'t hold."')

    const stamina = this.registry.get('stamina')
    const alive   = stamina?.deduct(2) ?? true

    if (!alive) {
      // Stamina hit 0 — day fail.
      this.time.delayedCall(1000, () => this._emitDayFail())
      return
    }

    if (!this._retryUsed && this._fuelStock > 0) {
      // First fail, fuel available — allow one retry.
      this._retryUsed = true
      this._fuelStock--
      this.registry.set('fuelStock', this._fuelStock)
      this.time.delayedCall(1400, () => this._startRetry())
      return
    }

    // No retry possible — day fail (GDD: triggerDayFail when no fuel left).
    this.time.delayedCall(1000, () => this._emitDayFail())
  }

  _startRetry() {
    this._sparks               = 0
    this._totalClicks          = 0
    this._midClickWarningShown = false
    this._refreshUI()
    this._showDialogue('"Try again."')

    this._flintBg.setInteractive({ useHandCursor: true })
    this._lastClickTime = this.time.now

    this._startDecayTimer()
    if (this._useRain) this._startRainTimer()

    this._idleCheckTimer = this.time.addEvent({
      delay: 500,
      callback: this._checkIdle,
      callbackScope: this,
      loop: true,
    })
  }

  _emitDayFail() {
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id:              'fire_ignite',
      success:         false,
      staminaDepleted: true,
    })
    this.scene.stop()
  }

  // ── UI refresh ────────────────────────────────────────────────────────────────

  _refreshUI() {
    this._counterText.setText(this._counterLabel())
    this._clicksText.setText(`Clicks: ${this._totalClicks} / ${MAX_CLICKS}`)
  }

  _counterLabel() {
    return `${this._sparks} / ${this._target}`
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

  // ── Timer cleanup ─────────────────────────────────────────────────────────────

  _stopAllTimers() {
    if (this._decayTimer)     { this._decayTimer.remove();     this._decayTimer     = null }
    if (this._rainTimer)      { this._rainTimer.remove();      this._rainTimer      = null }
    if (this._idleCheckTimer) { this._idleCheckTimer.remove(); this._idleCheckTimer = null }
    if (this._dialogueTimer)  { this._dialogueTimer.remove();  this._dialogueTimer  = null }
  }
}
