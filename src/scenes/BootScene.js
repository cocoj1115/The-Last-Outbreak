import Phaser from 'phaser'
import { GameEvents } from '../systems/GameEvents.js'
import {
  DEV_MOCK_DAY2_FIRE,
  seedDay2FireMockRegistry,
  resolveDay2FireMockEntryScene,
  getDay2FireMockBootPayload,
} from '../dev/day2FireMock.js'
import {
  DEV_MOCK_FIRE_BUILDING,
  seedFireBuildingMockRegistry,
  getFireBuildingMockPayload,
} from './minigames/fire/New/day2FireBuildingMock.js'
import { FIRE_CAMPSITE_SCENE_KEY } from './minigames/fire/New/fireSceneKeys.js'
import { StaminaSystem } from '../systems/StaminaSystem.js'
import { DaySystem } from '../systems/DaySystem.js'

/**
 * Optional: jump straight to FireCollect (forest) with stub Ink; does not use day2FireMock.
 * Keep false when using `DEV_MOCK_DAY2_FIRE` in `day2FireMock.js` (recommended for Day2 campsite V2).
 */
const DEV_PATH_B_DAY2_FIRE = false

/**
 * Minimal stub so fire minigames can read Ink variables without NarrativeScene.
 */
function createInkBridgeStub() {
  const _vars = {
    campsite_quality: 'good',
    mg_fire_collect_score: 'EASY',
  }
  return {
    getVariable(name) {
      return _vars[name]
    },
    setVariable(name, value) {
      _vars[name] = value
    },
  }
}

/**
 * BootScene
 * Loads all assets, initialises global systems, then hands off to NarrativeScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    const dpr = window.devicePixelRatio || 1
    const { width, height } = this.scale
    const bar = this.add.rectangle(width / 2, height / 2, 4 * dpr, 4 * dpr, 0x888888)
    this.add.rectangle(width / 2, height / 2, 400 * dpr, 4 * dpr, 0x333333)

    this.load.on('progress', (value) => {
      bar.setSize(400 * dpr * value, 4 * dpr)
    })

    const _fontLink = document.createElement('link')
    _fontLink.rel = 'stylesheet'
    _fontLink.href =
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=IM+Fell+English&display=swap'
    document.head.appendChild(_fontLink)

    this.load.image('onboarding1', 'assets/onboarding1.webp')
    this.load.image('dialog_box', 'assets/dialog_box.webp')
    this.load.image('dialogue_card', 'assets/dialogue_card.webp')
    this.load.image('maincharacter', 'assets/maincharacter-default2.webp')
    this.load.image('bg_background1', 'assets/background1.webp')
    this.load.image('bg_background2', 'assets/background2.webp')
    this.load.image('bg_village_morning', 'assets/village-bright-morning.webp')
    this.load.image('bg_village_day1',    'assets/village-bright-morning.webp')
    this.load.image('bg_forest_day2',     'assets/village-bright-morning.webp')
    this.load.image('bg_path_to_forest',  'assets/path to forest.webp')
    this.load.image('bg_forest_overview', 'assets/d2_bg_forest_overview.webp')
    this.load.image('bg_site_a',          'assets/d2_bg_site_a.webp')
    this.load.image('bg_site_b',          'assets/d2_bg_site_b.webp')
    this.load.image('bg_site_a_rain',     'assets/d2_bg_site_a_rain.webp')
    this.load.image('bg_site_b_rain',     'assets/d2_bg_site_b_rain.webp')
    this.load.image('d3_bg_forest_overview', 'assets/d3_bg_forest_overview.webp')
    this.load.image('d3_bg_site_a',          'assets/d3_bg_site_a.webp')
    this.load.image('d3_bg_site_b',          'assets/d3_bg_site_b.webp')
    this.load.image('d3_bg_site_a_rain',     'assets/d3_bg_site_a_rain.webp')
    this.load.image('d3_bg_site_b_rain',     'assets/d3_bg_site_b_rain.webp')
    this.load.image('bg_path_petra',      'assets/bg_path_Petra.webp')
    this.load.image('bg_ending_good',     'assets/bg_ending_good.png')
    this.load.image('bg_ending_bad',      'assets/bg_ending_bad.png')
    this.load.image('char_sleeping', 'assets/main-character-sleeping.webp')
    this.load.image('bg_map', 'assets/map_all.webp')
    this.load.image('map_village', 'assets/map_village.webp')
    this.load.image('portrait_mara',  'assets/NPC_Mara.webp')
    this.load.image('portrait_finn',  'assets/NPC_Finn.webp')
    this.load.image('portrait_isla',  'assets/NPC_Isla.webp')
    this.load.image('portrait_petra', 'assets/NPC_Petra2.webp')
    this.load.image('portrait_aiden',       'assets/main character-thinking.webp')
    this.load.image('portrait_aiden_happy', 'assets/main-character-happy.webp')

    this.load.json('story', 'assets/story/main.ink.json')

    this._createPlaceholderTextures()
  }

  create() {
    const stamina = new StaminaSystem(this.game.events)
    const days = new DaySystem(this.game.events)

    this.registry.set('stamina', stamina)
    this.registry.set('days', days)

    this.game.events.emit(GameEvents.GAME_READY)
    this.scene.launch('DebugScene')

    // Pre-warm the WebGL glow shader so MapScene doesn't stall on first use.
    // Must be on-screen (even at near-zero alpha) to actually enter the render pipeline.
    const _warmup = this.add.circle(1, 1, 1, 0xc49850, 0.01).setDepth(-999)
    _warmup.postFX.addGlow(0xc49850, 6, 0, false, 0.1, 16)
    this.time.delayedCall(500, () => _warmup.destroy())

    if (DEV_PATH_B_DAY2_FIRE) {
      this.registry.set('inkBridge', createInkBridgeStub())
      this.registry.set('fuelStock', 5)
      /** Collect only: after pack full, jumps per FireCollectMinigame (quick → ignite step in campsite). */
      this.registry.set('devQuickFireChain', true)
      this.scene.start('FireCollectMinigame', { day: 2 })
      return
    }

    if (DEV_MOCK_DAY2_FIRE) {
      seedDay2FireMockRegistry(this.registry)
      this.scene.launch('HUDScene')
      this.scene.start(resolveDay2FireMockEntryScene(), getDay2FireMockBootPayload())
      return
    }

    if (DEV_MOCK_FIRE_BUILDING) {
      seedFireBuildingMockRegistry(this.registry)
      this.scene.launch('HUDScene')
      const payload = getFireBuildingMockPayload()
      // `collect` lives in FireBuildingCollect — campsite flow scene key is FireCampsiteMinigame.
      if (payload.startStep === 'collect') {
        this.registry.set('devFireBuildChain', true)
        this.scene.start('FireBuildingCollect', { day: payload.day })
      } else {
        this.scene.start(FIRE_CAMPSITE_SCENE_KEY, payload)
      }
      return
    }

    this.scene.start('OnboardingScene')
  }

  _createPlaceholderTextures() {
    const dpr = window.devicePixelRatio || 1
    const g = this.make.graphics({ x: 0, y: 0, add: false })

    g.fillStyle(0x1a2a1a)
    g.fillRect(0, 0, 1280 * dpr, 720 * dpr)
    g.generateTexture('bg_placeholder', 1280 * dpr, 720 * dpr)

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
