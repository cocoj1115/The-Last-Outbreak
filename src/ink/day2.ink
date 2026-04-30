// day2.ink
// Day 2 — Shimmerleaf + campsite in rain + firemaking

// ═════════════════════════════════════════════════════════════════════════════
// DAY 2 TRANSITION — map
// ═════════════════════════════════════════════════════════════════════════════

=== day2_transition ===
# scene:path_to_forest
# portrait:aiden
# speaker:Aiden
The forest is north. Half a day's walk.

Isla said to be there before the storm hits. I need to move.
-> day2_forest


// ═════════════════════════════════════════════════════════════════════════════
// INTO THE FOREST
// ═════════════════════════════════════════════════════════════════════════════

=== day2_forest ===
# scene:forest_day2
# speaker:Aiden
Rain is coming. I can feel it in the air.

I need to make camp now — and be ready to search the moment it stops.
-> day2_campsite


// ═════════════════════════════════════════════════════════════════════════════
// MINIGAME 1 — CAMPSITE SELECTION
// Phaser writes back: mg_campsite_success (bool)
// Stamina: Phaser deducts -2 if false, then sets stamina_depleted if zero
// ═════════════════════════════════════════════════════════════════════════════

=== day2_campsite ===
# speaker:Aiden
Two spots. I need to decide before the rain hits.
# minigame:campsite day:2

{ stamina_depleted:
    ~ fail_reason = "stamina"
    -> day2_buffer
}

{ mg_campsite_success:
    - true:
        ~ campsite_quality = "good"
        # speaker:Aiden
        Higher ground. If the rain pools anywhere, it will not be here.
        -> day2_fire_intro
    - false:
        ~ campsite_quality = "poor"
        # speaker:Aiden
        Sheltered. That will have to do.

        The rain started. The ground is already getting soft.

        It is going to be a cold night.
        -> day2_fire_intro
}


// ═════════════════════════════════════════════════════════════════════════════
// FIREMAKING INTRO
// ═════════════════════════════════════════════════════════════════════════════

=== day2_fire_intro ===
# speaker:Aiden
The fire spot is clear. I need to get this lit and keep it alive through the night.
-> day2_fire_collect


// ═════════════════════════════════════════════════════════════════════════════
// MINIGAME 2 — MATERIAL COLLECTION
// Phaser writes back: mg_fire_collect_success (bool), mg_fire_collect_score (string)
// FireCollectMinigame chains internally to FireCampsiteMinigame
// ═════════════════════════════════════════════════════════════════════════════

=== day2_fire_collect ===
# speaker:Aiden
I need to gather what I can find to start the fire.
# minigame:fire_collect day:2

{ stamina_depleted:
    ~ fail_reason = "stamina"
    -> day2_buffer
}
-> day2_fire_campsite


// ═════════════════════════════════════════════════════════════════════════════
// MINIGAME 3 — BUILD AND LIGHT FIRE
// Phaser writes back: mg_fire_campsite_success (bool), mg_fire_campsite_score ("strong"/"weak")
// Covers sort materials → stack layers → ignite → sustain — all internal
// ═════════════════════════════════════════════════════════════════════════════

=== day2_fire_campsite ===
# speaker:Aiden
Now to get this fire built and lit.
# minigame:fire_campsite day:2

{ stamina_depleted:
    ~ fail_reason = "stamina"
    -> day2_buffer
}

{ mg_fire_campsite_success:
    - true:
        { mg_fire_campsite_score == "strong":
            # speaker:Aiden
            Strong fire. This will hold through the night.
        - else:
            # speaker:Aiden
            A small flame. It will have to do.
        }
        -> day2_rain_stops
    - false:
        ~ fail_reason = "no_fire"
        # speaker:Aiden
        Nothing. I could not get this started.

        The night is going to be brutal without fire.
        -> day2_buffer
}


// ═════════════════════════════════════════════════════════════════════════════
// RAIN STOPS
// ═════════════════════════════════════════════════════════════════════════════

=== day2_rain_stops ===
# speaker:Aiden
The rain stopped.

This is the window. Thirty minutes.

