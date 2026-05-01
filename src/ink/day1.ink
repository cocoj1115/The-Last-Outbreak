// day1.ink

=== day1_arrival ===
# scene:village_day1
# portrait:aiden
# speaker:Aiden
Three people nearby.
-> village_hub

=== village_hub ===
# scene:village_hub
# portrait:none
# speaker:
+ [Talk to Mara — the hunter] -> mara_entry
+ [Talk to Finn — the woodcutter] -> finn_entry
+ [Talk to Isla — the village elder] -> isla_entry
+ [I have learned enough. Time to head out.] -> day1_end


// ═══════════════════════════════════════
// MARA
// ═══════════════════════════════════════

=== mara_entry ===
{ talked_to_mara:
    - true:
        # portrait:mara
        # speaker:Mara
        Still here?
        -> mara_questions
    - false:
        # portrait:mara
        # speaker:Mara
        You are not from here. What do you want?
        # portrait:aiden
        # speaker:Aiden
        My name is Aiden. I am looking for the Shimmerleaf.
        # portrait:mara
        # speaker:Mara
        Shimmerleaf. Long way to come for a plant.
        # portrait:aiden
        # speaker:Aiden
        It is important. Do you know it?
        # portrait:mara
        # speaker:Mara
        You will need to survive in the forest. Ask me what you need.
        ~ talked_to_mara = true
        -> mara_questions
}

=== mara_questions ===
+ [How do I choose where to sleep?] -> mara_campsite
+ [What do you know about the Shimmerleaf?] -> mara_shimmerleaf
+ [Have you seen anyone else pass through?] -> mara_others
+ [That is all I needed.] -> village_hub

=== mara_campsite ===
# portrait:mara
# speaker:Mara
Ground first. Always ground first.

Find somewhere high — not a hilltop, just higher than what surrounds it. Water runs downhill. Sleep in a low spot and you wake up wet. Or you do not wake up at all.

Stay back from water. Fifteen steps at least. The bank looks stable until it is not.
# speaker:Mara
Now tell me — flat ground right beside a stream, or a slight rise thirty steps away. Which do you take?
+ [The flat spot — easier access to water]
    # portrait:mara
    # speaker:Mara
    Easy access to water. Easy access to flooding. The rise. Always the rise.
    -> mara_questions
+ [The rise, further from water]
    # portrait:mara
    # speaker:Mara
    Good. You are thinking like someone who wants to wake up dry.
    { not has_dried_berries:
        ~ has_dried_berries = true
        # item:dried_berries
        Here. You will need the energy.
    }
    -> mara_questions

=== mara_shimmerleaf ===
# portrait:mara
# speaker:Mara
It grows near water but not in it. 

The north-facing edges of the forest, mostly. Less sun. The plant likes the shade.
-> mara_questions

=== mara_others ===
# portrait:mara
# speaker:Mara
Two, last week. One camped by the river bend. Gone before sunrise — tent half-buried in mud by morning.
# speaker:Mara
The other listened. She is probably doing fine out there.
# speaker:Mara
Some people learn from others. Some learn from the mud.
-> mara_questions


// ═══════════════════════════════════════
// FINN
// ═══════════════════════════════════════

=== finn_entry ===
{ talked_to_finn:
    - true:
        # portrait:finn
        # speaker:Finn
        Back again?
        -> finn_questions
    - false:
        # portrait:finn
        # speaker:Finn
        You look lost. First time out here?
        # portrait:aiden
        # speaker:Aiden
        I am looking for the Shimmerleaf.
        # portrait:finn
        # speaker:Finn
        Then you will need to survive in the forest. Ask away.
        ~ talked_to_finn = true
        -> finn_questions
}

=== finn_questions ===
+ [Any dangers I should watch for out there?] -> finn_overhead
+ [That is all I needed.] -> village_hub

=== finn_overhead ===
# portrait:finn
# speaker:Finn
The trees will kill you before the cold does — trust me. Dead branches. Widowmakers, we call them. Always look up before you pitch your tent. Always.

And never build fire under a canopy. One spark into dry leaves overhead and it all comes down on you. Open sky above your fire. No exceptions.
# speaker:Finn
Two spots. One under a big oak — sheltered. One in a clearing — open sky but you would feel the wind. Which one?
+ [Under the oak — better shelter]
    # portrait:finn
    # speaker:Finn
    That oak has three dead branches I can see from here. Any one comes down in the night... Always choose the clearing, which is the open area.
    -> finn_questions
+ [The clearing — open sky is safer]
    # portrait:finn
    # speaker:Finn
    Exactly. Wind you can deal with. A branch through your tent you cannot.

    { not has_rope:
        ~ has_rope = true
        # item:rope
        Here. Useful for securing things.
    }
    -> finn_questions


// ═══════════════════════════════════════
// ISLA
// ═══════════════════════════════════════

=== isla_entry ===
{ talked_to_isla:
    - true:
        # portrait:isla
        # speaker:Isla
        You again. Sit, if you like.
        -> isla_questions
    - false:
        # portrait:isla
        # speaker:Isla
        You have the look of someone who has come a long way.
        # portrait:aiden
        # speaker:Aiden
        I have. I am looking for the Shimmerleaf.
        # portrait:isla
        # speaker:Isla
        Then sit for a moment. There are things worth knowing.
        ~ talked_to_isla = true
        -> isla_questions
}

=== isla_questions ===
+ [What do you know about making camp?] -> isla_camp
+ [What do you know about the Shimmerleaf?] -> isla_shimmerleaf
+ [That is all I needed.] -> village_hub

=== isla_camp ===
# portrait:isla
# speaker:Isla
Wind is the one people forget. They think about rain, they think about cold. Not wind — until it is three in the morning and their fire is ash and their blankets are wet.

Face your shelter away from the wind. Find something solid at your back. A boulder, a bank, a hill.

And cold air flows downhill just like water. Hollows fill up with cold before anywhere else. Sleep high. Sleep dry. Sleep warm.
# speaker:Isla
A hollow between two hills — sheltered, soft ground. Or a flat open space on the hillside — exposed, higher up. Where do you sleep?
+  [The hollow — sheltered and quiet]
    # portrait:isla
    # speaker:Isla
    Cold air pools in hollows like water in a bowl. By midnight shivering. By dawn sick. 
    Cold flows downhill — remember that.
    -> isla_questions
+  [The hillside — higher and better air]
    # portrait:isla
    # speaker:Isla
    You understand. Most people do not until they have spent a night in a hollow.
    { not has_water_pouch:
        ~ has_water_pouch = true
        # item:water_pouch
        Take this. Keep it full.
    }
    -> isla_questions

=== isla_shimmerleaf ===
# portrait:isla
# speaker:Isla
My grandmother collected it. Said the rain wakes something in the leaf. Half an hour after a storm passes, they glow — pale green. Easy to spot. But only for a short while.

You need to already be there when the rain stops. Camped and waiting.

-> isla_questions


// ═══════════════════════════════════════
// DAY 1 END
// ═══════════════════════════════════════

=== day1_end ===
# portrait:aiden
# speaker:Aiden
I know where to go. I'll head to the north edge of the forest tomorrow. 
-> day2_transition