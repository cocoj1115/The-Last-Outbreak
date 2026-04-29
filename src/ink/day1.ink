// day1.ink

=== day1_arrival ===
# scene:village_day1
# speaker:Aiden
A village. Small. Quiet. Someone here must know where the Moonleaf grows.
-> village_hub

=== village_hub ===
# speaker:
Three people nearby.
* [Talk to Mara — the hunter] -> mara_entry
* [Talk to Finn — the woodcutter] -> finn_entry
* [Talk to Isla — the village elder] -> isla_entry
* [I have learned enough. Time to make camp.] -> day1_end


// ═══════════════════════════════════════
// MARA — ground + water
// ═══════════════════════════════════════

=== mara_entry ===
{ talked_to_mara:
    - true:
        # speaker:Mara
        Still here?
        -> mara_questions
    - false:
        # speaker:Mara
        You are not from here. What do you want?
        # speaker:Aiden
        My name is Aiden. I am looking for the Moonleaf. 
        # speaker:Mara
        The Moonleaf only blooms at dawn — only for those who slept safely nearby. Ask me what you need.
        ~ talked_to_mara = true
        -> mara_questions
}

=== mara_questions ===
* [How do I choose a campsite?] -> mara_campsite
* [Have you seen anyone else pass through?] -> mara_others
* [That is all I needed.] -> village_hub

=== mara_campsite ===
# speaker:Mara
Ground first. Find somewhere high — not a hilltop, just higher than what surrounds it. Water runs downhill. Sleep in a low spot and you wake up wet.
# speaker:Mara
Stay back from water. Fifteen steps at least. I have seen men camp by a quiet stream and find themselves underwater by morning.
# speaker:Mara
Tell me — flat ground right beside a stream, or a slight rise thirty steps away. Which do you take?
* [The flat spot — easier access to water]
    # speaker:Mara
    Easy access to water. Easy access to flooding. The rise. Always the rise.
    -> mara_questions
* [The rise, further from water]
    # speaker:Mara
    Good. You are thinking like someone who wants to wake up dry.
    { not has_dried_berries:
        ~ has_dried_berries = true
        # item:dried_berries
        Here. You will need the energy.
    }
    -> mara_questions

=== mara_others ===
# speaker:Mara
Two, last week. One camped by the river bend. Gone before sunrise — tent half-buried in mud by morning.
# speaker:Mara
The other listened. She is probably doing fine out there.
# speaker:Mara
Some people learn from others. Some learn from the mud.
-> mara_questions


// ═══════════════════════════════════════
// FINN — overhead + wind
// ═══════════════════════════════════════

=== finn_entry ===
{ talked_to_finn:
    - true:
        # speaker:Finn
        Back again?
        -> finn_questions
    - false:
        # speaker:Finn
        You look lost. First time out here?
        # speaker:Aiden
        I need to survive in the forest tonight. Looking for the Moonleaf.
        # speaker:Finn
        Then you will want to know a few things. Ask away.
        ~ talked_to_finn = true
        -> finn_questions
}

=== finn_questions ===
* [Any dangers I should watch for out there?] -> finn_overhead
* [That is all I needed.] -> village_hub

=== finn_overhead ===
# speaker:Finn
The trees will kill you before the cold does — trust me. Dead branches. Widowmakers, we call them. Always look up before you pitch your tent.
# speaker:Finn
And never build fire under a canopy. One spark into dry leaves overhead and it all comes down on you. Open sky above your fire. No exceptions.
# speaker:Finn
Two spots. One under a big oak — sheltered. One in a clearing — open sky but you would feel the wind. Which one?
* [Under the oak — better shelter]
    # speaker:Finn
    That oak has three dead branches I can see from here. Any one comes down in the night... Clearing. Always the clearing.
    -> finn_questions
* [The clearing — open sky is safer]
    # speaker:Finn
    Exactly. Wind you can deal with. A branch through your tent you cannot.
    { not has_rope:
        ~ has_rope = true
        # item:rope
        Here. Useful for securing things if you have to camp under cover.
    }
    -> finn_questions


// ═══════════════════════════════════════
// ISLA — water + wind
// ═══════════════════════════════════════

=== isla_entry ===
{ talked_to_isla:
    - true:
        # speaker:Isla
        You again. Sit, if you like.
        -> isla_questions
    - false:
        # speaker:Isla
        You have the look of someone who has come a long way.
        # speaker:Aiden
        I have. I need to camp in the forest tonight. Looking for the Moonleaf.
        # speaker:Isla
        Then sit for a moment. There are things worth knowing.
        ~ talked_to_isla = true
        -> isla_questions
}

=== isla_questions ===
* [What do you know about making camp?] -> isla_camp
* [That is all I needed.] -> village_hub

=== isla_camp ===
# speaker:Isla
Wind is the one people forget. They think about rain, they think about cold. Not wind — until it is three in the morning and their fire is ash.
# speaker:Isla
Face your shelter away from the wind. Find something solid at your back. A boulder, a bank, a hill. And cold air flows downhill just like water — hollows fill up with cold before anywhere else. Sleep high.
# speaker:Isla
A hollow between two hills — sheltered, soft ground. Or a flat open space on the hillside — exposed, higher up. Where do you sleep?
* [The hollow — sheltered and quiet]
    # speaker:Isla
    Cold air pools in hollows like water in a bowl. By midnight shivering. By dawn sick. The hillside. Cold flows down — remember that.
    -> isla_questions
* [The hillside — higher and better air]
    # speaker:Isla
    You understand. Most people do not until they have spent a night in a hollow.
    { not has_water_pouch:
        ~ has_water_pouch = true
        # item:water_pouch
        Take this. Keep it full.
    }
    -> isla_questions


// ═══════════════════════════════════════
=== day1_end ===
# speaker:Aiden
Time to find a spot before dark.
-> END