{ campsite_quality == "good":
    -> day2_search_good
    - else:
    -> day2_search_poor
}


// ═════════════════════════════════════════════════════════════════════════════
// MINIGAME 5 — SEARCH
// Phaser writes back: mg_search_success (bool)
// No stamina deduction
// ═════════════════════════════════════════════════════════════════════════════

=== day2_search_good ===
# scene:forest_dawn_wet
# speaker:Aiden
There — at the edge of the tree line. A pale green glow.
# minigame:search day:2 difficulty:easy

{ mg_search_success:
    - true:
        # speaker:Aiden
        Shimmerleaf. The rain woke it up. And I was here to see it.
        ~ herb_count = herb_count + 1
        -> day2_morning_good
    - false:
        ~ fail_reason = "missed_herb"
        # speaker:Aiden
        I was too slow. The glow faded before I could reach it.
        -> day2_buffer
}

=== day2_search_poor ===
# scene:forest_dawn_wet
# speaker:Aiden
The rain stopped. But this ground — I can barely move without sinking.

The window is open. I cannot waste it.
# minigame:search day:2 difficulty:hard

{ mg_search_success:
    - true:
        # speaker:Aiden
        I can see something — at the edge of the light.

        Got it. But this ground nearly cost me everything.
        ~ herb_count = herb_count + 1
        ~ next_day_stamina_max = 4
        -> day2_morning_good
    - false:
        ~ fail_reason = "missed_herb"
        # speaker:Aiden
        I could see the glow — just out of reach. The mud held me back.
        -> day2_buffer
}


// ═════════════════════════════════════════════════════════════════════════════
// SUCCESS MORNING
// ═════════════════════════════════════════════════════════════════════════════

=== day2_morning_good ===
# scene:forest_morning
# speaker:Aiden
{ campsite_quality == "good":
    Found it.

    Isla was right. Be there before the storm. Not after.
    - else:
    Found it. But I chose wrong last night.

    Higher ground. I will not forget that again.
}
-> day3_transition


// ═════════════════════════════════════════════════════════════════════════════
// BUFFER DAY — retry with Mara
// ═════════════════════════════════════════════════════════════════════════════

=== day2_buffer ===
# scene:village_interior
~ current_day = current_day + 1
~ buffer_days_used = buffer_days_used + 1
~ stamina_depleted = false

{ buffer_days_used > buffer_days_total:
    -> worst_ending
}

# speaker:Aiden
{ fail_reason == "no_fire":
    The fire never started. I could not see anything out there.
- else:
    { fail_reason == "fire_out":
        The fire went out. I spent the night shivering. I could not find anything in the dark.
    - else:
        { fail_reason == "missed_herb":
            I was there. The window was open. But I was too slow.
        - else:
            { fail_reason == "stamina":
                I pushed too hard. My body gave out before I could finish.
            - else:
                Something went wrong out there.
            }
        }
    }
}

One more night. I have to get it right.
-> day2_buffer_mara

=== day2_buffer_mara ===
# speaker:Mara
You are back. I can see it on your face.

* [Ask about the campsite]
    # speaker:Mara
    Higher ground. Always. The water runs away from you, not toward you.
    -> day2_buffer_leave

* [Ask about the fire]
    # speaker:Mara
    Heavy wood is wet inside even when it looks dry. Go by weight. And keep the fire pit off damp ground.
    -> day2_buffer_leave

* [I know what I did wrong.]
    # speaker:Aiden
    I just need another shot.
    -> day2_buffer_leave

=== day2_buffer_leave ===
# scene:forest_day2
# speaker:Aiden
One more night. Same forest, same herb.

This time I know what I am walking into.
~ stamina_depleted = false
~ fail_reason = ""
-> day2_campsite


// ═════════════════════════════════════════════════════════════════════════════
// ENDINGS
// ═════════════════════════════════════════════════════════════════════════════

=== worst_ending ===
# speaker:Aiden
I cannot go on like this.

I have run out of time. The window is closing.
-> END

=== day3_transition ===
# scene:map
# speaker:Aiden
Shimmerleaf... Found...

Now I need to find the next herb before the window closes.
-> END