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

const DAY3_CAMPSITES = {
  A: {
    name: 'Site A — Ridge',
    bgKey: 'd3_bg_site_a',
    bgRainKey: 'd3_bg_site_a_rain',
    hotspots: [
      { id: 'ridge',  x: 0.720, y: 0.346, label: 'Rock Face',
        body: 'The rock face runs north-south. Whatever comes from the north hits this first.' },
      { id: 'view',   x: 0.601, y: 0.472, label: 'View',
        body: 'I cannot see very far from here. The ridge blocks the view north.' },
      { id: 'ground', x: 0.564, y: 0.811, label: 'Ground',
        body: 'Firm. No water marks on the stones. This has not flooded recently.' },
      { id: 'stream', x: 0.361, y: 0.822, label: 'Stream',
        body: 'I can hear water but I cannot see it from here. It is below me somewhere.' },
      { id: 'roots',  x: 0.087, y: 0.607, label: 'Tree Roots',
        body: 'Old roots here. This tree has been standing a long time.' },
      { id: 'light',  x: 0.335, y: 0.226, label: 'Light',
        body: 'The sun will hit this spot early in the morning.' },
    ],
    confirmLines: [
      'I got lucky choosing this spot. The ridge is taking everything — wind, cold, all of it. I can feel the difference already.',
      'The view told me. I could not see north from here.',
      'Water below, not beside. Ground has not flooded.',
    ],
    success: true,
  },
  B: {
    name: 'Site B — Open High Ground',
    bgKey: 'd3_bg_site_b',
    bgRainKey: 'd3_bg_site_b_rain',
    hotspots: [
      { id: 'wind',     x: 0.151, y: 0.327, label: 'Wind',
        body: 'My coat keeps shifting. The wind changes direction every few minutes.' },
      { id: 'grass',    x: 0.465, y: 0.523, label: 'Grass',
        body: 'The grass here is short and pressed flat. Has been for a while.' },
      { id: 'view',     x: 0.724, y: 0.391, label: 'Surroundings',
        body: 'I can see the whole valley from here. Nothing blocking anything.' },
      { id: 'ground',   x: 0.519, y: 0.693, label: 'Ground',
        body: 'High ground. Dry. The best-draining spot I have seen today.' },
      { id: 'stones',   x: 0.360, y: 0.580, label: 'Stones',
        body: 'Low flat stones. They would not get in the way.' },
      { id: 'tree',     x: 0.651, y: 0.169, label: 'Tree',
        body: 'One tree at the edge. Too far away to block anything.' },
      { id: 'overhead', x: 0.464, y: 0.246, label: 'Overhead',
        body: 'Nothing above me for fifty metres in every direction.' },
    ],
    confirmLines: [
      'High ground. I thought that meant safe.',
      'But the grass is flat because the wind never stops here. Nothing to slow it down — not a tree, not a rock.',
      'The wind is brutal. I am already cold.',
      'This is going to be a long night.',
    ],
    success: false,
  },
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export class CampsiteMinigame extends Phaser.Scene {
  constructor() {
    super({ key: 'CampsiteMinigame' })
  }

  init(data) {
    this.day               = data.day ?? 2
    this._campsiteData     = this.day === 3 ? DAY3_CAMPSITES : CAMPSITES
    this._overviewBgKey    = this.day === 3 ? 'd3_bg_forest_overview' : 'bg_forest_overview'
    this._maxClicks        = this.day === 3 ? 3 : 4
    this._clicksUsed       = 0
    this._currentSite      = null
    this._markers          = []
    this._hotspotObjects   = []
    this._inspectGroup     = []
    this._visitedIds       = new Set()
    this._chooseLocked     = true
    this._progressText     = null
    this._infoPanel        = null
    this._chooseBtnBg      = null
    this._chooseBtnLabel   = null
    this._dialogueBg       = null
    this._speakerText      = null
    this._dialogueText     = null
  }

  create() {
    const W   = this.scale.width
    const H   = this.scale.height
    const dpr = window.devicePixelRatio || 1
    this._W = W; this._H = H; this._dpr = dpr

    this._bg = this.add.image(W / 2, H / 2, this._overviewBgKey)
      .setDisplaySize(W, H).setDepth(0)

    this._topText = this.add.text(W / 2, 72 * dpr,
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

    if (this.day === 3) {
      this._buildMarker(W * 0.25, H * 0.50, 'A', dpr)
      this._buildMarker(W * 0.75, H * 0.40, 'B', dpr)
    } else {
      this._buildMarker(W * 0.212, H * 0.754, 'A', dpr)
      this._buildMarker(W * 0.880, H * 0.429, 'B', dpr)
    }

    this.cameras.main.setAlpha(0)
    gsap.to(this.cameras.main, { alpha: 1, duration: 0.5 })
  }

  // ── Dialogue box (confirmation only) ──────────────────────────────────────

  _buildDialogueBox(W, H, dpr) {
    const boxW = W * 0.946
    const boxH = (H - Math.round(H * 0.699)) * 0.739
    const boxX = W / 2
    const boxY = H * 0.745

    this._dialogueBg = this.add.nineslice(
      boxX, boxY + boxH / 2,
      'dialogue_card', undefined,
      boxW, boxH,
      80, 80, 80, 80,
    ).setDepth(600).setVisible(false)

    const textX = W * 0.099
    this._speakerText = this.add.text(textX, H * 0.795, 'Aiden', {
      fontSize:   `${Math.round(19.5 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color:      '#5c3a00',
      fontStyle:  'italic',
    }).setDepth(601).setVisible(false)

    this._dialogueText = this.add.text(textX, H * 0.795 + 30 * dpr, '', {
      fontSize:   `${Math.round(24.7 * dpr)}px`,
      fontFamily: '"IM Fell English", serif',
      color:      '#2a1500',
      wordWrap:   { width: W - textX - 80 * dpr },
      lineSpacing: 6 * dpr,
    }).setDepth(601).setVisible(false)
  }

  _setDialogue(text, onClick) {
    const vis = text !== null
    this._dialogueBg.setVisible(vis)
    this._speakerText.setVisible(vis)
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
    const r = 14 * dpr

    // Glow layers
    const outerGlow = this.add.circle(x, y, r * 3.2, 0xffffff, 0.12).setDepth(198)
    const midGlow   = this.add.circle(x, y, r * 1.9, 0xfff8e0, 0.45).setDepth(199)
    const core      = this.add.circle(x, y, r,        0xffffff, 1.00).setDepth(200)

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
    zone.on('pointerover', () => { core.setFillStyle(0xfff8e0); gsap.to(midGlow, { alpha: 0.7, scaleX: 1.5, scaleY: 1.5, duration: 0.12 }) })
    zone.on('pointerout',  () => { core.setFillStyle(0xffffff); gsap.to(midGlow, { alpha: 0.45, scaleX: 1, scaleY: 1, duration: 0.2 }) })
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
    this._currentSite  = siteId
    this._visitedIds   = new Set()
    this._clicksUsed   = 0
    this._chooseLocked = true

    const camp = this._campsiteData[siteId]
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
    const y = 60 * dpr

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

    this._inspectGroup.push(backBtn, nameText)

    if (this.day === 3) {
      // Clue counter on a second row, centred
      const progText = this.add.text(W / 2, y + 26 * dpr, `Clues remaining: ${this._maxClicks}`, {
        fontFamily: '"IM Fell English", serif',
        fontSize:   `${19 * dpr}px`,
        color:      '#c4a060',
        stroke:     '#000000',
        strokeThickness: 2 * dpr,
      }).setOrigin(0.5, 0.5).setDepth(300)
      this._progressText = progText

      this._inspectGroup.push(progText)
    } else {
      const progText = this.add.text(W - 24 * dpr, y, 'Inspected  0 / 4', {
        fontFamily: '"IM Fell English", serif',
        fontSize:   `${15 * dpr}px`,
        color:      '#c4a060',
        stroke:     '#000000',
        strokeThickness: 2 * dpr,
      }).setOrigin(1, 0.5).setDepth(300)
      this._progressText = progText
      this._inspectGroup.push(progText)
    }
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
      body.setText('Each clue may affect whether this campsite is safe')
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
    this._clicksUsed = this._visitedIds.size
    const n = this._clicksUsed

    if (this.day === 3) {
      const remaining = Math.max(0, this._maxClicks - n)
      if (this._progressText) this._progressText.setText(`Clues remaining: ${remaining}`)
      if (n === 1) this._unlockChooseButton()
      if (n >= this._maxClicks) {
        this._hotspotObjects.forEach(h => h.lock())
      }
    } else {
      if (this._progressText) this._progressText.setText(`Inspected  ${n} / 4`)
      if (n >= this._maxClicks) this._unlockChooseButton()
    }
  }

  _unlockChooseButton() {
    this._chooseLocked = false
    this._chooseBtnLabel.setText('Choose this site').setColor('#c4a060')
  }

  // ── Hotspot ────────────────────────────────────────────────────────────────

  _buildHotspot(x, y, data, dpr) {
    const sz     = this.day === 2 ? 1.45 : 1.0
    const rCore  =  9 * dpr * sz
    const rMid   = 20 * dpr * sz
    const rOuter = 36 * dpr * sz

    const outerGlow = this.add.circle(x, y, rOuter, 0xffffff, 0.15).setDepth(198)
    const midGlow   = this.add.circle(x, y, rMid,   0xfff8e0, 0.45).setDepth(199)
    const core      = this.add.circle(x, y, rCore,  0xffffff, 1.00).setDepth(200)

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
      lock: () => {
        if (visited) return
        zone.disableInteractive()
        tOuter.kill(); tMid.kill(); tCore.kill()
        gsap.killTweensOf(outerGlow); gsap.killTweensOf(midGlow); gsap.killTweensOf(core)
        gsap.to([outerGlow, midGlow, core], { alpha: 0.2, duration: 0.3 })
        gsap.to(label, { alpha: 0.2, duration: 0.3 })
      },
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
    this._bg.setTexture(this._overviewBgKey).setDisplaySize(W, H)
    this._topText.setVisible(true)
    this._clearHotspots()
    this._inspectGroup.forEach(o => o.destroy())
    this._inspectGroup   = []
    this._progressText   = null
    this._infoPanel      = null
    this._chooseBtnBg    = null
    this._chooseBtnLabel = null
    this._visitedIds     = new Set()
    this._clicksUsed     = 0
    if (this.day === 3) {
      this._buildMarker(W * 0.25, H * 0.50, 'A', dpr)
      this._buildMarker(W * 0.75, H * 0.40, 'B', dpr)
    } else {
      this._buildMarker(W * 0.212, H * 0.754, 'A', dpr)
      this._buildMarker(W * 0.880, H * 0.429, 'B', dpr)
    }
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  _confirmSite() {
    const siteId = this._currentSite
    if (!siteId || this._chooseLocked) return

    this._clearHotspots()
    this._inspectGroup.forEach(o => o.destroy())
    this._inspectGroup = []

    const { _W: W, _H: H } = this
    const camp = this._campsiteData[siteId]
    this._bg.setTexture(camp.bgRainKey).setDisplaySize(W, H)

    const lines = camp.confirmLines
    let index = 0
    const showNext = () => {
      if (index < lines.length) {
        this._setDialogue(lines[index], () => { index++; showNext() })
      } else {
        this._setDialogue(null, null)
        this._finish(camp.success)
      }
    }
    showNext()
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
