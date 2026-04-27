import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.js'
import { NarrativeScene } from './scenes/narrative/NarrativeScene.js'
import { CampsiteMinigame } from './scenes/minigames/campsite/CampsiteMinigame.js'
import { FireMinigame } from './scenes/minigames/fire/FireMinigame.js'
import { HUDScene } from './scenes/HUDScene.js'

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0a0a0a',
  parent: document.body,
  scene: [
    BootScene,
    NarrativeScene,
    CampsiteMinigame,
    FireMinigame,
    HUDScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

const game = new Phaser.Game(config)
export default game
