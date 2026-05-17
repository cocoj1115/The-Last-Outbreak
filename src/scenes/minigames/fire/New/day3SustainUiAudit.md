# Day 3 sustain — predator-window UI audit (depth / layout)

Reference: `FireBuildingMinigame.js`, `DialogueBox.js`, `HUDScene.js`, `BootScene.js` (scene order).

## Phaser scene stacking (mock boot)

`BootScene` launches `HUDScene`, then `scene.start(FireCampsiteMinigame / FireBuilding…)`. The **started** main game scene is normally drawn **above** an already-running HUD in Phaser 3’s default scene list ordering. **Stamina / day counter in `HUDScene` can sit on top of campsite content** in the same screen region (e.g. upper band), independent of per-object `depth` inside `FireBuildingMinigame`.

## FireBuildingMinigame — sustain predator window (simultaneous layers)

| Component | Anchor / position | depth | Notes |
|-----------|-------------------|-------|-------|
| `_bgRect` | full screen | 0 | BG |
| Pit circle + inner ring | `_pitX=W/2`, `_pitY≈H*0.46` | 1 | |
| `_fireIcon` (sustain) | pit | 2 → **32** at sustain start (`_beginSustain`) | Raised for sustain |
| Wind ring guide `_day3WindRingGfx` | pit-centred | **2** (`DAY3_WIND_RING_GUIDE_DEPTH`) | Below most UI |
| Day 3 rocks `🪨` | 12 fixed offsets from pit | **3** | |
| Wind-slot debug rects (DEV) | cardinals ±100 | **4** | |
| Drifting wind leaves | animated | **6** | |
| Todo list panel | `x≈14`, `startY≈62` | **11–12** | Left column |
| Night bar label + track + fill | bottom `H-28` band | **10–11** | “Burn through the night” |
| **Fire strength** HUD | top-centre `barY≈64` | **10** | Shares upper band with gust warn |
| Gust warn **text** | `W/2`, `pad+46` (`pad=56` → **y≈102**) | **4102** | |
| Gust warn **bar** bg / fill | below text | **4102 / 4104** | |
| Crouch prompt | `W/2`, `_pitY - STACK_TOP_R - 48` | **4002** | Warn window |
| Cardinal crouch arcs | slot centres | **4003** | |
| Windward silhouette gfx | offset toward windward slot | **4004** | Sustain |
| Gust **flash** fullscreen rect | centre | **4000** | Burst |
| **DialogueBox** (Aiden lines) | bottom card | **4500** (`DialogueBox.js`) | **`showSequence` during warn** — **covers everything below 4500**, including Gust HUD (410x) |
| SPREAD remediation / special drags | varies | **4620+** | Not sustain predator default |

## HUDScene (parallel scene)

| Component | Position | depth | Notes |
|-----------|----------|-------|-------|
| Stamina flame graphics | top-left | default 0 in scene | |
| Stamina hit `zone` | top-left | **5000** | Full-width priority for hover |
| Rules overlay + panel | expanded | **5999–6001** when open | |
| Day text | top-right | unset (0) | |

## Conflicts (root causes for “Gust incoming invisible”)

1. **Dialogue (4500) vs Gust (4102–4104):** `_runDay3WindWarningPhaseContinue` calls `_dialogue.showSequence` **before** `_mountDay3SustainGustWarnHud`. While the line is on screen, the **dialogue card fills the lower half** but the **nineslice depth 4500 beats 4102**, so any overlap region (and visual attention) hides the gust strip unless the player dismisses dialogue quickly.
2. **Scene order:** If `HUDScene` renders above the campsite scene, **HUD elements occlude the entire minigame**, including top-centre gust HUD — **depth inside FireBuilding cannot fix cross-scene occlusion**; only reorder scenes, move Gust into HUD, or lower HUD opacity in that band.
3. **First-gust tutorial:** `showDay3SustainInfoModal` + `_pauseDay3GlobalForSustainTutorial` — clocks paused; Gust HUD may only appear after resume.
4. **Vertical competition:** Fire strength label/segments (`y≈64`) vs Gust text (`y≈102`) — same general “top” area; different depths (10 vs 4102) mean **Gust wins inside the same scene**, but **not** against HUD or dialogue.

## Layout sketch (same scene, conceptual)

```text
[HudScene layer if on top: stamina ···················· Day n/5]

[Fire strength — depth 10 ·················]
[Todo — left 11–12]

[Gust "Gust incoming…" — 4102 — may be under Dialogue 4500]

[Dialogue card bottom — 4500 ·······················]

[Pit / ring / rocks / picker — mid screen]

[Night bar — bottom 10–11]
```

## Fix direction (v1 implemented in code)

- **`_mountDay3SustainGustWarnHud`:** depth **4583–4587** (above `DialogueBox` 4500); label Y `min(142, pitY-188)`; bar width up to **460**; `scene.manager.bringToTop(this.scene)` on mount.
- **`_runDay3WindWarningPhaseContinue`:** **`showSequence`** moved to **end** (after warn timer + flash) so Gust mounts before the line.
- **Conflicts item 1:** still relevant for any **full-screen** dialogue; warn strip is now **above** dialogue in depth.
