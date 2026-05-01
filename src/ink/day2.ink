// day2.ink
// Day 2 — Shimmerleaf

=== day2_transition ===
# day_advance
# scene:village_day1
# portrait:aiden
# speaker:Aiden
It's another day. Half day's walk to the forest. I need to move now.
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
It's becoming colder. I need to gather wood to make fire. Move fast.
# minigame:fire_collect day:2
+ [Continue]
- { stamina_depleted:
    ~ fail_reason = "fire"
    -> day2_buffer
}

-> day2_fire

=== day2_fire ===
# minigame:fire_campsite day:2
+ [Continue]
- { stamina_depleted:
    ~ fail_reason = "fire"
    -> day2_buffer
}

{ mg_fire_campsite_success:
    - true:  -> day2_rain_stops
    - false:
        ~ fail_reason = "fire"
        -> day2_buffer
}

=== day2_rain_stops ===
{ campsite_quality == "good":
    -> day2_search_good
    - else:
    -> day2_search_poor
}

=== day2_search_good ===
# scene:forest_dawn_wet
# portrait:aiden
# speaker:Aiden
There — at the edge of the tree line. A pale green glow.
# minigame:search day:2 difficulty:easy
+ [Continue]
- { mg_search_success:
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
# portrait:aiden
# speaker:Aiden
The rain stopped. But this ground — I can barely move without sinking.

The window is open. I cannot waste it.
# minigame:search day:2 difficulty:hard
+ [Continue]
- { mg_search_success:
    - true:
        # speaker:Aiden
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

=== day2_morning_good ===
# scene:forest_morning
# portrait:aiden
# speaker:Aiden
{ campsite_quality == "good":
    Found it.

    Isla was right. Be there before the storm. Not after.
    - else:
    Found it. But I chose wrong last night.

    Higher ground. I will not forget that again.
}
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
# scene:forest_day2
# portrait:aiden
# speaker:Aiden
One more night. Same forest, same herb.

This time I know what I am walking into.
~ stamina_depleted = false
~ fail_reason = ""
-> day2_campsite
