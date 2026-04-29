// src/scenes/minigames/FireCollectMinigame.js
import { GameEvents } from '../systems/GameEvents.js'

// ─── 材料数据 ────────────────────────────────────────────────────────────────

const MATERIALS_DAY2 = [
  {
    id: 'dry_leaves',
    label: 'Dry Leaves',
    line: 'Light. Crumbles when I press it.',
    quality: 'GOOD',
    poorQuality: 'MID',
  },
  {
    id: 'dry_twigs',
    label: 'Dry Twigs',
    line: 'Snaps cleanly. Good.',
    quality: 'GOOD',
    poorQuality: 'GOOD',
  },
  {
    id: 'grass_bundle',
    label: 'Grass Bundle',
    line: 'This will catch fast.',
    quality: 'GOOD',
    poorQuality: 'MID',
  },
  {
    id: 'wet_bark',
    label: 'Wet Bark',
    line: 'Too heavy. Already wet.',
    quality: 'BAD',
    poorQuality: 'BAD',
  },
  {
    id: 'wet_moss',
    label: 'Wet Moss',
    line: "Sticky. This won't catch a spark.",
    quality: 'BAD',
    poorQuality: 'BAD',
  },
  {
    id: 'pine_cone',
    label: 'Pine Cone',
    line: 'Might work. Not my first choice.',
    quality: 'MID',
    poorQuality: 'MID',
  },
]

const MATERIALS_DAY3 = [
  {
    id: 'dry_leaves',
    label: 'Dry Leaves',
    line: 'Light. Crumbles when I press it.',
    quality: 'GOOD',
    poorQuality: 'MID',
  },
  {
    id: 'dry_twigs',
    label: 'Dry Twigs',
    line: 'Snaps cleanly.',
    quality: 'GOOD',
    poorQuality: 'GOOD',
  },
  {
    id: 'grass_bundle',
    label: 'Grass Bundle',
    line: "Too light. Wind will scatter this before it catches.",
    quality: 'BAD',
    poorQuality: 'BAD',
  },
  {
    id: 'thick_bark',
    label: 'Thick Bark',
    line: "Heavy and dense. Won't blow around.",
    quality: 'GOOD',
    poorQuality: 'GOOD',
  },
  {
    id: 'wet_moss',
    label: 'Wet Moss',
    line: "Sticky. Won't catch.",
    quality: 'BAD',
    poorQuality: 'BAD',
  },
  {
    id: 'pine_cone',
    label: 'Pine Cone',
    line: 'Compact. Might hold in the wind.',
    quality: 'MID',
    poorQuality: 'MID',
  },
]

// ─── 难度计算 ─────────────────────────────────────────────────────────────────

