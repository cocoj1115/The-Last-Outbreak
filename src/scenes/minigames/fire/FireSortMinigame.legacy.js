import Phaser from 'phaser'
import { GameEvents } from '../../../systems/GameEvents.js'

// ─── Sort configuration ───────────────────────────────────────────────────────

// Materials NOT in this map cannot be placed anywhere (unsortable by type).
const CORRECT_ZONE = {
  dry_leaves:   'tinder',
  dry_grass:    'tinder',
  dry_twigs:    'kindling',
  pine_cone:    'fuel_wood',
  thick_branch: 'fuel_wood',
}

const ZONE_DEFS = [
  {
    id:          'tinder',
    label:       'Tinder',
    description: 'Catches the spark. Lightest, driest.',
    tint:        0x8a6020,
  },
  {
    id:          'kindling',
    label:       'Kindling',
    description: 'Grows the flame. Small and dry.',
    tint:        0x6a5018,
  },
  {
    id:          'fuel_wood',
    label:       'Fuel Wood',
    description: 'Sustains the fire. Dense and heavy.',
    tint:        0x4a3810,
  },
]

// Specific feedback lines for wrong placements.
// Falls back to a generic wrong-placement line if combination is not listed.
const WRONG_FEEDBACK = {
  dry_grass: {
    fuel_wood: 'Too light to sustain anything — burns up in seconds.',
    kindling:  'Too fine for kindling — keep it at the base as tinder.',
  },
  thick_branch: {
    tinder:   'Too dense to catch a spark — it needs smaller material underneath it first.',
    kindling: 'Too thick for the middle — it needs fuel wood position on top.',
  },
  pine_cone: {
    tinder:   'Too compact for tinder — save it for fuel once the flame is going.',
    kindling: 'Too dense for the middle layer — it goes with the fuel wood.',
  },
  dry_twigs: {
    fuel_wood: 'Too thin to sustain the fire — it needs to go in the middle, not on top.',
    tinder:    'Too coarse for tinder — put the lightest material at the base.',
  },
  dry_leaves: {
    kindling:  'Too fragile for kindling — put it at the base beneath the twigs.',
    fuel_wood: 'Too light to sustain anything — burns up in seconds.',
  },
}

const ZONE_W  = 220
const ZONE_H  = 110
const PILE_ITEM_W = 76
const PILE_ITEM_H = 76

