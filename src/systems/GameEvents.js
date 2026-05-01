/**
 * GameEvents.js
 *
 * ⚠️  SHARED CONTRACT — do not modify without telling the other developer ⚠️
 *
 * All communication between Ink (narrative) and Phaser (minigames/HUD)
 * goes through these event names. Both devs import from here — never use
 * raw strings for events anywhere else in the codebase.
 *
 * Dev A owns: INK_* events
 * Dev B owns: MINIGAME_* events
 * Shared: STAMINA_*, DAY_*, GAME_*
 */

export const GameEvents = {
  // ── Ink → Phaser ──────────────────────────────────────────────────────────

  /** Ink requests a background/scene change.
   *  payload: { key: string }  e.g. { key: 'forest_day1' } */
  SCENE_CHANGE: 'ink:scene_change',

  /** Ink wants to display a dialogue line.
   *  payload: { text: string, speaker: string|null, tags: object } */
  DIALOGUE_LINE: 'ink:dialogue_line',

  /** Ink presents choices to the player.
   *  payload: { choices: Array<{ text: string, index: number }> } */
  CHOICES_AVAILABLE: 'ink:choices_available',

  /** Ink requests a minigame to start.
   *  payload: { id: string, day: number, difficulty: 'learn'|'practice'|'challenge' }
   *  id values: 'campsite' | 'fire' */
  MINIGAME_TRIGGER: 'ink:minigame_trigger',

  /** Ink requests hiding/showing the main character portrait.
   *  No payload. */
  HIDE_CHARACTER: 'ink:hide_character',
  SHOW_CHARACTER: 'ink:show_character',

  /** Ink signals the narrative is waiting (no more text, no choices yet).
   *  Used to pause dialogue UI while waiting for minigame result. */
  INK_WAITING: 'ink:waiting',

  // ── Phaser → Ink ──────────────────────────────────────────────────────────

  /** Player selects a dialogue choice.
   *  payload: { index: number } */
  CHOICE_MADE: 'game:choice_made',

  /** Minigame finished — result written back to Ink variables.
   *  payload: { id: string, success: boolean, score: number }
   *  id matches the id from MINIGAME_TRIGGER */
  MINIGAME_COMPLETE: 'game:minigame_complete',

  // ── Shared state (both devs read/write via systems) ───────────────────────

  /** Stamina changed.
   *  payload: { current: number, max: number, delta: number } */
  STAMINA_CHANGE: 'state:stamina_change',

  /** Day advanced.
   *  payload: { day: number, maxDays: number } */
  DAY_ADVANCE: 'state:day_advance',

  /** Player stamina hit zero — trigger retry flow.
   *  payload: { day: number } */
  STAMINA_DEPLETED: 'state:stamina_depleted',

  /** Days hit zero — force worst-ending branch.
   *  No payload. */
  DAYS_EXHAUSTED: 'state:days_exhausted',

  // ── Game lifecycle ─────────────────────────────────────────────────────────

  /** Boot finished, ready to start narrative. */
  GAME_READY: 'game:ready',

  /** Player triggered a full game restart. */
  GAME_RESTART: 'game:restart',

  /** Prologue (pre-time-transition) finished — show HUD. */
  PROLOGUE_END: 'game:prologue_end',

  /** Ink story reached -> END with no more choices or content. */
  STORY_END: 'game:story_end',

  // ── Village scene ─────────────────────────────────────────────────────

  /** Player clicked an NPC portrait in the village scene.
   *  payload: { id: 'mara' | 'finn' | 'isla' } */
  VILLAGE_NPC_CLICKED: 'village:npc_clicked',

  /** Player clicked the "Head out" button in the village scene.
   *  No payload. */
  VILLAGE_LEAVE: 'village:leave',
}
