import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

// Step 1 of the campsite fire sequence.
// Player clicks 6 debris items to clear the fire pit area.
// Skipping (Move On before all 6 cleared) is always allowed —
// consequence is a higher drain rate in FireSustainMinigame.

const DEBRIS_COUNT = 6

export class FireClearMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireClearMinigame' })
  }

  init(data) {
    this.day = data?.day ?? 2
    this._debrisRemaining = DEBRIS_COUNT
    this._groundCleared = false
    this._firstDebrisClicked = false
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    this._buildBackground(W, H)
    this._buildFirePit(W, H)
    this._buildDebris(W, H)
    this._buildUI(W, H)
    this._buildDialogueBox(W, H)
    this._buildMoveOnButton(W, H)
  }

  // ── Background ────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    // Placeholder until BG-CAMPSITE-NIGHT art asset is loaded
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0f0a)

    this.add.text(W / 2, 28, `Day ${this.day} — Clear the camp`, {
      fontSize: '18px',
      fontFamily: 'Georgia, serif',
      fill: '#8a9a7a',
    }).setOrigin(0.5)
  }

  // ── Fire pit (placeholder) ─────────────────────────────────────────────────

  _buildFirePit(W, H) {
    this._pitX = W / 2
    this._pitY = H * 0.48

    // Pit base (placeholder rect; swap for FIREPIT-EMPTY sprite when available)
    this.add.circle(this._pitX, this._pitY, 60, 0x1a1208)
      .setStrokeStyle(2, 0x4a3a20)

    this.add.text(this._pitX, this._pitY, '🔥', {
      fontSize: '36px',
    }).setOrigin(0.5).setAlpha(0.25)

    // Rock ring — hidden until all debris cleared
    this._rockRing = this.add.circle(this._pitX, this._pitY, 76, 0x000000, 0)
      .setStrokeStyle(4, 0x7a6a50)
      .setVisible(false)
  }

  // ── Debris items ──────────────────────────────────────────────────────────

  _buildDebris(W, H) {
    const cx = this._pitX
    const cy = this._pitY

    // Place 6 debris items in a rough ring around the pit, avoiding overlap
    const positions = [
      { x: cx - 140, y: cy - 90 },
      { x: cx + 130, y: cy - 80 },
      { x: cx - 160, y: cy + 40 },
      { x: cx + 150, y: cy + 50 },
      { x: cx - 60,  y: cy + 120 },
      { x: cx + 80,  y: cy + 130 },
    ]

    const debrisTypes = [
      { tint: 0x7a6a40, size: 28, label: '🍂' }, // dry leaves
      { tint: 0x5a4a30, size: 18, label: '🌿' }, // twig
      { tint: 0x6a5a38, size: 32, label: '🍂' }, // leaves cluster
      { tint: 0x4a3a28, size: 22, label: '🌿' }, // twig
      { tint: 0x7a6040, size: 26, label: '🍂' }, // dry leaves
      { tint: 0x5a4838, size: 20, label: '🌿' }, // twig
    ]

    this._debrisObjects = []

    positions.forEach((pos, i) => {
      const type = debrisTypes[i]

      // Placeholder: circle + emoji text; replace with sprite when art available
      const circle = this.add.circle(pos.x, pos.y, type.size, type.tint)
        .setStrokeStyle(1, 0x9a8a60)
        .setInteractive({ useHandCursor: true })

      const icon = this.add.text(pos.x, pos.y, type.label, {
        fontSize: `${type.size}px`,
      }).setOrigin(0.5)

      // Hover highlight
      circle.on('pointerover', () => circle.setFillStyle(0xb0a070))
      circle.on('pointerout', () => circle.setFillStyle(type.tint))
      circle.on('pointerup', () => this._onDebrisClick(i, circle, icon))

      this._debrisObjects.push({ circle, icon, removed: false })
    })
  }

  // ── Counter + checkmark UI ────────────────────────────────────────────────

  _buildUI(W, H) {
    this._counterText = this.add.text(W / 2, 64, this._counterLabel(), {
      fontSize: '15px',
      fontFamily: 'monospace',
      fill: '#aaaaaa',
    }).setOrigin(0.5)

    this._checkmark = this.add.text(W / 2, 64, '✔  Area cleared', {
      fontSize: '15px',
      fontFamily: 'monospace',
      fill: '#7adf7a',
    }).setOrigin(0.5).setVisible(false)
  }

  // ── Dialogue box ─────────────────────────────────────────────────────────

  _buildDialogueBox(W, H) {
    const boxY = H * 0.88

    this._dialogueBg = this.add.rectangle(W / 2, boxY, W * 0.8, 52, 0x0d0a04, 0.88)
      .setStrokeStyle(1, 0x6b5020)
      .setVisible(false)

    this._dialogueText = this.add.text(W / 2, boxY, '', {
      fontSize: '15px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
      fill: '#f5e8c0',
      wordWrap: { width: W * 0.76 },
      align: 'center',
    }).setOrigin(0.5).setVisible(false)
  }

  // ── Move On button ────────────────────────────────────────────────────────

  _buildMoveOnButton(W, H) {
    const btnX = W - 100
    const btnY = H - 40

    const btn = this.add.rectangle(btnX, btnY, 160, 40, 0x2a2018)
      .setStrokeStyle(1, 0x7a6040)
      .setInteractive({ useHandCursor: true })

    this.add.text(btnX, btnY, 'Move On →', {
      fontSize: '15px',
      fontFamily: 'Georgia, serif',
      fill: '#c8b870',
    }).setOrigin(0.5)

    btn.on('pointerover', () => btn.setFillStyle(0x3a3028))
    btn.on('pointerout', () => btn.setFillStyle(0x2a2018))
    btn.on('pointerup', () => this._finish())
  }

  // ── Interaction ──────────────────────────────────────────────────────────

  _onDebrisClick(index, circle, icon) {
    const obj = this._debrisObjects[index]
    if (obj.removed) return

    // First debris: play Aiden line once
    if (!this._firstDebrisClicked) {
      this._firstDebrisClicked = true
      this._showDialogue('"Clear the area before lighting anything. Dry debris near a fire spreads fast."')
    }

    // Remove debris
    obj.removed = true
    circle.disableInteractive()
    circle.setVisible(false)
    icon.setVisible(false)

    this._debrisRemaining--
    this._counterText.setText(this._counterLabel())

    if (this._debrisRemaining === 0) {
      this._onAllCleared()
    }
  }

  _onAllCleared() {
    this._groundCleared = true

    // Show rock ring around pit
    this._rockRing.setVisible(true)

    // Swap counter for checkmark
    this._counterText.setVisible(false)
    this._checkmark.setVisible(true)

    // Brief delay then auto-finish — player has completed the step
    this.time.delayedCall(1200, () => this._finish())
  }

  _finish() {
    this.registry.set('groundCleared', this._groundCleared)

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_clear',
      success: true,
      score: this._groundCleared ? 1 : 0,
    })

    if (this.registry.get('devFireBuildChain')) {
      this.scene.stop()
      this.scene.start('FireCollectMinigame', { day: this.day })
      return
    }

    this.scene.stop()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _counterLabel() {
    return `Clear the area: ${this._debrisRemaining} remaining`
  }

  _showDialogue(text) {
    this._dialogueBg.setVisible(true)
    this._dialogueText.setText(text).setVisible(true)

    if (this._dialogueTimer) this._dialogueTimer.remove()
    this._dialogueTimer = this.time.delayedCall(4000, () => {
      this._dialogueText.setVisible(false)
      this._dialogueBg.setVisible(false)
    })
  }
}
