import Phaser from 'phaser'
import { GameEvents } from '../systems/GameEvents.js'

/**
 * MapScene
 * Shown when Ink emits SCENE_CHANGE with key 'map'.
 * Player clicks a location marker → emits CHOICE_MADE → fades out → wakes NarrativeScene.
 */
export class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' })
  }

  create() {
    const dpr  = window.devicePixelRatio || 1
    const W    = this.scale.width
    const H    = this.scale.height

    // ── Transparent camera so NarrativeScene background shows through ─────
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')

    // Map is 60% of screen; bottom-left at W*0.200, H*0.704
    const mapW  = W * 0.6
    const mapH  = H * 0.6
    const mapX  = W * 0.200               // left edge
    const mapY  = H * 0.704 - mapH        // top edge (bottom-left Y minus height)
    const centX = mapX + mapW / 2
    const centY = mapY + mapH / 2

    // ── Map background ────────────────────────────────────────────────────
    this.add.image(centX, centY, 'bg_map').setDisplaySize(mapW, mapH).setDepth(0)
    // Dark overlay 30% over map area only
    this.add.rectangle(centX, centY, mapW, mapH, 0x000000, 0.2).setDepth(1)

    // ── Shared label card ─────────────────────────────────────────────────
    this._createLabelUI()

    // ── Markers (coordinates relative to map inset) ───────────────────────
    // Village marker: bottom-left at (W*0.463, H*0.655)
    const markerX = W * 0.463
    const markerY = H * 0.655
    this._buildActiveMarker(markerX, markerY, 'Village Hub', 0xc49850)
  }

  // ── Label card ─────────────────────────────────────────────────────────────

  _createLabelUI() {
    const dpr = window.devicePixelRatio || 1
    const w   = 180 * dpr
    const h   = 52 * dpr

    this._labelBg = this.add.rectangle(0, 0, w, h, 0x1a1008, 0.92)
      .setOrigin(0, 0).setDepth(1000).setVisible(false)
    this._labelEdge = this.add.rectangle(0, 0, w, 3 * dpr, 0xc49850)
      .setOrigin(0, 0).setDepth(1001).setVisible(false)
    this._labelText = this.add.text(0, 0, '', {
      fontSize: `${24 * dpr}px`,
      fontFamily: 'IM Fell English, serif',
      color: '#e8d5a3',
    }).setOrigin(0, 0).setDepth(1002).setVisible(false)
  }

  _showLabel(x, y, label) {
    const dpr  = window.devicePixelRatio || 1
    const ox   = x + 20 * dpr
    const oy   = y - 70 * dpr
    const padX = 16 * dpr
    const padY = 14 * dpr

    this._labelBg.setPosition(ox, oy).setVisible(true)
    this._labelEdge.setPosition(ox, oy).setVisible(true)
    this._labelText.setPosition(ox + padX, oy + padY).setText(label).setVisible(true)
  }

  _hideLabel() {
    this._labelBg.setVisible(false)
    this._labelEdge.setVisible(false)
    this._labelText.setVisible(false)
  }

  // ── Marker helpers ─────────────────────────────────────────────────────────

  _buildActiveMarker(x, y, label, color) {
    const dpr      = window.devicePixelRatio || 1
const iconSize = 256 * dpr

    // ── Village icon sprite (falls back to circle) ────────────────────────
    let dot
    if (this.textures.exists('map_village')) {
      dot = this.add.image(x, y, 'map_village')
        .setOrigin(0, 1)          // x=left edge, y=bottom edge
        .setDisplaySize(iconSize, iconSize)
        .setDepth(10)
    } else {
      const r = 12 * dpr
      dot = this.add.circle(x, y, r, color).setDepth(10)
      this.tweens.add({
        targets: dot, scaleX: 1.3, scaleY: 1.3,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }

    // ── Soft glow via postFX (Phaser 3.60+) ───────────────────────────────
    // outerStrength controls the soft halo spread; color is 0xRRGGBB
    const glowFX = dot.postFX.addGlow(0xc49850, 6, 0, false, 0.1, 16)

    // ── Hit zone ──────────────────────────────────────────────────────────
    const hitR = iconSize / 2 + 10 * dpr
    const zone = this.add.zone(x, y, hitR * 2, hitR * 2)
      .setInteractive({ cursor: 'pointer' }).setDepth(20)

    zone.on('pointerover', () => {
      glowFX.outerStrength = 14
      if (dot.setTint) dot.setTint(0xffeebb)
      this._showLabel(x, y, label)
    })
    zone.on('pointerout', () => {
      glowFX.outerStrength = 6
      if (dot.clearTint) dot.clearTint()
      this._hideLabel()
    })
    zone.on('pointerdown', () => {
      glowFX.outerStrength = 20
      this.time.delayedCall(150, () => { glowFX.outerStrength = 14 })
      this._onMarkerClick()
    })
  }

  // ── Click handler ──────────────────────────────────────────────────────────

  _onMarkerClick() {
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop()
      // NarrativeScene is already awake — just emit the choice
      this.game.events.emit(GameEvents.CHOICE_MADE, { index: 0 })
      // Reset map flag on NarrativeScene
      const narr = this.scene.get('NarrativeScene')
      if (narr) narr._mapActive = false
    })
  }
}
