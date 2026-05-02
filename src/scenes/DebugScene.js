import Phaser from 'phaser'
import { GameEvents } from '../systems/GameEvents.js'

/**
 * DebugScene — coordinate inspector + data flow overlay (dev only).
 *
 * Controls
 *   `  (backtick)  toggle coordinate overlay
 *   G              toggle grid
 *   L              lock crosshair at current position + copy to clipboard
 *   D              toggle data flow panel
 */
export class DebugScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DebugScene' })
    this._visible     = false
    this._showGrid    = true
    this._locked      = false
    this._lockX       = 0
    this._lockY       = 0
    this._dataVisible = false
    this._lastEvent   = null   // last MINIGAME_COMPLETE payload
  }

  create() {
    const W   = this.scale.width
    const H   = this.scale.height
    const dpr = window.devicePixelRatio || 1

    this._W   = W
    this._H   = H
    this._dpr = dpr

    // ── Grid ─────────────────────────────────────────────────────────────
    this._gridGfx    = this.add.graphics()
    this._gridLabels = []
    this._drawGrid()

    // ── Crosshair (cleared and redrawn every frame) ───────────────────────
    this._crossGfx = this.add.graphics()

    // ── Readout panel ─────────────────────────────────────────────────────
    this._panelGfx = this.add.graphics()
    this._readout  = this.add.text(0, 0, '', {
      fontFamily:  'monospace',
      fontSize:    `${11 * dpr}px`,
      color:       '#f0d890',
      lineSpacing: 3 * dpr,
    })

    // ── Keyboard toggles ──────────────────────────────────────────────────
    this.input.keyboard.on('keydown-BACKTICK', () => {
      this._visible = !this._visible
      this._applyVisibility()
    })

    this.input.keyboard.on('keydown-O', () => {
      this._visible = !this._visible
      this._applyVisibility()
    })

    this.input.keyboard.on('keydown-G', () => {
      this._showGrid = !this._showGrid
      this._gridGfx.setVisible(this._showGrid)
      this._gridLabels.forEach(l => l.setVisible(this._showGrid))
    })

    // ── Data flow panel ───────────────────────────────────────────────────
    this._dataPanelGfx  = this.add.graphics()
    this._dataPanelText = this.add.text(0, 0, '', {
      fontFamily:  'monospace',
      fontSize:    `${11 * dpr}px`,
      color:       '#a0e8ff',
      lineSpacing: 4 * dpr,
    })
    this._dataPanelGfx.setVisible(false)
    this._dataPanelText.setVisible(false)

    // Listen for minigame events to capture payloads
    this.game.events.on(GameEvents.MINIGAME_COMPLETE, (payload) => {
      this._lastEvent = payload
    })
    this.game.events.on(GameEvents.MINIGAME_TRIGGER, (payload) => {
      this._lastTrigger = payload
    })

    this.input.keyboard.on('keydown-D', () => {
      this._dataVisible = !this._dataVisible
      this._dataPanelGfx.setVisible(this._dataVisible)
      this._dataPanelText.setVisible(this._dataVisible)
      this._launchLinks.forEach(({ text }) => text.setVisible(this._dataVisible))
    })

    // ── Dev launch links (shown with D panel) ────────────────────────────
    this._launchLinks = []
    const linkStyle = {
      fontFamily: 'monospace',
      fontSize: `${11 * dpr}px`,
      color: '#88ffcc',
      lineSpacing: 3 * dpr,
    }
    const makeLink = (label, yOffset, callback) => {
      const link = this.add.text(0, 0, label, linkStyle)
        .setInteractive({ useHandCursor: true })
        .setVisible(false)
        .setDepth(9999)
      link.on('pointerover', () => link.setColor('#ffffff'))
      link.on('pointerout',  () => link.setColor('#88ffcc'))
      link.on('pointerup',   () => callback())
      this._launchLinks.push({ text: link, yOffset })
      return link
    }
    // Jump straight to minigame (bypasses dialogue)
    makeLink('▶ Search easy  [', 0, () => {
      const narrative = this.scene.get('NarrativeScene')
      if (narrative && !this.scene.isSleeping('NarrativeScene')) {
        narrative._mainCharacter?.setVisible(false)
        this.scene.sleep('NarrativeScene')
      }
      if (!this.scene.isActive('SearchMinigame')) {
        this.scene.launch('SearchMinigame', { day: 2, difficulty: 'easy' })
      }
    })
    makeLink('▶ Search hard  ]', 1, () => {
      const narrative = this.scene.get('NarrativeScene')
      if (narrative && !this.scene.isSleeping('NarrativeScene')) {
        narrative._mainCharacter?.setVisible(false)
        this.scene.sleep('NarrativeScene')
      }
      if (!this.scene.isActive('SearchMinigame')) {
        this.scene.launch('SearchMinigame', { day: 2, difficulty: 'hard' })
      }
    })

    // Jump to Ink knot — dialogue plays through NarrativeScene then triggers minigame
    const jumpTo = (knot) => {
      if (this.scene.isActive('SearchMinigame')) this.scene.stop('SearchMinigame')
      const narrative = this.scene.get('NarrativeScene')
      if (!narrative) { console.warn('[DEV] NarrativeScene not found'); return }
      if (this.scene.isSleeping('NarrativeScene')) this.scene.wake('NarrativeScene')
      try {
        narrative._bridge?.jumpTo(knot)
      } catch (e) {
        console.error(`[DEV] jumpTo('${knot}') failed — has the Ink been recompiled?`, e)
      }
    }
    makeLink('▷ Dialogue A (easy)',  2, () => jumpTo('day2_search_a'))
    makeLink('▷ Dialogue B (hard)',  3, () => jumpTo('day2_search_b'))
    makeLink('▷ Dialogue C (no fire)', 4, () => jumpTo('day2_search_c'))


    // ── Apply initial visibility (starts hidden) ──────────────────────────
    this._applyVisibility()

    // ── L — lock position + copy to clipboard ────────────────────────────
    this.input.keyboard.on('keydown-L', () => {
      if (this._locked) {
        // Unlock
        this._locked = false
      } else {
        // Lock at current mouse position and copy
        const ptr = this.input.activePointer
        this._lockX  = ptr.x
        this._lockY  = ptr.y
        this._locked = true
        const xR   = (ptr.x / W).toFixed(3)
        const yR   = (ptr.y / H).toFixed(3)
        const text = `X:${Math.round(ptr.x)} Y:${Math.round(ptr.y)}  W*${xR} H*${yR}`
        navigator.clipboard?.writeText(text).catch(() => {})
        // Flash to confirm
        this._crossGfx.setAlpha(0.2)
        this.time.delayedCall(120, () => this._crossGfx.setAlpha(1))
      }
    })
  }

  update() {
    if (this._dataVisible) this._updateDataPanel()

    if (!this._visible) return

    const ptr = this.input.activePointer
    const W   = this._W
    const H   = this._H
    const dpr = this._dpr

    // Use locked coords when frozen, live coords otherwise
    const x = this._locked ? this._lockX : ptr.x
    const y = this._locked ? this._lockY : ptr.y

    // ── Crosshair ─────────────────────────────────────────────────────────
    const hairColor = this._locked ? 0x80e0ff : 0xf0d890
    this._crossGfx.clear()
    this._crossGfx.lineStyle(dpr, hairColor, 0.55)
    this._crossGfx.lineBetween(0, y, W, y)
    this._crossGfx.lineBetween(x, 0, x, H)
    this._crossGfx.fillStyle(hairColor, 1)
    this._crossGfx.fillCircle(x, y, 3 * dpr)

    // ── Readout ───────────────────────────────────────────────────────────
    const xR     = (x / W).toFixed(3)
    const yR     = (y / H).toFixed(3)
    const status = this._locked ? 'L  unlock            (copied)' : 'L  lock + copy'
    this._readout.setText([
      `X  ${Math.round(x).toString().padStart(4)}   W × ${xR}`,
      `Y  ${Math.round(y).toString().padStart(4)}   H × ${yR}`,
      '',
      status,
      'O  hide    G  grid    D  data',
    ])
    this._readout.setColor(this._locked ? '#80e0ff' : '#f0d890')

    // Panel: follow cursor, clamp to screen edges
    const padX = 12 * dpr
    const padY =  8 * dpr
    const panW = this._readout.width  + padX * 2
    const panH = this._readout.height + padY * 2
    const off  = 18 * dpr

    let px = x + off
    let py = y + off
    if (px + panW > W) px = x - panW - off
    if (py + panH > H) py = y - panH - off

    this._panelGfx.clear()
    this._panelGfx.fillStyle(0x0d0a06, 0.88)
    this._panelGfx.fillRoundedRect(px, py, panW, panH, 5 * dpr)
    this._panelGfx.lineStyle(dpr, 0xf0d890, 0.25)
    this._panelGfx.strokeRoundedRect(px, py, panW, panH, 5 * dpr)

    this._readout.setPosition(px + padX, py + padY)
  }

  // ── Data panel ───────────────────────────────────────────────────────────

  _updateDataPanel() {
    const W   = this._W
    const H   = this._H
    const dpr = this._dpr

    // ── Read registry ──────────────────────────────────────────────────────
    const stamina   = this.registry.get('stamina')
    const days      = this.registry.get('days')
    const staminaStr = stamina
      ? `${stamina.current ?? '?'} / ${stamina.max ?? '?'}`
      : 'n/a'
    const dayStr = days
      ? `${days.currentDay ?? '?'} / ${days.maxDays ?? '?'}`
      : 'n/a'

    const reg = (key) => {
      const v = this.registry.get(key)
      return v === undefined || v === null ? '—' : String(v)
    }

    // ── Last trigger ───────────────────────────────────────────────────────
    const trigStr = this._lastTrigger
      ? `id:${this._lastTrigger.id}  day:${this._lastTrigger.day}  diff:${this._lastTrigger.difficulty ?? '—'}`
      : '—'

    // ── Last complete ──────────────────────────────────────────────────────
    let evStr = '—'
    if (this._lastEvent) {
      const e = this._lastEvent
      const parts = [`id:${e.id}`, `ok:${e.success}`]
      if (e.score !== undefined)        parts.push(`score:${e.score}`)
      if (e.staminaDepleted !== undefined) parts.push(`stamDep:${e.staminaDepleted}`)
      evStr = parts.join('  ')
    }

    const lines = [
      '── REGISTRY ─────────────────',
      `stamina          ${staminaStr}`,
      `day              ${dayStr}`,
      `campsiteQuality  ${reg('campsiteQuality')}`,
      `ignitionDiff     ${reg('ignitionDifficulty')}`,
      `fuelStock        ${reg('fuelStock')}`,
      `fireQuality      ${reg('fireQuality')}`,
      '',
      '── LAST TRIGGER ─────────────',
      trigStr,
      '',
      '── LAST COMPLETE ────────────',
      evStr,
      '',
      'D  hide',
    ]

    this._dataPanelText.setText(lines)

    // Panel background
    const padX = 12 * dpr
    const padY =  8 * dpr
    const panW = this._dataPanelText.width  + padX * 2
    const panH = this._dataPanelText.height + padY * 2
    const px   = W - panW - 10 * dpr
    const py   = 10 * dpr

    this._dataPanelGfx.clear()
    this._dataPanelGfx.fillStyle(0x060d12, 0.90)
    this._dataPanelGfx.fillRoundedRect(px, py, panW, panH, 5 * dpr)
    this._dataPanelGfx.lineStyle(dpr, 0xa0e8ff, 0.30)
    this._dataPanelGfx.strokeRoundedRect(px, py, panW, panH, 5 * dpr)

    this._dataPanelText.setPosition(px + padX, py + padY)

    // Position launch links stacked below the panel
    const linkLineH = (11 * dpr + 3 * dpr + 4 * dpr)
    this._launchLinks.forEach(({ text, yOffset }) => {
      text.setPosition(px + padX, py + panH + 6 * dpr + yOffset * linkLineH)
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _drawGrid() {
    const W   = this._W
    const H   = this._H
    const dpr = this._dpr
    const g   = this._gridGfx

    g.clear()

    // Lines every 10% — 50% lines brighter
    for (let i = 1; i < 10; i++) {
      const alpha = (i === 5) ? 0.28 : 0.10
      g.lineStyle(dpr, 0xffffff, alpha)
      g.lineBetween(W * i / 10, 0, W * i / 10, H)
      g.lineBetween(0, H * i / 10, W, H * i / 10)
    }

    // Labels along top edge (X) and left edge (Y) every 20%
    const style = {
      fontFamily: 'monospace',
      fontSize:   `${9 * dpr}px`,
      color:      '#ffffff',
    }
    for (let i = 0; i <= 5; i++) {
      const xLabel = this.add.text(W * i / 5 + 3 * dpr, 3 * dpr, `${i * 20}%W`, style)
        .setAlpha(0.4)
      const yLabel = this.add.text(3 * dpr, H * i / 5 + 3 * dpr, `${i * 20}%H`, style)
        .setAlpha(0.4)
      this._gridLabels.push(xLabel, yLabel)
    }
  }

  _applyVisibility() {
    const v = this._visible
    this._crossGfx.setVisible(v)
    this._panelGfx.setVisible(v)
    this._readout.setVisible(v)
    this._gridGfx.setVisible(v && this._showGrid)
    this._gridLabels.forEach(l => l.setVisible(v && this._showGrid))
  }
}
