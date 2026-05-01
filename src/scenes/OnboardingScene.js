import Phaser from 'phaser'

/**
 * OnboardingScene
 * Shows the title card (onboarding1.png) with a glassmorphism entry button.
 * On click: ripple → fade to black → launch HUD + start NarrativeScene.
 */
export class OnboardingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'OnboardingScene' })
  }

  create() {
    const W   = this.scale.width
    const H   = this.scale.height
    const dpr = window.devicePixelRatio || 1

    // Button left edge aligns with title (W * 0.199).
    const btnX = W * 0.200
    const btnW = 300 * dpr
    const btnH =  60 * dpr
    const btnY = H * 0.554
    const r    =  10 * dpr

    this._dpr     = dpr
    this._btnCX   = btnX + btnW / 2
    this._btnCY   = btnY + btnH / 2
    this._btnRect = { x: btnX, y: btnY, w: btnW, h: btnH, r }
    this._triX    = btnX        // tip-left anchor for the triangle
    this._btnLabel = null

    this._glowFX    = null
    this._glowTween  = null

    // ── Background ─────────────────────────────────────────────────────────
    this.add.image(W / 2, H / 2, 'onboarding1').setDisplaySize(W, H)

    // ── Game title ─────────────────────────────────────────────────────────
    document.fonts.load(`48px "IM Fell English"`).finally(() => {
      if (!this.scene.isActive()) return
      this.add.text(W * 0.199, H * 0.444, 'The Last Outbreak', {
        fontFamily: '"IM Fell English", serif',
        fontSize:   `${58 * dpr}px`,
        color:      '#1B262C',
      }).setOrigin(0, 0)
    })


    // ── Button text + triangle ─────────────────────────────────────────────
    const triSize  = 7 * dpr   // triangle half-height
    const triGap   = 10 * dpr  // gap between triangle and text
    const textX    = btnX + triSize * 2 + triGap

    // Triangle (drawn Graphics, recoloured on hover)
    this._tri = this.add.graphics()
    this._setColor('#1B262C', 0x1B262C)

    document.fonts.load(`bold ${18 * dpr}px Montserrat`).finally(() => {
      if (!this.scene.isActive()) return
      this._btnLabel = this.add.text(textX, this._btnCY, 'Begin your journey', {
        fontFamily: 'Montserrat, sans-serif',
        fontSize:   `${18 * dpr}px`,
        fontStyle:  'bold',
        color:      '#1B262C',
      }).setOrigin(0, 0.5)
    })

    // ── Hit zone ───────────────────────────────────────────────────────────
    this.add.zone(this._btnCX, this._btnCY, btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this._setColor('#493320', 0x493320, true))
      .on('pointerout',   () => this._setColor('#1B262C', 0x1B262C, false))
      .on('pointerdown',  () => this._setColor('#0d1518', 0x0d1518, false))
      .on('pointerup',    () => this._startGame())

    // ── Dev jump links ─────────────────────────────────────────────────────
    document.fonts.load(`12px "IM Fell English"`).finally(() => {
      if (!this.scene.isActive()) return

      const linkY = H * 0.96
      const linkStyle = {
        fontFamily: '"IM Fell English", serif',
        fontSize:   `${13 * dpr}px`,
        color:      '#5a7a8a',
      }

      const day2Link = this.add.text(W * 0.199, linkY, '→ Day 2', linkStyle)
        .setOrigin(0, 1)
        .setInteractive({ useHandCursor: true })
        .on('pointerover',  () => day2Link.setColor('#a0c8d8'))
        .on('pointerout',   () => day2Link.setColor('#5a7a8a'))
        .on('pointerup',    () => this._startGame('day2_transition'))

      const day3Link = this.add.text(W * 0.199 + 100 * dpr, linkY, '→ Day 3', linkStyle)
        .setOrigin(0, 1)
        .setInteractive({ useHandCursor: true })
        .on('pointerover',  () => day3Link.setColor('#a0c8d8'))
        .on('pointerout',   () => day3Link.setColor('#5a7a8a'))
        .on('pointerup',    () => this._startGame('day3_transition'))
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _setColor(hex, int, glow = false) {
    this._btnLabel?.setColor(hex)

    const dpr = this._dpr
    const cx  = this._triX + 7 * dpr
    const cy  = this._btnCY
    const s   = 7 * dpr
    this._tri.clear()
    this._tri.fillStyle(int, 1)
    this._tri.fillTriangle(cx - s, cy - s, cx - s, cy + s, cx + s, cy)

    // Stop any existing glow tween and clear postFX
    if (this._glowTween) { this._glowTween.stop(); this._glowTween = null }
    this._glowFX = null
    this._tri.postFX.clear()
    if (this._btnLabel) this._btnLabel.postFX.clear()

    // Subtle pulsing gold outer glow on hover
    if (glow && this._btnLabel) {
      this._glowFX = this._btnLabel.postFX.addGlow(0xE9C46A, 0.4, 0, false, 0.1, 16)
      this._glowTween = this.tweens.addCounter({
        from:     0.4,
        to:       0.8,
        duration: 2000,
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut',
        onUpdate: (tween) => {
          if (this._glowFX) this._glowFX.outerStrength = tween.getValue()
        },
      })
    }
  }

  _startGame(jumpTo = null) {
    const ripple = this.add.graphics()
    const state  = { r: 0, a: 1.0 }

    // Expanding ring from button centre, then fade to black, then switch scene.
    this.tweens.add({
      targets:  state,
      r:        220 * this._dpr,
      a:        0,
      duration: 380,
      ease:     'Cubic.Out',
      onUpdate: () => {
        ripple.clear()
        ripple.lineStyle(2 * this._dpr, 0xffffff, state.a)
        ripple.strokeCircle(this._btnCX, this._btnCY, state.r)
      },
      onComplete: () => {
        ripple.destroy()
        this.cameras.main.fadeOut(700, 0, 0, 0)
        this.cameras.main.once(
          Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          () => {
            if (jumpTo) this.registry.set('devJumpTo', jumpTo)
            this.scene.launch('HUDScene')
            this.scene.start('NarrativeScene')
          },
        )
      },
    })
  }
}
