import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.js'
import { OnboardingScene } from './scenes/OnboardingScene.js'
import { NarrativeScene } from './scenes/narrative/NarrativeScene.js'
import { MapScene } from './scenes/MapScene.js'
import { CampsiteMinigame } from './scenes/minigames/campsite/CampsiteMinigame.js'
import { FireMinigame } from './scenes/minigames/fire/FireMinigame.js'
import { FireCollectMinigame } from './scenes/minigames/fire/FireCollectMinigame.js'
import { FireClearMinigame } from './scenes/minigames/fire/FireClearMinigame.js'
import { FireSortMinigame } from './scenes/minigames/fire/FireSortMinigame.js'
import { FireIgniteMinigame } from './scenes/minigames/fire/FireIgniteMinigame.js'
import { FireSustainMinigame } from './scenes/minigames/fire/FireSustainMinigame.js'
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
  scene: [
    BootScene, OnboardingScene, NarrativeScene, MapScene,
    CampsiteMinigame,
    FireMinigame,
    FireCollectMinigame, FireClearMinigame, FireSortMinigame,
    FireIgniteMinigame, FireSustainMinigame,
    HUDScene, DebugScene,
  ],
}

const game = new Phaser.Game(config)
export default game