function computeDifficulty(selectedIds, materials, isPoor) {
  const getQ = (id) => {
    const m = materials.find((m) => m.id === id)
    return isPoor ? m.poorQuality : m.quality
  }
  const badCount = selectedIds.filter((id) => getQ(id) === 'BAD').length
  const midCount = selectedIds.filter((id) => getQ(id) === 'MID').length
  if (badCount >= 2) return 'HARD'
  if (badCount === 1 || midCount >= 2) return 'MEDIUM'
  return 'EASY'
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export default class FireCollectMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'FireCollectMinigame' })
  }

  // 接收 { day: 2|3 } 作为 scene data
  init(data) {
    this.day = data?.day ?? 2
    this.materials = this.day === 3 ? MATERIALS_DAY3 : MATERIALS_DAY2

    // 营地质量影响材料外观和难度计算
    this.isPoor = this.registry.get('campsiteQuality') === 'poor'

    // 状态
    this.slots = [null, null, null, null] // 背包槽，存放 material id
    this.inspected = new Set()            // 已听过独白的材料
    this.activeMonologue = null           // 当前显示独白的计时器
  }

  preload() {
    // 背景图占位（美术资源到位后替换 key）
    // this.load.image('bg_fire_collect', this.day === 3 ? 'assets/BG-3G.png' : 'assets/BG-2G.png')
    // this.load.image('ui_slot', 'assets/UI-SLOT.png')
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // ── 背景 ──────────────────────────────────────────────────────────────────
    this._buildBackground(W, H)

    // ── 标题提示 ──────────────────────────────────────────────────────────────
    this.add
      .text(W / 2, 36, 'Collect materials for the fire.', {
        fontSize: '20px',
        fill: '#f0e6c8',
        fontFamily: 'Georgia, serif',
        stroke: '#1a0f00',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)

    // ── 材料精灵 ──────────────────────────────────────────────────────────────
    this._buildMaterials(W, H)

    // ── 背包槽 ────────────────────────────────────────────────────────────────
    this._buildSlots(W, H)

    // ── 独白文本框 ────────────────────────────────────────────────────────────
    this._buildMonologueBox(W, H)

    // ── Start Fire 按钮（初始隐藏）────────────────────────────────────────────
    this._buildStartButton(W, H)
  }

  // ─── 背景 ──────────────────────────────────────────────────────────────────

  _buildBackground(W, H) {
    // 占位色块，美术资源到位后换成 this.add.image(...)
    this.add.rectangle(W / 2, H / 2, W, H, 0x1c1a10)

    // 如果 isPoor（Site A 营地），材料颜色偏暗
    // 视觉状态通过 _getMaterialTint() 控制
  }

  // ─── 材料精灵 ──────────────────────────────────────────────────────────────

  _buildMaterials(W, H) {
    // 6种材料排成 2行 × 3列
    const cols = 3
    const rows = 2
    const startX = W * 0.15
    const startY = H * 0.25
    const spacingX = (W * 0.7) / (cols - 1)
    const spacingY = H * 0.22

    this.materialSprites = {}

    this.materials.forEach((mat, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * spacingX
      const y = startY + row * spacingY

      // 占位色块（美术到位后换图）
      const tint = this._getMaterialTint(mat)
      const bg = this.add.rectangle(x, y, 90, 90, tint).setInteractive({ useHandCursor: true })
      const label = this.add
        .text(x, y + 52, mat.label, {
          fontSize: '13px',
          fill: '#e8d8a0',
          fontFamily: 'Georgia, serif',
        })
        .setOrigin(0.5, 0)

      // 状态标记：材料是否已放入背包
      const slotIndicator = this.add
        .text(x + 38, y - 38, '', {
          fontSize: '16px',
          fill: '#7fff7f',
        })
        .setOrigin(0.5, 0.5)
        .setVisible(false)

      this.materialSprites[mat.id] = { bg, label, slotIndicator, x, y }

      // 第一次点击：播放独白
      // 第二次点击（已检查过）：放入背包槽
      bg.on('pointerdown', () => this._onMaterialClick(mat.id))

      // hover 高亮
      bg.on('pointerover', () => {
        if (!this._isInSlot(mat.id)) bg.setStrokeStyle(2, 0xffd966)
      })
      bg.on('pointerout', () => {
        bg.setStrokeStyle(0)
      })
    })
  }

  _getMaterialTint(mat) {
    // isPoor 时 dry_leaves 和 grass_bundle 用偏暗色
    const poorDimIds = ['dry_leaves', 'grass_bundle']
    if (this.isPoor && poorDimIds.includes(mat.id)) {
      return 0x3a3020 // 暗湿色
    }
    const qualityColors = { GOOD: 0x5a7a3a, MID: 0x8a7a3a, BAD: 0x3a2a1a }
    const q = this.isPoor ? mat.poorQuality : mat.quality
    return qualityColors[q] ?? 0x555555
  }

  // ─── 背包槽 ────────────────────────────────────────────────────────────────

  _buildSlots(W, H) {
    const slotCount = 4
    const slotSize = 70
    const totalWidth = slotCount * slotSize + (slotCount - 1) * 12
    const startX = W / 2 - totalWidth / 2 + slotSize / 2
    const slotY = H * 0.82

    this.slotObjects = []

    for (let i = 0; i < slotCount; i++) {
      const x = startX + i * (slotSize + 12)
      const border = this.add.rectangle(x, slotY, slotSize, slotSize, 0x2a1e0a)
      border.setStrokeStyle(2, 0x8b6914)
      const label = this.add
        .text(x, slotY, '', {
          fontSize: '11px',
          fill: '#e8d8a0',
          fontFamily: 'Georgia, serif',
          wordWrap: { width: slotSize - 8 },
          align: 'center',
        })
        .setOrigin(0.5, 0.5)

      // 点击槽位 → 移除材料（取消放置）
      border.setInteractive({ useHandCursor: true })
      border.on('pointerdown', () => this._onSlotClick(i))

      this.slotObjects.push({ border, label, x, y: slotY })
    }

    // 槽位标题
    this.add
      .text(W / 2, slotY - 50, 'Pack — 4 slots', {
        fontSize: '14px',
        fill: '#a08040',
        fontFamily: 'Georgia, serif',
      })
      .setOrigin(0.5, 0.5)
  }

  // ─── 独白文本框 ────────────────────────────────────────────────────────────

  _buildMonologueBox(W, H) {
    const boxY = H * 0.68
    this.monoBox = this.add
      .rectangle(W / 2, boxY, W * 0.8, 48, 0x0d0a04, 0.85)
      .setStrokeStyle(1, 0x6b5020)

    this.monoText = this.add
      .text(W / 2, boxY, '', {
        fontSize: '15px',
        fill: '#f5e8c0',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        wordWrap: { width: W * 0.76 },
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
  }

  // ─── Start Fire 按钮 ───────────────────────────────────────────────────────

  _buildStartButton(W, H) {
    this.startBtn = this.add
      .rectangle(W / 2, H * 0.94, 220, 48, 0x8b3a0a)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
    this.startBtn.setStrokeStyle(2, 0xffa040)

    this.startBtnText = this.add
      .text(W / 2, H * 0.94, 'Start Fire →', {
        fontSize: '18px',
        fill: '#ffe0a0',
        fontFamily: 'Georgia, serif',
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false)

    this.startBtn.on('pointerdown', () => this._onStartFire())
    this.startBtn.on('pointerover', () => this.startBtn.setFillStyle(0xb05020))
    this.startBtn.on('pointerout', () => this.startBtn.setFillStyle(0x8b3a0a))
  }

  // ─── 交互逻辑 ──────────────────────────────────────────────────────────────

  _onMaterialClick(id) {
    if (this._isInSlot(id)) return // 已在背包里，无响应

    const mat = this.materials.find((m) => m.id === id)

    if (!this.inspected.has(id)) {
      // 第一次点击：展示独白
      this.inspected.add(id)
      this._showMonologue(mat.line)
    } else {
      // 已检查过：尝试放入背包
      const emptySlot = this.slots.findIndex((s) => s === null)
      if (emptySlot === -1) {
        this._showMonologue('Pack is full.')
        return
      }
      this._addToSlot(id, emptySlot)
    }
  }

  _onSlotClick(slotIndex) {
    const id = this.slots[slotIndex]
    if (!id) return
    this._removeFromSlot(slotIndex)
  }

  _addToSlot(id, slotIndex) {
    this.slots[slotIndex] = id

    const mat = this.materials.find((m) => m.id === id)
    const slotObj = this.slotObjects[slotIndex]
    slotObj.label.setText(mat.label)
    slotObj.border.setFillStyle(0x3a2e14)

    // 材料本体加已放标记
    const sprite = this.materialSprites[id]
    sprite.slotIndicator.setText('✓').setVisible(true)
    sprite.bg.disableInteractive() // 放入后不可再点（需通过槽位移除）

    this._refreshStartButton()
  }

  _removeFromSlot(slotIndex) {
    const id = this.slots[slotIndex]
    if (!id) return
    this.slots[slotIndex] = null

    const slotObj = this.slotObjects[slotIndex]
    slotObj.label.setText('')
    slotObj.border.setFillStyle(0x2a1e0a)

    // 恢复材料可交互
    const sprite = this.materialSprites[id]
    sprite.slotIndicator.setVisible(false)
    sprite.bg.setInteractive({ useHandCursor: true })

    this._refreshStartButton()
  }

  _isInSlot(id) {
    return this.slots.includes(id)
  }

  _refreshStartButton() {
    const full = this.slots.every((s) => s !== null)
    this.startBtn.setVisible(full)
    this.startBtnText.setVisible(full)
  }

  _showMonologue(text) {
    this.monoText.setText(`"${text}"`)

    // 清除之前的消隐计时器
    if (this.activeMonologue) {
      this.activeMonologue.remove()
    }
    this.activeMonologue = this.time.delayedCall(3000, () => {
      this.monoText.setText('')
      this.activeMonologue = null
    })
  }

  // ─── 结算 ──────────────────────────────────────────────────────────────────

  _onStartFire() {
    const selectedIds = this.slots.filter(Boolean)
    const difficulty = computeDifficulty(selectedIds, this.materials, this.isPoor)

    this.registry.set('ignitionDifficulty', difficulty)
    this.registry.set('fuelStock', 5)

    this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
      id: 'fire_collect',
      success: true,
      score: difficulty, // 'EASY' | 'MEDIUM' | 'HARD'
    })
  }
}