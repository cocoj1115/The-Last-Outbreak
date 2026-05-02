import Phaser from 'phaser'
import { gsap } from 'gsap'
import { GameEvents } from '../../../systems/GameEvents.js'

const EASY_CONFIG = {
  textureKey: 'd2_shimmerleaf_center',
  x: 0.5,
  y: 0.45,
  hitSize: 140,
  glowScale: 1.15,
  glowAlpha: 0.9,
  pulseDuration: 1.2,
}

const HARD_CONFIG = {
  textureKey: 'd2_shimmerleaf_edge',
  x: 0.88,
  y: 0.55,
  hitSize: 60,
  glowScale: 1.12,
  glowAlpha: 0.55,
  pulseDuration: 1.6,
}

export class SearchMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'SearchMinigame' })
    this._day = 2
    this._difficulty = 'easy'
    this._plantTween = null
  }

  init(data) {
    this._day = data.day ?? 2
    this._difficulty = data.difficulty ?? 'easy'
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height
    const dpr = window.devicePixelRatio || 1

    // Background
    this.add.image(W / 2, H / 2, 'd2_bg_search').setDisplaySize(W, H)

    // Dark overlay to match narrative tone
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35)

    // Aiden portrait — bottom right, matching NarrativeScene placement
    if (this.textures.exists('portrait_aiden')) {
      const portrait = this.add.image(W * 0.82, H, 'portrait_aiden').setOrigin(0, 1)
      const scaleW = (W * 0.22) / portrait.width
      const scaleH = (H * 0.72) / portrait.height
      portrait.setScale(Math.min(scaleW, scaleH))
    }

    this._buildPlant(W, H, dpr)
  }

  _buildPlant(W, H, dpr) {
    const cfg = this._difficulty === 'hard' ? HARD_CONFIG : EASY_CONFIG

    const plant = this.add.image(W * cfg.x, H * cfg.y, cfg.textureKey)

    // Scale so the texture fits within the target hit size
    const scaleX = (cfg.hitSize * dpr) / plant.width
    const scaleY = (cfg.hitSize * dpr) / plant.height
    const baseScale = Math.min(scaleX, scaleY)
    plant.setScale(baseScale)

    // Invisible interactive zone centred on the plant
    const zone = this.add.zone(W * cfg.x, H * cfg.y, cfg.hitSize * dpr, cfg.hitSize * dpr)
      .setInteractive({ useHandCursor: true })

    // Glow pulse via gsap
    this._plantTween = gsap.to(plant, {
      scaleX: baseScale * cfg.glowScale,
      scaleY: baseScale * cfg.glowScale,
      alpha: cfg.glowAlpha,
      duration: cfg.pulseDuration,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })

    zone.on('pointerup', () => this._onFound())
  }

  _onFound() {
    if (this._plantTween) {
      this._plantTween.kill()
      this._plantTween = null
    }
    gsap.to(this.cameras.main, {
      alpha: 0, duration: 0.4,
      onComplete: () => {
        console.log('[SearchMinigame] emitting MINIGAME_COMPLETE success:true')
        this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
          id: 'search',
          success: true,
          staminaDepleted: false,
        })
        this.scene.stop('SearchMinigame')
      },
    })
  }
}
