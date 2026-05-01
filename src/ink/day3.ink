// day3.ink
// Day 3 — Glaceweed (wind)

// ═════════════════════════════════════════════════════════════════════════════
// DAY 3 TRANSITION — map
// ═════════════════════════════════════════════════════════════════════════════

=== day3_transition ===
# day_advance
# scene:path_petra
# portrait:aiden
# speaker:Aiden
Two down. The Glaceweed is deeper in.

Further from any village. Further from anything familiar.
* [Continue] -> petra_encounter


// ═════════════════════════════════════════════════════════════════════════════
// PETRA ENCOUNTER
// ═════════════════════════════════════════════════════════════════════════════

=== petra_encounter ===
# scene:path_petra
# hide_character
# portrait:petra
# speaker:Petra
Heading deeper in? In this wind?

# portrait:aiden
# speaker:Aiden
I am looking for Glaceweed. You know it?

# portrait:petra
# speaker:Petra
Know it well. I come out every season for it. You have to be there before the sun — frost melts in half an hour once the light hits. Miss that and you have wasted the night.

# portrait:aiden
# speaker:Aiden
I will have to camp out there then.

# portrait:petra
# speaker:Petra
Find something to put between you and the wind. A ridge, a bank, anything. Stop the wind and you can manage the rest.

# portrait:none
# speaker:
She was already moving.

~ day3_petra_seen = true
-> day3_arrival


// ═════════════════════════════════════════════════════════════════════════════
// ARRIVAL
// ═════════════════════════════════════════════════════════════════════════════

=== day3_arrival ===
# scene:forest_day3
# show_character
# portrait:aiden
# speaker:Aiden
Cold already. And the sun has not even set.

I need to make camp before it gets dark.
-> day3_campsite


// ═════════════════════════════════════════════════════════════════════════════
// MINIGAME 1 — CAMPSITE SELECTION
// ═════════════════════════════════════════════════════════════════════════════

=== day3_campsite ===
# minigame:campsite day:3
+ [Continue]
- { stamina_depleted:
    ~ fail_reason = "stamina"
    -> day3_buffer
}

{ mg_campsite_success:
    - true:
        ~ campsite_quality = "good"
    - false:
        ~ campsite_quality = "poor"
}
-> day3_fire_collect


// ═════════════════════════════════════════════════════════════════════════════
// MINIGAME 2 — MATERIAL COLLECTION
// ═════════════════════════════════════════════════════════════════════════════

=== day3_fire_collect ===
# minigame:fire_collect day:3
+ [Continue]
- { stamina_depleted:
    ~ fail_reason = "stamina"
    -> day3_buffer
}
-> day3_fire


// ═════════════════════════════════════════════════════════════════════════════
// MINIGAME 3 — BUILD & SUSTAIN FIRE (wind night)
// ═════════════════════════════════════════════════════════════════════════════

=== day3_fire ===
# minigame:fire_campsite day:3
+ [Continue]
- { stamina_depleted:
    ~ fail_reason = "no_fire"
    -> day3_buffer
}

{ mg_fire_campsite_success:
    - true:  -> day3_dawn
    - false:
        ~ fail_reason = "no_fire"
        -> day3_buffer
}


// ═════════════════════════════════════════════════════════════════════════════
// DAWN — collect window
// ═════════════════════════════════════════════════════════════════════════════

=== day3_dawn ===
{ campsite_quality == "good":
    -> day3_dawn_good
    - else:
    -> day3_dawn_poor
}

=== day3_dawn_good ===
# scene:forest_dawn_frost
# portrait:aiden
# speaker:Aiden
The wind dropped. Just a little.

Petra said before the sun hits. That means now.
# minigame:search day:3 difficulty:easy
+ [Continue]
- { mg_search_success:
    - true:
        # speaker:Aiden
        Glaceweed. Still cold. Still good.
        ~ herb_count = herb_count + 1
        -> day3_morning_good
    - false:
        ~ fail_reason = "missed_herb"
        # speaker:Aiden
        The frost is gone. I missed it.
        -> day3_buffer
}

=== day3_dawn_poor ===
# scene:forest_dawn_frost
# portrait:aiden
# speaker:Aiden
Made it through. Barely.

The window. I have to move now.
# minigame:search day:3 difficulty:hard
+ [Continue]
- { mg_search_success:
    - true:
        # speaker:Aiden
        Got it. The edges were already melting.
        ~ herb_count = herb_count + 1
        ~ next_day_stamina_max = 4
        -> day3_morning_good
    - false:
        ~ fail_reason = "missed_herb"
        # speaker:Aiden
        The frost is gone. I could not get there in time.
        -> day3_buffer
}


// ═════════════════════════════════════════════════════════════════════════════
// MORNING
// ═════════════════════════════════════════════════════════════════════════════

=== day3_morning_good ===
# scene:forest_morning_wind
# portrait:aiden
# speaker:Aiden
{ campsite_quality == "good":
    Three down.

    Petra was right. Stop the wind and you can manage anything.
    - else:
    Three down. But I fought the whole night instead of sleeping through it.

    The ridge. That was the answer. I saw it and chose wrong anyway.
}
-> day4_transition


// ═════════════════════════════════════════════════════════════════════════════
// BUFFER DAY
// ═════════════════════════════════════════════════════════════════════════════

=== day3_buffer ===
# day_advance
# scene:village_interior
~ current_day = current_day + 1
~ buffer_days_used = buffer_days_used + 1
~ stamina_depleted = false

{ buffer_days_used > buffer_days_total:
    -> worst_ending
}

# portrait:aiden
# speaker:Aiden
{ fail_reason == "no_fire":
    The fire went out sometime in the night. By the time the frost came I was too cold to move.

    One more night. I know what I need to do differently.
- else:
    { fail_reason == "missed_herb":
        I saw the frost. I just could not get there in time.

        I was too exhausted. I need to hold the fire better so I can actually move when it matters.
    - else:
        Something went wrong out there.
    }
}

One more night.
-> day3_buffer_petra

=== day3_buffer_petra ===
{ day3_petra_seen:
    -> day3_buffer_leave
}

# portrait:petra
# speaker:Petra
You are back. The frost got you?

* [Ask about the campsite]
    # speaker:Petra
    Find something to put between you and the wind. A ridge, a bank, a boulder. Height does not matter. Shelter does.
    -> day3_buffer_leave

* [Ask about the fire]
    # speaker:Petra
    Wind pulls the heat out of everything. Shield it while you are starting it. And keep feeding it — wind burns through wood faster than you think.
    -> day3_buffer_leave

* [I know what went wrong.]
    # portrait:aiden
    # speaker:Aiden
    I just need another shot at it.
    -> day3_buffer_leave

=== day3_buffer_leave ===
# scene:forest_day3
# portrait:aiden
# speaker:Aiden
The frost comes back every night this wind holds.

One more night. This time I know where to stand.
~ stamina_depleted = false
~ fail_reason = ""
-> day3_campsite


// ═════════════════════════════════════════════════════════════════════════════
// DAY 4 PLACEHOLDER
// ═════════════════════════════════════════════════════════════════════════════

=== day4_transition ===
{ herb_count >= 2:
    -> good_ending
- else:
    -> worst_ending
}
