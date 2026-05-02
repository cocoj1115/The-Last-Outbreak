/**
 * UIConstants.js
 * Single source of truth for all visual values.
 * Both developers import from here — never hardcode colours or sizes elsewhere.
 *
 * Dev A  — uses: FONTS, DIALOGUE, TRANSITIONS, DEPTH
 * Dev B  — uses: FONTS, BUTTONS, HUD, TRANSITIONS, DEPTH
 */

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS
// ─────────────────────────────────────────────────────────────────────────────

export const CANVAS = {
  WIDTH:  1280,
  HEIGHT: 720,
  BG:     0x000000,    // letterbox colour (Phaser int)
  BG_CSS: '#000000',   // same, CSS string
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR PALETTE
// All colours as CSS strings. Convert to Phaser int: 0x + hex.slice(1)
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE = {
  // Text
  TEXT_DIALOGUE:   '#f5e6d3',   // warm white — dialogue body
  TEXT_BUTTON:     '#f0dfc0',   // slightly cooler — button labels
  TEXT_BUTTON_HOV: '#fff8e7',   // hover state
  TEXT_CONFIRM:    '#d4f0d8',   // green-tinted — confirm button
  TEXT_BACK:       '#c8b89a',   // muted warm — back button
  TEXT_HUD:        '#2a2218',   // dark brown — on light pill background
  TEXT_HINT:       '#b0a090',   // small hints / secondary labels
  TEXT_SCENE:      '#c8c0a8',   // scene title / chapter marker

  // Glow / border
  GLOW:            '#c49850',   // warm gold — all glows and border accents
  GLOW_RGBA:       'rgba(196,152,80,',  // append alpha + ')' e.g. GLOW_RGBA + '0.35)'

  // Surfaces
  SURFACE_DARK:    'rgba(8,4,0,0.78)',     // dialogue box bg
  SURFACE_BTN:     'rgba(18,10,2,0.88)',   // button bg at rest
  SURFACE_BTN_HOV: 'rgba(30,16,4,0.92)',  // button bg on hover
  SURFACE_CONFIRM: 'rgba(10,26,12,0.92)', // confirm button bg
  SURFACE_BACK:    'rgba(18,12,6,0.85)',  // back button bg
  SURFACE_HUD:     'rgba(245,232,205,0.88)', // HUD pill bg

  // Confirm / green
  GLOW_GREEN:      'rgba(80,180,90,',     // append alpha + ')'

  // Overlay
  OVERLAY:         'rgba(0,0,0,0.52)',     // dark scene overlay
  DIALOG_OVERLAY:  'rgba(0,0,0,0.62)',    // dialogue box tint
}

// ─────────────────────────────────────────────────────────────────────────────
// FONTS
// System font stacks only — no CDN, no @font-face.
// ─────────────────────────────────────────────────────────────────────────────

export const FONTS = {
  SERIF:      'Georgia, serif',
  SANS:       'Segoe UI, Arial, sans-serif',
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT STYLES
// Pass directly to Phaser add.text() as the style object.
// ─────────────────────────────────────────────────────────────────────────────

export const TEXT_STYLE = {
  DIALOGUE_BODY: {
    fontFamily:  FONTS.SERIF,
    fontSize:    '22px',
    color:       PALETTE.TEXT_DIALOGUE,
    lineSpacing: 7,
  },

  CHOICE_LABEL: {
    fontFamily:    FONTS.SANS,
    fontSize:      '15px',
    color:         PALETTE.TEXT_BUTTON,
    letterSpacing: 0.02,
  },

  CONFIRM_LABEL: {
    fontFamily:    FONTS.SANS,
    fontSize:      '15px',
    color:         PALETTE.TEXT_CONFIRM,
    letterSpacing: 0.04,
  },

  BACK_LABEL: {
    fontFamily: FONTS.SANS,
    fontSize:   '13px',
    color:      PALETTE.TEXT_BACK,
  },

  SCENE_TITLE: {
    fontFamily: FONTS.SERIF,
    fontSize:   '20px',
    color:      PALETTE.TEXT_SCENE,
  },

  HUD_LABEL: {
    fontFamily: FONTS.SERIF,
    fontSize:   '13px',
    color:      PALETTE.TEXT_HUD,
  },

  HINT: {
    fontFamily: FONTS.SANS,
    fontSize:   '13px',
    color:      PALETTE.TEXT_HINT,
  },

  // Continue arrow ▼ shown after typewriter finishes
  CONTINUE_ARROW: {
    fontFamily: FONTS.SERIF,
    fontSize:   '14px',
    color:      '#c4a882',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOGUE BOX
// ─────────────────────────────────────────────────────────────────────────────

export const DIALOGUE = {
  // Geometry
  MARGIN_X:       32,    // px from screen edge, each side
  MARGIN_BOTTOM:  68,    // px from screen bottom to box bottom edge
  HEIGHT:         158,   // px
  get WIDTH()     { return CANVAS.WIDTH - this.MARGIN_X * 2 },  // 1216px
  get X()         { return CANVAS.WIDTH / 2 },
  get Y()         { return CANVAS.HEIGHT - this.MARGIN_BOTTOM - this.HEIGHT / 2 },

  // Text offsets inside box
  TEXT_PAD_LEFT:  38,    // px from box left edge to text start
  TEXT_PAD_TOP:   18,    // px from box top edge to text start
  get TEXT_WRAP_WIDTH() {
    return this.WIDTH - this.TEXT_PAD_LEFT - 20
  },

  // Visuals
  BG_COLOR:       0x000000,
  BG_ALPHA:       0.62,
  BORDER_COLOR:   0x5c4033,
  BORDER_ALPHA:   0.8,
  BORDER_WIDTH:   1,

  // Warm glow — applied as Phaser FX or rendered as a Graphics shadow rect
  GLOW_COLOR:     0xc49850,
  GLOW_OUTER_PX:  12,    // outer spread
  GLOW_ALPHA:     0.12,  // opacity of glow

  // Continue arrow
  ARROW_OFFSET_RIGHT:  28,   // px from box right edge
  ARROW_OFFSET_BOTTOM: 22,   // px from box bottom edge
  ARROW_TWEEN: {
    alpha:    { from: 0, to: 1 },
    duration: 520,
    yoyo:     true,
    repeat:   -1,
    ease:     'Sine.easeInOut',
  },

  // Typewriter
  TYPEWRITER_DELAY_MS: 35,   // ms per character
}

// ─────────────────────────────────────────────────────────────────────────────
// BUTTONS
// ─────────────────────────────────────────────────────────────────────────────

export const BUTTONS = {
  // Choice buttons (dialogue options)
  CHOICE: {
    FONT:         TEXT_STYLE.CHOICE_LABEL,
    PAD_X:        22,
    PAD_Y:        11,
    GAP:          9,          // vertical gap between buttons
    ARROW_CHAR:   '▷ ',
    ARROW_COLOR:  '#b89060',
    // Glow border values — implemented via Graphics or CSS-equivalent technique
    GLOW_ALPHA_REST:  0.28,
    GLOW_ALPHA_HOVER: 0.55,
    GLOW_PX_HOVER:    14,
  },

  // Confirm button (minigame / campsite selection)
  CONFIRM: {
    FONT:              TEXT_STYLE.CONFIRM_LABEL,
    PAD_X:             26,
    PAD_Y:             10,
    BG_COLOR:          0x0a1a0c,
    BG_ALPHA:          0.92,
    GLOW_COLOR:        0x50b45a,
    GLOW_ALPHA_REST:   0.07,
    GLOW_ALPHA_HOVER:  0.18,
    GLOW_PX_HOVER:     16,
    DISABLED_COLOR:    '#2a3a2c',
    DISABLED_BG:       0x0a100b,
  },

  // Back button (top-left, always on top)
  BACK: {
    FONT:     TEXT_STYLE.BACK_LABEL,
    LABEL:    '← Back',
    PAD_X:    12,
    PAD_Y:    8,
    X:        16,
    Y:        14,
    BG_COLOR: 0x1a120a,
    BG_ALPHA: 0.85,
    GLOW_ALPHA_REST:  0.18,
    GLOW_ALPHA_HOVER: 0.4,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD
// Stamina shown as a countdown number (most intuitive).
// Days shown as "Day X / 7".
// ─────────────────────────────────────────────────────────────────────────────

export const HUD = {
  // Stamina counter — top-left
  STAMINA: {
    X:          24,
    Y:          20,
    FONT:       { ...TEXT_STYLE.HUD_LABEL, fontSize: '15px' },
    // Rendered as:  "Stamina  3"  where the number counts down
    // Number colour changes with urgency:
    COLOR_SAFE:     '#c4f0c8',   // 4–5 remaining
    COLOR_WARNING:  '#f0d890',   // 2–3 remaining
    COLOR_DANGER:   '#f09070',   // 1 remaining
  },

  // Day counter — top-right
  DAY: {
    get X() { return CANVAS.WIDTH - 20 },
    Y:      20,
    FONT:   { ...TEXT_STYLE.HUD_LABEL, fontSize: '15px' },
    // Rendered as:  "Day 3 / 7"
  },

  // Pill background (wraps both counters)
  PILL: {
    BG_COLOR:    0xf5e8cd,
    BG_ALPHA:    0.88,
    PAD_X:       10,
    PAD_Y:       4,
    GLOW_COLOR:  0xc49850,
    GLOW_ALPHA:  0.1,
    GLOW_PX:     8,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE TRANSITIONS
// All transitions use GSAP — no Phaser fadeIn/fadeOut.
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSITIONS = {
  FADE_IN:  { alpha: 1, duration: 0.5, ease: 'none' },
  FADE_OUT: { alpha: 0, duration: 0.5, ease: 'none' },
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH LAYERS
// Assign depth to every object using these constants.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPTH = {
  BACKGROUND:    0,
  OVERLAY:       1,
  WORLD_LABELS:  4900,
  DIALOGUE_BG:   4998,
  DIALOGUE_TEXT: 5000,
  DIALOGUE_ARROW:5001,
  BUTTONS:       5002,
  HUD:           9000,
  BACK_BTN:      9500,
}
