/**
 * tests/mock_minigame.js
 *
 * Dev A uses this to test Ink branches WITHOUT waiting for Dev B's minigames.
 *
 * In NarrativeScene.create(), temporarily call:
 *   import { mockMinigameComplete } from '../../tests/mock_minigame.js'
 *   mockMinigameComplete(this.game.events, 'campsite', true, 85)
 *
 * Remove before integration.
 */

import { GameEvents } from '../src/systems/GameEvents.js'

/**
 * Simulate a minigame finishing.
 * @param {Phaser.Events.EventEmitter} events - this.game.events
 * @param {string} id - 'campsite' | 'fire'
 * @param {boolean} success
 * @param {number} score
 * @param {number} delayMs - how long to wait before emitting (simulates play time)
 */
export function mockMinigameComplete(events, id, success, score = 75, delayMs = 500) {
  setTimeout(() => {
    console.log(`[MOCK] Minigame '${id}' complete: success=${success}, score=${score}`)
    events.emit(GameEvents.MINIGAME_COMPLETE, { id, success, score })
  }, delayMs)
}

/**
 * Simulate a specific stamina state for testing UI.
 */
export function mockStaminaChange(events, current, max) {
  events.emit(GameEvents.STAMINA_CHANGE, { current, max, delta: 0 })
}

/**
 * Simulate day advancing.
 */
export function mockDayAdvance(events, day, maxDays = 7) {
  events.emit(GameEvents.DAY_ADVANCE, { day, maxDays })
}
