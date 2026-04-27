import Phaser from 'phaser'
import { gsap } from 'gsap'
import { GameEvents } from '../../../systems/GameEvents.js'

/**
 * FireMinigame
 * Dev B owns this file.
 *
 * Three phases:
 *   1. Material selection — pick dry vs wet materials
 *   2. Ignition timing — hit the sweet spot on a moving bar
 *   3. Sustain — keep fire alive by clicking to add fuel at the right time
 *
 * Difficulty controls:
 *   learn    — obvious dry/wet, wide timing window, no wind events
 *   practice — subtle distinction, medium window, wind events
 *   challenge — mostly wet materials, tight window, frequent wind events
 */
export class FireMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireMinigame' })
  }

  init(data) {
    this.day = data.day ?? 2
    this.difficulty = data.difficulty ?? 'learn'
    this._phase = 'material' // 'material' | 'ignition' | 'sustain' | 'result'
    this._selectedMaterials = []
    this._fireHealth = 0
    this._sustainTimer = null
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a).setAlpha(0.97)

    this._titleText = this.add.text(W / 2, 40, `生火 — Day ${this.day}`, {
      fontSize: '22px', fontFamily: 'serif', color: '#cc8844',
    }).setOrigin(0.5)

    this._instructionText = this.add.text(W / 2, 72, '选择引火材料（选出3个）', {
      fontSize: '16px', fontFamily: 'monospace', color: '#666666',
    }).setOrigin(0.5)

    this._buildMaterialPhase(W, H)

    // Fade in
    this.cameras.main.setAlpha(0)
    gsap.to(this.cameras.main, { alpha: 1, duration: 0.5 })
  }

  // ── Phase 1: Material selection ──────────────────────────────────────────

  _buildMaterialPhase(W, H) {
    const config = this._getDifficultyConfig()
    this._materials = this._generateMaterials(config)
    this._materialContainer = this.add.container(W / 2, H / 2)
    this._selectedCount = 0
    this._selectConfirmBtn = null

    const cols = 4
    const itemW = 120
    const itemH = 100
    const gapX = 20
    const gapY = 20
    const totalW = cols * itemW + (cols - 1) * gapX
    const startX = -totalW / 2

    this._materials.forEach((mat, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * (itemW + gapX) + itemW / 2
      const y = -(itemH + gapY) + row * (itemH + gapY)

      const card = this.add.rectangle(x, y, itemW, itemH, 0x111111)
        .setStrokeStyle(1, 0x333333)
      const label = this.add.text(x, y - 16, mat.icon, {
        fontSize: '28px',
      }).setOrigin(0.5)
      const desc = this.add.text(x, y + 20, mat.name, {
        fontSize: '12px', fontFamily: 'monospace', color: '#888888',
        align: 'center', wordWrap: { width: itemW - 8 },
      }).setOrigin(0.5, 0)

      this._materialContainer.add([card, label, desc])

      card.setInteractive({ useHandCursor: true })
      card.on('pointerup', () => this._toggleMaterial(mat, card, desc))
    })

    // Confirm button (shown once 3 selected)
    this._matConfirmBtn = this.add.text(0, 140, '[ 开始生火 ]', {
      fontSize: '20px', fontFamily: 'monospace', color: '#444444',
    }).setOrigin(0.5)
    this._materialContainer.add(this._matConfirmBtn)
  }

  _generateMaterials(config) {
    // icon: emoji placeholder — replace with sprites
    const dryOptions = [
      { id: 'dry_bark', name: '干树皮', icon: '🪵', dry: true },
      { id: 'dry_grass', name: '枯草', icon: '🌾', dry: true },
      { id: 'pine_needles', name: '松针', icon: '🌿', dry: true },
      { id: 'dry_leaves', name: '干叶', icon: '🍂', dry: true },
    ]
    const wetOptions = [
      { id: 'wet_bark', name: '湿树皮', icon: '🌲', dry: false },
      { id: 'wet_moss', name: '苔藓', icon: '🌱', dry: false },
      { id: 'green_branch', name: '青枝', icon: '🌿', dry: false },
      { id: 'snow_log', name: '雪木', icon: '🧊', dry: false },
    ]

    // Difficulty: ratio of wet to dry items shown
    const dryCount = config.dryMaterialCount
    const wetCount = 8 - dryCount

    const dry = Phaser.Utils.Array.Shuffle([...dryOptions]).slice(0, dryCount)
    const wet = Phaser.Utils.Array.Shuffle([...wetOptions]).slice(0, wetCount)

    return Phaser.Utils.Array.Shuffle([...dry, ...wet])
  }

  _toggleMaterial(mat, card, desc) {
    if (mat.selected) {
      mat.selected = false
      this._selectedCount--
      card.setFillColor(0x111111).setStrokeStyle(1, 0x333333)
      desc.setColor('#888888')
    } else {
      if (this._selectedCount >= 3) return // limit
      mat.selected = true
      this._selectedCount++
      const color = mat.dry ? 0x1a2a0a : 0x2a0a0a
      const stroke = mat.dry ? 0x66aa44 : 0xaa4444
      card.setFillColor(color).setStrokeStyle(2, stroke)
      desc.setColor(mat.dry ? '#aaffaa' : '#ffaaaa')
    }

    // Show/hide confirm
    if (this._selectedCount === 3) {
      this._matConfirmBtn.setColor('#ffcc88').setInteractive({ useHandCursor: true })
      this._matConfirmBtn.removeAllListeners('pointerup')
      this._matConfirmBtn.on('pointerup', () => {
        const drySelected = this._materials.filter(m => m.selected && m.dry).length
        this._materialContainer.destroy()
        this._startIgnitionPhase(drySelected)
      })
    } else {
      this._matConfirmBtn.setColor('#444444').removeInteractive()
    }
  }

  // ── Phase 2: Ignition timing ─────────────────────────────────────────────

  _startIgnitionPhase(dryCount) {
    const W = this.scale.width
    const H = this.scale.height
    const config = this._getDifficultyConfig()

    this._instructionText.setText('等待时机，点击点火！')
    this._phase = 'ignition'

    // Build timing bar
    const barW = 500
    const barH = 24
    const barX = W / 2 - barW / 2
    const barY = H / 2

    // Track background
    this.add.rectangle(W / 2, barY, barW, barH, 0x222222)

    // Sweet zone (green)
    const zoneW = barW * config.timingWindow
    const zoneX = barX + (barW - zoneW) / 2
    this._sweetZone = this.add.rectangle(
      zoneX + zoneW / 2, barY, zoneW, barH, 0x226622, 0.6
    ).setOrigin(0.5)

    // Moving cursor
    this._cursor = this.add.rectangle(barX, barY, 6, barH + 8, 0xffffff)
      .setOrigin(0, 0.5)

    // Animate cursor back and forth
    const duration = config.cursorSpeed
    gsap.to(this._cursor, {
      x: barX + barW - 6,
      duration,
      ease: 'none',
      repeat: -1,
      yoyo: true,
    })

    // Dry material bonus — widen sweet zone slightly
    if (dryCount >= 2) {
      this._sweetZone.setSize(zoneW * 1.3, barH)
    }

    // Click to fire
    const hitZone = this.add.rectangle(W / 2, barY, barW, barH + 20, 0x000000, 0)
      .setInteractive({ useHandCursor: true })

    hitZone.on('pointerup', () => {
      const cursorX = this._cursor.x
      const inZone = cursorX >= zoneX && cursorX <= zoneX + zoneW
      gsap.killTweensOf(this._cursor)
      hitZone.removeInteractive()
      this._phase = 'sustain'

      if (inZone) {
        this._fireHealth = 50 + dryCount * 10 // better materials = higher start
        this._startSustainPhase(W, H, true)
      } else {
        // Miss — deduct stamina, allow retry or fail
        const stamina = this.registry.get('stamina')
        const alive = stamina?.deduct(1) ?? true
        if (alive) {
          this.time.delayedCall(800, () => this._startIgnitionPhase(dryCount))
          this._instructionText.setText('没打着。再试一次…')
        } else {
          this._endMinigame(false)
        }
      }
    })
  }

  // ── Phase 3: Sustain ─────────────────────────────────────────────────────

  _startSustainPhase(W, H, ignited) {
    const config = this._getDifficultyConfig()
    this._instructionText.setText('维持火焰！点击加柴')

    // Fire health bar
    const barW = 300
    this._fireBarBg = this.add.rectangle(W / 2, H / 2 + 100, barW, 20, 0x222222)
    this._fireBarFill = this.add.rectangle(
      W / 2 - barW / 2, H / 2 + 100, barW * (this._fireHealth / 100), 20, 0xff6600
    ).setOrigin(0, 0.5)

    // Flame visual (placeholder)
    this._flameVisual = this.add.text(W / 2, H / 2 + 40, '🔥', {
      fontSize: '64px',
    }).setOrigin(0.5)

    // Decay loop
    this._decayTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this._fireHealth -= config.decayRate
        this._fireHealth = Math.max(0, this._fireHealth)
        this._updateFireBar(barW)

        if (this._fireHealth <= 0) {
          this._decayTimer.remove()
          const stamina = this.registry.get('stamina')
          stamina?.deduct(2)
          this._endMinigame(false)
        }
      },
    })

    // Wind events (practice+)
    if (config.windEvents) {
      this._scheduleWindEvent(W, H, config)
    }

    // Add fuel button
    const fuelBtn = this.add.text(W / 2, H / 2 + 160, '[ 加柴 ]', {
      fontSize: '22px', fontFamily: 'monospace', color: '#ffaa44',
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this._fireHealth = Math.min(100, this._fireHealth + 20)
        this._updateFireBar(barW)
      })

    // Auto-succeed after sustain duration
    this._sustainTimer = this.time.delayedCall(config.sustainDuration, () => {
      this._decayTimer?.remove()
      this._endMinigame(true)
    })
  }

  _updateFireBar(barW) {
    const fill = barW * (this._fireHealth / 100)
    gsap.to(this._fireBarFill, { width: fill, duration: 0.2 })

    // Color feedback
    if (this._fireHealth > 60) this._fireBarFill.setFillColor(0xff6600)
    else if (this._fireHealth > 30) this._fireBarFill.setFillColor(0xffaa00)
    else this._fireBarFill.setFillColor(0xff2200)
  }

  _scheduleWindEvent(W, H, config) {
    this.time.delayedCall(
      Phaser.Math.Between(3000, 6000),
      () => {
        if (this._phase !== 'sustain') return
        // Wind gust — drain fire faster temporarily
        const overlay = this.add.text(W / 2, H / 2 - 40, '💨 风！', {
          fontSize: '28px', fontFamily: 'serif', color: '#aaaaff',
        }).setOrigin(0.5)

        gsap.to(overlay, {
          alpha: 0, duration: 1.5, delay: 1,
          onComplete: () => overlay.destroy(),
        })

        this._fireHealth -= config.windDamage
        this._fireHealth = Math.max(0, this._fireHealth)
        this._updateFireBar(300)

        // Schedule next wind
        if (this._phase === 'sustain') this._scheduleWindEvent(W, H, config)
      }
    )
  }

  // ── End ──────────────────────────────────────────────────────────────────

  _endMinigame(success) {
    this._phase = 'result'
    gsap.to(this.cameras.main, {
      alpha: 0,
      duration: 0.5,
      onComplete: () => {
        this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
          id: 'fire',
          success,
          score: success ? Math.round(this._fireHealth) : 0,
        })
        this.scene.stop('FireMinigame')
      },
    })
  }

  // ── Difficulty config ────────────────────────────────────────────────────

  _getDifficultyConfig() {
    return {
      learn: {
        dryMaterialCount: 3,  // 3 dry out of 8 visible
        timingWindow: 0.35,   // 35% of bar is sweet zone
        cursorSpeed: 3,       // seconds per pass
        decayRate: 8,
        sustainDuration: 8000,
        windEvents: false,
        windDamage: 0,
      },
      practice: {
        dryMaterialCount: 2,
        timingWindow: 0.22,
        cursorSpeed: 2.2,
        decayRate: 12,
        sustainDuration: 10000,
        windEvents: true,
        windDamage: 15,
      },
      challenge: {
        dryMaterialCount: 1,
        timingWindow: 0.14,
        cursorSpeed: 1.5,
        decayRate: 18,
        sustainDuration: 12000,
        windEvents: true,
        windDamage: 25,
      },
    }[this.difficulty] ?? {}
  }
}
