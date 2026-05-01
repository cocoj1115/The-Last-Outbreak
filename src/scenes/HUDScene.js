import Phaser from 'phaser'
import { GameEvents } from '../systems/GameEvents.js'

/**
 * HUDScene
 * Dev B owns this file.
 *
 * Persistent overlay (launched once, never stopped).
 * Displays:
 *  - Stamina flames (5 icons, extinguish as stamina drops)
 *  - Day counter (Day X / 5) with moon phase icon
 *
 * Listens to STAMINA_CHANGE and DAY_ADVANCE to update.
 */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HUDScene' })
    this._flames = []
    this._dayText = null
    this._moonIcon = null
  }

  create() {
    const W = this.scale.width

    // ── Stamina flames (top-left) — hidden until Day 1 begins ────────────
    this._buildFlames()
    this._flames.forEach(f => f.setVisible(false))
    this._buildStaminaRulesPanel()

    // ── Day counter (top-right) — hidden until prologue ends ────────────
    this._buildDayCounter(W)
    this._dayText.setVisible(false)

    // ── Event listeners ──────────────────────────────────────────────────
    this.game.events.on(GameEvents.STAMINA_CHANGE, ({ current, max }) => {
      this._updateFlames(current, max)
    })

    this.game.events.on(GameEvents.DAY_ADVANCE, ({ day, maxDays }) => {
      this._updateDayCounter(day, maxDays)
    })

    this.game.events.once(GameEvents.PROLOGUE_END, () => {
      this._flames.forEach(f => f.setVisible(true))
      this._dayText.setVisible(true)
    })
  }

  // ── Stamina rules panel ──────────────────────────────────────────────────

  _buildStaminaRulesPanel() {
    const dpr  = window.devicePixelRatio || 1
    const W    = this.scale.width
    const H    = this.scale.height

    // Invisible hit zone over the 5 flames
    const zoneW = (16 + 4 * 18 + 16) * dpr
    const zoneH = 52 * dpr
    const zone  = this.add.zone(zoneW / 2, zoneH / 2, zoneW, zoneH)
      .setInteractive({ useHandCursor: true }).setDepth(5000)

    // ── Panel (hidden by default) ─────────────────────────────────────────
    const panelW = 360 * dpr
    const panelH = 280 * dpr
    const panelX = 24 * dpr
    const panelY = 60 * dpr

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45)
      .setDepth(5999).setVisible(false).setInteractive()

    const panel = this.add.rectangle(
      panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x1a0c02, 0.97
    ).setStrokeStyle(1.5 * dpr, 0xb8943c, 0.9).setDepth(6000).setVisible(false)

    const title = this.add.text(panelX + 16 * dpr, panelY + 16 * dpr, 'Stamina', {
      fontSize:   `${18 * dpr}px`,
      fontFamily: '"IM Fell English", serif',
      fontStyle:  'italic',
      color:      '#c49850',
    }).setDepth(6001).setVisible(false)

    const body = this.add.text(panelX + 16 * dpr, panelY + 50 * dpr, [
      'Each flame is 1 stamina point.',
      '',
      'Poor decisions cost stamina:',
      '  · Wrong campsite         −2',
      '  · Failed fire / overload  −1',
      '  · Giving up               −2',
      '',
      'Stamina resets each new day.',
      'If all flames go out, the day is lost.',
    ].join('\n'), {
      fontSize:    `${13 * dpr}px`,
      fontFamily:  '"IM Fell English", serif',
      color:       '#e8d5a3',
      lineSpacing: 5 * dpr,
      wordWrap:    { width: panelW - 32 * dpr },
    }).setDepth(6001).setVisible(false)

    const close = this.add.text(
      panelX + panelW - 16 * dpr, panelY + 14 * dpr, '✕', {
        fontSize:   `${16 * dpr}px`,
        fontFamily: 'monospace',
        color:      '#b8943c',
      }
    ).setOrigin(1, 0).setDepth(6001).setVisible(false)
      .setInteractive({ useHandCursor: true })

    const all = [overlay, panel, title, body, close]
    const show = () => all.forEach(o => o.setVisible(true))
    const hide = () => all.forEach(o => o.setVisible(false))

    zone.on('pointerup',    show)
    close.on('pointerup',   hide)
    overlay.on('pointerup', hide)
  }

  // ── Stamina flames ───────────────────────────────────────────────────────

  _buildFlames() {
    const dpr = window.devicePixelRatio || 1
    const startX = 16 * dpr
    const startY = 18 * dpr
    const spacing = 18 * dpr

    for (let i = 0; i < 5; i++) {
      const flame = this._drawFlame(startX + i * spacing, startY, true)
      this._flames.push(flame)
    }
  }

  _drawFlame(x, y, lit) {
    // Drawn in code — replace with sprite sheet later
    const g = this.add.graphics()
    this._renderFlame(g, x, y, lit)
    g.setData('lit', lit)
    g.setData('x', x)
    g.setData('y', y)
    return g
  }

  _renderFlame(g, x, y, lit) {
    const dpr = window.devicePixelRatio || 1
    g.clear()
    if (lit) {
      // Outer flame
      g.fillStyle(0xff6600, 0.9)
      g.fillTriangle(x, y - 5 * dpr, x - 4 * dpr, y + 4 * dpr, x + 4 * dpr, y + 4 * dpr)
      // Inner flame
      g.fillStyle(0xffcc00, 0.95)
      g.fillTriangle(x, y - 3 * dpr, x - 2 * dpr, y + 3 * dpr, x + 2 * dpr, y + 3 * dpr)
    } else {
      // Extinguished — just a small grey ember
      g.fillStyle(0x444444, 0.6)
      g.fillCircle(x, y + 2 * dpr, 2 * dpr)
    }
  }

  _updateFlames(current, max) {
    this._flames.forEach((flame, i) => {
      const lit = i < current
      const x = flame.getData('x')
      const y = flame.getData('y')
      const wasLit = flame.getData('lit')

      if (wasLit !== lit) {
        this._renderFlame(flame, x, y, lit)
        flame.setData('lit', lit)

        // Flash animation when extinguishing
        if (!lit) {
          this.tweens.add({
            targets: flame,
            alpha: { from: 1, to: 0.4 },
            duration: 200,
            yoyo: true,
          })
        }
      }
    })
  }

  // ── Day counter ──────────────────────────────────────────────────────────

  _buildDayCounter(W) {
    const dpr = window.devicePixelRatio || 1
    this._moonIcon = null

    this._dayText = this.add.text(W - 20 * dpr, 20 * dpr, 'Day 1 / 5', {
      fontSize: `${16 * dpr}px`,
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(1, 0)
  }

  _updateDayCounter(day, maxDays) {
    this._dayText.setText(`Day ${day} / ${maxDays}`)

    // Flash the day text
    this.tweens.add({
      targets: this._dayText,
      alpha: { from: 0.3, to: 1 },
      duration: 400,
    })
  }
}
