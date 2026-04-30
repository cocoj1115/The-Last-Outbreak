// main.ink
// Compile this file with Inky: File > Export story to JSON
// Save output to: public/assets/story/main.ink.json

// ── Global variables ──────────────────────────────────────────────────────
VAR campsite_score = 0
VAR fire_score = 0
VAR herb_count = 0
VAR current_day = 1
VAR forced_worst_ending = false
VAR has_dried_berries = false
VAR has_rope = false
VAR has_water_pouch = false
VAR talked_to_mara = false
VAR talked_to_finn = false
VAR talked_to_isla = false
VAR campsite_quality = ""
VAR fire_quality = ""
VAR next_day_stamina_max = 5
VAR buffer_days_used = 0
VAR buffer_days_total = 2
VAR mg_campsite_success = false
VAR mg_fire_ignite_success = false
VAR mg_fire_sustain_success = false
VAR mg_search_success = false
VAR stamina_depleted = false
VAR fail_reason = ""

// ── Story files ───────────────────────────────────────────────────────────
INCLUDE prologue.ink
INCLUDE day1.ink
INCLUDE day2.ink

// ── Start ─────────────────────────────────────────────────────────────────
-> prologue