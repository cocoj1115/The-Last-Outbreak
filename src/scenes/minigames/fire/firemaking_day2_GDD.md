# Fire-Making Minigame — Day 2
## Game Design Document

---

## Overview

This document describes the fire-making minigame for Day 2 of *7 Days in the Forest*. The minigame takes place across two scenes: a forest scene where the player collects materials, and a campsite scene where the player clears the area, sorts materials, stacks the fire, ignites it, and sustains it through a rain night.

Day 2 is the tutorial version of fire-making. Every meaningful action gives the player immediate feedback explaining what they did and why it matters. The player learns by doing with explanation. Failure is possible but the game always tells the player what went wrong.

The minigame begins after campsite selection is complete. The campsite quality (good or poor) chosen by the player carries into this minigame and affects difficulty throughout.

---

## Scene Structure

```
Campsite Selection (preceding scene)
        ↓
Scene 1: Forest — Collect Materials
        ↓
Scene 2: Campsite — Clear → Sort → Stack → Ignite → Sustain
        ↓
Rain stops → Shimmerleaf search window (next scene)
```

---

# Scene 1: Forest — Collect Materials

## Game Mechanics

The player enters a dark forest scene at night. It is raining. Materials appear one at a time in randomised positions across the screen. Each material has a wet timer — the longer a material sits in the rain uncollected, the worse its quality becomes.

**Material spawning:**
- Materials spawn one at a time every 3 seconds at a random screen position
- Maximum 4 materials visible on screen at any time
- There is a pool of 8 possible material types (see Material Table below)
- Materials spawn in random order from the pool
- Once the player has filled all 4 backpack slots, all remaining materials on screen fade out and the Head Back button appears

**Wet timer mechanic:**
- Each material has a circular timer ring around it that fills up over a set number of seconds (the wet timer duration varies per material — see Material Table)
- At 50% of the timer duration, a tween begins that gradually shifts the material's tint to a darker, damp colour. This is a visual warning that the material is getting wet
- At 100% of the timer duration, the material's hidden quality downgrades one level: GOOD becomes MID, MID becomes BAD
- The timer then resets and the material stays at its new degraded quality. It does not disappear
- Some materials (damp_bark, wet_moss, wet_log) start at MID or BAD quality and have no wet timer — they are already degraded on spawn
- The wet tint effect is achieved via Phaser's setTint() on the sprite. No additional art assets are needed — one clean sprite per material, wet state handled entirely by code

**Collecting materials:**
- First click on a material: Aiden speaks a one-line tactile observation describing what the material feels like. This line is displayed in the dialogue box at the bottom of the screen
- Second click on the same material: the material moves into the next empty backpack slot
- The player can click a filled backpack slot to eject that item back onto the ground. It reappears at its original position with its current quality state (including any wetness degradation that occurred while it was in the backpack)
- The player must fill all 4 backpack slots before they can head back

**Day 2 immediate feedback:**
- If the player collects a BAD quality material, a feedback line appears immediately: *"That's already too wet — it won't catch. You can swap it out before heading back."*
- This is the only feedback in this scene. No penalty for collecting bad materials — the consequence comes later during ignition

**Material quality hidden from player:**
- The quality value (GOOD, MID, BAD) is never shown to the player as text or icon
- The only signal is the visual wet tint and the weight of Aiden's observation line
- The player must make judgements based on what they see and hear

## Material Table

| Material ID | Visual description | Aiden observation | Base quality | Wet timer |
|-------------|-------------------|-------------------|-------------|-----------|
| dry_leaves | Pale brown, curled edges, light-looking | "Light. Crumbles when I press it." | GOOD | 4 seconds |
| dry_twigs | Grey, visible cracks along the grain | "Snaps cleanly." | GOOD | 6 seconds |
| thick_branch | Dark brown, dense, clearly heavy | "Heavy. This will burn long." | GOOD | 8 seconds |
| dry_grass | Pale yellow, loose bundle, airy | "This will catch fast." | GOOD | 3 seconds |
| pine_cone | Brown, compact, medium size | "Compact. Might work for fuel." | MID | 5 seconds |
| damp_bark | Dark surface, slight sheen already | "Already heavy. Getting wetter." | MID | No timer — already degraded |
| wet_moss | Deep green, clumped together, dense | "Sticky. This won't catch." | BAD | No timer — already BAD |
| wet_log | Dark smooth bark, visibly waterlogged | "Too waterlogged. Useless tonight." | BAD | No timer — already BAD |

