import { Story } from 'inkjs'
import { GameEvents } from './GameEvents.js'

/**
 * InkBridge
 * Dev A owns this file.
 *
 * Runs the Ink story and translates tags/variables into Phaser events.
 * Dev B never imports this directly — only listens to GameEvents.
 *
 * Ink tag conventions (used in .ink files):
 *   #scene:forest_day1        → emits SCENE_CHANGE
 *   #speaker:protagonist      → attached to next DIALOGUE_LINE
 *   #minigame:campsite day:1 difficulty:learn  → emits MINIGAME_TRIGGER
 *   #bg:forest_night          → (future) background swap
 *
 * Ink variable conventions:
 *   mg_campsite_success       → bool, written by onMinigameComplete
 *   mg_fire_success           → bool, written by onMinigameComplete
 *   stamina                   → int, kept in sync with StaminaSystem
 *   current_day               → int, kept in sync with DaySystem
 */
export class InkBridge {
  constructor(scene, storyJson) {
    this.scene = scene
    this.events = scene.game.events
    this.story = new Story(storyJson)
    this._pendingSpeaker = null

    // Listen for player choices coming back from UI
    this.events.on(GameEvents.CHOICE_MADE, ({ index }) => {
      this.story.ChooseChoiceIndex(index)
      this.tick()
    })

    // Listen for minigame results
    this.events.on(GameEvents.MINIGAME_COMPLETE, ({ id, success, score }) => {
      this.story.variablesState[`mg_${id}_success`] = success
      this.story.variablesState[`mg_${id}_score`] = score ?? 0
      this.tick()
    })
  }

  /** Advance exactly one line of the story, then stop. */
  tick() {
    // Skip tag-only lines (no visible text) without requiring a click
    while (this.story.canContinue) {
      const text = this.story.Continue()
      const tags = this._parseTags(this.story.currentTags)

      this._processTags(tags)

      const clean = text.trim()
      if (clean) {
        // Visible line — emit and stop. Next click will call tick() again.
        this.events.emit(GameEvents.DIALOGUE_LINE, {
          text: clean,
          speaker: this._pendingSpeaker,
          tags,
        })
        this._pendingSpeaker = null

        // If a minigame was triggered on this line, stop and wait for result
        if (tags.minigame) return

        // Stop after one visible line — wait for player click
        return
      }

      // Tag-only line: if a minigame was triggered, stop here too
      if (tags.minigame) return
    }

    // canContinue is false — emit choices or end state
    if (this.story.currentChoices.length > 0) {
      this.events.emit(GameEvents.CHOICES_AVAILABLE, {
        choices: this.story.currentChoices.map((c, i) => ({
          text: c.text,
          index: i,
        })),
      })
    } else {
      this.events.emit(GameEvents.INK_WAITING)
    }
  }

  /** Sync a variable from external systems into Ink. */
  setVariable(name, value) {
    this.story.variablesState[name] = value
  }

  getVariable(name) {
    return this.story.variablesState[name]
  }

  // ── Private ─────────────────────────────────────────────────────────────

  _parseTags(rawTags = []) {
    const result = {}
    for (const tag of rawTags) {
      // Support both "key:value" and standalone flags
      const colonIdx = tag.indexOf(':')
      if (colonIdx === -1) {
        result[tag.trim()] = true
      } else {
        const key = tag.slice(0, colonIdx).trim()
        const value = tag.slice(colonIdx + 1).trim()
        // Parse space-separated sub-values: "minigame:campsite day:1 difficulty:learn"
        // becomes { minigame: 'campsite', day: '1', difficulty: 'learn' }
        result[key] = value
        // Also parse inline k:v pairs within a single tag string
        // e.g. tag = "minigame:campsite day:1 difficulty:learn"
        const parts = tag.split(' ')
        for (const part of parts) {
          const i = part.indexOf(':')
          if (i > -1) {
            result[part.slice(0, i).trim()] = part.slice(i + 1).trim()
          }
        }
      }
    }
    return result
  }

  _processTags(tags) {
    if (tags.scene) {
      this.events.emit(GameEvents.SCENE_CHANGE, { key: tags.scene })
    }
    if (tags.speaker) {
      this._pendingSpeaker = tags.speaker
    }
    if (tags.minigame) {
      this.events.emit(GameEvents.MINIGAME_TRIGGER, {
        id: tags.minigame,
        day: parseInt(tags.day ?? '1', 10),
        difficulty: tags.difficulty ?? 'learn',
      })
    }
  }
}
