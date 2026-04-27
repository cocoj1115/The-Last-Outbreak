import Phaser from 'phaser'
import { gsap } from 'gsap'
import { GameEvents } from '../../../systems/GameEvents.js'

/**
 * CampsiteMinigame
 * Dev B owns this file.
 *
 * Player evaluates 3 campsite candidates across 4 dimensions:
 *   ground / water / wind / overhead
 *
 * Launched by NarrativeScene via MINIGAME_TRIGGER { id:'campsite', day, difficulty }
 * Emits MINIGAME_COMPLETE { id:'campsite', success:bool, score:number } when done.
 *
 * Data passed in via this.scene.settings.data (the second arg to scene.launch)
 */
export class CampsiteMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'CampsiteMinigame' })
  }

  init(data) {
    this.day = data.day ?? 1
    this.difficulty = data.difficulty ?? 'learn'
    this._selected = null
    this._sites = []
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // ── Background tint ──────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a1a0a).setAlpha(0.95)

    // ── Title ────────────────────────────────────────────────────────────
    this.add.text(W / 2, 40, `扎营 — Day ${this.day}`, {
      fontSize: '22px',
      fontFamily: 'serif',
      color: '#aaaaaa',
    }).setOrigin(0.5)

    this.add.text(W / 2, 72, '选择你的营地', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#666666',
    }).setOrigin(0.5)

    // ── Build site cards ─────────────────────────────────────────────────
    this._sites = this._buildSiteData(this.difficulty)
    this._renderSites(W, H)

    // ── Confirm button (disabled until selection) ────────────────────────
    this._confirmBtn = this.add.text(W / 2, H - 50, '[ 确认营地 ]', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#444444',
    })
      .setOrigin(0.5)

    // Fade in
    this.cameras.main.setAlpha(0)
    gsap.to(this.cameras.main, { alpha: 1, duration: 0.5 })
  }

  // ── Site data by difficulty ──────────────────────────────────────────────

  _buildSiteData(difficulty) {
    // Each site has ratings for ground/water/wind/overhead and a quality score
    // quality: 'good' | 'ok' | 'bad'
    const sets = {
      learn: [
        {
          id: 'A',
          label: '高地平坦处',
          clues: ['地面干燥平坦', '远离水源 15m', '自然挡风树丛', '树冠茂密'],
          quality: 'good',
          score: 90,
        },
        {
          id: 'B',
          label: '水边空地',
          clues: ['地面较潮湿', '紧靠溪流', '无挡风遮蔽', '头顶无遮挡'],
          quality: 'ok',
          score: 50,
        },
        {
          id: 'C',
          label: '低洼凹地',
          clues: ['地面有积水迹象', '低洼集水', '挡风效果好', '头顶枯枝多'],
          quality: 'bad',
          score: 20,
        },
      ],
      practice: [
        // Day 2: starts fine, rain changes everything — bad/good reversal
        {
          id: 'A',
          label: '高地坡面',
          clues: ['地面倾斜', '排水良好', '中等挡风', '树冠稀疏'],
          quality: 'good',
          score: 80,
        },
        {
          id: 'B',
          label: '低洼平坦处',
          clues: ['地面平坦', '靠近水源', '挡风佳', '头顶无枯枝'],
          quality: 'bad', // becomes bad when rain starts
          score: 30,
        },
        {
          id: 'C',
          label: '岩石背面',
          clues: ['地面碎石', '距水源 20m', '极佳挡风', '无头顶遮挡'],
          quality: 'ok',
          score: 60,
        },
      ],
      challenge: [
        // Day 4: all flawed — pick least bad
        {
          id: 'A',
          label: '山坡雪地',
          clues: ['地面结冰', '无水源（冻住）', '挡风一般', '树冠密'],
          quality: 'ok',
          score: 55,
        },
        {
          id: 'B',
          label: '峡谷入口',
          clues: ['地面较平', '有雪水', '风道直吹', '头顶安全'],
          quality: 'bad',
          score: 25,
        },
        {
          id: 'C',
          label: '大石背风处',
          clues: ['地面结冰', '无水源', '极佳挡风', '能见度低'],
          quality: 'ok',
          score: 65,
        },
      ],
    }
    return sets[difficulty] ?? sets.learn
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _renderSites(W, H) {
    const cardW = 280
    const cardH = 260
    const gap = 40
    const totalW = 3 * cardW + 2 * gap
    const startX = (W - totalW) / 2

    this._sites.forEach((site, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2
      const cy = H / 2

      const card = this._buildCard(cx, cy, cardW, cardH, site)
      this._sites[i]._card = card
    })
  }

  _buildCard(cx, cy, w, h, site) {
    const container = this.add.container(cx, cy)

    // Background
    const bg = this.add.rectangle(0, 0, w, h, 0x111111)
      .setStrokeStyle(1, 0x333333)
    container.add(bg)

    // Label
    const label = this.add.text(0, -h / 2 + 24, site.label, {
      fontSize: '18px',
      fontFamily: 'serif',
      color: '#dddddd',
    }).setOrigin(0.5)
    container.add(label)

    // Clue lines
    site.clues.forEach((clue, j) => {
      const t = this.add.text(0, -h / 2 + 60 + j * 36, `· ${clue}`, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#888888',
        wordWrap: { width: w - 24 },
      }).setOrigin(0.5, 0)
      container.add(t)
    })

    // Select interaction
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerover', () => {
      if (this._selected !== site.id) bg.setFillColor(0x1a1a1a)
    })
    bg.on('pointerout', () => {
      if (this._selected !== site.id) bg.setFillColor(0x111111)
    })
    bg.on('pointerup', () => this._selectSite(site, container, bg))

    // Animate in
    container.setAlpha(0)
    gsap.to(container, { alpha: 1, duration: 0.4, delay: 0.1 * site.id.charCodeAt(0) % 3 })

    return container
  }

  _selectSite(site, container, bg) {
    // Deselect all
    this._sites.forEach(s => {
      if (s._card) {
        const oldBg = s._card.getAt(0)
        oldBg.setFillColor(0x111111).setStrokeStyle(1, 0x333333)
      }
    })

    // Select this one
    bg.setFillColor(0x1a2a1a).setStrokeStyle(2, 0x44aa44)
    this._selected = site.id
    this._selectedSite = site

    // Enable confirm button
    this._confirmBtn
      .setColor('#aaffaa')
      .setInteractive({ useHandCursor: true })
      .removeAllListeners('pointerup')
      .on('pointerup', () => this._confirm())
  }

  _confirm() {
    if (!this._selectedSite) return

    const site = this._selectedSite
    const success = site.quality !== 'bad'

    // Stamina deduction for bad choice
    if (site.quality === 'bad') {
      const stamina = this.registry.get('stamina')
      stamina?.deduct(2)
    }

    // Fade out then return
    gsap.to(this.cameras.main, {
      alpha: 0,
      duration: 0.4,
      onComplete: () => {
        this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
          id: 'campsite',
          success,
          score: site.score,
        })
        this.scene.stop('CampsiteMinigame')
      },
    })
  }
}