**Quality effect on ignition difficulty:**
At the end of Scene 1, the four collected materials are evaluated. This sets the ignition difficulty used in Scene 2 Step 4.
- 2 or more BAD quality materials selected → HARD
- 1 BAD or 2 or more MID materials selected → MEDIUM
- All GOOD or mostly GOOD with no BAD → EASY

**Effect of poor campsite on material quality:**
If the player chose the poor campsite (Site A, low hollow) in the preceding campsite selection, the starting quality of dry_leaves and dry_grass is reduced to MID. Their sprites appear slightly darker and damper. No text label changes. The player sees the visual difference but receives no explanation.

## Game Visuals

- Background: BG-FOREST-RAIN — dark forest at night, rain-soaked ground, wet reflections on leaves, 2560×1440
- Each material is rendered as a distinct static sprite on the ground at a random position
- Timer ring: a circular progress ring surrounds each material sprite and fills clockwise. It is white and thin
- Wet tween: as the timer fills past 50%, the sprite's tint shifts gradually toward a dark damp green-grey colour using Phaser's tween and setTint. The shift completes by the time the timer reaches 100%
- At BAD quality, the sprite's alpha is slightly reduced (around 0.85) making it look heavy and dull
- On first click: dialogue box appears at bottom of screen with Aiden's observation line
- On second click: material sprite moves into the backpack slot at the bottom of the screen
- Backpack panel: horizontal bar at the bottom of the screen with 4 outlined slots. Empty slots show a grey outline. Filled slots show a small thumbnail of the item
- Rain overlay: a semi-transparent rain layer over the entire scene to reinforce the rain atmosphere

## Game Controls

- First click on a material sprite → plays Aiden's observation line
- Second click on the same material sprite → adds it to the backpack
- Click on a filled backpack slot → ejects the item back to the ground at its original position
- When all 4 slots are filled → Head Back button appears bottom-right
- Click Head Back → transition to Scene 2

## Game Flow

1. Player enters the forest scene
2. Materials begin spawning at random positions with wet timers running
3. Player inspects and collects 4 materials
4. Player can swap items by ejecting from backpack and recollecting
5. When all 4 slots are filled, Head Back button appears
6. Player clicks Head Back → ignition difficulty is calculated from collected materials → Scene 2 begins

---

# Scene 2: Campsite — Clear, Sort, Stack, Ignite, Sustain

## Game Mechanics — Overview

The player returns to the campsite. All remaining steps happen in this single scene. The campsite has several interactive zones that become available as the player progresses. The player is not forced into a strict sequence by menus or locked screens — instead, attempting actions out of logical order produces natural in-world consequences or Aiden simply says what needs to happen first.

**Interactive zones in the campsite scene:**
- Debris zone: clickable debris items scattered around the fire pit. Active on arrival
- Sort zone: three labelled ground areas — Tinder, Kindling, Fuel Wood — where collected materials are dragged and sorted. Active on arrival
- Stack zone: the fire pit itself with three concentric ring overlays representing layers — Bottom, Middle, Top. Becomes active after all sortable materials are correctly placed in the sort zones
- Ignite button: a flint icon beside the fire pit. Becomes active after the stack is complete
- Add Fuel button: beside the fire pit. Becomes active after ignition succeeds and the sustain phase begins

**Out-of-order action responses:**

| Action attempted out of order | What happens |
|-------------------------------|-------------|
| Try to stack before sorting is complete | Stack zone is inactive. Aiden says: "I should organise these first." |
| Try to ignite before stacking is complete | Ignite button is greyed out. Aiden says: "I haven't built the fire yet." |
| Ignite without clearing debris first | Fire lights successfully but sustain drain rate is increased by 20%. Day 2 feedback line plays after ignition: "I should have cleared the area first. The ground isn't stable." |

---

## Step 1: Clear Ground

### Game Mechanics

There are 6 debris items scattered around the fire pit area. These include dry leaves, small twigs, and dirt clumps. The player clicks each item to remove it.

