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

    // ── Stamina flames (top-left) — hidden ──────────────────────────────
    // this._buildFlames()

    // ── Day counter (top-right) — hidden until prologue ends ────────────
    this._buildDayCounter(W)
    this._dayText.setVisible(false)
    this._moonIcon.setVisible(false)

    // ── Event listeners ──────────────────────────────────────────────────
    this.game.events.on(GameEvents.STAMINA_CHANGE, ({ current, max }) => {
      this._updateFlames(current, max)
    })

    this.game.events.on(GameEvents.DAY_ADVANCE, ({ day, maxDays }) => {
      this._updateDayCounter(day, maxDays)
    })

    this.game.events.once(GameEvents.PROLOGUE_END, () => {
      this._dayText.setVisible(true)
      this._moonIcon.setVisible(true)
    })
  }

  // ── Stamina flames ───────────────────────────────────────────────────────

  _buildFlames() {
    const dpr = window.devicePixelRatio || 1
    const startX = 24 * dpr
    const startY = 24 * dpr
    const spacing = 32 * dpr

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
      g.fillTriangle(x, y - 20 * dpr, x - 8 * dpr, y + 8 * dpr, x + 8 * dpr, y + 8 * dpr)
      // Inner flame
      g.fillStyle(0xffcc00, 0.95)
      g.fillTriangle(x, y - 12 * dpr, x - 4 * dpr, y + 6 * dpr, x + 4 * dpr, y + 6 * dpr)
    } else {
      // Extinguished — just a small grey ember
      g.fillStyle(0x444444, 0.6)
      g.fillCircle(x, y + 4 * dpr, 4 * dpr)
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
    // Moon icon (drawn in code)
    this._moonIcon = this.add.graphics()
    this._renderMoon(1, 5)

    this._dayText = this.add.text(W - 20 * dpr, 20 * dpr, 'Day 1 / 5', {
      fontSize: `${16 * dpr}px`,
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(1, 0)
  }

  _renderMoon(currentDay, maxDays) {
    const dpr = window.devicePixelRatio || 1
    const W = this.scale.width
    const x = W - 110 * dpr
    const y = 32 * dpr
    const r = 12 * dpr
    const phase = currentDay / maxDays // 0 → 1

    this._moonIcon.clear()
    // Full circle (dark)
    this._moonIcon.fillStyle(0x333333)
    this._moonIcon.fillCircle(x, y, r)
    // Lit portion grows from right
    this._moonIcon.fillStyle(0xddddaa, 0.9)
    const litWidth = r * 2 * phase
    this._moonIcon.fillCircle(x + r - litWidth / 2, y, litWidth / 2)
  }

  _updateDayCounter(day, maxDays) {
    this._dayText.setText(`Day ${day} / ${maxDays}`)
    this._renderMoon(day, maxDays)

    // Flash the day text
    this.tweens.add({
      targets: this._dayText,
      alpha: { from: 0.3, to: 1 },
      duration: 400,
    })
  }
}
