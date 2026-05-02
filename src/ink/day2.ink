// day2.ink
// Day 2 — Shimmerleaf

=== day2_transition ===
# day_advance
# scene:map
# portrait:aiden
# speaker:Aiden
Half a day's walk to the forest. Isla said the Shimmerleaf grows there.
* [Head out] -> day2_forest

=== day2_forest ===
# scene:path_to_forest
# portrait:aiden
# speaker:Aiden
Rain is coming. I can feel it in the air.

I need to make camp now — and be ready to search the moment it stops.
-> day2_campsite

=== day2_campsite ===
# minigame:campsite day:2
+ [Continue]
- { stamina_depleted:
    ~ fail_reason = "stamina"
    -> day2_buffer
}

{ mg_campsite_success:
    - true:
        ~ campsite_quality = "good"
        -> day2_fire_collect
    - false:
        ~ campsite_quality = "poor"
        -> day2_fire_collect
}

=== day2_fire_collect ===
# scene:path_to_forest
# portrait:aiden
# speaker:Aiden
It is getting colder. I need to gather wood and get a fire going before dark.
-> day2_fire

=== day2_fire ===
# minigame:fire_campsite day:2
+ [Continue]
- { stamina_depleted:
    ~ fail_reason = "fire"
    -> day2_buffer
}

{ mg_fire_campsite_success:
    - true:  -> day2_search_window
    - false:
        ~ fail_reason = "fire"
        -> day2_buffer
}

=== day2_search_window ===
{ campsite_quality == "good":
    -> day2_search_a
    - else:
    -> day2_search_b
}

=== day2_search_a ===
# scene:d2_bg_search
# portrait:aiden
# speaker:Aiden
The rain stopped.

This is the window. Thirty minutes.
# minigame:search day:2 difficulty:easy
+ [Continue]
- { mg_search_success:
    - true:
        # speaker:Aiden
        Shimmerleaf. The rain woke it up. And I was here to see it.
        ~ herb_count = herb_count + 1
        -> day2_morning_a
    - false:
        ~ fail_reason = "missed_herb"
        -> day2_buffer
}

=== day2_search_b ===
# scene:d2_bg_search
# portrait:aiden
# speaker:Aiden
The rain stopped.

But this ground — I can barely move without sinking.

The window is open. I cannot waste it.
# minigame:search day:2 difficulty:hard
+ [Continue]
- { mg_search_success:
    - true:
        # speaker:Aiden
        I can see something — at the edge of the light.

        Got it. But this ground nearly cost me everything.
        ~ herb_count = herb_count + 1
        ~ next_day_stamina_max = 4
        -> day2_morning_b
    - false:
        ~ fail_reason = "missed_herb"
        -> day2_buffer
}

=== day2_morning_a ===
# scene:forest_morning
# portrait:aiden
# speaker:Aiden
One herb down.

The rain did exactly what that villager said it would.
-> day3_transition

=== day2_morning_b ===
# scene:forest_morning
# portrait:aiden
# speaker:Aiden
I found it. But I chose wrong last night.

Higher ground. I will not forget that again.
-> day3_transition

=== day2_buffer ===
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
{ fail_reason == "fire":
    The fire never held. I could not find anything in the dark.
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

One more night. I have to get it right.
-> day2_buffer_mara

=== day2_buffer_mara ===
# portrait:mara
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
    # portrait:aiden
    # speaker:Aiden
    I just need another shot.
    -> day2_buffer_leave

=== day2_buffer_leave ===
# scene:path_to_forest
# portrait:aiden
# speaker:Aiden
One more night. Same forest, same herb.

This time I know what I am walking into.
~ stamina_depleted = false
~ fail_reason = ""
-> day2_campsite
