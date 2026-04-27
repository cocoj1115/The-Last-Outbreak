import Phaser from 'phaser'
import { GameEvents } from '../systems/GameEvents.js'
import { StaminaSystem } from '../systems/StaminaSystem.js'
import { DaySystem } from '../systems/DaySystem.js'

/**
 * BootScene
 * Loads all assets, initialises global systems, then hands off to NarrativeScene.
 * Dev A and Dev B both add their asset loads here.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // ── Loading bar ──────────────────────────────────────────────────────
    const { width, height } = this.scale
    const bar = this.add.rectangle(width / 2, height / 2, 4, 4, 0x888888)
    const track = this.add.rectangle(width / 2, height / 2, 400, 4, 0x333333)

    this.load.on('progress', (value) => {
      bar.setSize(400 * value, 4)
    })

    // ── Placeholder assets (replace with real files later) ───────────────
    // Backgrounds
    // this.load.image('bg_forest_day', 'assets/images/bg_forest_day.jpg')
    // this.load.image('bg_forest_night', 'assets/images/bg_forest_night.jpg')

    // Ink story JSON (compile .ink → .ink.json with Inky app or inklecate)
    // this.load.json('story', 'assets/story/main.ink.json')

    // ── Dev placeholder graphics (drawn in code, no files needed) ────────
    // These let the game run before any real art exists.
    this._createPlaceholderTextures()
  }

  create() {
    // ── Initialise global systems on game.registry ───────────────────────
    // Both scenes access these via this.registry or this.game.registry
    const stamina = new StaminaSystem(this.game.events)
    const days = new DaySystem(this.game.events)

    this.registry.set('stamina', stamina)
    this.registry.set('days', days)

    // ── Start persistent HUD on top of everything ────────────────────────
    this.scene.launch('HUDScene')

    // ── Hand off to narrative ────────────────────────────────────────────
    this.game.events.emit(GameEvents.GAME_READY)
    this.scene.start('NarrativeScene')
  }

  // ── Private ─────────────────────────────────────────────────────────────

  _createPlaceholderTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })

    // Background placeholder
    g.fillStyle(0x1a2a1a)
    g.fillRect(0, 0, 1280, 720)
    g.generateTexture('bg_placeholder', 1280, 720)

    // Character portrait placeholder
    g.clear()
    g.fillStyle(0x2a2a2a)
    g.fillRect(0, 0, 200, 300)
    g.fillStyle(0x888888)
    g.fillCircle(100, 80, 50)
    g.fillRect(50, 140, 100, 150)
    g.generateTexture('portrait_placeholder', 200, 300)

    g.destroy()
  }
}
