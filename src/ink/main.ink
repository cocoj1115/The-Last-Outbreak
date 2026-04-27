// main.ink
// Dev A owns all .ink files.
//
// Compile to JSON using Inky (File > Export to JSON) or inklecate:
//   inklecate -o src/assets/story/main.ink.json src/ink/main.ink
//
// Variable naming conventions:
//   mg_{id}_success  (bool)  — minigame result written by InkBridge
//   mg_{id}_score    (int)   — minigame score written by InkBridge
//   stamina          (int)   — kept in sync by InkBridge
//   current_day      (int)   — kept in sync by InkBridge

VAR mg_campsite_success = false
VAR mg_campsite_score = 0
VAR mg_fire_success = false
VAR mg_fire_score = 0
VAR stamina = 5
VAR current_day = 1
VAR herb_count = 0
VAR forced_worst_ending = false

-> day1_intro

// ─────────────────────────────────────────────────────────────────────────────
// DAY 1 — Learn 扎营（晴，无压力）
// ─────────────────────────────────────────────────────────────────────────────

=== day1_intro ===
# scene:forest_day1
# speaker:旁白
三天前，村里开始生病。

老人说林子深处有一种草药，能治这种寒症。

# speaker:主角
我是唯一一个还没倒下的人。

今天天气还好。先找个地方扎营。

-> day1_campsite

=== day1_campsite ===
# speaker:旁白
林子边缘有几处空地。

天还亮着，可以仔细看看地形。

// Trigger campsite minigame — Day 1, learn difficulty
# minigame:campsite day:1 difficulty:learn

// ── Minigame result branch ──
{ mg_campsite_success:
    - true: -> day1_campsite_good
    - false: -> day1_campsite_bad
}

=== day1_campsite_good ===
# speaker:主角
这里不错。地势高，不会积水。

营地搭好后，我还有力气在周围转了转。

~ herb_count = herb_count + 1

# speaker:旁白
在营地东边，找到了第一株草药。

叶片完整，气味对。

-> day1_end

=== day1_campsite_bad ===
# speaker:主角
搭起来才发现地方选得不好。

整晚都在想哪里出了问题。

# speaker:旁白
疲惫让搜索范围缩小了许多。

草药就在不远处，但今天没有找到。

-> day1_end

=== day1_end ===
# speaker:旁白
第一天结束。

草药还差得远。

-> END
// TODO: -> day2_intro when Day 2 is written
