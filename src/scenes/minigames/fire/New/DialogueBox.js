/**
 * DialogueBox
 * Reusable dialogue UI for FireBuildingMinigame.
 * Visual style copied verbatim from NarrativeScene._buildDialogueBox / _showChoices.
 * Portrait picker matches VillageScene layout (overlay + portrait cards + name plates).
 * Does NOT talk to InkBridge — callers own all narrative logic.
 *
 * API:
 *   show({ speaker, text, onComplete })
 *   showSequence([{ speaker, text }, ...], onComplete)
 *   showChoices([{ text, onSelect }, ...])
 *   showPortraitChoices({ entries, onPick, footer?, backgroundKey? })
 *   hidePortraitChoices()
 *   hide()
 *   destroy()
 */
export class DialogueBox {
  constructor(scene) {
    this._scene        = scene
    this._onComplete   = null
    this._fullText     = ''
    this._currentTimer = null
    this._arrowTween   = null
    this._choiceObjs   = []   // flat list of arrow + label objects for cleanup
    this._portraitObjs = []   // portrait-picker overlay objects

    const dpr = window.devicePixelRatio || 1
    const W   = scene.scale.width
    const H   = scene.scale.height

    // ── Box geometry (identical to NarrativeScene._buildDialogueBox) ─────────
    const boxW = W * 0.946
    const boxH = (H - Math.round(H * 0.699)) * 0.739
    const boxX = W / 2 - boxW / 2   // left edge
    const boxY = H * 0.745           // top edge

    // ── nineslice ornamental box ──────────────────────────────────────────────
    this._box = scene.add.nineslice(
      boxX + boxW / 2, boxY + boxH / 2,
      'dialogue_card', undefined,
      boxW, boxH,
      80, 80, 80, 80,
    ).setDepth(4500)

    this._box.setInteractive()
    this._box.on('pointerup', () => this._onBoxClick())
    // Hidden until show()/showChoices — must not steal clicks over the playfield (Phaser still hit-tests some builds).
    this._box.disableInteractive()

    // ── Speaker name ──────────────────────────────────────────────────────────
    const textX = W * 0.099
    const textY = H * 0.795

    this._speakerText = scene.add.text(textX, textY, '', {
      fontSize:   `${Math.round(19.5 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color:      '#5c3a00',
      fontStyle:  'italic',
    }).setDepth(4510)

    // ── Dialogue body ─────────────────────────────────────────────────────────
    this._text = scene.add.text(textX, textY + 30 * dpr, '', {
      fontSize:   `${Math.round(24.7 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color:      '#2a1500',
      wordWrap:   { width: W - textX - 80 * dpr },
      lineSpacing: 6 * dpr,
    }).setDepth(4510)

    // ── Continue arrow ▶ ──────────────────────────────────────────────────────
    this._arrow = scene.add.text(W - 80 * dpr, H - 36 * dpr, '▶', {
      fontSize: `${14 * dpr}px`,
      color:    '#8b5e00',
    }).setAlpha(0).setDepth(4510)

    // ── Choice container (repositioned in showChoices) ────────────────────────
    this._choiceContainer = scene.add.container(W / 2, H * 0.730).setDepth(4520).setVisible(false)

    // Store dpr for choice rendering
    this._dpr = dpr
    this._W   = W
    this._H   = H

    // Start hidden
    this._setVisible(false)
  }

  /**
   * VillageScene-style portrait grid over a dark overlay (optional background image).
   *
   * @param {object} opts
   * @param {Array<{ id: string, textureKey: string, label: string, sub: string, muted?: boolean }>} opts.entries
   * @param {(id: string) => void} opts.onPick — fired when a portrait is tapped
   * @param {{ label: string, onSelect: () => void }} [opts.footer] — bottom bar button; omit for none
   * @param {string} [opts.backgroundKey] — if set and texture exists, drawn behind overlay like VillageScene
   */
  showPortraitChoices(opts = {}) {
    const { entries = [], onPick, footer = null, backgroundKey } = opts
    if (!onPick || typeof onPick !== 'function') {
      console.warn('[DialogueBox] showPortraitChoices: onPick callback required')
      return
    }
    if (!entries.length) {
      console.warn('[DialogueBox] showPortraitChoices: entries must not be empty')
      return
    }

    this.hidePortraitChoices()

    const scene = this._scene
    const dpr   = this._dpr
    const W     = this._W
    const H     = this._H
    const push  = (...objs) => {
      for (const o of objs) this._portraitObjs.push(o)
      return objs[0]
    }

    const maxPortraitH = 420 * dpr * 0.9
    const portraitY    = H * 0.702
    const n            = entries.length

    if (backgroundKey && scene.textures.exists(backgroundKey)) {
      push(
        scene.add.image(W / 2, H / 2, backgroundKey)
          .setDisplaySize(W * 1.21, H * 1.21)
          .setDepth(4590),
      )
    }

    push(
      scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(4595),
    )

    const xAt = (i) => {
      if (n <= 1) return W / 2
      const t = i / (n - 1)
      return W * (0.075 + t * (0.85 - 0.075))
    }

    entries.forEach((npc, idx) => {
      const x    = xAt(idx)
      const ox   = 0.5
      const id   = npc.id
      const muted = npc.muted === true

      let img = null
      if (npc.textureKey && scene.textures.exists(npc.textureKey)) {
        img = scene.add.image(x, portraitY, npc.textureKey).setOrigin(ox, 1).setDepth(4600)
        const scale = maxPortraitH / img.height
        img.setScale(scale)
      } else {
        const phW = 140 * dpr
        const phH = maxPortraitH
        img = scene.add.rectangle(x, portraitY, phW, phH, 0x2a1f14, 0.9)
          .setOrigin(0.5, 1)
          .setDepth(4600)
        if (npc.textureKey) {
          console.warn('[DialogueBox] showPortraitChoices: missing texture', npc.textureKey)
        }
      }

      if (muted) img.setTint(0x888888)

      const cardCenterX = x
      const cardY       = portraitY + 18 * dpr
      const cardW       = 200 * dpr
      const cardH       = 52 * dpr

      push(
        scene.add.rectangle(cardCenterX, cardY, cardW, cardH, 0x0d0a06, 0.85)
          .setStrokeStyle(1 * dpr, 0xc4a060, 0.6)
          .setDepth(4602),
      )
      push(
        scene.add.text(cardCenterX, cardY - 8 * dpr, npc.label ?? '', {
          fontFamily: 'Georgia, serif',
          fontSize:   `${16 * dpr}px`,
          color:      '#c4a060',
        }).setOrigin(0.5, 0.5).setDepth(4603),
      )
      push(
        scene.add.text(cardCenterX, cardY + 10 * dpr, npc.sub ?? '', {
          fontFamily: 'Georgia, serif',
          fontSize:   `${12 * dpr}px`,
          color:      '#8a6a40',
        }).setOrigin(0.5, 0.5).setDepth(4603),
      )

      img.setInteractive({ useHandCursor: true })
      img.on('pointerover', () => {
        if (!muted) {
          scene.tweens.add({ targets: img, alpha: 0.85, duration: 120 })
        }
      })
      img.on('pointerout', () => {
        scene.tweens.add({ targets: img, alpha: 1, duration: 120 })
      })
      img.on('pointerup', () => {
        img.setTint(0x888888)
        onPick(id)
      })

      push(img)
    })

    if (footer && footer.label && typeof footer.onSelect === 'function') {
      const btnW   = Math.min(520 * dpr, W * 0.9)
      const btnH   = 52 * dpr
      const btnX   = W / 2
      const btnY   = H - 60 * dpr - H * 0.10

      const btnBg = scene.add.rectangle(btnX, btnY, btnW, btnH, 0x0d0a06, 0.88)
        .setStrokeStyle(1 * dpr, 0xc4a060, 0.6)
        .setInteractive({ useHandCursor: true })
        .setDepth(4604)

      const btnLabel = scene.add.text(btnX, btnY, footer.label, {
        fontFamily: 'Georgia, serif',
        fontSize:   `${17 * dpr}px`,
        color:      '#c4a060',
      }).setOrigin(0.5, 0.5).setDepth(4605)

      btnBg.on('pointerover', () => {
        btnBg.setFillStyle(0x2a1f0e, 0.95)
        btnLabel.setColor('#f0d890')
      })
      btnBg.on('pointerout', () => {
        btnBg.setFillStyle(0x0d0a06, 0.88)
        btnLabel.setColor('#c4a060')
      })
      btnBg.on('pointerup', () => {
        footer.onSelect()
      })

      push(btnBg, btnLabel)
    }
  }

  hidePortraitChoices() {
    this._portraitObjs.forEach((o) => o.destroy())
    this._portraitObjs = []
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Show a single line with typewriter effect.
   * First click on the box skips to full text; second click fires onComplete.
   */
  show({ speaker = '', text = '', onComplete = null } = {}) {
    this._resetState()
    this._choiceContainer.setVisible(true)
    this._box.setInteractive()
    this._setVisible(true)
    this._onComplete = onComplete
    this._fullText   = text

    this._speakerText.setText(speaker)
    this._text.setText('')
    this._stopArrow()

    let i = 0
    this._currentTimer = this._scene.time.addEvent({
      delay:    30,
      repeat:   text.length - 1,
      callback: () => {
        this._text.setText(text.slice(0, ++i))
        if (i >= text.length) this._startArrow()
      },
    })
  }

  /**
   * Play an array of { speaker, text } lines in sequence.
   * onComplete fires after the last line is advanced past.
   */
  showSequence(lines = [], onComplete = null) {
    if (lines.length === 0) {
      if (onComplete) onComplete()
      return
    }
    const [first, ...rest] = lines
    this.show({
      speaker:    first.speaker ?? '',
      text:       first.text    ?? '',
      onComplete: () => this.showSequence(rest, onComplete),
    })
  }

  /**
   * Show choice buttons, positioned identically to NarrativeScene._showChoices.
   * Each entry: { text: string, onSelect: () => void }
   */
  showChoices(choices = []) {
    this._clearChoices()
    this._stopArrow()
    this._choiceContainer.setVisible(true)
    this._setVisible(true)
    this._box.setInteractive()

    const dpr  = this._dpr
    const W    = this._W
    const H    = this._H
    const lineH = 52 * dpr
    const padX  = 24 * dpr

    // Reposition container to match NarrativeScene anchor
    this._choiceContainer.setPosition(W * 0.344, H * 0.298)

    choices.forEach((choice, i) => {
      const rowY = i * lineH + lineH / 2

      // Arrow indicator — hidden until hover
      const arrow = this._scene.add.text(0, rowY, '➤', {
        fontSize:   `${17 * dpr}px`,
        fontFamily: '"IM Fell English", serif',
        color:      '#FFD54F',
        shadow:     { x: 0, y: 0, color: '#FFD54F', blur: 14, fill: true },
      }).setOrigin(0, 0.5).setAlpha(0)

      // Choice label
      const label = this._scene.add.text(padX, rowY, choice.text, {
        fontSize:   `${23 * dpr}px`,
        fontFamily: '"IM Fell English", serif',
        fontStyle:  'bold',
        color:      '#EFE0C0',
        shadow:     { x: 1, y: 2, color: '#1a0c00', blur: 5, fill: true },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })

      let arrowTween = null

      label
        .on('pointerover', () => {
          label.setColor('#FFD54F')
          label.setShadow(0, 0, '#FFD54F', 18, true, true)
          arrow.setAlpha(1)
          if (arrowTween) arrowTween.stop()
          arrowTween = this._scene.tweens.add({
            targets:  arrow,
            alpha:    { from: 0.45, to: 1.0 },
            duration: 900, yoyo: true, repeat: -1,
            ease:     'Sine.easeInOut',
          })
        })
        .on('pointerout', () => {
          label.setColor('#EFE0C0')
          label.setShadow(1, 2, '#1a0c00', 5, true, false)
          arrow.setAlpha(0)
          if (arrowTween) { arrowTween.stop(); arrowTween = null }
        })
        .on('pointerup', () => {
          this._clearChoices()
          choice.onSelect()
        })

      this._choiceContainer.add([arrow, label])
      this._choiceObjs.push(arrow, label)
    })
  }

  /** True while the parchment dialogue box is visible (story text or choice buttons). */
  isBlocking() {
    return this._box?.visible === true
  }

  /** Hide the dialogue box and all associated elements. */
  hide() {
    this.hidePortraitChoices()
    this._resetState()
    this._box.disableInteractive()
    this._choiceContainer.setVisible(false)
    this._setVisible(false)
  }

  /** Remove all Phaser objects created by this instance. */
  destroy() {
    this.hidePortraitChoices()
    this._resetState()
    this._box.destroy()
    this._speakerText.destroy()
    this._text.destroy()
    this._arrow.destroy()
    this._choiceContainer.destroy(true)
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  _onBoxClick() {
    // Skip typewriter → show full text immediately
    if (this._currentTimer && this._currentTimer.getRepeatCount() > 0) {
      this._currentTimer.remove()
      this._currentTimer = null
      this._text.setText(this._fullText)
      this._startArrow()
      return
    }
    // Typewriter done → fire completion callback
    if (this._onComplete) {
      const cb = this._onComplete
      this._onComplete = null
      cb()
    }
  }

  _startArrow() {
    this._stopArrow()
    this._arrow.setAlpha(0)
    this._arrowTween = this._scene.tweens.add({
      targets:  this._arrow,
      alpha:    { from: 0, to: 0.8 },
      duration: 800,
      yoyo:     true,
      repeat:   -1,
    })
  }

  _stopArrow() {
    if (this._arrowTween) {
      this._arrowTween.stop()
      this._arrowTween = null
    }
    this._arrow.setAlpha(0)
  }

  _clearChoices() {
    this._choiceObjs.forEach(o => o.destroy())
    this._choiceObjs = []
  }

  _resetState() {
    if (this._currentTimer) {
      this._currentTimer.remove()
      this._currentTimer = null
    }
    this._stopArrow()
    this._clearChoices()
    this._onComplete = null
  }

  _setVisible(visible) {
    this._box.setVisible(visible)
    this._speakerText.setVisible(visible)
    this._text.setVisible(visible)
    this._arrow.setVisible(visible)
    // Choice container visibility is handled implicitly — it's empty when hidden
  }
}