Clearing all debris causes a rock ring sprite to appear automatically around the fire pit. This represents the player creating a contained fire site.

If the player skips this step and ignites the fire without clearing, the fire still lights. However, the sustain drain rate in Step 5 is increased by 20% because the unstable ground makes the fire harder to maintain. The player receives an immediate feedback line after ignition explaining this.

There is no time pressure and no stamina deduction for this step.

**Day 2 immediate feedback:**
When the player clicks the first debris item, Aiden says: *"Clear the area before lighting anything. Dry debris near a fire spreads fast."*
This line plays once only and is not repeated for each subsequent debris item.

### Game Visuals

- Debris items are visually distinct: pale dry leaves, small dark twigs, grey rocks, brown dirt clumps
- Items have a subtle hover highlight (slight brightness increase) when the cursor moves over them
- On click: item disappears. No animation needed — a simple sprite removal is sufficient
- A small text counter at the top of the screen shows how many debris items remain: for example "Clear the area: 4 remaining"
- When all debris is cleared: counter is replaced with a checkmark, and the rock ring sprite appears around the fire pit

### Game Controls

- Click on debris item → removes it
- No button needed — step ends automatically when all 6 items are removed

### Game Flow

1. Player arrives at campsite scene
2. Debris items are visible and clickable
3. Player clicks each debris item to remove it
4. After all 6 removed: rock ring appears, ground cleared flag set to true
5. Player can also skip this and proceed directly to Sort — consequences appear later

---

## Step 2: Sort Materials

### Game Mechanics

The 4 collected materials appear as a loose pile beside the fire pit. Three labelled drop zones are visible on the ground: Tinder, Kindling, and Fuel Wood. Each zone has a short description line visible at all times below its label.

- Tinder: "Catches the spark. Lightest, driest."
- Kindling: "Grows the flame. Small and dry."
- Fuel Wood: "Sustains the fire. Dense and heavy."

The player drags materials from the pile into the zones.

**Day 2 immediate feedback on every placement:**

If the placement is correct, the item snaps into the zone and Aiden says: *"Good."*

If the placement is wrong, the item bounces back to the pile and Aiden says a specific line explaining why it is wrong. The player must try again. Feedback is specific to the material and the wrong zone — not a generic error message.

**Examples of wrong placement feedback:**
- dry_grass dragged to Fuel Wood: *"Too light to sustain anything — burns up in seconds."*
- thick_branch dragged to Tinder: *"Too dense to catch a spark — it needs smaller material underneath it first."*
- pine_cone dragged to Tinder: *"Too compact for tinder — save it for fuel once the flame is going."*
- dry_twigs dragged to Fuel Wood: *"Too thin to sustain the fire — it needs to go in the middle, not on top."*

**BAD quality materials:**
If the player collected wet_bark, wet_moss, or wet_log, those items appear in the pile but cannot be correctly placed in any zone. If the player tries to drag them anywhere, Aiden says: *"This is too wet for any role tonight."* The item stays in the pile and is greyed out. The player proceeds without those materials. Fewer materials in the stack means the fire strength ceiling is reduced by 1 segment per missing item in the sustain phase.

**Correct sort reference:**

| Material | Correct zone |
|----------|-------------|
| dry_leaves | Tinder |
| dry_grass | Tinder |
| dry_twigs | Kindling |
| pine_cone | Fuel Wood |
| thick_branch | Fuel Wood |
| damp_bark | Cannot be sorted |
| wet_moss | Cannot be sorted |
| wet_log | Cannot be sorted |

**Sorting outcome flag:**
- All items placed correctly on first attempt → sortingQuality = clean
- Any items required feedback before correct placement → sortingQuality = corrected
- In Day 2, corrected sorting has no mechanical penalty. It is noted by Aiden: *"Had to rethink that."* but does not affect difficulty

### Game Visuals

- Materials appear as a loose pile of sprites beside the fire pit
- Three drop zones rendered as labelled rectangular ground areas with dashed outlines
- During drag: a semi-transparent ghost of the sprite follows the cursor
- Correct drop: item snaps into zone, zone outline flashes green briefly, item sits visually inside the zone
- Incorrect drop: item bounces back to pile, zone outline flashes red briefly, feedback text appears in dialogue box
- BAD materials that cannot be sorted: after a failed placement attempt, the sprite gains a grey overlay and sits separately at the edge of the pile

