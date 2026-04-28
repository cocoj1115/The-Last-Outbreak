// main.ink
// Compile with Inky: File > Export story to JSON
// Save output to: public/assets/story/main.ink.json

VAR campsite_score = 0
VAR fire_score = 0
VAR herb_count = 0
VAR current_day = 1
VAR forced_worst_ending = false

-> prologue

// ═════════════════════════════════════════════════════════════════════════════
// PROLOGUE
// ═════════════════════════════════════════════════════════════════════════════

=== prologue ===
# speaker:Aiden
My village died when I was young.

A disease no one could stop.

I became a doctor to find the cure.

It took me twenty years.

The ingredients have been extinct for centuries.

But I found a way back.

-> time_transition

=== time_transition ===
# speaker:
One chance. A few nights before I have to return.

# speaker:Aiden
Five days. Two herbs. I need to move fast.

The Moonleaf first — that village is closer.

Let's move.

-> day1_arrival


// ═════════════════════════════════════════════════════════════════════════════
// DAY 1 — Learning campsite basics
// ═════════════════════════════════════════════════════════════════════════════

=== day1_arrival ===
# scene:forest_day1
# speaker:Mara
You are not from here. What do you want?

# speaker:Aiden
My name is Aiden. I am looking for the Moonleaf.

# speaker:Mara
The Moonleaf? What for?

# speaker:Aiden
A cure. For a disease that has taken many lives.

# speaker:Mara
The Moonleaf only blooms at dawn. Only for those who slept safely nearby through the night.

# speaker:Aiden
Then I need to make camp. Can you help me?

# speaker:Mara
I can. But first — do you know how to choose a campsite?

# speaker:Aiden
...Not exactly.

# speaker:Mara
Then come. Two travelers camped here before you. Go and look at what they left behind. The forest will teach you better than I can.

-> site_a


// ─────────────────────────────────────────────────────────────────────────────
// SITE A — Bad campsite
// ─────────────────────────────────────────────────────────────────────────────

=== site_a ===
# speaker:Mara
This traveler left before sunrise. Look around carefully. What do you notice?

* [Examine the tent under the branches]
    # speaker:Mara
    The branches hang directly over the tent. Dead wood falls without warning — and they drip long after rain stops.
    -> site_a_continue

* [Look at the stream beside the tent]
    # speaker:Mara
    The stream is barely two steps away. See the waterline on those rocks? The water rises at night.
    -> site_a_continue

* [Check the ground around the tent]
    # speaker:Mara
    The ground dips down toward the water here. After any rain this whole area floods.
    -> site_a_continue

* [Look for a fire spot]
    # speaker:Mara
    Nowhere safe to build a fire. Too many roots, too much damp ground, branches too low overhead.
    -> site_a_continue

=== site_a_continue ===
* [Keep looking]
    -> site_a
* [I have seen enough]
    -> site_b


// ─────────────────────────────────────────────────────────────────────────────
// SITE B — Good campsite
// ─────────────────────────────────────────────────────────────────────────────

=== site_b ===
# speaker:Mara
Now come. There is one more site to look at. This traveler left safe and healthy. See what they chose.

* [Examine the tent position]
    # speaker:Mara
    The ground sits higher than the area around it. Water drains away naturally — this spot stays dry even after heavy rain.
    -> site_b_continue

* [Look at the boulder]
    # speaker:Mara
    The boulder blocks the wind and gives a clear view of the surrounding forest. No branches overhead — nothing to fall or drip on the tent.
    -> site_b_continue

* [Check the stream distance]
    # speaker:Mara
    The stream is about fifteen metres away. The bank is high and stable. Close enough to collect water — far enough to sleep safely.
    -> site_b_continue

* [Look at the fire spot]
    # speaker:Mara
    Open sky directly above. The fire ring sits about three metres from the tent on the downhill side — smoke drifts away from the sleeping area.
    -> site_b_continue

=== site_b_continue ===
* [Keep looking]
    -> site_b
* [I understand now]
    -> challenge1_setup


// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 1 — Identify why the site is bad
// ─────────────────────────────────────────────────────────────────────────────

=== challenge1_setup ===
# speaker:Mara
You have seen both sites. Now you need to find your own.

A new site. A tent pitched on a slope. A fire ring with a branch clearly visible overhead.

Is this site safe to camp?

