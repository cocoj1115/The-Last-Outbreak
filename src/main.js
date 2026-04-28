import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.js'
import { NarrativeScene } from './scenes/narrative/NarrativeScene.js'
import { CampsiteMinigame } from './scenes/minigames/campsite/CampsiteMinigame.js'
import { FireMinigame } from './scenes/minigames/fire/FireMinigame.js'
import { HUDScene } from './scenes/HUDScene.js'

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
  scene: [BootScene, NarrativeScene, CampsiteMinigame, FireMinigame, HUDScene],
}

const game = new Phaser.Game(config)
export default game
