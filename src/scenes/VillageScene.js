import Phaser from 'phaser'
import { GameEvents } from '../systems/GameEvents.js'

/**
 * VillageScene
 * Launched (as an overlay) when InkBridge emits SCENE_CHANGE { key: 'village_hub' }.
 *
 * Displays the three NPCs as clickable portrait cards.
 * Emits VILLAGE_NPC_CLICKED or VILLAGE_LEAVE back to NarrativeScene.
 */
export class VillageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VillageScene' })
    this._talkStates = {}
  }

  init(data) {
    this._talkStates = data?.talkStates ?? {}
  }

  create() {
    const W   = this.scale.width
    const H   = this.scale.height
    const dpr = window.devicePixelRatio || 1
    console.log('[VillageScene] create — W:', W, 'H:', H, 'dpr:', dpr)
    console.log('[VillageScene] textures — mara:', this.textures.exists('portrait_mara'), 'finn:', this.textures.exists('portrait_finn'), 'isla:', this.textures.exists('portrait_isla'))

    // ── Background ───────────────────────────────────────────────────────
    this._bg = this.add.image(W / 2, H / 2, 'bg_village_morning')
      .setDisplaySize(W * 1.21, H * 1.21)

    // Dark overlay to unify the mood
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65)

    // ── NPC definitions ──────────────────────────────────────────────────
    const dprScale = dpr
    const npcs = [
      { id: 'mara',  key: 'portrait_mara', x: W * 0.075,  ox: 0,   label: 'Mara',  sub: 'Hunter',        talkedVar: 'talked_to_mara'  },
      { id: 'finn',  key: 'portrait_finn', x: W * 0.500,  ox: 0.5, label: 'Finn',  sub: 'Woodcutter',     talkedVar: 'talked_to_finn'  },
      { id: 'isla',  key: 'portrait_isla', x: W * 0.850,  ox: 0.5, label: 'Isla',  sub: 'Village Elder',  talkedVar: 'talked_to_isla'  },
    ]

    const maxPortraitH = 420 * dprScale
    const portraitY    = H * 0.702

    npcs.forEach(npc => {
      // ── Portrait image ─────────────────────────────────────────────────
      const img = this.add.image(npc.x, portraitY, npc.key)
        .setOrigin(npc.ox, 1)

      // Scale to max height 420 px
      const scale = Math.min(maxPortraitH / img.height, maxPortraitH / img.height)
      img.setScale(scale)
      console.log('[VillageScene]', npc.id, '— x:', npc.x, 'y:', portraitY, 'imgH:', img.height, 'scale:', scale.toFixed(3), 'displayH:', img.displayHeight.toFixed(0))

      // Center x for the name-tag: if origin is left-edge (ox=0), offset by half display width
      const cardCenterX = npc.ox === 0 ? npc.x + img.displayWidth / 2 : npc.x

      // Check if player has already spoken to this NPC
      const alreadyTalked = this._talkStates[npc.id] === true
      if (alreadyTalked) img.setTint(0x888888)

      // ── Name-tag card ──────────────────────────────────────────────────
      const cardY  = portraitY + 18 * dprScale
      const cardW  = 200 * dprScale
      const cardH  = 52 * dprScale
      this.add.rectangle(cardCenterX, cardY, cardW, cardH, 0x0d0a06, 0.85)
        .setStrokeStyle(1 * dprScale, 0xc4a060, 0.6)
      this.add.text(cardCenterX, cardY - 8 * dprScale, npc.label, {
        fontFamily: 'Georgia, serif',
        fontSize:   `${16 * dprScale}px`,
        color:      '#c4a060',
      }).setOrigin(0.5, 0.5)
      this.add.text(cardCenterX, cardY + 10 * dprScale, npc.sub, {
        fontFamily: 'Georgia, serif',
        fontSize:   `${12 * dprScale}px`,
        color:      '#8a6a40',
      }).setOrigin(0.5, 0.5)

      // ── Click interaction ──────────────────────────────────────────────
      img.setInteractive({ useHandCursor: true })

      img.on('pointerover', () => {
        if (!img.isTinted || img.tintTopLeft !== 0x888888) {
          this.tweens.add({ targets: img, alpha: 0.85, duration: 120 })
        }
      })
      img.on('pointerout', () => {
        this.tweens.add({ targets: img, alpha: 1, duration: 120 })
      })
      img.on('pointerup', () => {
        img.setTint(0x888888)
        this.game.events.emit(GameEvents.VILLAGE_NPC_CLICKED, { id: npc.id })
      })
    })

    // ── "Head out →" button ───────────────────────────────────────────────
    const btnW = 520 * dprScale
    const btnH = 52 * dprScale
    const btnX = W / 2
    const btnY = H - 60 * dprScale - H * 0.10

    const btnBg = this.add.rectangle(btnX, btnY, btnW, btnH, 0x0d0a06, 0.88)
      .setStrokeStyle(1 * dprScale, 0xc4a060, 0.6)
      .setInteractive({ useHandCursor: true })

    const btnLabel = this.add.text(btnX, btnY, 'I have learned enough. Time to head out.', {
      fontFamily: 'Georgia, serif',
      fontSize:   `${17 * dprScale}px`,
      color:      '#c4a060',
    }).setOrigin(0.5, 0.5)

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x2a1f0e, 0.95)
      btnLabel.setColor('#f0d890')
    })
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x0d0a06, 0.88)
      btnLabel.setColor('#c4a060')
    })
    btnBg.on('pointerup', () => {
      this.game.events.emit(GameEvents.VILLAGE_LEAVE)
    })
  }
}
