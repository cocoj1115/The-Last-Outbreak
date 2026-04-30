import Phaser from 'phaser'
import { gsap } from 'gsap'
import { GameEvents } from '../../../systems/GameEvents.js'

// ── Campsite data ─────────────────────────────────────────────────────────────

const CAMPSITES = {
  A: {
    name: 'Site A — Forest Hollow',
    bgKey: 'bg_site_a',
    bgRainKey: 'bg_site_a_rain',
    hotspots: [
      { id: 'canopy',   x: 0.211, y: 0.119, label: 'Canopy',
        body: 'Good cover overhead. Rain will not hit directly.',
        implication: 'Natural shelter from direct rainfall.' },
      { id: 'stream',   x: 0.538, y: 0.826, label: 'Stream',
        body: 'Stream is close. Water access is easy.',
        implication: 'Convenient, but proximity could be a risk if water rises.' },
      { id: 'ground',   x: 0.226, y: 0.759, label: 'Ground',
        body: 'The ground dips down here. Leaves have been collecting for a while.',
        implication: 'Water may pool here in heavy rain.' },
      { id: 'branches', x: 0.290, y: 0.320, label: 'Branches',
        body: 'Dead branches hang above the tent area.',
        implication: 'They may fall in wind or heavy rain.' },
    ],
    confirmLines: [
      'The water is already moving. I can hear it — the stream is climbing the bank. And somewhere above me, a branch just shifted.',
      'The cold is coming in fast. I need fire before full dark.',
    ],
    success: false,
  },
  B: {
    name: 'Site B — Rocky Rise',
    bgKey: 'bg_site_b',
    bgRainKey: 'bg_site_b_rain',
    hotspots: [
      { id: 'boulder', x: 0.621, y: 0.289, label: 'Boulder',
        body: 'The large boulder can block wind and deflect rain from one side.',
        implication: 'Good natural windbreak and partial rain shield.' },
      { id: 'ground',  x: 0.884, y: 0.484, label: 'Ground',
        body: 'The raised ground is firm and drains water downhill.',
        implication: 'Lower flooding risk than lower-lying terrain.' },
      { id: 'sky',     x: 0.871, y: 0.081, label: 'Sky',
        body: 'Trees are beside me, not overhead. Open to the rain. But it seems like the ground will drain.',
        implication: 'Trade-off between safety above and exposure to rain.' },
      { id: 'stream',  x: 0.329, y: 0.786, label: 'Stream Direction',
        body: 'Water drains below this slope, but the stream is farther away.',
        implication: 'Less flood risk, but water access requires more effort.' },
    ],
    confirmLines: [
      "The boulder is doing its job. Wind's hitting everywhere else but not here. The ground is holding dry.",
      'The cold is coming in fast. I need fire before full dark.',
    ],
    success: true,
  },
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export class CampsiteMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'CampsiteMinigame' })
  }

  init(data) {
    this.day             = data.day ?? 2
    this._currentSite    = null
    this._markers        = []
    this._hotspotObjects = []
    this._inspectGroup   = []   // all inspect-phase UI objects; destroyed on goBack/confirm
    this._visitedIds     = new Set()
    this._chooseLocked   = true
    this._progressText   = null
    this._infoPanel      = null
    this._chooseBtnBg    = null
    this._chooseBtnLabel = null
    this._dialogueBg     = null
    this._dialogueText   = null
  }

  create() {
    const W   = this.scale.width
    const H   = this.scale.height
    const dpr = window.devicePixelRatio || 1
    this._W = W; this._H = H; this._dpr = dpr

    this._bg = this.add.image(W / 2, H / 2, 'bg_forest_overview')
      .setDisplaySize(W, H).setDepth(0)

    this._topText = this.add.text(W / 2, 48 * dpr,
      'Two spots. I need to inspect each campsite first', {
        fontFamily: '"IM Fell English", serif',
        fontSize:   `${20 * dpr}px`,
        color:      '#f0e0c8',
        stroke:     '#000000',
        strokeThickness: 4 * dpr,
        align:      'center',
      }).setOrigin(0.5, 0).setDepth(100)

    this._buildDialogueBox(W, H, dpr)
    this._setDialogue(null, null)

    this._buildMarker(W * 0.212, H * 0.754, 'A', dpr)
    this._buildMarker(W * 0.880, H * 0.429, 'B', dpr)

    this.cameras.main.setAlpha(0)
    gsap.to(this.cameras.main, { alpha: 1, duration: 0.5 })
  }

  // ── Dialogue box (confirmation only) ──────────────────────────────────────

  _buildDialogueBox(W, H, dpr) {
    const boxH = 110 * dpr
    const boxY = H - boxH - 16 * dpr
    this._dialogueBg = this.add.rectangle(
      W / 2, boxY + boxH / 2, W * 0.94, boxH, 0x140a02, 0.94
    ).setStrokeStyle(1.5 * dpr, 0xb8943c, 0.8).setDepth(600)
    this._dialogueText = this.add.text(W * 0.05, boxY + 16 * dpr, '', {
      fontFamily:  '"IM Fell English", serif',
      fontSize:    `${22 * dpr}px`,
      color:       '#f0e0c8',
      wordWrap:    { width: W * 0.90 },
      lineSpacing: 4 * dpr,
    }).setDepth(601)
  }

  _setDialogue(text, onClick) {
    const vis = text !== null
    this._dialogueBg.setVisible(vis)
    this._dialogueText.setVisible(vis)
    if (vis) this._dialogueText.setText(text)
    this._dialogueBg.removeAllListeners()
    this._dialogueText.removeAllListeners()
    if (vis && onClick) {
      this._dialogueBg.setInteractive({ useHandCursor: true }).on('pointerup', onClick)
      this._dialogueText.setInteractive({ useHandCursor: true }).on('pointerup', onClick)
    } else {
      this._dialogueBg.disableInteractive()
      this._dialogueText.disableInteractive()
    }
  }

  // ── Overview markers ───────────────────────────────────────────────────────

  _buildMarker(x, y, siteId, dpr) {
    const r = 10 * dpr

    // Glow layers
    const outerGlow = this.add.circle(x, y, r * 3.2, 0xffd060, 0.10).setDepth(198)
    const midGlow   = this.add.circle(x, y, r * 1.9, 0xffd060, 0.45).setDepth(199)
    const core      = this.add.circle(x, y, r,        0xffe480, 1.00).setDepth(200)

    const tOuter = gsap.to(outerGlow, { scaleX: 1.35, scaleY: 1.35, alpha: 0.04, duration: 1.6, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 0.3 })
    const tMid   = gsap.to(midGlow,   { scaleX: 1.30, scaleY: 1.30, alpha: 0.22, duration: 1.2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const tCore  = gsap.to(core,      { scaleX: 1.18, scaleY: 1.18, alpha: 0.75, duration: 1.0, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 0.2 })

    const label = this.add.text(x, y + r * 3.2 + 8 * dpr, `Site ${siteId}`, {
      fontFamily: '"IM Fell English", serif',
      fontSize:   `${15 * dpr}px`,
      color:      '#f0e0c8',
      stroke:     '#000000',
      strokeThickness: 3 * dpr,
    }).setOrigin(0.5, 0).setDepth(201)

    const zone = this.add.zone(x, y, r * 6, r * 6)
      .setInteractive({ useHandCursor: true }).setDepth(202)
    zone.on('pointerover', () => { core.setFillStyle(0xfff4a0); gsap.to(midGlow, { alpha: 0.7, scaleX: 1.5, scaleY: 1.5, duration: 0.12 }) })
    zone.on('pointerout',  () => { core.setFillStyle(0xffe480); gsap.to(midGlow, { alpha: 0.45, scaleX: 1, scaleY: 1, duration: 0.2 }) })
    zone.on('pointerup',   () => this._enterSite(siteId))

    this._markers.push({ circle: core, label, zone, tween: { kill: () => { tOuter.kill(); tMid.kill(); tCore.kill() } }, _extras: [outerGlow, midGlow] })
  }

  _destroyMarkers() {
    this._markers.forEach(m => {
      m.tween.kill()
      m.circle.destroy(); m.label.destroy(); m.zone.destroy()
      m._extras?.forEach(o => o.destroy())
    })
    this._markers = []
  }

  // ── Enter site ────────────────────────────────────────────────────────────

  _enterSite(siteId) {
    const { _W: W, _H: H, _dpr: dpr } = this
    this._currentSite = siteId
    this._visitedIds  = new Set()
    this._chooseLocked = true

    const camp = CAMPSITES[siteId]
    this._bg.setTexture(camp.bgKey).setDisplaySize(W, H)
    this._topText.setVisible(false)
    this._destroyMarkers()

    this._buildInspectHeader(camp.name, W, H, dpr)
    this._buildInspectBottom(W, H, dpr)
    camp.hotspots.forEach(h =>
      this._hotspotObjects.push(this._buildHotspot(W * h.x, H * h.y, h, dpr))
    )
    this._showClue(null)
  }

  // ── Inspect header (top bar) ───────────────────────────────────────────────

  _buildInspectHeader(siteName, W, H, dpr) {
    const y = 36 * dpr

    const backBtn = this.add.text(24 * dpr, y, '← Back to both sites', {
      fontFamily: '"IM Fell English", serif',
      fontSize:   `${16 * dpr}px`,
      color:      '#c4a060',
      stroke:     '#000000',
      strokeThickness: 3 * dpr,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(300)
    backBtn.on('pointerover', () => backBtn.setColor('#f0d890'))
    backBtn.on('pointerout',  () => backBtn.setColor('#c4a060'))
    backBtn.on('pointerup',   () => this._goBack())

    const nameText = this.add.text(W / 2, y, siteName, {
      fontFamily: '"IM Fell English", serif',
      fontSize:   `${18 * dpr}px`,
      color:      '#f0e0c8',
      stroke:     '#000000',
      strokeThickness: 3 * dpr,
    }).setOrigin(0.5, 0.5).setDepth(300)

    const progText = this.add.text(W - 24 * dpr, y, 'Inspected  0 / 4', {
      fontFamily: '"IM Fell English", serif',
      fontSize:   `${15 * dpr}px`,
      color:      '#c4a060',
      stroke:     '#000000',
      strokeThickness: 2 * dpr,
    }).setOrigin(1, 0.5).setDepth(300)
    this._progressText = progText

    this._inspectGroup.push(backBtn, nameText, progText)
  }

  // ── Info panel + choose button ─────────────────────────────────────────────

  _buildInspectBottom(W, H, dpr) {
    const panelH = 78 * dpr
    const panelY = H - panelH - 16 * dpr
    const panelW = W * 0.62
    const panelX = W * 0.03

    // Info panel background
    const panelBg = this.add.rectangle(
      panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x140a02, 0.90
    ).setStrokeStyle(1.5 * dpr, 0xb8943c, 0.60).setDepth(400)

    const titleText = this.add.text(panelX + 16 * dpr, panelY + 13 * dpr, '', {
      fontFamily: '"IM Fell English", serif',
      fontSize:   `${17 * dpr}px`,
      color:      '#f0d890',
    }).setDepth(401)

    const bodyText = this.add.text(panelX + 16 * dpr, panelY + 37 * dpr, '', {
      fontFamily: '"IM Fell English", serif',
      fontSize:   `${15 * dpr}px`,
      color:      '#e8d4b0',
      wordWrap:   { width: panelW - 32 * dpr },
    }).setDepth(401)

    this._infoPanel = { bg: panelBg, title: titleText, body: bodyText }
    this._inspectGroup.push(panelBg, titleText, bodyText)

    // Choose button (right of info panel)
    const btnW = W * 0.29
    const btnH = panelH
    const btnX = W * 0.695 + btnW / 2
    const btnY = panelY + panelH / 2

    const btnBg = this.add.rectangle(btnX, btnY, btnW, btnH, 0x140a02, 0.90)
      .setStrokeStyle(1.5 * dpr, 0xb8943c, 0.60)
      .setDepth(400)
      .setInteractive({ useHandCursor: true })

    const btnLabel = this.add.text(btnX, btnY, 'Inspect all\nclues first', {
      fontFamily:  '"IM Fell English", serif',
      fontSize:    `${16 * dpr}px`,
      color:       '#6a5030',
      align:       'center',
      lineSpacing: 6 * dpr,
    }).setOrigin(0.5, 0.5).setDepth(401)

    btnBg.on('pointerover', () => {
      if (this._chooseLocked) return
      btnBg.setFillStyle(0x2a1806, 0.95)
      btnLabel.setColor('#f0d890')
    })
    btnBg.on('pointerout', () => {
      if (this._chooseLocked) return
      btnBg.setFillStyle(0x140a02, 0.90)
      btnLabel.setColor('#c4a060')
    })
    btnBg.on('pointerup', () => {
      if (this._chooseLocked) {
        this._showClue({ _hint: true })
      } else {
        this._confirmSite()
      }
    })

    this._chooseBtnBg    = btnBg
    this._chooseBtnLabel = btnLabel
    this._inspectGroup.push(btnBg, btnLabel)
  }

  _showClue(clue) {
    if (!this._infoPanel) return
    const { title, body } = this._infoPanel
    if (!clue) {
      title.setText('Look around carefully.')
      body.setText('Each clue may affect whether this campsite is safe in rain.')
    } else if (clue._hint) {
      title.setText('')
      body.setText('I should inspect the area more carefully before deciding.')
    } else {
      title.setText(clue.label)
      body.setText(clue.body)
    }
  }

  // ── Progress + unlock ──────────────────────────────────────────────────────

  _onHotspotVisited(id) {
    this._visitedIds.add(id)
    const n = this._visitedIds.size
    if (this._progressText) this._progressText.setText(`Inspected  ${n} / 4`)
    if (n >= 4) this._unlockChooseButton()
  }

  _unlockChooseButton() {
    this._chooseLocked = false
    this._chooseBtnLabel.setText('Choose this site').setColor('#c4a060')
  }

  // ── Hotspot ────────────────────────────────────────────────────────────────

  _buildHotspot(x, y, data, dpr) {
    const rCore  =  9 * dpr
    const rMid   = 20 * dpr
    const rOuter = 36 * dpr

    const outerGlow = this.add.circle(x, y, rOuter, 0xffffff, 0.18).setDepth(198)
    const midGlow   = this.add.circle(x, y, rMid,   0xffd060, 0.60).setDepth(199)
    const core      = this.add.circle(x, y, rCore,  0xffe480, 1.00).setDepth(200)

    const tOuter = gsap.to(outerGlow, {
      scaleX: 1.35, scaleY: 1.35, alpha: 0.06,
      duration: 1.6, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 0.4,
    })
    const tMid = gsap.to(midGlow, {
      scaleX: 1.3, scaleY: 1.3, alpha: 0.28,
      duration: 1.2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    const tCore = gsap.to(core, {
      scaleX: 1.15, scaleY: 1.15, alpha: 0.78,
      duration: 1.0, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 0.2,
    })

    const label = this.add.text(x, y - rMid - 10 * dpr, data.label, {
      fontFamily: '"IM Fell English", serif',
      fontSize:   `${13 * dpr}px`,
      color:      '#e8c870',
      stroke:     '#000000',
      strokeThickness: 3 * dpr,
    }).setOrigin(0.5, 1).setDepth(201).setAlpha(0.80)

    const zone = this.add.zone(x, y, rOuter * 2.2, rOuter * 2.2)
      .setInteractive({ useHandCursor: true }).setDepth(202)

    let visited  = false
    let checkmark = null

    const setVisited = () => {
      if (visited) return
      visited = true
      gsap.killTweensOf(outerGlow); gsap.killTweensOf(midGlow); gsap.killTweensOf(core)
      tOuter.kill(); tMid.kill(); tCore.kill()
      gsap.to([outerGlow, midGlow], { alpha: 0, duration: 0.3 })
      gsap.to(core, { scaleX: 0.65, scaleY: 0.65, duration: 0.25, onComplete: () => core.setFillStyle(0xa07030) })
      label.setAlpha(0.55).setColor('#9a7840')
      checkmark = this.add.text(x + rMid * 0.9, y - rMid - 7 * dpr, '✓', {
        fontFamily: 'monospace',
        fontSize:   `${11 * dpr}px`,
        color:      '#b8943c',
      }).setOrigin(0, 1).setDepth(203)
    }

    zone.on('pointerover', () => {
      if (visited) return
      gsap.killTweensOf(core); gsap.killTweensOf(midGlow)
      gsap.to(core,    { scaleX: 1.5, scaleY: 1.5, duration: 0.12 })
      gsap.to(midGlow, { scaleX: 1.6, scaleY: 1.6, alpha: 0.85, duration: 0.12 })
      label.setAlpha(1).setColor('#fff4a0')
    })
    zone.on('pointerout', () => {
      if (visited) return
      gsap.killTweensOf(core); gsap.killTweensOf(midGlow)
      gsap.to(core,    { scaleX: 1, scaleY: 1, duration: 0.2 })
      gsap.to(midGlow, { scaleX: 1, scaleY: 1, alpha: 0.55, duration: 0.2 })
      label.setAlpha(0.80).setColor('#e8c870')
    })
    zone.on('pointerup', () => {
      setVisited()
      this._onHotspotVisited(data.id)
      this._showClue(data)
    })

    return {
      setVisited,
      destroy: () => {
        tOuter.kill(); tMid.kill(); tCore.kill()
        gsap.killTweensOf(outerGlow); gsap.killTweensOf(midGlow); gsap.killTweensOf(core)
        outerGlow.destroy(); midGlow.destroy(); core.destroy()
        label.destroy(); zone.destroy()
        if (checkmark) checkmark.destroy()
      },
    }
  }

  _clearHotspots() {
    this._hotspotObjects.forEach(h => h.destroy())
    this._hotspotObjects = []
  }

  // ── Go Back ───────────────────────────────────────────────────────────────

  _goBack() {
    const { _W: W, _H: H, _dpr: dpr } = this
    this._currentSite = null
    this._bg.setTexture('bg_forest_overview').setDisplaySize(W, H)
    this._topText.setVisible(true)
    this._clearHotspots()
    this._inspectGroup.forEach(o => o.destroy())
    this._inspectGroup  = []
    this._progressText  = null
    this._infoPanel     = null
    this._chooseBtnBg   = null
    this._chooseBtnLabel = null
    this._visitedIds    = new Set()
    this._buildMarker(W * 0.212, H * 0.754, 'A', dpr)
    this._buildMarker(W * 0.880, H * 0.429, 'B', dpr)
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  _confirmSite() {
    const siteId = this._currentSite
    if (!siteId || this._chooseLocked) return

    this._clearHotspots()
    this._inspectGroup.forEach(o => o.destroy())
    this._inspectGroup = []

    const { _W: W, _H: H } = this
    const camp = CAMPSITES[siteId]
    this._bg.setTexture(camp.bgRainKey).setDisplaySize(W, H)

    const [line1, line2] = camp.confirmLines
    this._setDialogue(line1,
      () => this._setDialogue(line2,
        () => { this._setDialogue(null, null); this._finish(camp.success) }
      )
    )
  }

  // ── Finish ────────────────────────────────────────────────────────────────

  _finish(success) {
    this.registry.set('campsiteQuality', success ? 'good' : 'poor')
    let staminaDepleted = false
    if (!success) {
      const stamina = this.registry.get('stamina')
      if (stamina) { const alive = stamina.deduct(2); staminaDepleted = !alive }
    }
    gsap.to(this.cameras.main, {
      alpha: 0, duration: 0.5,
      onComplete: () => {
        this.game.events.emit(GameEvents.MINIGAME_COMPLETE, {
          id: 'campsite', success, staminaDepleted,
        })
        this.scene.stop('CampsiteMinigame')
      },
    })
  }
}
