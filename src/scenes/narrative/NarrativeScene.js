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
    this._bg = this.add.image(W / 2, H / 2, 'bg_placeholder')
      .setDisplaySize(W, H)

    // ── Portrait ───────────────────────────────────────────────────────────
    this._portrait = this.add.image(120 * dpr, H - 160 * dpr, 'portrait_placeholder')
      .setOrigin(0.5, 1)
      .setAlpha(0)

    // ── Dialogue box ─────────────────────────────────────────────────────
    this._buildDialogueBox(W, H)

    // ── Event listeners ──────────────────────────────────────────────────
    this._bindEvents()

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
    const dpr = window.devicePixelRatio || 1
    const boxH = 180 * dpr
    const boxY = H - boxH - 20 * dpr
    const pad  = 24 * dpr

    // Semi-transparent box
    const box = this.add.rectangle(W / 2, boxY + boxH / 2, W - 40 * dpr, boxH, 0x000000, 0.75)
      .setStrokeStyle(dpr, 0x555555)

    // Speaker name
    this._speakerText = this.add.text(pad + 20 * dpr, boxY + 16 * dpr, '', {
      fontSize: `${16 * dpr}px`,
      fontFamily: 'monospace',
      color: '#aaaaaa',
      fontStyle: 'italic',
    })

    // Dialogue text
    this._dialogueText = this.add.text(pad + 20 * dpr, boxY + 44 * dpr, '', {
      fontSize: `${20 * dpr}px`,
      fontFamily: 'serif',
      color: '#ffffff',
      wordWrap: { width: W - 40 * dpr - pad * 2 },
      lineSpacing: 6 * dpr,
    })

    // "Click to continue" hint
    this._continueHint = this.add.text(W - 60 * dpr, H - 30 * dpr, '▶', {
      fontSize: `${14 * dpr}px`,
      color: '#666666',
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

    this._dialogueElements = { box, boxY, pad }
  }

  // ── Event binding ────────────────────────────────────────────────────────

  _bindEvents() {
    const e = this.game.events

    e.on(GameEvents.DIALOGUE_LINE, ({ text, speaker }) => {
      this._showDialogue(speaker, text)
    })

    e.on(GameEvents.CHOICES_AVAILABLE, ({ choices }) => {
      this._showChoices(choices)
    })

    e.on(GameEvents.SCENE_CHANGE, ({ key }) => {
      this._changeBackground(key)
    })

    e.on(GameEvents.MINIGAME_TRIGGER, ({ id, day, difficulty }) => {
      this._launchMinigame(id, day, difficulty)
    })

    e.on(GameEvents.MINIGAME_COMPLETE, () => {
      // Wake up after minigame finishes
      this.scene.wake('NarrativeScene')
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
    if (this.textures.exists(textureKey)) {
      this._bg.setTexture(textureKey)
    }
    // Graceful fallback: keep current bg if texture not loaded yet
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

  // ── Placeholder (remove when Ink is wired up) ───────────────────────────

  _showPlaceholderDialogue() {
    this._showDialogue(
      'Aiden',
      'The forest edge. Light fading. I am the only one still standing.'
    )
  }
}
