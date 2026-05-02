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
    this.events.on(GameEvents.MINIGAME_COMPLETE, (data) => {
      const { id, success, score, staminaDepleted } = data
      console.log('[InkBridge] MINIGAME_COMPLETE received:', data)
      this.story.variablesState[`mg_${id}_success`] = success
      if (id === 'fire_campsite') console.log('[InkBridge] mg_fire_campsite_success set to:', success)
      if (score !== undefined) this.story.variablesState[`mg_${id}_score`] = score
      if (staminaDepleted) this.story.variablesState['stamina_depleted'] = true
      this.tick()
    })
  }

  /** Advance exactly one line of the story, then stop. */
  tick() {
    while (this.story.canContinue) {
      const text = this.story.Continue()
      const tags = this._parseTags(this.story.currentTags)

      console.log('[InkBridge] tick - text:', JSON.stringify(text.trim()), 'tags:', JSON.stringify(tags))

      // Process tags ALWAYS, even if no text
      this._processTags(tags)

      // Only emit DIALOGUE_LINE if there is visible text
      const clean = text.trim()
      if (clean) {
        this.events.emit(GameEvents.DIALOGUE_LINE, {
          text: clean,
          speaker: this._pendingSpeaker,
          tags,
        })
        this._pendingSpeaker = null
      }

      // Stop if a scene change to village_hub was triggered — always hand off via INK_WAITING
      if (tags.scene === 'village_hub') {
        this.events.emit(GameEvents.INK_WAITING)
        return
      }

      // Stop if minigame triggered
      if (tags.minigame) return

      // Stop after a visible line — wait for player click
      if (clean) return
    }

    if (this.story.currentChoices.length > 0) {
      this.events.emit(GameEvents.CHOICES_AVAILABLE, {
        choices: this.story.currentChoices.map((c, i) => ({
          text: c.text,
          index: i,
        })),
      })
    } else if (!this.story.canContinue) {
      // Story truly ended (-> END reached)
      this.events.emit(GameEvents.STORY_END)
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

  /** Jump directly to a named knot and tick. */
  jumpTo(knotName) {
    this.story.ChoosePathString(knotName)
    this.tick()
  }

  /** Alias for jumpTo — same behaviour, friendlier name for scene controllers. */
  jumpToKnot(knotName) {
    this.story.ChoosePathString(knotName)
    this.tick()
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
    console.log('[InkBridge] tags received:', JSON.stringify(tags))
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
    if (tags.day_advance) {
      const days    = this.scene.registry.get('days')
      const stamina = this.scene.registry.get('stamina')
      if (days)    days.advance()
      if (stamina) stamina.reset(days?.currentDay)
    }
    if (tags.hide_character) {
      console.log('[InkBridge] emitting HIDE_CHARACTER')
      this.events.emit(GameEvents.HIDE_CHARACTER)
    }
    if (tags.show_character) {
      this.events.emit(GameEvents.SHOW_CHARACTER)
    }
  }
}
