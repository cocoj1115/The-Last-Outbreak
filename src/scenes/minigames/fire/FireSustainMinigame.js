import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

/**
 * Keep the fire alive until night ends (90s). Placeholder UI only.
 * Registry: campsiteQuality, fuelStock. Optional: stamina.
 */
export class FireSustainMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireSustainMinigame' })
  }

  init(data) {
    this.day = data?.day ?? 2
    this.isPoor = this.registry.get('campsiteQuality') === 'poor'
    this.fuelStock = this.registry.get('fuelStock') ?? 5

    this.fireStrength = 5
    this.nightProgress = 0

    if (this.day === 3) {
      this.DRAIN_MS = this.isPoor ? 8000 : 12000
    } else {
      this.DRAIN_MS = this.isPoor ? 9000 : 12000
    }

    this.windEventImminent = false
    this.tendCharges = 2

    this._inFireOut = false
    this._drainTimer = null
    this._nightTimer = null
    this._floodTimer = null
    this._windScheduleTimer = null
    this._windResolveTimer = null
    this._windFlashTween = null
    this._tendRechargeTimer = null
    this._monoClearTimer = null
    this._nightEnded = false
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0b08)

    // ── Fire strength (5 segments) ────────────────────────────────────────
    this._fireSegs = []
    const segW = 36
    const gap = 8
    const fireTotalW = 5 * segW + 4 * gap
    const fx0 = W / 2 - fireTotalW / 2
    const fy = 120
    for (let i = 0; i < 5; i++) {
      const r = this.add
        .rectangle(fx0 + i * (segW + gap) + segW / 2, fy, segW, 52, 0xff6600)
        .setStrokeStyle(2, 0x331100)
      this._fireSegs.push(r)
    }

    this._fuelCounter = this.add
      .text(W / 2, 190, `Fuel: ${this.fuelStock}`, {
        fontSize: '18px',
        fill: '#e8d8a0',
        fontFamily: 'Georgia, serif',
      })
      .setOrigin(0.5)

    // ── Night progress bar (bottom, ~90s = 100 ticks × 900ms) ────────────
    this._barW = W - 80
    const barH = 18
    const barY = H - 140
    const barLeft = W / 2 - this._barW / 2
    this.add.rectangle(W / 2, barY, this._barW, barH, 0x1a1610).setStrokeStyle(2, 0x3a3020)
    this._nightFill = this.add
      .rectangle(barLeft + 2, barY, 0, barH - 4, 0x6a5a40)
      .setOrigin(0, 0.5)

    this._addFuelBtn = this.add
      .rectangle(W / 2, H * 0.45, 160, 44, 0x4a3a20)
      .setInteractive({ useHandCursor: true })
    this.add
      .text(W / 2, H * 0.45, 'Add Fuel', {
        fontSize: '16px',
        fill: '#f0e6c8',
        fontFamily: 'Georgia, serif',
      })
      .setOrigin(0.5)
    this._addFuelBtn.on('pointerup', () => this._onAddFuel())

    // Monologue
    const boxH = 72
    const boxY = H - 56
    this.add.rectangle(W / 2, boxY, W - 48, boxH, 0x1a1610, 0.92).setStrokeStyle(2, 0x4a3a20)
    this._monoText = this.add
      .text(W / 2, boxY, '', {
        fontSize: '15px',
        fill: '#d4c4a0',
        fontFamily: 'Georgia, serif',
        wordWrap: { width: W - 72 },
        align: 'center',
      })
      .setOrigin(0.5)

    if (this.day === 3) {
      this._windSegs = []
      const wSegW = 40
      const wGap = 10
      const wTotal = 3 * wSegW + 2 * wGap
      const wx0 = W / 2 - wTotal / 2
      const wy = 250
      for (let i = 0; i < 3; i++) {
        const r = this.add
          .rectangle(wx0 + i * (wSegW + wGap) + wSegW / 2, wy, wSegW, 36, 0x3a4555)
          .setStrokeStyle(2, 0x2a3545)
        this._windSegs.push(r)
      }

      this._tendBtn = this.add
        .rectangle(W / 2, 310, 120, 40, 0x3a3a3a)
        .setInteractive({ useHandCursor: true })
      this.add
        .text(W / 2, 310, 'Tend', {
          fontSize: '15px',
          fill: '#e0e0e0',
          fontFamily: 'Georgia, serif',
        })
        .setOrigin(0.5)
      this._tendBtn.on('pointerup', () => this._onTend())

      this._tendCounterText = this.add
        .text(W / 2, 350, `Tend charges: ${this.tendCharges}`, {
          fontSize: '14px',
          fill: '#aaa',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)

      this.scheduleWindEvent(10000)
    }

    this.updateFireUI()

    this._drainTimer = this.time.addEvent({
      delay: this.DRAIN_MS,
      loop: true,
      callback: () => {
        this.fireStrength = Math.max(0, this.fireStrength - 1)
        this.updateFireUI()
        if (this.fireStrength === 0) this.onFireOut()
      },
    })

    this._nightTimer = this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        if (this._nightEnded) return
        this.nightProgress = Math.min(100, this.nightProgress + 1)
        const innerW = Math.max(0, this._barW - 4)
        this._nightFill.width = (innerW * this.nightProgress) / 100
        if (this.nightProgress >= 100) this.onNightComplete()
      },
    })

    if (this.day === 2 && this.isPoor) {
      this._floodTimer = this.time.addEvent({
        delay: 20000,
        loop: true,
        callback: () => {
          this.fireStrength = Math.max(0, this.fireStrength - 1)
          this.updateFireUI()
          this._showMonologue('Water is getting in. Harder to keep this alive.')
          if (this.fireStrength === 0) this.onFireOut()
        },
      })
    }
  }

  updateFireUI() {
    const strong = this.fireStrength >= 3
    for (let i = 0; i < 5; i++) {
      const lit = i < this.fireStrength
      const c = lit ? (strong ? 0xff6600 : 0xaa5500) : 0x2a2220
      this._fireSegs[i].setFillStyle(c)
    }
  }

  _updateFuelCounter() {
    this._fuelCounter.setText(`Fuel: ${this.fuelStock}`)
  }

  _updateTendCounter() {
    if (this._tendCounterText) {
      this._tendCounterText.setText(`Tend charges: ${this.tendCharges}`)
    }
  }

  _onAddFuel() {
    if (this.fuelStock <= 0) return

    if (this.fireStrength === 5) {
      this._showMonologue('Not yet. Wasted.')
      this.fuelStock -= 1
      this._updateFuelCounter()
      return
    }

    this.fuelStock -= 1
    this.fireStrength = Math.min(5, this.fireStrength + 2)
    this._updateFuelCounter()
    this.updateFireUI()
  }

  scheduleWindEvent(delay) {
    if (this.day !== 3) return

    if (this._windScheduleTimer) {
      this._windScheduleTimer.remove(false)
      this._windScheduleTimer = null
    }

    this._windScheduleTimer = this.time.delayedCall(delay, () => {
      this._windScheduleTimer = null
      if (!this.scene.isActive('FireSustainMinigame')) return

      this.windEventImminent = true
      this._startWindFlash()

      if (this._windResolveTimer) {
        this._windResolveTimer.remove(false)
        this._windResolveTimer = null
      }

      this._windResolveTimer = this.time.delayedCall(1500, () => {
        this._windResolveTimer = null
        if (!this.scene.isActive('FireSustainMinigame')) return

        if (this.windEventImminent) {
          this.fireStrength = Math.max(0, this.fireStrength - 2)
          this.updateFireUI()
          if (this.fireStrength === 0) this.onFireOut()
        }

        this.windEventImminent = false
        this._stopWindFlash()

        const nextDelay = this.isPoor ? 15000 : 25000
        this.scheduleWindEvent(nextDelay)
      })
    })
  }

  _startWindFlash() {
    this._stopWindFlash()
    if (!this._windSegs?.length) return
    this._windFlashTween = this.tweens.add({
      targets: this._windSegs,
      alpha: { from: 1, to: 0.35 },
      duration: 200,
      yoyo: true,
      repeat: -1,
    })
  }

  _stopWindFlash() {
    if (this._windFlashTween) {
      this._windFlashTween.stop()
      this._windFlashTween = null
    }
    if (this._windSegs) {
      this._windSegs.forEach((s) => s.setAlpha(1))
    }
  }

  _onTend() {
    if (this.day !== 3) return
    if (this.tendCharges <= 0 || !this.windEventImminent) return

    this.windEventImminent = false
    this._stopWindFlash()

    this.tendCharges -= 1
    this._updateTendCounter()
    this._showMonologue('Held it.')

    if (this._tendRechargeTimer) {
      this._tendRechargeTimer.remove(false)
      this._tendRechargeTimer = null
    }
    this._tendRechargeTimer = this.time.delayedCall(60000, () => {
      this._tendRechargeTimer = null
      if (!this.scene.isActive('FireSustainMinigame')) return
      this.tendCharges = 2
      this._updateTendCounter()
    })
  }

  _showMonologue(text, clearAfterMs = 4500) {
    this._monoText.setText(text)
    if (this._monoClearTimer) {
      this._monoClearTimer.remove(false)
      this._monoClearTimer = null
    }
    if (clearAfterMs > 0) {
      this._monoClearTimer = this.time.delayedCall(clearAfterMs, () => {
        if (this._monoText?.text === text) this._monoText.setText('')
        this._monoClearTimer = null
      })
    }
  }

  onFireOut() {
    if (this._inFireOut) return
    this._inFireOut = true

    const stamina = this.registry.get('stamina')

    if (this.fuelStock > 0) {
      const alive = stamina ? stamina.deduct(1) : true
      if (!alive) {
        this.emitFail(true)
        return
      }
      this.registry.set('fuelStock', this.fuelStock)
      this._destroyTimers()
      this.scene.stop('FireSustainMinigame')
      this.scene.start('FireIgniteMinigame', { day: this.day })
      return
    }

    const alive = stamina ? stamina.deduct(1) : true
    if (!alive) {
      this.emitFail(true)
      return
    }
    this.emitFail(false)
  }

  onNightComplete() {
    if (this._nightEnded) return
    this._nightEnded = true

    const fireQuality = this.fireStrength >= 3 ? 'strong' : 'weak'
    this.registry.set('fireQuality', fireQuality)
    this.registry.set('fuelStock', this.fuelStock)

    this._destroyTimers()
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_sustain',
      success: true,
      score: fireQuality,
    })
    this.scene.stop('FireSustainMinigame')
  }

  emitFail(staminaDepleted) {
    this._destroyTimers()
    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_sustain',
      success: false,
      staminaDepleted: staminaDepleted || false,
    })
    this.scene.stop('FireSustainMinigame')
  }

  _destroyTimers() {
    if (this._drainTimer) {
      this._drainTimer.destroy()
      this._drainTimer = null
    }
    if (this._nightTimer) {
      this._nightTimer.destroy()
      this._nightTimer = null
    }
    if (this._floodTimer) {
      this._floodTimer.destroy()
      this._floodTimer = null
    }
    if (this._windScheduleTimer) {
      this._windScheduleTimer.remove(false)
      this._windScheduleTimer = null
    }
    if (this._windResolveTimer) {
      this._windResolveTimer.remove(false)
      this._windResolveTimer = null
    }
    if (this._tendRechargeTimer) {
      this._tendRechargeTimer.remove(false)
      this._tendRechargeTimer = null
    }
    if (this._monoClearTimer) {
      this._monoClearTimer.remove(false)
      this._monoClearTimer = null
    }
    this._stopWindFlash()
  }
}