### Game Controls

- Click and drag a material from the pile to a zone
- Release over a zone to attempt placement
- If placement fails, item returns to pile automatically
- Step ends automatically when all sortable materials are correctly placed

### Game Flow

1. Player sees loose pile of collected materials beside fire pit
2. Player drags each material into Tinder, Kindling, or Fuel Wood zone
3. Immediate feedback after every placement
4. BAD materials stay in pile after failed placement attempts
5. When all sortable materials are correctly placed → Stack zone activates

---

## Step 3: Stack

### Game Mechanics

The fire pit now shows three concentric ring overlays representing layers: Bottom, Middle, and Top. The player drags materials from the sort zones into the correct layer of the fire pit.

**Correct layering:**
- Bottom layer → Tinder
- Middle layer → Kindling
- Top layer → Fuel Wood

**Day 2 immediate feedback on every placement:**

If the layer is correct, the material settles visually into the fire pit and Aiden says: *"Air can move through that."*

If the layer is wrong, the material returns to its sort zone and Aiden says a specific line explaining the problem.

**Examples of wrong layer feedback:**
- Fuel Wood placed at Bottom: *"Large wood at the base blocks the airflow — the tinder can't breathe underneath."*
- Tinder placed at Top: *"Tinder at the top won't reach the kindling below it — heat rises, not falls."*
- Kindling placed at Bottom: *"The kindling needs tinder under it to catch first — put the lightest material at the base."*

**Effect of missing materials:**
If the player has fewer than the expected number of materials (because BAD items were collected and could not be sorted), some layers may have only one item or may be incomplete. The fire strength ceiling in the sustain phase is reduced by 1 segment for each missing material slot.

**Stack completion:**
When all available sorted materials are correctly placed in the pit, the stack is complete. The fire pit shows a visual of a properly built fire lay (unlit). The Ignite button activates.

### Game Visuals

- Fire pit shows three concentric ring overlays, labelled: Bottom, Middle, Top
- Materials from sort zones appear in a small holding area beside the pit, ready to be dragged
- Correct layer placement: material settles into the pit layer, layer ring glows briefly
- Wrong layer placement: material bounces back to holding area, ring flashes red, feedback in dialogue box
- After all materials placed: fire pit shows a complete unlit fire lay sprite

### Game Controls

- Click and drag materials from sort zone holding area into pit layer rings
- Release over a ring to attempt placement
- Step ends automatically when all available materials are correctly placed

### Game Flow

1. Sorted materials are available in holding area beside pit
2. Player drags each into the correct pit layer
3. Immediate feedback after every placement
4. When all placed correctly → Ignite button activates

---

## Step 4: Ignite

### Game Mechanics

The Ignite button is a flint icon beside the fire pit. The player clicks it rapidly to accumulate sparks. Sparks decay when the player stops clicking. The player must reach a target spark count before accumulating 30 total clicks.

**Spark accumulation:**
- Each click on the flint icon produces between 1 and 3 sparks (random each click)
- The spark counter is displayed prominently on screen showing current sparks and the target: for example "7 / 10"
- Sparks decay automatically — the counter drops by 1 at regular intervals when the player is not clicking
- The player must click fast enough to outpace the decay and reach the target

**Difficulty parameters set by material quality from Scene 1:**

| Difficulty | Spark target | Decay rate | Rain interference |
|------------|-------------|------------|------------------|
| EASY | 10 sparks | −1 every 0.8 seconds | None |
| MEDIUM | 15 sparks | −1 every 0.6 seconds | None |
| HARD | 20 sparks | −1 every 0.5 seconds | Every 4 seconds: −3 sparks, tinder sprite flashes dark briefly to show raindrop hit |

Rain interference only occurs on HARD difficulty AND poor campsite quality combined.

**Day 2 immediate feedback during ignition:**
- If the player stops clicking for more than 2 seconds: *"Keep going — sparks die fast in this rain."*
- If the player has made 15 clicks and sparks are below 50% of the target: *"The material is slowing this down. Wet tinder needs more sparks to catch."*
These lines are informational only and do not change the mechanics.

