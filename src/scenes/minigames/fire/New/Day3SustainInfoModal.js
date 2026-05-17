/**
 * Lightweight modal for Day 3 sustain tutorial / info overlays.
 * No Phaser DialogueBox dependency — fullscreen dim + card + Got it.
 *
 * @param {{
 *   title: string,
 *   bodyLines: string[],
 *   confirmLabel?: string,
 *   onConfirm?: () => void,
 * }} opts
 */

export function showDay3SustainInfoModal(scene, opts) {
  const {
    title,
    bodyLines,
    confirmLabel = 'Got it',
    onConfirm = null,
  } = opts
  const W = scene.scale.width
  const H = scene.scale.height

  const objs = []

  const dim = scene.add
    .rectangle(W / 2, H / 2, W + 24, H + 24, 0x060606, 0.72)
    .setDepth(5600)
    .setScrollFactor(0)
  objs.push(dim)

  const cardW = Math.min(W * 0.9, 420)
  const cardH = Math.min(H * 0.55, 440)
  const card = scene.add
    .rectangle(W / 2, H / 2, cardW, cardH, 0x141210, 0.94)
    .setStrokeStyle(2, 0x8a6840, 0.72)
    .setDepth(5602)
    .setScrollFactor(0)
  objs.push(card)

  const titleTxt = scene.add
    .text(W / 2, H / 2 - cardH / 2 + 36, title, {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      fill: '#e8dcc8',
      align: 'center',
    })
    .setOrigin(0.5, 0)
    .setDepth(5605)
    .setScrollFactor(0)
  objs.push(titleTxt)

  const body = bodyLines.join('\n\n')
  const bodyTxt = scene.add
    .text(W / 2, H / 2 - cardH / 2 + 92, body, {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fill: '#c8baa0',
      wordWrap: { width: cardW - 52 },
      lineSpacing: 4,
      align: 'left',
    })
    .setOrigin(0.5, 0)
    .setDepth(5605)
    .setScrollFactor(0)
  objs.push(bodyTxt)

  const hide = () => {
    for (const o of objs) {
      try {
        o?.destroy?.()
      } catch (_) {
        /* noop */
      }
    }
  }

  const btnLabel = scene.add
    .text(W / 2, H / 2 + cardH / 2 - 48, confirmLabel, {
      fontSize: '16px',
      fontFamily: 'Georgia, serif',
      fill: '#1a1510',
      backgroundColor: '#c8a060',
      padding: { left: 22, right: 22, top: 10, bottom: 10 },
    })
    .setOrigin(0.5)
    .setDepth(5606)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0)

  objs.push(btnLabel)
  btnLabel.on('pointerup', () => {
    hide()
    if (typeof onConfirm === 'function') onConfirm()
  })

  return { hide }
}