* [Safe to camp]
    # speaker:Mara
    Look more carefully. Something here would cost you the night.
    -> challenge1_setup

* [Not safe]
    # speaker:Mara
    Good. Now tell me why.
    -> challenge1_mcq2


=== challenge1_mcq2 ===
# speaker:Mara
Which of these are problems at this site?

* [Ground condition and fire placement]
    -> challenge1_mcq3

* [Ground condition only]
    # speaker:Mara
    Look at the site again. You missed something.
    -> challenge1_mcq2

* [Fire placement only]
    # speaker:Mara
    Look at the site again. You missed something.
    -> challenge1_mcq2

* [Water proximity]
    # speaker:Mara
    Are you sure about that one? Look carefully.
    -> challenge1_mcq2

* [Natural shelter]
    # speaker:Mara
    Are you sure about that one? Look carefully.
    -> challenge1_mcq2


=== challenge1_mcq3 ===
# speaker:Mara
What is the problem with the ground?

* [It is too rocky and uneven to sleep on]
    # speaker:Mara
    Rocky is uncomfortable but not dangerous. Think about where the water would go if it rained on that slope.
    -> challenge1_mcq3

* [It slopes downward]
    # speaker:Mara
    Exactly. Water runs downhill. A sloped site floods from above.
    -> challenge1_mcq4

* [It is too close to the tree roots]
    # speaker:Mara
    Roots can be managed. Think about where the water would go if it rained on that slope.
    -> challenge1_mcq3

* [It is too soft and grassy]
    # speaker:Mara
    Soft grass is not the danger. Think about where the water would go if it rained on that slope.
    -> challenge1_mcq3


=== challenge1_mcq4 ===
# speaker:Mara
What is the problem with the fire?

* [The fire is too far from the tent to provide warmth]
    # speaker:Mara
    Distance is not the issue here. Look directly above the fire ring — that is where the danger is.
    -> challenge1_mcq4

* [The fire ring has a low dry branch directly overhead]
    # speaker:Mara
    Exactly. A single spark and the whole branch goes up.
    -> challenge1_complete

* [The fire is too close to the stream]
    # speaker:Mara
    The stream is not directly above the fire. Look up — that is where the danger is.
    -> challenge1_mcq4

* [The fire ring is too small]
    # speaker:Mara
    Size does not matter here. Look up — that is where the danger is.
    -> challenge1_mcq4


=== challenge1_complete ===
~ campsite_score = campsite_score + 1
-> challenge2_setup


// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 2 — Build the correct campsite
// ─────────────────────────────────────────────────────────────────────────────

=== challenge2_setup ===
# speaker:Mara
Now you know what to avoid. Let's set up properly before the sun goes down.

Where do you pitch the tent?

* [On the raised firm ground behind the boulder]
    # speaker:Mara
    Good. High ground, no overhead hazards.
    -> challenge2_mcq2

* [Under the large tree for overhead cover]
    # speaker:Mara
    Overhanging branches drip and drop wood. This tree carries the same risk.
    -> challenge2_setup

* [On the flat ground at the base of the hill]
    # speaker:Mara
    Flat looks safe but the hill above sends rainwater runoff straight down here.
    -> challenge2_setup


=== challenge2_mcq2 ===
# speaker:Mara
Where do you build the fire?

* [In the open clearing, 3m from the tent, on the downhill side]
    # speaker:Mara
    Good. Smoke drifts away. Nothing overhead to catch a spark.
    -> challenge2_mcq3

* [Beside the tent on the uphill side]
    # speaker:Mara
    Uphill means smoke and embers drift down toward the tent as you sleep.
    -> challenge2_mcq2

* [Under the tree canopy, sheltered from wind]
    # speaker:Mara
    Overhanging branches and fire are a bad combination.
    -> challenge2_mcq2

