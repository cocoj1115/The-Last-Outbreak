// main.ink
// Entry point — variables and includes only.
// Compile this file with Inky: File > Export story to JSON
// Save output to: public/assets/story/main.ink.json

// ── Global variables ──────────────────────────────────────────────────────
VAR campsite_score = 0
VAR fire_score = 0
VAR herb_count = 0
VAR current_day = 1
VAR forced_worst_ending = false

// ── Story files ───────────────────────────────────────────────────────────
INCLUDE prologue.ink
INCLUDE day1.ink
INCLUDE day2.ink

// ── Start ─────────────────────────────────────────────────────────────────
-> prologue
