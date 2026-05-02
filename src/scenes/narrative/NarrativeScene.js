import Phaser from 'phaser'
import { gsap } from 'gsap'
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
    this._villageActive = false
    this._waitingForVillage = false
    this._villageTalkStates = {}
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

    // ── Vignette (top + sides focus) ────────────────────────────────────
    {
      const vc = document.createElement('canvas')
      vc.width = Math.ceil(W); vc.height = Math.ceil(H)
      const vx = vc.getContext('2d')
      // Left edge
      const gL = vx.createLinearGradient(0, 0, W * 0.28, 0)
      gL.addColorStop(0, 'rgba(0,0,0,0.72)')
      gL.addColorStop(1, 'rgba(0,0,0,0)')
      vx.fillStyle = gL; vx.fillRect(0, 0, W, H)
      // Right edge
      const gR = vx.createLinearGradient(W, 0, W * 0.72, 0)
      gR.addColorStop(0, 'rgba(0,0,0,0.72)')
      gR.addColorStop(1, 'rgba(0,0,0,0)')
      vx.fillStyle = gR; vx.fillRect(0, 0, W, H)
      // Top edge
      const gT = vx.createLinearGradient(0, 0, 0, H * 0.32)
      gT.addColorStop(0, 'rgba(0,0,0,0.72)')
      gT.addColorStop(1, 'rgba(0,0,0,0)')
      vx.fillStyle = gT; vx.fillRect(0, 0, W, H)
      this.textures.addCanvas('__vignette__', vc)
      this.add.image(W / 2, H / 2, '__vignette__').setDepth(50)
    }

    // ── Portrait (NPC) ─────────────────────────────────────────────────────
    this._portrait = this.add.image(W * 0.032, H * 0.747, null)
      .setOrigin(0, 1)
      .setAlpha(0)
      .setDepth(4000)
      .setVisible(false)

    // ── Portrait (Aiden) ─────────────────────────────────────────────────
    this._portraitAiden = this.add.image(W * 0.591, H * 0.788, 'portrait_aiden')
      .setOrigin(0, 1)
      .setAlpha(0)
      .setDepth(4000)
      .setVisible(false)
    {
      const scaleW = (1280 * 0.686 * dpr * 0.9) / this._portraitAiden.width
      const scaleH = (720  * 0.806 * dpr * 0.9) / this._portraitAiden.height
      this._portraitAiden.setScale(Math.min(scaleW, scaleH))
    }

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

    // ── Dev shortcut: D = jump to day3_transition ────────────────────────
    this.input.keyboard.on('keydown-D', () => {
      if (this._bridge) this._bridge.jumpTo('day3_transition')
    })

    // ── Dev shortcut: M = directly launch FireCollectMinigame (bypass Ink) ─
    this.input.keyboard.on('keydown-M', () => {
      console.log('[DEV] M pressed — launching FireCollectMinigame directly')
      if (this._mainCharacter) this._mainCharacter.setVisible(false)
      this.scene.sleep('NarrativeScene')
      this.scene.launch('FireCollectMinigame', { day: 2 })
    })

    // ── Start Ink story ──────────────────────────────────────────────────
    const storyJson = this.cache.json.get('story')
    if (storyJson) {
      this._bridge = new InkBridge(this, storyJson)
      const jumpTarget = this.registry.get('devJumpTo')
      if (jumpTarget) {
        this.registry.remove('devJumpTo')
        this._bridge.jumpTo(jumpTarget)
      } else {
        this._bridge.tick()
      }
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
    ).setDepth(4500)

    // Speaker name
    const textX = W * 0.099
    const textY = H * 0.795
    this._speakerText = this.add.text(textX, textY, '', {
      fontSize: `${Math.round(19.5 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color: '#5c3a00',
      fontStyle: 'italic',
    }).setDepth(4510)

    // Dialogue text
    this._dialogueText = this.add.text(textX, textY + 30 * dpr, '', {
      fontSize: `${Math.round(24.7 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color: '#2a1500',
      wordWrap: { width: W - textX - 80 * dpr },
      lineSpacing: 6 * dpr,
    }).setDepth(4510)

    // Click anywhere on box to advance
    box.setInteractive()
    box.on('pointerup', () => this._onAdvance())

    // Choice container — depth 4520 so it sits above dialogue box (4500)
    this._choiceContainer = this.add.container(W / 2, H * 0.730).setDepth(4520)

    this._dialogueElements = { box, boxY, boxH, pad }
  }

  // ── Event binding ────────────────────────────────────────────────────────

  _bindEvents() {
    const e = this.game.events

    e.on(GameEvents.DIALOGUE_LINE, ({ text, speaker, tags }) => {
      if (tags && tags.portrait !== undefined) {
        this._showPortrait(tags.portrait)
      }
      if (tags && tags.time_transition) {
        this._playTimeTransition(() => this._showDialogue(speaker, text))
      } else {
        this._showDialogue(speaker, text)
      }
    })

    e.on(GameEvents.CHOICES_AVAILABLE, ({ choices }) => {
      // While the map or village scene is handling navigation, suppress the choice UI
      if (this._mapActive || this._villageActive || this._waitingForVillage) return
      this._showChoices(choices)
    })

    e.on(GameEvents.SCENE_CHANGE, ({ key }) => {
      if (key === 'village_hub') {
        console.log('[DEBUG] village_hub triggered')
        // Set flag and capture talk states — VillageScene launches on INK_WAITING
        this._waitingForVillage = true
        this._villageTalkStates = {
          mara: this._bridge?.getVariable('talked_to_mara') === true,
          finn: this._bridge?.getVariable('talked_to_finn') === true,
          isla: this._bridge?.getVariable('talked_to_isla') === true,
        }
      } else if (key === 'map') {
        // Launch map as overlay — NarrativeScene stays awake
        this._mapActive = true
        this.scene.launch('MapScene')
      } else {
        // Stop MapScene if still running
        if (this.scene.isActive('MapScene')) this.scene.stop('MapScene')
        this._changeBackground(key)
      }
    })

    // STORY_END — story reached -> END, fade out over 3s and return to title
    e.on(GameEvents.STORY_END, () => {
      this.cameras.main.fadeOut(3000, 0, 0, 0)
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          if (this.scene.isActive('HUDScene')) this.scene.stop('HUDScene')
          this.scene.stop('NarrativeScene')
          this.scene.start('OnboardingScene')
        },
      )
    })

    // INK_WAITING — used to hand off to VillageScene after # scene:village_hub
    e.on(GameEvents.INK_WAITING, () => {
      console.log('[DEBUG] INK_WAITING, waitingForVillage:', this._waitingForVillage)
      if (this._waitingForVillage) {
        this._waitingForVillage = false
        this._villageActive = true
        this.scene.sleep('NarrativeScene')
        this.scene.launch('VillageScene', { talkStates: this._villageTalkStates })
      }
    })

    // Resume from VillageScene — jump to selected NPC entry
    e.on(GameEvents.VILLAGE_NPC_CLICKED, ({ id }) => {
      this._villageActive = false
      if (this.scene.isSleeping('NarrativeScene')) {
        this.scene.wake('NarrativeScene')
      }
      if (this.scene.isActive('VillageScene')) this.scene.stop('VillageScene')
      if (this._bridge) this._bridge.jumpToKnot(id + '_entry')
    })

    // Resume from VillageScene — head out
    e.on(GameEvents.VILLAGE_LEAVE, () => {
      this._villageActive = false
      if (this.scene.isSleeping('NarrativeScene')) {
        this.scene.wake('NarrativeScene')
      }
      if (this.scene.isActive('VillageScene')) this.scene.stop('VillageScene')
      if (this._bridge) this._bridge.jumpToKnot('day1_end')
    })

    // Reset map/village flags when those scenes stop
    this.events.on('wake', () => { this._mapActive = false; this._villageActive = false })

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
    this._speakerText.setText(speaker ?? '')
    this._dialogueText.setText('')
    // hint removed

    // Simple typewriter effect
    let i = 0
    const timer = this.time.addEvent({
      delay: 30,
      repeat: text.length - 1,
      callback: () => {
        this._dialogueText.setText(text.slice(0, ++i))
        if (i >= text.length) {
          // hint removed
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
      // hint removed
      return
    }
    // Otherwise ask InkBridge to continue
    if (this._bridge) this._bridge.tick()
  }

  _showChoices(choices) {
    // Auto-advance single "Continue" choices — no button needed
    if (choices.length === 1 && choices[0].text.trim() === 'Continue') {
      this.game.events.emit(GameEvents.CHOICE_MADE, { index: 0 })
      return
    }
    this._clearChoices()
    // hint removed
    const dpr    = window.devicePixelRatio || 1
    const W      = this.scale.width
    const H      = this.scale.height
    const lineH  = 52 * dpr
    const padX   = 24 * dpr

    // Anchor: top-left of first row at W*0.344, H*0.298
    this._choiceContainer.setPosition(W * 0.344, H * 0.298)

    choices.forEach((choice, i) => {
      const rowY = i * lineH + lineH / 2

      // Arrow indicator — hidden by default
      const arrow = this.add.text(0, rowY, '➤', {
        fontSize: `${17 * dpr}px`,
        fontFamily: '"IM Fell English", serif',
        color: '#FFD54F',
        shadow: { x: 0, y: 0, color: '#FFD54F', blur: 14, fill: true },
      }).setOrigin(0, 0.5).setAlpha(0)

      // Choice label
      const label = this.add.text(padX, rowY, choice.text, {
        fontSize: `${23 * dpr}px`,
        fontFamily: '"IM Fell English", serif',
        fontStyle: 'bold',
        color: '#EFE0C0',
        shadow: { x: 1, y: 2, color: '#1a0c00', blur: 5, fill: true },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })

      let arrowTween = null

      label
        .on('pointerover', () => {
          label.setColor('#FFD54F')
          label.setShadow(0, 0, '#FFD54F', 18, true, true)
          arrow.setAlpha(1)
          if (arrowTween) arrowTween.stop()
          arrowTween = this.tweens.add({
            targets: arrow,
            alpha: { from: 0.45, to: 1.0 },
            duration: 900, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
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
          this.game.events.emit(GameEvents.CHOICE_MADE, { index: choice.index })
        })

      this._choiceContainer.add([arrow, label])
      this._choiceButtons.push(arrow, label)
    })
  }

  _clearChoices() {
    this._choiceButtons.forEach(b => b.destroy())
    this._choiceButtons = []
  }

  _changeBackground(key) {
    // Keys that trigger scene switches — handled elsewhere, skip here
    if (key === 'village_hub' || key === 'map') return

    // Fallback map for keys that don't yet have a dedicated texture
    const FALLBACK = {
      forest_dawn_wet:  'forest_day2',
      forest_morning:   'forest_day2',
      village_interior: 'village_morning',
      forest_day3:      'path_petra',
    }
    const resolvedKey = FALLBACK[key] ?? key
    const textureKey  = `bg_${resolvedKey}`

    console.log(`[NarrativeScene] scene:${key} → texture:${textureKey}`, this.textures.exists(textureKey) ? '✓' : '✗ MISSING')

    if (!this.textures.exists(textureKey)) return

    const W = this.scale.width
    const H = this.scale.height
    const scale = (resolvedKey === 'village_morning' || resolvedKey === 'village_day1') ? 1.21
      : resolvedKey === 'forest_day2' ? 1.1
      : 1.0
    this._bg.setTexture(textureKey).setDisplaySize(W * scale, H * scale)
  }

  // ── Minigame handoff ────────────────────────────────────────────────────

  _launchMinigame(id, day, difficulty) {
    const sceneMap = {
      campsite:      'CampsiteMinigame',
      fire_collect:  'FireBuildingCollect',
      fire_campsite: 'FireBuildingMinigame',
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

  _showPortrait(key) {
    console.log('[Portrait] showing:', key)
    if (key === 'none' || key === null) {
      gsap.killTweensOf(this._portrait)
      gsap.killTweensOf(this._portraitAiden)
      gsap.to(this._portrait, {
        alpha: 0, duration: 0.3,
        onComplete: () => this._portrait.setVisible(false),
      })
      gsap.to(this._portraitAiden, {
        alpha: 0, duration: 0.3,
        onComplete: () => this._portraitAiden.setVisible(false),
      })
    } else if (key === 'aiden' || key === 'aiden_happy') {
      gsap.killTweensOf(this._portrait)
      gsap.killTweensOf(this._portraitAiden)
      this._portrait.setVisible(false)
      this._portrait.setAlpha(0)
      const aidTexture = key === 'aiden_happy' ? 'portrait_aiden_happy' : 'portrait_aiden'
      this._portraitAiden.setTexture(aidTexture)
      const dpr = window.devicePixelRatio || 1
      const scaleW = (1280 * 0.686 * dpr * 0.9) / this._portraitAiden.width
      const scaleH = (720  * 0.806 * dpr * 0.9) / this._portraitAiden.height
      this._portraitAiden.setScale(Math.min(scaleW, scaleH))
      this._portraitAiden.setVisible(true)
      gsap.to(this._portraitAiden, { alpha: 1, duration: 0.3 })
    } else {
      gsap.killTweensOf(this._portrait)
      gsap.killTweensOf(this._portraitAiden)
      this._portraitAiden.setVisible(false)
      this._portraitAiden.setAlpha(0)
      this._portrait.setTexture('portrait_' + key)
      this._portrait.setX(this.scale.width  * (key === 'petra' ? 0.040 : 0.032))
      this._portrait.setY(this.scale.height * (key === 'petra' ? 0.767 : 0.747))
      const portraitScale = key === 'petra' ? 0.9 * 1.1 * 1.1 : 0.9
      const maxW = this.scale.width * 0.3375 * portraitScale
      const maxH = this.scale.height * 0.806 * portraitScale
      const scaleW = maxW / this._portrait.width
      const scaleH = maxH / this._portrait.height
      const scale = Math.min(scaleW, scaleH)
      this._portrait.setScale(scale)
      this._portrait.setVisible(true)
      gsap.to(this._portrait, { alpha: 1, duration: 0.3 })
    }
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
    // hint removed
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
      targets: cam, rotation: Phaser.Math.DegToRad(45),
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

}