* [At the stream's edge, safer if it spreads]
    # speaker:Mara
    Damp ground near water makes fire hard to keep alive and risks spreading to roots and reeds.
    -> challenge2_mcq2


=== challenge2_mcq3 ===
# speaker:Mara
Where do you position your shelter opening?

* [Away from the prevailing wind]
    # speaker:Mara
    Correct. Cold air and smoke stay out.
    -> challenge2_complete

* [Toward the stream, easy access overnight]
    # speaker:Mara
    Facing the stream means damp air and insects flow straight into the tent all night.
    -> challenge2_mcq3

* [Toward the large tree for morning shade]
    # speaker:Mara
    Morning shade is comfort, not safety. Wind direction determines where cold air and smoke go while you sleep.
    -> challenge2_mcq3

* [Direction does not matter for one night]
    # speaker:Mara
    One night of bad wind direction means a cold, smoky sleep.
    -> challenge2_mcq3


=== challenge2_complete ===
~ campsite_score = campsite_score + 1
# speaker:Mara
The camp is set. Rest now. The Moonleaf will find you at dawn.

-> day1_dawn


// ─────────────────────────────────────────────────────────────────────────────
// DAY 1 — Dawn
// ─────────────────────────────────────────────────────────────────────────────

=== day1_dawn ===
# speaker:Mara
Wake up, doctor.

# speaker:Aiden
The Moonleaf... it's here...

~ herb_count = herb_count + 1

# speaker:Aiden
Thank you, Mara. For everything. I have to get going now — to save everyone.

-> day2_transition


// ═════════════════════════════════════════════════════════════════════════════
// DAY 2 — Campsite in rain + firemaking
// ═════════════════════════════════════════════════════════════════════════════

=== day2_transition ===
# scene:map
# speaker:Aiden
One herb down. One more to go.

-> day2_arrival

=== day2_arrival ===
# scene:forest_day2
# speaker:Aiden
Rain is coming. I need to make camp now, before it hits.

Everything Mara taught me. Let's see if I remember it.

-> day2_campsite_mcq


=== day2_campsite_mcq ===
# speaker:Aiden
Which site do I choose?

* [Flat ground under thick tree cover. Stream nearby. Protected from wind.]
    # speaker:Aiden
    Tree cover drips long after rain stops and risks falling branches. It does nothing to stop flooding. In rain, what the ground does with water matters more than what is above you.
    -> day2_campsite_mcq

* [Raised firm ground behind a boulder. Stream 15m away. Open sky above.]
    # speaker:Aiden
    Raised ground. Distance from water. Everything else is secondary when it rains.
    -> day2_campsite_correct

* [Hollow between two rocks. Very sheltered from wind. Dry overhead canopy.]
    # speaker:Aiden
    Hollows collect rainwater and flood overnight. In rain, elevation always beats shelter.
    -> day2_campsite_mcq


=== day2_campsite_correct ===
~ campsite_score = campsite_score + 1
# speaker:Aiden
Now I'll need to set things up before it rains.

-> day2_fire_intro


// ─────────────────────────────────────────────────────────────────────────────
// DAY 2 — Firemaking
// ─────────────────────────────────────────────────────────────────────────────

=== day2_fire_intro ===
# speaker:Traveler
First time in the field?

# speaker:Aiden
That obvious?

# speaker:Traveler
You are staring at a pile of wood like it owes you something.

# speaker:Aiden
I want to build a fire to keep warm. But I do not know where to start.

# speaker:Traveler
Then I'll show you. But we need to move fast — that rain won't wait.

-> day2_fire_spot


=== day2_fire_spot ===
# speaker:Traveler
Before anything else — pick your spot.

# speaker:Aiden
I know this. I have done it before.

# speaker:Traveler
Show me then.

* [Under a large tree, sheltered from rain]
    # speaker:Traveler
    Tree branches overhead drip constantly in rain and dry ones catch sparks easily.
    -> day2_fire_spot

* [In the open, 3m from tent, downhill, clear sky above]
    # speaker:Traveler
    Good. You do know it.
    -> day2_fire_clear

* [Right beside the tent on the uphill side]
    # speaker:Traveler
    Uphill means smoke and embers drift down toward you all night.
    -> day2_fire_spot

* [At the edge of the clearing near the stream]
    # speaker:Traveler
    Damp ground near water makes fire impossible to maintain.
    -> day2_fire_spot


=== day2_fire_clear ===
# speaker:Traveler
Now clear the ground before you do anything else. Leaves, roots, debris — fire spreads to whatever is closest.

# speaker:Traveler
Good. Now the wood.

-> day2_fire_wood


=== day2_fire_wood ===
# speaker:Traveler
Not all wood burns the same. Dry, dead wood — that is what you want.

-> day2_fire_build


=== day2_fire_build ===
# speaker:Traveler
Now build it.

-> day2_end


=== day2_end ===
# speaker:Traveler
There. That will hold through the night.

-> END
