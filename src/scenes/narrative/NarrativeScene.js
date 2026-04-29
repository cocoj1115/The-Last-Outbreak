import Phaser from 'phaser'
import { GameEvents } from '../../systems/GameEvents.js'
import { InkBridge } from '../../systems/InkBridge.js'

/**
 * NarrativeScene
 * Dev A owns this file.
 *
 * Displays:
 *  - Background image
 *  - Character portrait
 *  - Dialogue box with speaker name + text
 *  - Choice buttons
 *
 * Listens to GameEvents and either updates UI or launches minigame scenes.
 *
 * While a minigame is running, NarrativeScene sleeps (this.scene.sleep()).
 * When the minigame emits MINIGAME_COMPLETE, NarrativeScene wakes and
 * InkBridge resumes ticking.
 */
export class NarrativeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NarrativeScene' })
    this._bridge = null
    this._dialogueElements = {}
    this._choiceButtons = []
  }

  create() {
    const dpr = window.devicePixelRatio || 1
    const W = this.scale.width
    const H = this.scale.height

    // ── Background ───────────────────────────────────────────────────────
    const hasBg1 = this.textures.exists('bg_background1')
    console.log('[NarrativeScene] bg_background1 exists:', hasBg1, '| all textures:', this.textures.list ? Object.keys(this.textures.list).join(',') : 'n/a')
    const initBg = hasBg1 ? 'bg_background1' : 'bg_placeholder'
    this._bg = this.add.image(W / 2, H / 2, initBg)
      .setDisplaySize(W, H)

    // ── Dark overlay ─────────────────────────────────────────────────────
    this._bgOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45)

    // ── Portrait ───────────────────────────────────────────────────────────
    this._portrait = this.add.image(120 * dpr, H - 160 * dpr, 'portrait_placeholder')
      .setOrigin(0.5, 1)
      .setAlpha(0)

    // ── Main character ───────────────────────────────────────────────────
    const charSize = H * 0.558
    this._mainCharacter = this.add.image(W * 0.682, H * 0.259, 'maincharacter')
      .setOrigin(0, 0)
      .setDisplaySize(charSize, charSize)

    // ── Dialogue box ─────────────────────────────────────────────────────
    this._buildDialogueBox(W, H)

    // ── Event listeners ──────────────────────────────────────────────────
    this._bindEvents()

    // ── Dev shortcut: T = jump to time_transition knot ───────────────────
    this.input.keyboard.on('keydown-T', () => {
      if (this._bridge) this._bridge.jumpTo('time_transition')
    })

    // ── Start Ink story ──────────────────────────────────────────────────
    const storyJson = this.cache.json.get('story')
    if (storyJson) {
      this._bridge = new InkBridge(this, storyJson)
      this._bridge.tick()
    } else {
      // No compiled story loaded yet — show placeholder
      this._showPlaceholderDialogue()
    }
  }

  // ── UI builders ─────────────────────────────────────────────────────────

  _buildDialogueBox(W, H) {
    const dpr  = window.devicePixelRatio || 1
    const boxW      = W * 0.946
    const boxH      = (H - Math.round(H * 0.699)) * 0.739
    const boxX      = W / 2 - boxW / 2                  // centered
    const boxY      = H * 0.745                          // top edge
    const pad  = 120 * dpr   // horizontal inset keeps text clear of corner art

    // 9-slice ornamental box — corners: 80px all sides (source: 1536×1024)
    const box = this.add.nineslice(
      boxX + boxW / 2, boxY + boxH / 2,
      'dialogue_card', undefined,
      boxW, boxH,
      80, 80, 80, 80,
    )

    // Speaker name
    const textX = W * 0.099
    const textY = H * 0.795
    this._speakerText = this.add.text(textX, textY, '', {
      fontSize: `${Math.round(19.5 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color: '#5c3a00',
      fontStyle: 'italic',
    })

    // Dialogue text
    this._dialogueText = this.add.text(textX, textY + 30 * dpr, '', {
      fontSize: `${Math.round(24.7 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color: '#2a1500',
      wordWrap: { width: W - textX - 80 * dpr },
      lineSpacing: 6 * dpr,
    })

    // "Click to continue" hint
    this._continueHint = this.add.text(W - 80 * dpr, H - 36 * dpr, '▶', {
      fontSize: `${14 * dpr}px`,
      color: '#8b5e00',
    }).setAlpha(0)

    // Click anywhere on box to advance
    box.setInteractive()
    box.on('pointerup', () => this._onAdvance())

    // Blinking continue hint
    this.tweens.add({
      targets: this._continueHint,
      alpha: { from: 0, to: 0.8 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    })

    // Choice container
    this._choiceContainer = this.add.container(W / 2, H - 220 * dpr)

    this._dialogueElements = { box, boxY, boxH, pad }
  }

  // ── Event binding ────────────────────────────────────────────────────────

  _bindEvents() {
    const e = this.game.events

    e.on(GameEvents.DIALOGUE_LINE, ({ text, speaker, tags }) => {
      if (tags && tags.time_transition) {
        this._playTimeTransition(() => this._showDialogue(speaker, text))
      } else {
        this._showDialogue(speaker, text)
      }
    })

    e.on(GameEvents.CHOICES_AVAILABLE, ({ choices }) => {
      // While the map scene is handling navigation, suppress the choice UI
      if (this._mapActive) return
      this._showChoices(choices)
    })

    e.on(GameEvents.SCENE_CHANGE, ({ key }) => {
      if (key === 'map') {
        // Launch map as overlay — NarrativeScene stays awake
        this._mapActive = true
        this.scene.launch('MapScene')
      } else {
        // Stop MapScene if still running
        if (this.scene.isActive('MapScene')) this.scene.stop('MapScene')
        this._changeBackground(key)
      }
    })

    // Reset map flag when MapScene stops
    this.events.on('wake', () => { this._mapActive = false })

    e.on(GameEvents.HIDE_CHARACTER, () => {
      console.log('[NarrativeScene] HIDE_CHARACTER received, char:', !!this._mainCharacter)
      if (this._mainCharacter) this._mainCharacter.setVisible(false)
    })

    e.on(GameEvents.SHOW_CHARACTER, () => {
      if (this._mainCharacter) this._mainCharacter.setVisible(true)
    })

    e.on(GameEvents.MINIGAME_TRIGGER, ({ id, day, difficulty }) => {
      this._launchMinigame(id, day, difficulty)
    })

    e.on(GameEvents.MINIGAME_COMPLETE, () => {
      // Wake up after minigame finishes
      this.scene.wake('NarrativeScene')
      if (this._mainCharacter) this._mainCharacter.setVisible(true)
    })

    e.on(GameEvents.STAMINA_DEPLETED, ({ day }) => {
      this._showRetryPrompt(day)
    })

    e.on(GameEvents.DAYS_EXHAUSTED, () => {
      this._triggerWorstEnding()
    })
  }

  // ── Dialogue display ────────────────────────────────────────────────────

  _showDialogue(speaker, text) {
    this._clearChoices()
    this._speakerText.setText(speaker ?? '')
    this._dialogueText.setText('')
    this._continueHint.setAlpha(0)

    // Simple typewriter effect
    let i = 0
    const timer = this.time.addEvent({
      delay: 30,
      repeat: text.length - 1,
      callback: () => {
        this._dialogueText.setText(text.slice(0, ++i))
        if (i >= text.length) {
          this._continueHint.setAlpha(0.8)
        }
      },
    })
    this._currentTimer = timer
  }

  _onAdvance() {
    // Skip typewriter if still running
    if (this._currentTimer && this._currentTimer.getRepeatCount() > 0) {
      this._currentTimer.remove()
      this._dialogueText.setText(this._dialogueText.text) // show full text
      this._continueHint.setAlpha(0.8)
      return
    }
    // Otherwise ask InkBridge to continue
    if (this._bridge) this._bridge.tick()
  }

  _showChoices(choices) {
    this._clearChoices()
    this._continueHint.setAlpha(0)
    const dpr = window.devicePixelRatio || 1

    choices.forEach((choice, i) => {
      const btn = this.add.text(0, i * 48 * dpr, `▷  ${choice.text}`, {
        fontSize: `${18 * dpr}px`,
        fontFamily: 'serif',
        color: '#cccccc',
        backgroundColor: '#111111',
        padding: { x: 16 * dpr, y: 8 * dpr },
      })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => btn.setColor('#ffffff'))
        .on('pointerout', () => btn.setColor('#cccccc'))
        .on('pointerup', () => {
          this.game.events.emit(GameEvents.CHOICE_MADE, { index: choice.index })
        })

      this._choiceContainer.add(btn)
      this._choiceButtons.push(btn)
    })
  }

  _clearChoices() {
    this._choiceButtons.forEach(b => b.destroy())
    this._choiceButtons = []
  }

  _changeBackground(key) {
    const textureKey = `bg_${key}`
    console.log('[NarrativeScene] _changeBackground', key, 'exists:', this.textures.exists(textureKey))
    if (this.textures.exists(textureKey)) {
      const W = this.scale.width
      const H = this.scale.height
      // Scale up village_morning by 10%, others fill exactly
      const scale = key === 'village_morning' ? 1.1 : 1.0
      this._bg.setTexture(textureKey).setDisplaySize(W * scale, H * scale)
    }
  }

  // ── Minigame handoff ────────────────────────────────────────────────────

  _launchMinigame(id, day, difficulty) {
    const sceneMap = {
      campsite: 'CampsiteMinigame',
      fire: 'FireMinigame',
    }
    const targetScene = sceneMap[id]
    if (!targetScene) {
      console.warn(`[NarrativeScene] Unknown minigame id: ${id}`)
      return
    }
    if (this._mainCharacter) this._mainCharacter.setVisible(false)
    this.scene.sleep('NarrativeScene')
    this.scene.launch(targetScene, { day, difficulty })
  }

  // ── Edge case flows ─────────────────────────────────────────────────────

  _showRetryPrompt(day) {
    // TODO: overlay "You're exhausted. Rest costs 1 day. [Rest] [Push through]"
    console.log(`[NarrativeScene] Stamina depleted on day ${day}. Show retry prompt.`)
  }

  _triggerWorstEnding() {
    // TODO: jump Ink to worst-ending knot
    console.log('[NarrativeScene] Days exhausted. Triggering worst ending.')
    if (this._bridge) {
      this._bridge.setVariable('forced_worst_ending', true)
      this._bridge.tick()
    }
  }

  // ── Time travel transition ─────────────────────────────────────────────────────

  _playTimeTransition(onComplete) {
    const cam = this.cameras.main

    // — Hide all UI ——————————————————————————————————————————————
    const { box } = this._dialogueElements
    box.setVisible(false)
    this._speakerText.setVisible(false)
    this._dialogueText.setVisible(false)
    this._continueHint.setVisible(false)
    if (this._mainCharacter) this._mainCharacter.setVisible(false)
    if (this._bgOverlay)     this._bgOverlay.setAlpha(0)

    // — Phase 1: Blur in ——————————————————————————————————————————
    const blurFX = cam.postFX.addBlur(0, 0.5, 0.5, 0)
    this.tweens.addCounter({
      from: 0, to: 6, duration: 2400, ease: 'Sine.easeIn',
      onUpdate: t => { blurFX.strength = t.getValue() },
    })

    // — Phase 2: Spin + zoom ——————————————————————————————————————
    this.tweens.add({
      targets: cam, rotation: Phaser.Math.DegToRad(90),
      duration: 3300, ease: 'Expo.easeIn',
    })
    cam.zoomTo(4.0, 3300, 'Expo.easeIn')

    // — Phase 3: Camera fade to black (screen-space, rotation-proof) ————
    this.time.delayedCall(2400, () => {
      cam.fadeOut(1500, 0, 0, 0)
      cam.once('camerafadeoutcomplete', () => {
        // Reset camera while screen is fully black
        cam.postFX.remove(blurFX)
        cam.zoomTo(1, 1)
        cam.setRotation(0)

        // Switch bg while fully black so background2 never shows
        this._changeBackground('village_morning')
        if (this._bgOverlay) this._bgOverlay.setAlpha(1.0)

        // Hold black 2s, then simple fade in
        this.time.delayedCall(2000, () => {
          cam.fadeIn(800, 0, 0, 0)

          cam.once('camerafadeincomplete', () => {
            const W = this.scale.width
            const H = this.scale.height

            // Show dialogue box immediately — map will overlay on top
            box.setVisible(true)
            this._speakerText.setVisible(true)
            this._dialogueText.setVisible(true)
            this.game.events.emit(GameEvents.PROLOGUE_END)
            onComplete()
          })
        })
      })
    })
  }

  // ── Placeholder (remove when Ink is wired up) ───────────────────────────

  _showPlaceholderDialogue() {
    this._showDialogue(
      'Aiden',
      'The forest edge. Light fading. I am the only one still standing.'
    )
  }
}
