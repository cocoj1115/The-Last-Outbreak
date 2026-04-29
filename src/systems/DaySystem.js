import { GameEvents } from './GameEvents.js'

/**
 * DaySystem
 * Dev A owns this file.
 *
 * Tracks the 7-day countdown.
 * Emits DAY_ADVANCE on each new day.
 * Emits DAYS_EXHAUSTED when days run out.
 *
 * Usage:
 *   const days = new DaySystem(this.game.events)
 *   days.advance()        // move to next day
 *   days.consumeBuffer()  // spend a buffer day (retry or rest)
 */
export class DaySystem {
  constructor(eventEmitter) {
    this.events = eventEmitter
    this.maxDays = 5
    this.currentDay = 1
  }

  /** Advance to the next story day (called at start of each narrative day). */
  advance() {
    if (this.currentDay >= this.maxDays) {
      this.events.emit(GameEvents.DAYS_EXHAUSTED)
      return false
    }
    this.currentDay++
    this.events.emit(GameEvents.DAY_ADVANCE, {
      day: this.currentDay,
      maxDays: this.maxDays,
    })
    return true
  }

  /**
   * Consume a buffer day (retry after stamina depletion, or deliberate rest).
   * Returns false if no days left.
   */
  consumeBuffer(reason = 'retry') {
    if (this.currentDay >= this.maxDays) {
      this.events.emit(GameEvents.DAYS_EXHAUSTED)
      return false
    }
    this.currentDay++
    console.log(`[DaySystem] Buffer day consumed: ${reason}. Now day ${this.currentDay}/${this.maxDays}`)
    this.events.emit(GameEvents.DAY_ADVANCE, {
      day: this.currentDay,
      maxDays: this.maxDays,
    })
    return true
  }

  getDaysRemaining() {
    return this.maxDays - this.currentDay
  }

  getState() {
    return { currentDay: this.currentDay, maxDays: this.maxDays }
  }
}
