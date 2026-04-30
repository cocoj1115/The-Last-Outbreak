import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.js'
import { OnboardingScene } from './scenes/OnboardingScene.js'
import { NarrativeScene } from './scenes/narrative/NarrativeScene.js'
import { VillageScene } from './scenes/VillageScene.js'
import { MapScene } from './scenes/MapScene.js'
import { CampsiteMinigame } from './scenes/minigames/campsite/CampsiteMinigame.js'
import { FireCollectMinigame } from './scenes/minigames/fire/FireCollectMinigame.js'
import { FireCampsiteMinigame } from './scenes/minigames/fire/FireCampsiteMinigame.js'
import { HUDScene } from './scenes/HUDScene.js'
import { DebugScene } from './scenes/DebugScene.js'

const dpr = window.devicePixelRatio || 1

const config = {
  type: Phaser.AUTO,
  width: 1280 * dpr,
  height: 720 * dpr,
  backgroundColor: '#1a1008',
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280 * dpr,
    height: 720 * dpr,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    resolution: dpr,
  },
  scene: [BootScene, OnboardingScene, NarrativeScene, VillageScene, MapScene, CampsiteMinigame, FireCollectMinigame, FireCampsiteMinigame, HUDScene, DebugScene],
}

const game = new Phaser.Game(config)
export default game
