import { GameEvents } from './GameEvents.js'

/**
 * StaminaSystem
 * Dev B owns this file.
 *
 * Tracks the player's stamina (5 points per day).
 * Emits STAMINA_CHANGE on every update.
 * Emits STAMINA_DEPLETED when current hits 0.
 *
 * Usage:
 *   const stamina = new StaminaSystem(this.game.events)
 *   stamina.deduct(2)
 *   stamina.reset()
 */
export class StaminaSystem {
  constructor(eventEmitter) {
    this.events = eventEmitter
    this.max = 5
    this.current = 5
    // Penalty: each bad night reduces max by 1 (min 2)
    this._maxPenalty = 0
  }

  get effectiveMax() {
    return Math.max(2, this.max - this._maxPenalty)
  }

  /** Deduct points. Returns true if still alive, false if depleted. */
  deduct(amount) {
    const before = this.current
    this.current = Math.max(0, this.current - amount)
    this.events.emit(GameEvents.STAMINA_CHANGE, {
      current: this.current,
      max: this.effectiveMax,
      delta: -(before - this.current),
    })
    if (this.current === 0) {
      this.events.emit(GameEvents.STAMINA_DEPLETED, {
        day: this._currentDay,
      })
      return false
    }
    return true
  }

  /** Reset to effective max at the start of a new day. */
  reset(day) {
    this._currentDay = day
    this.current = this.effectiveMax
    this.events.emit(GameEvents.STAMINA_CHANGE, {
      current: this.current,
      max: this.effectiveMax,
      delta: 0,
    })
  }

  /** Apply end-of-day narrative penalty (bad campsite/fire). */
  applyNightPenalty(reason) {
    // Penalty persists to next day's max
    this._maxPenalty = Math.min(this._maxPenalty + 1, 3)
    console.log(`[StaminaSystem] Night penalty applied: ${reason}. New max: ${this.effectiveMax}`)
  }

  /** Clear penalties (e.g. player chose to rest). */
  clearPenalties() {
    this._maxPenalty = 0
  }

  getState() {
    return { current: this.current, max: this.effectiveMax }
  }
}
