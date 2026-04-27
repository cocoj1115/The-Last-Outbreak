/**
 * tests/mock_ink_bridge.js
 *
 * Dev B uses this to test minigames WITHOUT waiting for Dev A's Ink story.
 *
 * In CampsiteMinigame or FireMinigame create(), add:
 *   import { validateMinigameEmit } from '../../tests/mock_ink_bridge.js'
 *   validateMinigameEmit(this.game.events)
 *
 * It logs whether the MINIGAME_COMPLETE payload is correctly shaped.
 * Remove before integration.
 */

import { GameEvents } from '../src/systems/GameEvents.js'

/**
 * Attach a validator listener to confirm the minigame emits
 * MINIGAME_COMPLETE with the correct payload shape.
 *
 * Expected payload: { id: string, success: boolean, score: number }
 */
export function validateMinigameEmit(events) {
  events.once(GameEvents.MINIGAME_COMPLETE, (payload) => {
    const { id, success, score } = payload ?? {}
    const errors = []

    if (typeof id !== 'string' || id.length === 0)
      errors.push(`❌ 'id' must be a non-empty string, got: ${JSON.stringify(id)}`)

    if (typeof success !== 'boolean')
      errors.push(`❌ 'success' must be boolean, got: ${JSON.stringify(success)}`)

    if (typeof score !== 'number')
      errors.push(`❌ 'score' must be number, got: ${JSON.stringify(score)}`)

    if (errors.length === 0) {
      console.log(`✅ [MOCK_INK_BRIDGE] MINIGAME_COMPLETE payload OK:`, payload)
    } else {
      console.error(`[MOCK_INK_BRIDGE] Payload validation FAILED:`)
      errors.forEach(e => console.error(e))
    }
  })

  console.log('[MOCK_INK_BRIDGE] Listening for MINIGAME_COMPLETE...')
}

/**
 * Simulate InkBridge triggering a minigame.
 * Use in a standalone test scene to launch the minigame.
 */
export function mockMinigameTrigger(scene, id, day = 1, difficulty = 'learn') {
  console.log(`[MOCK_INK_BRIDGE] Triggering minigame: ${id}, day ${day}, ${difficulty}`)
  scene.game.events.emit(GameEvents.MINIGAME_TRIGGER, { id, day, difficulty })
}