**On failure (30 total clicks without reaching target):**
- Aiden says: *"The spark won't hold."*
- Stamina −2
- One retry is allowed. Fuel stock is reduced by 1 to represent wasted effort
- If fuel stock is already 0, no retry is possible and triggerDayFail() is called
- On retry, spark count resets to 0 and total click count resets to 0

**On success:**
- Aiden says: *"There it is."*
- Fire pit sprite swaps to a lit fire
- Background swaps to the fire-strong version
- Sustain phase begins immediately

### Game Visuals

- Flint icon sits beside the fire pit, cursor changes to a hand on hover
- Spark counter displayed prominently above the flint: "sparks / TARGET"
- On each click: small orange spark particles appear briefly above the tinder layer in the pit then fade. This is a simple sprite effect
- Feedback text appears in the dialogue box below the spark counter, fades after 3 seconds
- Rain interference (HARD + poor campsite): tinder sprite briefly flashes to a dark wet version for 0.6 seconds then returns to normal
- On success: fire pit sprite swaps to lit fire, background swaps to BG-CAMPSITE-FIRE-STRONG

### Game Controls

- Click flint icon rapidly to generate sparks
- No other controls active during this step

### Game Flow

1. Ignite button (flint icon) is active after stack complete
2. Player clicks rapidly to accumulate sparks
3. Reach target before 30 clicks → success → sustain begins
4. Fail → Stamina −2 → one retry allowed → second fail with no fuel → triggerDayFail()

---

## Step 5: Sustain

### Game Mechanics

The fire is lit. The rain night progress bar at the bottom of the screen begins filling. The player must keep the fire alive until the bar completes (90 seconds of real time).

**Fire strength bar:**
- 5 segments displayed at the top of the screen
- Strength drains automatically over time
- When strength reaches 0, the fire goes out

**Fuel stock:**
- Displayed beside the fire strength bar as a log icon with a number
- Starting value is 5 logs, but may be reduced to 4 if a retry was used in Step 4
- Further reduced if BAD materials were collected (fire strength ceiling reduced but fuel stock stays the same)
- Player clicks Add Fuel to spend 1 log and restore fire strength

**Drain rates:**

| Condition | Drain rate |
|-----------|-----------|
| Good campsite, ground cleared | −1 segment every 12 seconds |
| Good campsite, ground not cleared | −1 segment every 10 seconds |
| Poor campsite, ground cleared | −1 segment every 9 seconds |
| Poor campsite, ground not cleared | −1 segment every 7.5 seconds |

**Flood event (poor campsite only):**
Every 20 seconds (15 seconds if ground was not cleared), the background briefly swaps to a close-up of puddles forming around the fire pit. The fire strength is forced down by 1 segment. This cannot be prevented or offset by adding fuel at that moment. After 1.2 seconds the background returns to the fire view.

**Add Fuel timing and feedback:**

| Fire strength when fuel added | Result | Aiden line |
|-------------------------------|--------|------------|
| 5 out of 5 (full) | Fuel consumed, strength unchanged | "Not yet — I'll smother it." |
| 3 or 4 out of 5 | Strength increases by 2 segments | No line |
| 1 or 2 out of 5 | Strength increases by 2 segments | "Barely." |
| 0 out of 5 (fire out) | Fire is out, cannot add fuel | "It went out." |

**Fire out consequences:**
- If fuel stock is greater than 0: Stamina −1, player returns to Step 4 to re-ignite. Fuel stock is not refilled
- If fuel stock is 0: Stamina −2, triggerDayFail() is called

**Background swaps based on fire strength:**
- Strength 3 or above → background is BG-CAMPSITE-FIRE-STRONG
- Strength below 3 → background swaps to BG-CAMPSITE-FIRE-WEAK
- These swap automatically as strength changes

**Night complete:**
When the rain night progress bar reaches 100%, the sustain phase ends. The fire quality outcome is recorded:
- Fire strength 3 or above at completion → fireQuality = strong
- Fire strength 1 or 2 at completion → fireQuality = weak
This value is used in the next scene to determine the Shimmerleaf search outcome.

### Game Visuals

