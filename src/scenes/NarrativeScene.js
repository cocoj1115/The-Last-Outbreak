import Phaser from 'phaser'
import { gsap } from 'gsap'
import { GameEvents } from '../../systems/GameEvents.js'

const W = 1280
const H = 720

const BOX_W   = W - 32 * 2
const BOX_H   = 158
const BOX_X   = W / 2
const BOX_Y   = H - 68 - BOX_H / 2
const BOX_TOP  = BOX_Y - BOX_H / 2
const BOX_LEFT = 32

const TEXT_X   = BOX_LEFT + 24 + 14
const TEXT_Y   = BOX_TOP + 18
const TEXT_WRAP = BOX_W - 24 - 20

const ARROW_X  = BOX_LEFT + BOX_W - 28
const ARROW_Y  = BOX_TOP + BOX_H - 22

const TAG_X    = BOX_LEFT + 20
const TAG_Y    = BOX_TOP - 30

const D_BG      = 0
const D_BOX     = 4998
const D_TEXT    = 5000
const D_ARROW   = 5001
const D_TAG     = 5002
const D_CHOICES = 5003

export class NarrativeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NarrativeScene' })
    this._bridge       = null
    this._choiceObjs   = []
    this._currentTimer = null
    this._fullText     = ''
  }

  create() {
    this._bg = this.add.image(W / 2, H / 2, 'bg_placeholder')
      .setDisplaySize(W, H)
      .setDepth(D_BG)

    this._box = this.add.rectangle(BOX_X, BOX_Y, BOX_W, BOX_H, 0x000000, 0.62)
      .setStrokeStyle(1, 0x5c4033, 0.8)
      .setDepth(D_BOX)
      .setInteractive()
      .on('pointerup', () => this._onAdvance())

    this._dialogueText = this.add.text(TEXT_X, TEXT_Y, '', {
      fontFamily:  'Georgia, serif',
      fontSize:    '27px',
      color:       '#f5e6d3',
      lineSpacing: 7,
      wordWrap:    { width: TEXT_WRAP },
    }).setDepth(D_TEXT)

    this._arrow = this.add.text(ARROW_X, ARROW_Y, '▼', {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#c4a882',
    }).setOrigin(1, 1).setAlpha(0).setDepth(D_ARROW)

    this.tweens.add({
      targets:  this._arrow,
      alpha:    { from: 0, to: 1 },
      duration: 520,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })

    this._tagBg   = this.add.graphics().setDepth(D_TAG)
    this._tagText = this.add.text(TAG_X + 12, TAG_Y + 6, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#c4a882',
    }).setDepth(D_TAG)

    this._bindEvents()

    this.cameras.main.setAlpha(0)
    gsap.to(this.cameras.main, { alpha: 1, duration: 0.5 })

    this._showDialogue('Protagonist', 'The forest edge. Light fading.\nI am the only one still standing.')
  }

  _drawTag(name) {
    this._tagBg.clear()
    if (!name) { this._tagText.setText(''); return }
    this._tagText.setText(name)
    const tw = this._tagText.width + 24
    const th = this._tagText.height + 12
    this._tagBg.fillStyle(0x1e1408, 1)
    this._tagBg.fillRect(TAG_X, TAG_Y, tw, th)
    this._tagBg.lineStyle(1, 0x5c4033, 0.8)
    this._tagBg.strokeRect(TAG_X, TAG_Y, tw, th)
    this._tagText.setPosition(TAG_X + 12, TAG_Y + 6)
  }

  _bindEvents() {
    const e = this.game.events
    e.on(GameEvents.DIALOGUE_LINE,     ({ text, speaker }) => this._showDialogue(speaker, text))
    e.on(GameEvents.CHOICES_AVAILABLE, ({ choices })       => this._showChoices(choices))
    e.on(GameEvents.SCENE_CHANGE,      ({ key })           => this._changeBackground(key))
    e.on(GameEvents.MINIGAME_TRIGGER,  ({ id, day, difficulty }) => this._launchMinigame(id, day, difficulty))
    e.on(GameEvents.MINIGAME_COMPLETE, ()                  => this.scene.wake('NarrativeScene'))
    e.on(GameEvents.STAMINA_DEPLETED,  ({ day })           => console.log(`Stamina depleted day ${day}`))
    e.on(GameEvents.DAYS_EXHAUSTED,    ()                  => console.log('Days exhausted'))
  }

  _showDialogue(speaker, text) {
    this._clearChoices()
    this._fullText = text
    this._drawTag(speaker)
    this._dialogueText.setText('')
    this._arrow.setAlpha(0)
    let i = 0
    if (this._currentTimer) this._currentTimer.remove()
    this._currentTimer = this.time.addEvent({
      delay:    35,
      repeat:   text.length - 1,
      callback: () => { this._dialogueText.setText(text.slice(0, ++i)) },
    })
  }

  _onAdvance() {
    if (this._currentTimer && this._currentTimer.getRepeatCount() > 0) {
      this._currentTimer.remove()
      this._dialogueText.setText(this._fullText)
      return
    }
    if (this._bridge) this._bridge.tick()
  }

  _showChoices(choices) {
    this._clearChoices()
    this._arrow.setAlpha(0)
    const startY = H - 250
    choices.forEach((choice, i) => {
      const btn = this.add.text(W / 2, startY + i * 44, `▷  ${choice.text}`, {
        fontFamily:      'Segoe UI, Arial, sans-serif',
        fontSize:        '16px',
        color:           '#fff8e7',
        backgroundColor: '#5c3d2e',
        padding:         { x: 18, y: 8 },
      })
        .setOrigin(0.5, 0)
        .setDepth(D_CHOICES)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => btn.setBackgroundColor('#7a5244'))
        .on('pointerout',  () => btn.setBackgroundColor('#5c3d2e'))
        .on('pointerup',   () => this.game.events.emit(GameEvents.CHOICE_MADE, { index: choice.index }))
      this._choiceObjs.push(btn)
    })
  }

  _clearChoices() {
    this._choiceObjs.forEach(o => o.destroy())
    this._choiceObjs = []
  }

  _changeBackground(key) {
    const tex = `bg_${key}`
    if (this.textures.exists(tex)) this._bg.setTexture(tex)
  }

  _launchMinigame(id, day, difficulty) {
    const map = { campsite: 'CampsiteMinigame', fire: 'FireMinigame' }
    const target = map[id]
    if (!target) return
    this.scene.sleep('NarrativeScene')
    this.scene.launch(target, { day, difficulty })
  }
}
