import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

const TARGET_BY = { EASY: 10, MEDIUM: 15, HARD: 20 }
const DECAY_BY = { EASY: 800, MEDIUM: 600, HARD: 500 }

/**
 * Flint-strike ignition minigame (Day 2 / Day 3 narrative).
 * Expects registry: ignitionDifficulty ('EASY'|'MEDIUM'|'HARD'), campsiteQuality ('good'|'poor').
 * Optional: fuelStock (number), stamina (StaminaSystem).
 */
export class FireIgniteMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireIgniteMinigame' })
  }

  init(data) {
    this.day = data?.day ?? 2

    const diffRaw = this.registry.get('ignitionDifficulty') ?? 'EASY'
    this.difficulty = typeof diffRaw === 'string' ? diffRaw.toUpperCase() : 'EASY'
    if (!TARGET_BY[this.difficulty]) this.difficulty = 'EASY'

    const siteQ = this.registry.get('campsiteQuality')
    this.isPoor = siteQ === 'poor'

    this.target = TARGET_BY[this.difficulty]
    this.baseDecayMs = DECAY_BY[this.difficulty]

    this.sparks = 0
    this.totalClicks = 0
    this.maxClicks = this.day === 3 ? 35 : 30

    this.isShielding = false

    this._decayTimer = null
    this._rainTimer = null
    this._windTimer = null
    this._shieldEndTimer = null
    this._monoClearTimer = null
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0b08)

    this.add
      .text(W / 2, 48, 'Strike the flint.', {
        fontSize: '22px',
        fill: '#f0e6c8',
        fontFamily: 'Georgia, serif',
      })
      .setOrigin(0.5)

    this._counterText = this.add
      .text(W / 2, 100, `0 / ${this.target}`, {
        fontSize: '20px',
        fill: '#e8d8a0',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)

    const flintW = 120
    const flintH = 72
    this._flint = this.add
      .rectangle(W / 2, H * 0.42, flintW, flintH, 0x8b7355)
      .setInteractive({ useHandCursor: true })
    this._flint.on('pointerup', () => this._onFlintClick())

    if (this.day === 3) {
      const sw = 140
      const sh = 44
      this._shieldBtn = this.add
        .rectangle(W / 2, H * 0.58, sw, sh, 0x3a3a3a)
        .setInteractive({ useHandCursor: true })
      this._shieldLabel = this.add
        .text(W / 2, H * 0.58, 'Shield', {
          fontSize: '16px',
          fill: '#e0e0e0',
          fontFamily: 'Georgia, serif',
        })
        .setOrigin(0.5)
      this._shieldBtn.on('pointerup', () => this._onShieldClick())
    }

    const boxH = 88
    const boxY = H - boxH / 2 - 24
    this.add.rectangle(W / 2, boxY, W - 48, boxH, 0x1a1610, 0.9).setStrokeStyle(2, 0x4a3a20)
    this._monoText = this.add
      .text(W / 2, boxY, '', {
        fontSize: '16px',
        fill: '#d4c4a0',
        fontFamily: 'Georgia, serif',
        wordWrap: { width: W - 80 },
        align: 'center',
      })
      .setOrigin(0.5)

    if (this.day === 2 && this.isPoor && this.difficulty === 'HARD') {
      this._rainTimer = this.time.addEvent({
        delay: 4000,
        loop: true,
        callback: () => {
          this.sparks = Math.max(0, this.sparks - 3)
          this._updateCounter()
          this._showMonologue('Rain is getting in.')
        },
      })
    }

    if (this.day === 3 && this.isPoor) {
      this._windTimer = this.time.addEvent({
        delay: 3000,
        loop: true,
        callback: () => {
          this.sparks = Math.max(0, this.sparks - 4)
          this._updateCounter()
        },
      })
    }

    this._scheduleDecay()
  }

  _getDecayIntervalMs() {
    if (this.day === 3 && !this.isShielding) {
      return this.baseDecayMs * 0.4
    }
    return this.baseDecayMs
  }

  _getSparkGain() {
    if (this.day === 3 && !this.isShielding) {
      return 1
    }
    return Phaser.Math.Between(1, 3)
  }

  _scheduleDecay() {
    if (this._decayTimer) {
      this._decayTimer.remove(false)
      this._decayTimer = null
    }
    const delay = this._getDecayIntervalMs()
    this._decayTimer = this.time.delayedCall(delay, () => {
      this._decayTimer = null
      this.sparks = Math.max(0, this.sparks - 1)
      this._updateCounter()
      this._scheduleDecay()
    })
  }

  _updateCounter() {
    this._counterText.setText(`${this.sparks} / ${this.target}`)
  }

  _onFlintClick() {
    this.totalClicks += 1
    this.sparks += this._getSparkGain()
    this._updateCounter()
    this._scheduleDecay()

    if (this.sparks >= this.target) {
      this.onSuccess()
      return
    }
    if (this.totalClicks >= this.maxClicks && this.sparks < this.target) {
      this.onFail()
    }
  }

  _onShieldClick() {
    if (this.day !== 3) return

    if (this._shieldEndTimer) {
      this._shieldEndTimer.remove(false)
      this._shieldEndTimer = null
    }

    this.isShielding = true
    this._shieldBtn.setFillStyle(0x228822)
    if (this._shieldLabel) this._shieldLabel.setColor('#ccffcc')

    this._scheduleDecay()

    this._shieldEndTimer = this.time.delayedCall(5000, () => {
      this._shieldEndTimer = null
      this.isShielding = false
      this._shieldBtn.setFillStyle(0x3a3a3a)
      if (this._shieldLabel) this._shieldLabel.setColor('#e0e0e0')
      this._scheduleDecay()
    })
  }

  _showMonologue(line) {
    this._monoText.setText(line)
    if (this._monoClearTimer) {
      this._monoClearTimer.remove(false)
      this._monoClearTimer = null
    }
    this._monoClearTimer = this.time.delayedCall(3200, () => {
      if (this._monoText && this._monoText.text === line) {
        this._monoText.setText('')
      }
      this._monoClearTimer = null
    })
  }

  resetPhase() {
    this.sparks = 0
    this.totalClicks = 0
    this._updateCounter()
    if (this._monoClearTimer) {
      this._monoClearTimer.remove(false)
      this._monoClearTimer = null
    }
    this._monoText.setText('')
    this._scheduleDecay()
  }

  onFail() {
    if (this._monoClearTimer) {
      this._monoClearTimer.remove(false)
      this._monoClearTimer = null
    }
    this._monoText.setText('The spark won\'t hold. Too wet.')

    const stamina = this.registry.get('stamina')
    const alive = stamina ? stamina.deduct(2) : true
    if (!alive) {
      this._destroyTimers()
      this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
        id: 'fire_ignite',
        success: false,
        staminaDepleted: true,
      })
      this.scene.stop('FireIgniteMinigame')
      return
    }

    const fuelStock = Number(this.registry.get('fuelStock') ?? 0)
    if (fuelStock <= 0) {
      this._destroyTimers()
      this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
        id: 'fire_ignite',
        success: false,
      })
      this.scene.stop('FireIgniteMinigame')
      return
    }

    this.registry.set('fuelStock', fuelStock - 1)
    this.resetPhase()
  }

  onSuccess() {
    this._destroyTimers()
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_ignite',
      success: true,
    })
    this.scene.stop('FireIgniteMinigame')
  }

  _destroyTimers() {
    if (this._decayTimer) {
      this._decayTimer.remove(false)
      this._decayTimer = null
    }
    if (this._rainTimer) {
      this._rainTimer.destroy()
      this._rainTimer = null
    }
    if (this._windTimer) {
      this._windTimer.destroy()
      this._windTimer = null
    }
    if (this._shieldEndTimer) {
      this._shieldEndTimer.remove(false)
      this._shieldEndTimer = null
    }
    if (this._monoClearTimer) {
      this._monoClearTimer.remove(false)
      this._monoClearTimer = null
    }
  }
}