- Background swaps between BG-CAMPSITE-FIRE-STRONG and BG-CAMPSITE-FIRE-WEAK based on fire strength
- Fire strength bar: 5 amber segments at top of screen, segments darken and empty from right to left as strength drops
- Fuel counter: log icon with number beside the fire strength bar
- Rain night progress bar: thin bar at bottom of screen, fills left to right over 90 seconds
- Flood event: background swaps to BG-FLOOD-CLOSEUP for 1.2 seconds then returns
- Add Fuel button: clearly visible beside the fire, shows greyed state when fuel stock is 0

### Game Controls

- Click Add Fuel button to spend 1 log and restore fire strength
- No other controls during this step

### Game Flow

1. Fire is lit, sustain begins automatically
2. Rain night progress bar fills over 90 seconds
3. Player adds fuel at the right moment to keep strength above 0
4. Fire out with fuel remaining → Stamina −1 → return to Step 4
5. Fire out with no fuel → Stamina −2 → triggerDayFail()
6. Progress bar completes → fireQuality recorded → proceed to rain-stop scene

---

# Stamina Summary

| Event | Stamina change |
|-------|---------------|
| Campsite Site A selected (preceding scene) | −2 |
| Step 4 ignition fail | −2 per fail |
| Step 5 fire goes out, fuel remaining | −1 per occurrence |
| Step 5 fire goes out, fuel empty | −2 → triggerDayFail() |
| Stamina reaches 0 at any point | triggerDayFail() |

---

# Art Assets Required

## Backgrounds

| Asset ID | Description | Size |
|----------|-------------|------|
| BG-FOREST-RAIN | Dark forest at night, rain-soaked ground, wet leaf reflections, rain atmosphere | 2560×1440 |
| BG-CAMPSITE-NIGHT | Campsite at night, fire pit unlit, debris visible around pit, rain falling | 2560×1440 |
| BG-CAMPSITE-FIRE-STRONG | Same campsite, fire burning well, warm light radiating | 2560×1440 |
| BG-CAMPSITE-FIRE-WEAK | Same campsite, fire dim and struggling, little light | 2560×1440 |
| BG-FLOOD-CLOSEUP | Ground-level view of puddles forming around the fire pit base | 2560×1440 |

## Material Sprites

One sprite per material. Wet/damp state is handled entirely by code using Phaser setTint() tween — no second art asset needed per material.

| Asset ID | Description |
|----------|-------------|
| MAT-DRY-LEAVES | Pale brown curled dry leaves, light-looking |
| MAT-DRY-TWIGS | Grey thin twigs with visible grain cracks |
| MAT-THICK-BRANCH | Dark brown dense branch, clearly heavy |
| MAT-DRY-GRASS | Pale yellow loose bundle, airy texture |
| MAT-PINE-CONE | Brown compact pine cone, medium size |
| MAT-DAMP-BARK | Dark bark with surface sheen, already looks wet |
| MAT-WET-MOSS | Deep green clumped moss, dense |
| MAT-WET-LOG | Dark smooth-barked log, visibly heavy |

## Fire Pit Sprites

| Asset ID | Description |
|----------|-------------|
| FIREPIT-EMPTY | Fire pit with no materials, no rock ring |
| FIREPIT-ROCK-RING | Rock ring around cleared fire pit, no materials |
| FIREPIT-STACKED-UNLIT | Complete fire lay built in pit, unlit |
| FIREPIT-LIT-STRONG | Fire pit with strong burning fire |
| FIREPIT-LIT-WEAK | Fire pit with weak struggling fire |

## UI Elements

| Asset ID | Description |
|----------|-------------|
| UI-BACKPACK-PANEL | Horizontal 4-slot backpack bar for bottom of screen |
| UI-TIMER-RING | Circular progress ring sprite to overlay on material sprites |
| UI-SORT-ZONE | Labelled rectangular drop zone outline (Tinder / Kindling / Fuel Wood) |
| UI-STACK-RING | Concentric ring overlays for fire pit layers (Bottom / Middle / Top) |
| UI-FIREBAR | 5-segment horizontal fire strength bar, amber segments |
| UI-NIGHT-PROGRESS | Thin rain night progress bar for bottom of screen |
| UI-FUEL-COUNT | Log icon with number counter |
| UI-FLINT-ICON | Flint and steel icon for ignite button |
| UI-ADD-FUEL-BTN | Add Fuel button, active and greyed states |