const MAT_QUALITY_COLOR = {
  GOOD: 0x8a7050,
  MID:  0x5a4a30,
  BAD:  0x2a1e10,
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FireSortMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireSortMinigame' })
  }

  init(data) {
    this.day = data?.day ?? 2

    // Populated in create() from registry.
    this._sortableIds   = []  // material ids that have a correct zone
    this._unsortableIds = []  // material ids that cannot be placed
    this._placedCount   = 0   // correctly placed so far
    this._hadError      = false  // any item needed correction?

    // Per-pile-piece state { pileKey → { matId, sprite, label, homePos, … } }
    this._matObjects    = {}

    // Zone data { zone_id → { rect, label, bounds } }
    this._zones         = {}

    this._feedbackTimer = null
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    console.log('sort received:', this.registry.get('collectedMaterials'))

    this._sortableIds = []
    this._unsortableIds = []
    this._matObjects = {}
    this._placedCount = 0
    this._hadError = false

    const raw = this.registry.get('collectedMaterials') ?? []
    const collected = Array.isArray(raw) ? raw : (raw?.items ?? [])

    // Classify into sortable vs. unsortable.
    collected.forEach(({ id }) => {
      if (CORRECT_ZONE[id] !== undefined) {
        this._sortableIds.push(id)
      } else {
        this._unsortableIds.push(id)
      }
    })

    this._buildBackground(W, H)
    this._buildZones(W, H)
    this._buildMaterialPile(W, H, collected)
    this._buildDialogueBox(W, H)
    this._enableDragDrop()

    // Edge case: nothing sortable (all 4 collected were unsortable types).
    if (this._sortableIds.length === 0) {
      this.time.delayedCall(800, () => this._finish())
    }
  }

  // ── Background ───────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0e0b)

    this.add.text(W / 2, 28, 'Sort your materials.', {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      fill: '#f0e6c8',
      stroke: '#1a0f00',
      strokeThickness: 4,
    }).setOrigin(0.5)

    // Placeholder fire pit
    this.add.circle(W / 2, H * 0.45, 55, 0x1a1208)
      .setStrokeStyle(2, 0x4a3a20)
    this.add.text(W / 2, H * 0.45, '🪵', { fontSize: '28px' }).setOrigin(0.5).setAlpha(0.35)
  }

  // ── Drop zones ────────────────────────────────────────────────────────────────

  _buildZones(W, H) {
    const totalW = 3 * ZONE_W + 2 * 24
    const startX = W / 2 - totalW / 2 + ZONE_W / 2
    const zoneY  = H * 0.75

    ZONE_DEFS.forEach((def, i) => {
      const x = startX + i * (ZONE_W + 24)

      // Dashed outline rectangle (stroke only)
      const rect = this.add.rectangle(x, zoneY, ZONE_W, ZONE_H, def.tint, 0.4)
        .setStrokeStyle(2, 0xaaaaaa)

      this.add.text(x, zoneY - ZONE_H / 2 + 14, def.label, {
        fontSize: '15px',
        fontFamily: 'Georgia, serif',
        fill: '#e0c870',
      }).setOrigin(0.5)

      this.add.text(x, zoneY + 8, def.description, {
        fontSize: '11px',
        fontFamily: 'Georgia, serif',
        fill: '#887050',
        wordWrap: { width: ZONE_W - 16 },
        align: 'center',
      }).setOrigin(0.5)

      // Flash overlay (hidden by default)
      const flash = this.add.rectangle(x, zoneY, ZONE_W, ZONE_H, 0xffffff, 0)

      this._zones[def.id] = {
        x, y: zoneY,
        rect, flash,
        bounds: new Phaser.Geom.Rectangle(
          x - ZONE_W / 2, zoneY - ZONE_H / 2, ZONE_W, ZONE_H
        ),
      }
    })
  }

  // ── Material pile ─────────────────────────────────────────────────────────────

  _buildMaterialPile(W, H, collected) {
    // Pile sits to the left of the fire pit.
    const pileX    = W * 0.22
    const pileY    = H * 0.45
    const cols     = 2
    const cellW    = PILE_ITEM_W + 12
    const cellH    = PILE_ITEM_H + 28

    collected.forEach(({ id, quality }, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x   = pileX + (col - 0.5) * cellW
      const y   = pileY + (row - 0.5) * cellH

      const color = MAT_QUALITY_COLOR[quality] ?? 0x5a4a30

      const sprite = this.add
        .rectangle(x, y, PILE_ITEM_W, PILE_ITEM_H, color)
        .setInteractive({ useHandCursor: true })
        .setDepth(5)
        .setAlpha(quality === 'BAD' ? 0.85 : 1)

      const label = this.add.text(x, y + PILE_ITEM_H / 2 + 4, id.replace(/_/g, ' '), {
        fontSize: '11px',
        fontFamily: 'Georgia, serif',
        fill: '#d8c898',
      }).setOrigin(0.5, 0).setDepth(6)

      const pileKey = `pile_${i}`
      this._matObjects[pileKey] = {
        matId: id,
        quality,
        sprite,
        label,
        homePos:  { x, y },
        placed:   false,
        greyed:   false,
      }
    })
  }

  // ── Dialogue box ──────────────────────────────────────────────────────────────

  _buildDialogueBox(W, H) {
    const boxY = H * 0.93

    this._feedbackBg = this.add
      .rectangle(W / 2, boxY, W * 0.78, 48, 0x0d0a04, 0.88)
      .setStrokeStyle(1, 0x6b5020)
      .setVisible(false)

    this._feedbackText = this.add.text(W / 2, boxY, '', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
      fill: '#f5e8c0',
      wordWrap: { width: W * 0.74 },
      align: 'center',
    }).setOrigin(0.5).setVisible(false)
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────────

  _enableDragDrop() {
    for (const obj of Object.values(this._matObjects)) {
      if (obj.placed || obj.greyed) continue
      this.input.setDraggable(obj.sprite)
    }

    this.input.on('dragstart', (pointer, sprite) => {
      sprite.setDepth(20)
    })

    this.input.on('drag', (pointer, sprite, dragX, dragY) => {
      sprite.setPosition(dragX, dragY)
      // Move the label with the sprite during drag.
      const pileKey = this._spriteToPileKey(sprite)
      if (pileKey) {
        const obj = this._matObjects[pileKey]
        obj.label.setPosition(dragX, dragY + PILE_ITEM_H / 2 + 4)
      }
    })

    this.input.on('dragend', (pointer, sprite) => {
      sprite.setDepth(5)
      const pileKey = this._spriteToPileKey(sprite)
      if (!pileKey) return
      this._onDragEnd(pileKey, sprite.x, sprite.y)
    })
  }

  _spriteToPileKey(sprite) {
    for (const [pileKey, obj] of Object.entries(this._matObjects)) {
      if (obj.sprite === sprite) return pileKey
    }
    return null
  }

  _onDragEnd(pileKey, dropX, dropY) {
    // Find which zone (if any) the item was dropped into.
    for (const [zoneId, zone] of Object.entries(this._zones)) {
      if (zone.bounds.contains(dropX, dropY)) {
        this._tryPlace(pileKey, zoneId)
        return
      }
    }
    // Dropped in empty space — bounce back.
    this._bounceBack(pileKey)
  }

  _tryPlace(pileKey, zoneId) {
    const matId = this._matObjects[pileKey].matId
    const correctZone = CORRECT_ZONE[matId]

    // Unsortable material.
    if (correctZone === undefined) {
      this._showFeedback('"This is too wet for any role tonight."')
      this._bounceBack(pileKey)
      this._greyOutMaterial(pileKey)
      return
    }

    if (zoneId === correctZone) {
      this._correctPlacement(pileKey, zoneId)
    } else {
      this._wrongPlacement(pileKey, zoneId)
    }
  }

  _correctPlacement(pileKey, zoneId) {
    const obj  = this._matObjects[pileKey]
    const zone = this._zones[zoneId]

    obj.placed = true
    obj.sprite.disableInteractive()

    // Snap to zone — offset slightly so multiple items don't stack exactly.
    const placed = Object.values(this._matObjects).filter(o => o.placed).length
    const snapX  = zone.x + (placed % 2 === 0 ? -18 : 18)
    const snapY  = zone.y - 10

    this.tweens.add({
      targets:  [obj.sprite, obj.label],
      x:        snapX,
      y:        snapY,
      duration: 200,
      ease:     'Back.Out',
    })
    obj.label.setPosition(snapX, snapY + PILE_ITEM_H / 2 + 4)

    // Green flash on zone outline
    this._flashZone(zoneId, 0x44dd44)

    this._showFeedback('"Good."')
    this._placedCount++
    this._checkComplete()
  }

  _wrongPlacement(pileKey, zoneId) {
    this._hadError = true

    const matId = this._matObjects[pileKey].matId
    // Look up specific feedback, fall back to generic.
    const specificFeedback = WRONG_FEEDBACK[matId]?.[zoneId]
    const text = specificFeedback
      ? `"${specificFeedback}"`
      : '"That doesn\'t belong there."'

    this._showFeedback(text)
    this._flashZone(zoneId, 0xdd4444)
    this._bounceBack(pileKey)
  }

  // ── Zone flash ────────────────────────────────────────────────────────────────

  _flashZone(zoneId, color) {
    const zone = this._zones[zoneId]
    zone.rect.setStrokeStyle(3, color)
    this.time.delayedCall(400, () => {
      zone.rect.setStrokeStyle(2, 0xaaaaaa)
    })
  }

  // ── Bounce / grey helpers ─────────────────────────────────────────────────────

  _bounceBack(pileKey) {
    const obj = this._matObjects[pileKey]
    const { x, y } = obj.homePos

    this.tweens.add({
      targets:  obj.sprite,
      x, y,
      duration: 280,
      ease:     'Back.Out',
    })
    this.tweens.add({
      targets:  obj.label,
      x,
      y: y + PILE_ITEM_H / 2 + 4,
      duration: 280,
      ease:     'Back.Out',
    })
  }

  _greyOutMaterial(pileKey) {
    const obj = this._matObjects[pileKey]
    if (obj.greyed) return
    obj.greyed = true

    obj.sprite.disableInteractive()
    this.tweens.add({
      targets:  [obj.sprite, obj.label],
      alpha:    0.3,
      duration: 300,
    })
  }

  // ── Feedback line ─────────────────────────────────────────────────────────────

  _showFeedback(text) {
    this._feedbackText.setText(text)
    this._feedbackBg.setVisible(true)
    this._feedbackText.setVisible(true)

    if (this._feedbackTimer) this._feedbackTimer.remove()
    this._feedbackTimer = this.time.delayedCall(3000, () => {
      this._feedbackBg.setVisible(false)
      this._feedbackText.setVisible(false)
      this._feedbackTimer = null
    })
  }

  // ── Completion ────────────────────────────────────────────────────────────────

  _checkComplete() {
    if (this._placedCount < this._sortableIds.length) return

    // All sortable materials are placed — brief pause then finish.
    if (this._hadError) {
      this._showFeedback('"Had to rethink that."')
    }
    this.time.delayedCall(1000, () => this._finish())
  }

  _finish() {
    const sortingQuality = this._hadError ? 'corrected' : 'clean'

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id:      'fire_sort',
      success: true,
      score:   sortingQuality,
    })

    if (this.registry.get('devFireBuildChain')) {
      this.scene.stop()
      this.scene.start('FireIgniteMinigame', { day: this.day })
      return
    }

    this.scene.stop()
  }
}
