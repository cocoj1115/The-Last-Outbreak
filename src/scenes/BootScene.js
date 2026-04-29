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
    const dpr = window.devicePixelRatio || 1
    // ── Loading bar ───────────────────────────────────────────────────────
    const { width, height } = this.scale
    const bar = this.add.rectangle(width / 2, height / 2, 4 * dpr, 4 * dpr, 0x888888)
    const track = this.add.rectangle(width / 2, height / 2, 400 * dpr, 4 * dpr, 0x333333)

    this.load.on('progress', (value) => {
      bar.setSize(400 * dpr * value, 4 * dpr)
    })

    // ── Montserrat (used by OnboardingScene button) ──────────────────────
    const _fontLink = document.createElement('link')
    _fontLink.rel  = 'stylesheet'
    _fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=IM+Fell+English&display=swap'
    document.head.appendChild(_fontLink)

    // ── UI & narrative assets ────────────────────────────────────────────
    this.load.image('onboarding1', 'assets/onboarding1.png')
    this.load.image('dialog_box', 'assets/dialog_box.png')
    this.load.image('dialogue_card', 'assets/dialogue_card.png')
    this.load.image('maincharacter', 'assets/maincharacter-default2.png')
    this.load.image('bg_background1', 'assets/background1.jpg')
    this.load.image('bg_background2', 'assets/background2.jpg')
    this.load.image('bg_village_morning', 'assets/village-bright-morning.jpg')
    this.load.image('bg_village_day1',    'assets/village-bright-morning.jpg')
    this.load.image('char_sleeping', 'assets/main-character-sleeping.png')
    this.load.image('bg_map', 'assets/map_all.jpg')
    this.load.image('map_village', 'assets/map_village.png')
    this.load.image('portrait_mara', 'assets/NPC_Mara.png')
    this.load.image('portrait_finn', 'assets/NPC_Finn.png')
    this.load.image('portrait_isla', 'assets/NPC_Isla.png')
    this.load.image('portrait_aiden', 'assets/main character-thinking.png')

    // ── Placeholder assets (replace with real files later) ───────────────
    // Backgrounds
    // this.load.image('bg_forest_day', 'assets/images/bg_forest_day.jpg')
    // this.load.image('bg_forest_night', 'assets/images/bg_forest_night.jpg')

    // Ink story JSON (compile .ink → .ink.json with Inky app or inklecate)
    this.load.json('story', 'assets/story/main.ink.json')

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

    // ── Hand off to onboarding (HUDScene is launched after the player clicks in) ─
    this.game.events.emit(GameEvents.GAME_READY)
    this.scene.launch('DebugScene')
    this.scene.start('OnboardingScene')
  }

  // ── Private ─────────────────────────────────────────────────────────────

  _createPlaceholderTextures() {
    const dpr = window.devicePixelRatio || 1
    const g = this.make.graphics({ x: 0, y: 0, add: false })

    // Background placeholder
    g.fillStyle(0x1a2a1a)
    g.fillRect(0, 0, 1280 * dpr, 720 * dpr)
    g.generateTexture('bg_placeholder', 1280 * dpr, 720 * dpr)

    // Character portrait placeholder
    g.clear()
    g.fillStyle(0x2a2a2a)
    g.fillRect(0, 0, 200 * dpr, 300 * dpr)
    g.fillStyle(0x888888)
    g.fillCircle(100 * dpr, 80 * dpr, 50 * dpr)
    g.fillRect(50 * dpr, 140 * dpr, 100 * dpr, 150 * dpr)
    g.generateTexture('portrait_placeholder', 200 * dpr, 300 * dpr)

    g.destroy()
  }
}
