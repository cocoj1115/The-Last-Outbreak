# Day 2 — Firemaking Minigame 开发文档

---

## 1. 概览

### 1.1 定位

Day 2 Firemaking 是野外生存教育游戏中的核心 mini game。玩家（Aiden）需要在雨夜森林中完成完整的生火流程——从清理火坑到守夜维持火焰。本关卡是**教学关（tutorial）**，Day 3 将复用同一套交互系统但移除所有引导，由玩家自主操作。

### 1.2 教学目标（Learning Objectives）

玩家完成 Day 2 后应掌握：

1. 生火前需要清理火坑周围的可燃物，露出矿物土
2. 三种火材的分类：tinder（引火物）、kindling（引燃物）、fuel wood（主燃料）——及各自的特征和作用
3. 生火前应先收集齐所有材料，而非边烧边找
4. 搭建 fire lay 的正确层级顺序：tinder（底）→ kindling（中）→ fuel wood（顶）
5. 火花应打在 tinder 层，因为只有最细最干的材料能接住火花
6. 从火花到稳定火焰的过程中，需要适度吹气提供氧气
7. 守夜时在正确时机添加燃料，不浪费也不太迟

### 1.3 叙事背景

Aiden 需要采集 Shimmerleaf——一种只在雨停后短暂发光的草药。他必须提前进入森林扎营，保持火焰燃烧一整夜，雨停后借火光寻找草药。在营地遇到猎人 Ren，两人合作完成生火。

---

## 2. 角色

### 2.1 Aiden（玩家角色）

年轻草药学徒，有基本的野外知识但不是生存专家。玩家通过他做出所有操作决策。

### 2.2 Ren（NPC 同伴）

**身份：** 独行猎人，常年在这片森林活动，野外生存经验丰富。

**出场理由：** Aiden 选完营地后，Ren 路过，看到有人在暴风雨前独自扎营，决定一起过夜。

**语气定位：** 友善、随意、有点 casual。不是老师，不是指挥官，是一个能力比你强一点的同伴。他默认你应该懂一些，会让你先做，但如果你搞砸了会毫不客气地指出来。偶尔带点调侃但不刻薄。

**在教学中的角色：**
- 每个阶段由 Ren 主动 propose 下一步行动
- 通过自然对话给玩家选择：自己做 or 听讲解
- 做对了给正反馈（解释做对了什么、为什么好、带来什么好处）
- 做错了给纠正反馈（explanatory，不直接给答案，引导玩家自己想）

### 2.3 对话系统说明

- 所有对话使用现有的对话框 + 人物立绘系统
- Day 2 中所有对话框为**强制弹出**，玩家必须点击确认后才能继续下一步
- 独白和对话在触发后阻塞交互，直到玩家点击 dismiss

---

## 3. 完整流程图

```
营地场景入口
    │
    ▼
[NPC Ren 出场] ── 叙事对话
    │
    ▼
[Step 1: 清理火坑] ── 点击清除可燃物
    │
    ▼
[Step 2: 收集材料] ── 点击森林 hotspot → 进入 FireCollectMinigame
    │                    Ren proposal → 玩家选"我知道"/"教我"
    │                    "我知道" → 自由收集，犯错时 Ren 纠正
    │                    "教我" → Ren 先讲解，再收集
    │                    目标：Tinder 3/3, Kindling 3/3, Fuel 2/2
    │                    收集完成 → 回到营地
    │
    ▼
[Step 3: 分拣 Sort] ── 材料散落在地面
    │                    Ren proposal → 玩家选"我知道"/"教我"
    │                    拖拽材料到三个分类区
    │                    放对：正反馈（首次强制弹出，后续 HUD）
    │                    放错：explanatory 反馈，材料弹回
    │
    ▼
[Step 4: 搭建 Stack] ── 三堆材料已分好
    │                     Ren proposal → 玩家选"我知道"/"教我"
    │                     按层级拖拽到火坑（底→中→上）
    │                     Day 2 层级顺序锁定（当前层完成才解锁下一层）
    │
    ▼
[Step 5: 点火 Ignite] ── 选择火花落点 + 燧石点击 + 吹气节奏
    │                      Ren proposal → 玩家选"我知道"/"教我"
    │                      难度参数由前置步骤决定
    │
    ▼
[Step 6: 蔓延 Spread] ── 自动，基于搭建质量
    │                      成功：逐层画面切换 + Ren 解说
    │                      失败：卡住 + 一次补救机会
    │
    ▼
[Step 7: 守夜 Sustain] ── 监控火焰 + 加柴时机判断
    │                       Ren proposal → 玩家选"我知道"/"教我"
    │                       进度条走完 = 成功
    │
    ▼
[成功] → 雨停 → 搜索 Shimmerleaf → Day 2 结束
[失败] → triggerDayFail() → Buffer Day → 从 Step 1 重来
```

---

## 4. 逐阶段详细设计

---

### 4.0 NPC Ren 出场

**触发：** 营地选址完成后自动触发。

**场景：** 营地近景，Aiden 在整理营地。

**对话序列（强制弹出，逐条点击确认）：**

```
(SFX) 树枝踩断的声音，脚步声从远处靠近。

(Ren) "Huh. Do not see many people out this deep. Especially not before a storm."

(Aiden) "I could say the same about you."

(Ren) "Fair enough. I am Ren — I hunt out here most seasons.
        You setting up camp for the night?"

(Aiden) "I need to be here when the rain stops. There is an herb
        that only shows itself after a storm."

(Ren) "Shimmerleaf? You are going to need a fire for that —
       you will never spot it in the dark. Tell you what,
       I will camp here tonight too. Two people keeping
       a fire alive beats one."

(Aiden) "I would not say no to that."

(Ren) "Then let us get moving. Rain is not going to wait."
```

**产出：** Ren 加入队伍，后续所有阶段 Ren 参与对话。

**美术资产：**
- CHAR-REN：年轻猎人立绘，户外装束，随意姿态，1200×1800

---

### 4.1 Step 1：清理火坑

**教学目标：** 生火前需要清理火坑周围的可燃物，防止火势蔓延。

**场景：** 营地近景，火坑区域居中，地面上有落叶、枯枝等可燃杂物散落。杂物为可点击的 hotspot。

**UI：**
- 火坑区域居中
- 可燃杂物散落为可点击 hotspot（落叶堆、枯枝、干草等）
- 森林方向 hotspot 可见但此阶段不可交互

#### 流程

**Ren proposal（强制弹出）：**

```
(Ren) "First things first — help me clear this ground. Dead leaves,
       dry debris, anything loose. One stray ember lands on that
       and suddenly the fire is everywhere except where you want it."
```

**玩家操作：** 逐个点击可燃杂物清除（点击后该物件消失或变灰）。

**清理完成后 Ren 反馈（强制弹出）：**

```
(Ren) "Good. Bare soil. Now if a spark jumps, it has nowhere to go.
       That is how you keep a fire under control."
```

#### 数据产出

```javascript
registry.groundCleared = true;  // 影响 sustain 阶段衰减档位
```

#### Day 3 复用

- 同一场景，火坑区域默认有杂物
- 无 Ren 对话提示
- 玩家需自己记得点击清理
- 跳过清理 → `groundCleared = false` → sustain 衰减加速

---

### 4.2 Step 2：收集材料（FireCollectMinigame）

**教学目标：**
- 认识三种火材分类：tinder、kindling、fuel wood
- 通过外观和触感判断材料干湿
- 理解"先准备齐全再生火"的原则
- 了解合理的材料配比

**场景：** 先在营地触发对话，然后玩家点击森林 hotspot 进入独立的 FireCollectMinigame 场景。

#### 营地内对话

**Ren proposal（强制弹出）：**

```
(Ren) "Right. We need wood. Rain is picking up so whatever is dry
       out there will not stay dry for long. You go ahead —
       you know what to grab, yeah?"
```

**玩家选项：**
- **"Of course. Three types — tinder, kindling, fuel wood."**
- **"Roughly, but remind me."**

##### 路径 A："Of course"

```
(Ren) "Alright, let us go then."
```

玩家点击森林 hotspot → 进入森林场景，无前置教学。

**机制说明对白（进入森林后，强制弹出）：**

```
(Ren) "Rain is getting heavier. Whatever is dry now will not be
       for long. Move fast."
```

玩家自由收集。**如果收集的配比明显不对**（如全是 fuel 没有 tinder）或**拿了很多湿材料**，Ren 在收集过程中介入（强制弹出）：

```
(Ren) "Hold on — look at what you have got so far. You are going
       to try to start a fire with that? You need the fine stuff,
       tinder, to catch the spark first. And enough kindling to
       bridge to the bigger pieces. Think about what is missing."
```

如果收集得很好，回营地时 Ren 正反馈（强制弹出）：

```
(Ren) "Not bad. You have got tinder to catch the spark, kindling
       to grow it, fuel wood to keep it going — and enough of each.
       That means we will not be scrambling around in the dark
       later looking for one more piece. Good."
```

##### 路径 B："Remind me"

```
(Ren) "Three types. Tinder — the lightest, driest stuff you can find.
       Leaves, dry grass, anything that crumbles. That catches the spark.
       Then kindling — thin sticks, things you can snap. They catch
       from the tinder and give the flame time to grow. And fuel wood —
       the thick pieces. Once the fire is going, that keeps it alive.
       I would say three handfuls of tinder, three of kindling,
       and two good pieces of fuel. And do not grab anything that
       feels heavy or damp — wet wood will kill a fire before it starts."
```

玩家点击森林 hotspot → 进入森林场景。

**机制说明对白（进入森林后，强制弹出）：**

```
(Ren) "Rain is getting heavier. Whatever is dry now will not be
       for long. Move fast."
```

#### 森林场景交互

**UI 布局：**
- 森林地面背景，材料散落为可点击 hotspot
- 屏幕角落材料计数器：`Tinder: 0/3 | Kindling: 0/3 | Fuel: 0/2`
- 体力条（已有 HUD）

**受潮机制：** 雨在逐渐变大，地上的材料会随时间受潮降级（GOOD → MID → BAD）。`poor` 营地的部分材料起始品质更低。

**拾取交互：** 玩家点击材料 → 拾取。

**第一次拾取每种类型时——教学反馈（强制弹出）：**

第一次拾取 tinder（如干树叶）：
```
(Ren) "That is good tinder. See how it crumbles? Dry enough
       to catch a spark."
```

第一次拾取 kindling（如干细枝）：
```
(Ren) "Thin and dry, snaps clean. Good kindling — it will catch
       from the tinder and keep the flame growing."
```

第一次拾取 fuel wood（如粗枝）：
```
(Ren) "Solid piece. That is fuel wood — once the fire is going,
       that is what keeps it alive through the night."
```

第一次拾取湿材料：
```
(Ren) "Feel that? Heavy. Damp inside. Wet material will smother
       a flame, not feed it. Leave it."
```

**后续拾取——HUD 轻量反馈（非弹窗）：**
- 屏幕短暂显示 "+1 Tinder" / "+1 Kindling" / "+1 Fuel Wood"
- 角落计数器更新
- 拾取湿材料：Ren 短句 "Too wet." （非弹窗，浮动文字）

#### 收集完成条件

三类都达到目标数量（3/3, 3/3, 2/2）后，Ren 提示（强制弹出）：

```
(Ren) "That should do it. Let us head back and get this fire built
       before the rain gets any worse."
```

**播种 Day 3 trade-off 认知（强制弹出）：**

```
(Ren) "I could carry more, but we are already loaded and the rain
       is not letting up. More trips means more weight on your legs —
       something to think about next time."
```

玩家点击确认 → 回到营地场景。

#### 材料定义表

| 材料 | 视觉描述 | 类别 | 默认品质 | poor 营地品质 |
|------|----------|------|----------|--------------|
| 干树叶 | 浅棕，卷曲 | tinder | GOOD | MID |
| 干草束 | 浅黄，蓬松 | tinder | GOOD | MID |
| 干细枝 | 灰色，有裂纹 | kindling | GOOD | GOOD |
| 细树枝 | 浅棕，能折断 | kindling | GOOD | GOOD |
| 粗树枝 | 深棕，粗实 | fuel_wood | GOOD | GOOD |
| 松果 | 棕色，紧实 | fuel_wood | MID | MID |
| 溪边树皮 | 深色，有光泽 | — | BAD | BAD |
| 湿苔藓 | 深绿，结块 | — | BAD | BAD |

#### 数据产出

```javascript
registry.collectedMaterials = {
  items: [
    { id: 'dry_leaves', type: 'tinder', quality: 'GOOD' },
    { id: 'dry_grass', type: 'tinder', quality: 'GOOD' },
    // ... 所有收集到的材料
  ],
  count: 8,
  tinder_count: 3,
  kindling_count: 3,
  fuel_count: 2
};
```

#### Day 3 复用

- 无目标数量提示，无计数器目标（只有总数计数）
- 无 Ren 教学对白和纠正
- 基础 8 把免费，超过 8 把每多 3 把消耗 1 点体力
- 体力条在超过 8 把后视觉提示（跳动/变色）
- 玩家自行判断何时停止、配比多少

#### 美术资产

- BG-FOREST：森林地面场景，材料散落，雨天氛围，2560×1440
- 各材料 sprite：干树叶、干草束、干细枝、细树枝、粗树枝、松果、溪边树皮、湿苔藓
- UI-MATERIAL-COUNTER：三类计数器 HUD 组件

---

### 4.3 Step 3：分拣（Sort）

**教学目标：** 巩固三种材料分类知识，理解分类对后续搭建效率的意义。

**场景：** 营地近景，收集到的 8 把木材散落在火坑旁地面上。

**UI 布局：**
- 火坑居中
- 材料散落在火坑周围，可拖拽
- 三个分类区域在火坑一侧，标有 Tinder / Kindling / Fuel Wood

#### 流程

**Ren proposal（强制弹出）：**

```
(Ren) "Alright, before we build anything — let us sort through this.
       You want to group them by type so when you are building the lay
       you can just grab what you need without thinking. Trust me,
       fumbling around for the right piece when your fire is dying
       is not fun. Go ahead, separate them out —
       you remember which is which, right?"
```

**玩家选项：**
- **"Tinder, kindling, fuel wood. I got it."**
- **"Walk me through it again."**

##### 路径 A："I got it"

```
(Ren) "Go for it then."
```

三个分类区域激活，玩家自由拖拽。

##### 路径 B："Walk me through it again"

```
(Ren) "Sure. Three piles. Tinder is the fine, light stuff — leaves,
       dry grass, anything that crumbles. That catches the spark.
       Kindling is the thin sticks, things you can snap. They catch
       from the tinder and keep the flame growing. Fuel wood is the
       heavy stuff — thick branches. They burn slow and long, that
       is what gets you through the night. Just pick each piece up,
       feel it, and ask yourself — is this light and crumbly, thin
       and snappy, or heavy and solid? That will tell you where it goes."
```

三个分类区域激活，玩家拖拽。

#### 反馈机制

**放错时——Ren 纠正（强制弹出），explanatory 式，不直接给答案，材料弹回：**

把 kindling 拖到 tinder 区：
```
(Ren) "Hmm — does this feel right? Tinder should crumble in my hand.
       This one... I can snap it, but it holds its shape.
       Maybe this belongs somewhere else."
```

把 tinder 拖到 fuel 区：
```
(Ren) "Wait. Fuel wood needs to burn for a long time.
       This is so light it would be gone in seconds.
       I do not think this is fuel."
```

把 fuel 拖到 kindling 区：
```
(Ren) "This feels heavy. Kindling should be thin, easy to snap.
       I can barely bend this. Maybe I should rethink where this goes."
```

把 tinder 拖到 kindling 区：
```
(Ren) "This is pretty fine — crumbles right away. Kindling has more
       structure than that. This might be more useful somewhere else."
```

把 kindling 拖到 fuel 区：
```
(Ren) "This is not heavy enough to be fuel. It would burn through
       too fast to keep a fire going all night.
       Feels more like something in between."
```

把 fuel 拖到 tinder 区：
```
(Ren) "That is way too thick to catch a spark. Tinder needs to be
       the finest, lightest material. This one has a different purpose."
```

**每种类型第一次放对时——Ren 正反馈（强制弹出）：**

Tinder 放对：
```
(Ren) "Light, dry, falls apart in my fingers. Tinder — that is
       what catches a spark."
```

Kindling 放对：
```
(Ren) "Thin enough to catch from tinder, strong enough to burn
       a little longer. That is good kindling."
```

Fuel wood 放对：
```
(Ren) "Heavy, solid. Fuel wood like this will keep the fire going
       once it is established."
```

**同类型后续放对：** HUD 轻量反馈（区域短暂亮一下），不弹对白。

**全部分完后 Ren 总结（强制弹出）：**

```
(Ren) "Good — tinder, kindling, fuel, all separated. Now when we
       build the lay, everything is right here, grouped and ready.
       No guessing, no wasting time. That is the difference between
       a fire that goes up smooth and one you are still fighting
       with when the rain hits."
```

#### 数据产出

```javascript
// 更新材料的分类状态
// 分错的材料（Day 3 无纠正时）会影响后续搭建
registry.sortedMaterials = {
  tinder: [{ id, quality }, ...],    // 被放入 tinder 区的材料
  kindling: [{ id, quality }, ...],  // 被放入 kindling 区的材料
  fuel_wood: [{ id, quality }, ...]  // 被放入 fuel 区的材料
};
```

#### Day 3 复用

- 同一场景和拖拽机制
- 无 Ren 对话、无选项
- 放错不弹回、不纠正
- 分错的材料保留在错误区域，后续搭建时按所在区域使用
  - 例：把 fuel 放进 tinder 区 → 搭建时当 tinder 用 → 底层有不合适的材料 → 点火更难

#### 美术资产

- 复用营地背景
- UI-SORT-ZONES：三个分类区域（Tinder / Kindling / Fuel Wood），带标签和边界

---

### 4.4 Step 4：搭建 Fire Lay（Stack）

**教学目标：**
- 搭建 fire lay 的正确层级顺序：tinder（底）→ kindling（中）→ fuel wood（顶）
- 理解火需要空气流通（概念层面，不做间距交互）

**场景：** 营地近景，火坑居中，三堆已分好的材料在旁。

**UI 布局：**
- 火坑居中，内部可视化三个放置层（底层 / 中层 / 上层）
- 三堆分好的材料在火坑旁，可拖拽
- Day 2：层按顺序解锁（当前层高亮，其余灰显锁定）
- 每层最低要求：底层 2 把，中层 1 把，上层 1 根

#### 流程

**Ren proposal（强制弹出）：**

```
(Ren) "Now we build. The order matters — and leave space between
       pieces. Fire needs air. Ready to lay it out?"
```

**玩家选项：**
- **"Bottom to top. I know."**
- **"What goes where?"**

##### 路径 A："I know"

```
(Ren) "Alright, let us get it set up."
```

底层高亮，其余锁定。玩家自由拖拽。

##### 路径 B："What goes where"

```
(Ren) "Tinder at the bottom — that is where the spark lands.
       Kindling on top of that — it catches from the tinder
       and grows the flame. Fuel wood on top — it burns slow
       and keeps you going. And leave gaps. Pack it too tight
       and you choke it."
```

底层高亮，玩家开始拖拽。

#### 层级交互逻辑

**Day 2 引导锁定：**
1. 开始时只有底层（Tinder）高亮可放置
2. 底层放满最低要求（2 把）→ 中层解锁高亮
3. 中层放满最低要求（1 把）→ 上层解锁高亮
4. 上层放满最低要求（1 根）→ 搭建完成

**放错层时——Ren 纠正（强制弹出），材料弹回：**

把 kindling 或 fuel 拖到底层：
```
(Ren) "Think smaller. The spark lands here — what is the only thing
       fine enough to catch it?"
```

把 tinder 或 fuel 拖到中层：
```
(Ren) "This layer bridges the flame upward. Too light and it is gone.
       Too heavy and it will not catch. What fits?"
```

把 tinder 或 kindling 拖到顶层：
```
(Ren) "The top needs to burn long and slow. What is heavy enough
       for that?"
```

**每层第一次放对时——Ren 正反馈（强制弹出）：**

底层（Tinder）放对：
```
(Ren) "Tinder at the base. That is where the spark catches. Good."
```

中层（Kindling）放对：
```
(Ren) "Kindling in the middle. It catches from the tinder
       and carries the flame up."
```

上层（Fuel）放对：
```
(Ren) "Fuel on top. Once everything below is burning,
       this keeps it going all night."
```

**同层后续放对：** HUD 轻量反馈。

**全部搭完后 Ren 总结（强制弹出）：**

```
(Ren) "Bottom to top — fine to heavy. Air between each piece.
       That is a fire that will actually breathe. Nice."
```

#### 数据产出

```javascript
registry.stackData = {
  bottom: [{ id, quality }, ...],   // 放入底层的材料（应为 tinder）
  middle: [{ id, quality }, ...],   // 放入中层的材料（应为 kindling）
  top: [{ id, quality }, ...],      // 放入上层的材料（应为 fuel）
  // Day 3 中可能有错放的材料
};

// 未放入火坑的余料 → 守夜阶段备用燃料
registry.reserveMaterials = [...]; // sorted 但没进火坑的材料
```

#### Day 3 复用

- 同一场景和拖拽机制
- 三层同时开放，不锁定顺序
- 无 Ren 对话
- 放错层不弹回、不纠正
- 错误搭建影响点火和蔓延阶段参数

#### 美术资产

- 复用营地背景
- UI-FIRE-PIT：火坑横截面，三层可视化放置区
- UI-LAYER-LABELS：底层/中层/上层标签（Day 2 显示，Day 3 隐藏）

---

### 4.5 Step 5：点火（Ignite）

**教学目标：**
- 火花应打在 tinder 层（最细最干的材料）
- 冒烟后需要轻轻吹气提供氧气，促使火苗形成
- 前置准备工作的质量直接影响点火难度

**场景：** 火坑特写。

**UI 布局：**
- 火坑 tinder 层特写为主画面
- 燧石图标（可点击）
- 吹气图标（初始灰色不可用）
- 火焰进度条（从空到满，分两个阶段标记：冒烟线 + 着火线）

#### 流程

**Ren proposal（强制弹出）：**

```
(Ren) "Alright, fire is built. Let us get a spark going."
```

**玩家选项：**
- **"Let us do this."**
- **"Where should the spark go?"**

##### 路径 A："Let us do this"

```
(Ren) "Go for it."
```

火坑三层都可点击。

**点了 kindling 或 fuel：**
```
(Ren) "Think about it — can a small spark catch on something
       that thick? You want the finest, driest layer."
```
弹回，玩家重新选。

**点了 tinder（正确）：**
```
(Ren) "Tinder. Right. That is the only layer fine enough
       to catch a spark."
```

##### 路径 B："Where should the spark go"

```
(Ren) "Bottom. The tinder. It is the only thing fine enough
       to catch a spark — everything else is too thick."
```

只有 tinder 层高亮，玩家点击。

#### 点火操作（两阶段）

选中 tinder 层后，画面切到 tinder 层特写。燧石图标激活。

##### 阶段一：打火花

- 玩家反复点击燧石
- 每次点击：画面闪火花特效，进度条 +1~3（随机）
- 进度条持续缓慢倒退（衰减）
- 玩家需要持续点击维持进度上涨

**进度条到达冒烟线 → tinder 开始冒烟。** 画面出现烟雾效果，吹气图标激活变亮。

##### 阶段二：吹气

- 燧石点击停止产生效果（继续点无用）
- 玩家点击吹气图标，每次点击进度条涨一大截
- **节奏要求：** 吹太快（连续疯狂点击）→ 进度条暴跌（"吹灭了"）；吹太慢 → 进度条倒退回冒烟线以下（"烟散了"，需重新打火花）
- 稳定节奏（约 1-2 秒一次）→ 进度条稳步上涨

**进度条到达着火线 → 点火成功。** 画面切换为小火苗状态。

**Day 2 Ren 提示：** 冒烟时（强制弹出）：
```
(Ren) "Smoke. Needs air — gentle."
```

吹太猛时（强制弹出）：
```
(Ren) "Too hard — you will blow it out. Easy."
```

#### 难度参数（由前置步骤决定）

| 参数 | 影响因素 | 效果 |
|------|----------|------|
| 进度条衰减速度 | 材料品质（BAD 越多越快）+ 营地质量（poor 更快） | 衰减快 → 打火花阶段更紧张 |
| 冒烟阈值 | tinder 有效数量：3把=40%, 2把=55%, 1把=70% | tinder 少 → 需要更多次点击才冒烟 |
| 吹气效率 | kindling 有效数量：3把=每次涨多, 2把=中等, 1把=涨少 | kindling 少 → 需要更多次精准吹气 |
| 雨滴干扰 | 仅 poor 营地 + 材料品质差时触发 | 周期性进度骤降 |
| 最大点击次数 | 固定 MAX_CLICKS = 30 | 用完未成功 = 失败 |

**Day 2 参数基准（宽松）：**
- 衰减速度：慢（-1 / 1.0s）
- 冒烟阈值：40%（假设 tinder 足够）
- 吹气效率：高
- 无雨滴干扰

**Day 3 参数基准（收紧）：**
- 衰减速度：由材料品质和营地实际决定
- 冒烟阈值：由实际 tinder 数量决定
- 吹气效率：由实际 kindling 数量决定
- poor 营地有雨滴干扰

#### 失败与重试

- **失败判定：** MAX_CLICKS（30次）用完且未到达着火线
- **首次失败（强制弹出）：**

```
(Ren) "Spark will not hold. That is alright — we have got
       enough tinder to try again."
```

- 消耗 1 把 tinder，体力 -1，允许重试
- **二次失败：** 体力 -2 → `triggerDayFail()`

#### 数据产出

```javascript
registry.ignitionSuccess = true/false;
registry.fireQuality = 'strong' / 'weak';  // 基于到达着火线时剩余点击数
```

#### 美术资产

- BG-IGNITE-BASE：tinder 层特写，引火物铺好，2560×1440
- BG-IGNITE-SMOKE：同上 + 冒烟效果，2560×1440
- BG-IGNITE-FLAME：同上 + 小火苗，2560×1440
- UI-FLINT：燧石图标
- UI-BLOW：吹气图标（灰色 / 激活态）
- UI-IGNITE-BAR：火焰进度条（带冒烟线和着火线标记）
- FX-SPARK：火花点击特效

---

### 4.6 Step 6：蔓延（Spread）

**教学目标：**
- 理解火焰从 tinder → kindling → fuel 的蔓延过程
- 搭建质量直接影响蔓延是否成功
- 蔓延失败时能诊断原因

**场景：** 火坑整体视图，小火苗在底层燃烧。

**注意：** 蔓延为自动过程，基于搭建质量决定结果。玩家不直接操作，但可能需要在卡住时进行一次补救操作。

#### 蔓延成功流程

画面逐步切换（每步间短暂停顿）：

**Tinder 层燃烧 → Kindling 着火：**
```
(Ren) "Flame is moving up to the kindling.
       The spacing is letting it breathe."
```

画面切换至 kindling 层着火状态。

**Kindling 燃烧 → Fuel 着火：**
```
(Ren) "Fuel is catching. That is a fire."
```

画面切换至全火焰状态。

**蔓延完成 Ren 总结（强制弹出）：**
```
(Ren) "Tinder catches the spark, kindling spreads it,
       fuel keeps it alive. Skip a step and it falls apart."
```

#### 蔓延卡住流程

**卡在 tinder → kindling（kindling 不够或品质差）：**

画面：火在底部烧但上层不动。

```
(Ren) "Flame is stuck at the bottom. Not enough kindling
       up there — the fire has nothing to grab onto."
```

**补救操作：** 如果有备用 kindling → 玩家从备用材料拖一把 kindling 到中层。成功后蔓延继续。无备用 kindling → 体力 -1，蔓延以弱火状态勉强成功。

**卡在 kindling → fuel（fuel 太湿或不够）：**

画面：中层在烧但上层不动。

```
(Ren) "Kindling is burning but the fuel is not catching.
       It might be too wet, or too heavy for what is below it."
```

**补救操作：** 如果有备用 fuel → 拖入上层。无备用 → 体力 -1，弱火状态进入守夜。

#### 蔓延结果影响守夜

| 蔓延结果 | fireQuality | 守夜影响 |
|----------|-------------|----------|
| 三层顺利蔓延 | 'strong' | 火焰初始满格，衰减正常 |
| 需要补救但成功 | 'weak' | 火焰初始 3/5，衰减略快 |
| 完全失败 | — | triggerDayFail() |

#### 数据产出

```javascript
registry.fireQuality = 'strong' / 'weak';
registry.reserveMaterials = [...];  // 更新（可能消耗了补救材料）
```

#### Day 3 复用

- 同样的自动蔓延机制
- 无 Ren 解说
- 卡住时无诊断对白，只有视觉症状（火在某层停住、大量浓烟）
- 玩家自行判断拖什么材料补救

#### 美术资产

- BG-SPREAD-1：火坑，tinder 层燃烧，2560×1440
- BG-SPREAD-2：火坑，tinder + kindling 燃烧，2560×1440
- BG-SPREAD-3：火坑，全层燃烧（旺火），2560×1440
- BG-SPREAD-STUCK-1：火在底部烧，上层无反应，2560×1440
- BG-SPREAD-STUCK-2：中层在烧，上层无反应，2560×1440

---

### 4.7 Step 7：守夜（Sustain）

**教学目标：**
- 在正确时机添加燃料维持火焰
- 理解添加太早（浪费）和太迟（灭火）的后果
- 前置选择（营地、材料、搭建）的累积效果在此阶段集中体现

**场景：** 营地夜景，火焰居中。

**UI 布局：**
- 火焰强度条（5 格，画面顶部）
- 备用材料区（画面侧边，可拖拽的材料 chip）
- 雨夜进度条（画面底部，走满 = 天亮）
- 背景随火焰强度切换（旺火 / 弱火 两张背景）

#### 流程

**Ren proposal（强制弹出）：**

```
(Ren) "Fire is up. Now we keep it alive through the night.
       When it gets low, add fuel. But not too early —
       we do not have wood to waste."
```

**玩家选项：**
- **"I will watch it. How hard can it be?"**
- **"How do I know when to add more?"**

##### 路径 A："How hard can it be"

```
(Ren) "Alright, I will rest first then."
```

玩家自行操作。

##### 路径 B："How do I know when"

```
(Ren) "Watch the flame. When it drops to about halfway,
       that is when you add. Too early, wasted wood. Too late,
       you are relighting in the rain."
```

第一次火焰降到 3 格时 Ren 提示：
```
(Ren) "Now. Add one."
```

之后玩家自己判断。

#### 守夜核心机制

**火焰强度条：** 5 格，持续衰减。

**加柴操作：** 玩家从备用材料区拖材料到火坑，或点击 [Add Fuel] 按钮。

**加柴时机反馈：**

| 情况 | 结果 | Ren 反馈 |
|------|------|----------|
| 满格（5/5）时加柴 | 柴消耗，强度不变 | "Wasted one. Save it for when it needs it." |
| 3-4 格时加柴 | 强度 +2 | HUD 反馈，无对白 |
| 1-2 格时加柴 | 强度 +2 | "Cutting it close." |
| 火灭（0 格） | 体力 -1，回到点火 | "It is out. Should have added sooner." |
| 柴用完且火灭 | 体力 -2 → triggerDayFail() | "No fuel, no fire. That is it." |

#### 守夜数值参数

**夜晚总时长（进度条跑完的时间）：**

由火坑内材料决定：
| 层 | 每件贡献 |
|----|----------|
| 上层（fuel） | +20 秒 |
| 中层（kindling） | +6 秒 |
| 底层（tinder） | +2 秒 |

Clamp：[20秒, 100秒]

标准配比（tinder 3 + kindling 3 + fuel 2）= 6 + 18 + 40 = 64 秒。

**火焰衰减速度（每掉一格的间隔）：**

| 营地质量 | groundCleared | 间隔（ms） |
|----------|---------------|-----------|
| good | true | 18000 |
| good | false | 14000 |
| poor | true | 11000 |
| poor | false | 8000 |

**积水事件（poor 营地专属）：**

- 每 20 秒（cleared）/ 15 秒（dirty）触发一次
- 效果：强制 -1 格火焰，无法用加柴抵消
- 画面短暂切换积水特写（1.2 秒）
- Ren 反馈（首次）：

```
(Ren) "Water getting in. Low ground — nothing we can do about it now."
```

**备用材料效果：**

| 材料类型 | 效果 |
|----------|------|
| Tinder | 火焰 +1（若 < 上限），但接下来 6 秒衰减加速（×0.5 间隔） |
| Kindling | 夜晚总时长 +10 秒 |
| Fuel wood | 夜晚总时长 +20 秒 + 接下来 20 秒衰减减速（×1.25 间隔） |

#### 守夜成功

进度条走满 → 天亮。

```
(Ren) "That is it. Fire made it through the night.
       Rain is slowing down too."
```

**成功评级：**
- 结束时火焰 ≥ 3 格 → `score: 'strong'`
- 结束时火焰 < 3 格 → `score: 'weak'`

#### 数据产出

```javascript
registry.sustainResult = {
  success: true/false,
  score: 'strong' / 'weak',
  fuelUsed: number,
  fireOutCount: number  // 火灭了几次
};
```

#### Day 3 复用

- 同一机制，无 Ren 提示
- 无"How hard can it be / How do I know" 选项
- 加柴时机完全自行判断
- 参数由实际营地和材料决定（可能更严苛）

#### 美术资产

- BG-SUSTAIN-STRONG：营地夜景，火焰旺盛，2560×1440
- BG-SUSTAIN-WEAK：营地夜景，火焰微弱，2560×1440
- BG-FLOOD：地面积水近景（poor 营地积水事件），2560×1440
- UI-FIREBAR：5 格火焰强度条
- UI-NIGHTPROGRESS：雨夜进度条
- UI-RESERVE-MATERIALS：备用材料 chip（tinder / kindling / fuel）

---

## 5. 数值系统

### 5.1 整条数值链总览

```
营地选择 ──→ campsiteQuality ('good'/'poor')
   │              │
   │              ├→ 收集：部分材料起始品质降低
   │              ├→ 点火：poor 时有雨滴干扰
   │              ├→ 守夜：衰减档位 + 积水事件
   │              └→ 搜索：影响搜索难度
   │
收集材料 ──→ 材料清单（type + quality）
   │              │
   │              ├→ BAD 材料数量 → 火焰上限 (strengthCeiling)
   │              ├→ tinder 有效数量 → 点火冒烟阈值
   │              ├→ kindling 有效数量 → 点火吹气效率 + 衰减速度修正
   │              └→ fuel 有效数量 → 守夜时长
   │
清理火坑 ──→ groundCleared (true/false)
   │              │
   │              └→ 守夜：衰减档位
   │
搭建质量 ──→ 各层实际内容
   │              │
   │              ├→ 蔓延：是否卡住
   │              ├→ 点火：目标倍率
   │              └→ 守夜：火焰上限
   │
点火结果 ──→ fireQuality ('strong'/'weak')
                  │
                  └→ 守夜：初始火焰格数
```

### 5.2 体力系统

**初始体力：** 5（若 Day 1 有惩罚则为 4）

**体力消耗事件：**

| 事件 | 体力变化 |
|------|----------|
| 选择 Site A（poor 营地） | -2 |
| 点火首次失败 | -1 |
| 点火二次失败 | -2 → triggerDayFail() |
| 蔓延卡住需补救 | -1 |
| 守夜火灭一次 | -1 → 回到点火 |
| 守夜柴尽火灭 | -2 → triggerDayFail() |
| Day 3：收集超 8 把（每多 3 把） | -1 |

**体力归零 = triggerDayFail()**

**典型最差路径（Site A）：**
选 Site A（-2）→ 点火首次失败（-1）→ 守夜火灭一次（-1）→ 剩余 1 点。再出任何问题 → 失败。设计意图：单个失误不致命，多个失误叠加 = game over。

### 5.3 火焰上限（strengthCeiling）

```javascript
strengthCeiling = max(1, 5 - badCount - (kindling === 0 ? 2 : 0) - (tinder === 0 ? 1 : 0));
```

- `badCount`：品质为 BAD 的可分拣材料数量
- 无 kindling：额外 -2
- 无 tinder：额外 -1

### 5.4 Day 2 vs Day 3 参数对比

| 参数 | Day 2 | Day 3 |
|------|-------|-------|
| 收集目标 | 固定 8 把（3+3+2） | 无上限，8 以上消耗体力 |
| 收集配比建议 | Ren 明确建议 | 无提示 |
| 分拣纠错 | 即时纠正弹回 | 无纠正 |
| 搭建层级锁定 | 顺序解锁 | 全部开放 |
| 点火衰减速度 | 慢（-1/1.0s） | 由材料决定 |
| 点火 Ren 提示 | 冒烟/吹气提示 | 无 |
| 守夜 Ren 提示 | 可选教学 | 无 |
| 积水事件 | 有（poor 营地） | 有（参数更严） |

---

## 6. 失败与重试机制

### 6.1 triggerDayFail() 触发条件

- 体力归零
- 点火二次失败且无 tinder
- 守夜柴尽且火灭
- 蔓延完全失败（无材料补救）

### 6.2 Buffer Day 流程

**Scene B-1：醒来（强制对话）**

```
(Aiden) "I made it back. Barely."

(Ren) "We will try again. But first — let us think about
       what went wrong."
```

**Scene B-2：可选提示（玩家选一个）**

- **[Ask about the campsite]：**
```
(Ren) "The ground around here floods fast in heavy rain.
       You want somewhere the water runs away from you,
       not toward you."
```

- **[Ask about the fire]：**
```
(Ren) "Wood that feels heavy is wet inside even if it looks dry.
       Go by weight, not colour. And the wetter the ground
       under your fire pit, the harder it is to keep going."
```

- **[I know what I did wrong. Let us go.]：**
```
(Aiden) "I do not need the advice. I just need another shot."
```

**Scene B-3：重新出发**

```
(Ren) "One more night. Same forest. This time we know
       what we are walking into."
```

**状态重置：**
```javascript
gameState.stamina = gameState.nextDayStaminaMax || 5;
gameState.campsiteQuality = null;
gameState.groundCleared = false;
gameState.collectedMaterials = [];
gameState.fireQuality = null;
gameState.fuelStock = 5;
gameState.currentDay += 1;
```

从营地选址（Scene 2-4）重新开始，跳过 NPC 出场和地图过渡。

---

## 7. Day 3 复用说明

### 7.1 共享系统

Day 2 和 Day 3 使用**同一套场景和交互机制**，通过一个 `tutorialMode` 标志控制差异。

| 系统 | Day 2 (tutorialMode: true) | Day 3 (tutorialMode: false) |
|------|---------------------------|----------------------------|
| Ren 对话 | 每阶段 proposal + 选项 | 无（Ren 不在场或沉默） |
| 层级锁定 | 搭建时顺序解锁 | 全部开放 |
| 分拣纠错 | 放错弹回 + 反馈 | 放错不弹回 |
| HUD 教学标签 | 层标签、区域标签显示 | 隐藏 |
| 正/负反馈对白 | 强制弹出 | 无 |
| 收集目标计数器 | 显示 X/3 目标 | 只显示总数 |
| 收集体力消耗 | 无 | 8 把以上每 3 把 -1 体力 |
| 右上角 to-do list | 无（流程由 Ren 引导） | 显示步骤列表 |

### 7.2 Day 3 环境变化（待详细设计）

Day 3 除了移除教学层，还有环境参数变化（不同天气、地形等），这些会影响：
- 材料可用性和受潮速度
- 营地选择的选项和风险
- 守夜的衰减参数和干扰事件

具体 Day 3 环境设计待后续文档定义。

---

## 8. 美术资产清单

### 8.1 角色立绘

| ID | 描述 | 尺寸 |
|----|------|------|
| CHAR-REN | 年轻猎人 Ren，户外装束，随意姿态 | 1200×1800 |
| CHAR-VILLAGER | 年长村民（Scene 2-2 使用，已有） | 1200×1800 |

### 8.2 场景背景

| ID | 描述 | 尺寸 | 使用阶段 |
|----|------|------|----------|
| BG-CAMP-DIRTY | 营地近景，火坑区域有杂物 | 2560×1440 | 清理前 |
| BG-CAMP-CLEAN | 营地近景，火坑已清理 | 2560×1440 | 清理后/分拣/搭建 |
| BG-FOREST | 森林地面，材料散落，雨天 | 2560×1440 | 收集 |
| BG-IGNITE-BASE | tinder 层特写，引火物铺好 | 2560×1440 | 点火 |
| BG-IGNITE-SMOKE | tinder 层特写 + 冒烟 | 2560×1440 | 点火（冒烟阶段） |
| BG-IGNITE-FLAME | tinder 层特写 + 小火苗 | 2560×1440 | 点火成功 |
| BG-SPREAD-1 | 火坑，tinder 层燃烧 | 2560×1440 | 蔓延 |
| BG-SPREAD-2 | 火坑，tinder + kindling 燃烧 | 2560×1440 | 蔓延 |
| BG-SPREAD-3 | 火坑，全层燃烧（旺火） | 2560×1440 | 蔓延成功 |
| BG-SPREAD-STUCK-1 | 火在底部，上层无反应 | 2560×1440 | 蔓延卡住 |
| BG-SPREAD-STUCK-2 | 中层在烧，上层无反应 | 2560×1440 | 蔓延卡住 |
| BG-SUSTAIN-STRONG | 营地夜景，火焰旺盛 | 2560×1440 | 守夜（强火） |
| BG-SUSTAIN-WEAK | 营地夜景，火焰微弱 | 2560×1440 | 守夜（弱火） |
| BG-FLOOD | 地面积水近景 | 2560×1440 | 守夜积水事件 |

### 8.3 材料 Sprite

| ID | 描述 |
|----|------|
| MAT-DRY-LEAVES | 干树叶，浅棕卷曲 |
| MAT-DRY-GRASS | 干草束，浅黄蓬松 |
| MAT-DRY-TWIGS | 干细枝，灰色有裂纹 |
| MAT-THIN-BRANCH | 细树枝，浅棕 |
| MAT-THICK-BRANCH | 粗树枝，深棕粗实 |
| MAT-PINE-CONE | 松果，棕色紧实 |
| MAT-WET-BARK | 溪边树皮，深色有光泽 |
| MAT-WET-MOSS | 湿苔藓，深绿结块 |

每种材料需要三种品质的视觉变体：GOOD（正常色）/ MID（略暗）/ BAD（深色偏湿）

### 8.4 UI 组件

| ID | 描述 | 使用阶段 |
|----|------|----------|
| UI-STAMINA-BAR | 体力条（5 格火焰图标） | 全程 |
| UI-DAY-COUNTER | Day 计数（Day 2/5） | 全程 |
| UI-MATERIAL-COUNTER | 三类材料计数器 | 收集 |
| UI-SORT-ZONES | 三个分类区域（Tinder/Kindling/Fuel） | 分拣 |
| UI-FIRE-PIT | 火坑横截面，三层放置区 | 搭建 |
| UI-LAYER-LABELS | 层标签（Bottom/Middle/Top） | 搭建（Day 2） |
| UI-FLINT | 燧石图标 | 点火 |
| UI-BLOW | 吹气图标（灰色/激活态） | 点火 |
| UI-IGNITE-BAR | 火焰进度条（含冒烟线/着火线标记） | 点火 |
| UI-FIREBAR | 5 格火焰强度条 | 守夜 |
| UI-NIGHTPROGRESS | 雨夜进度条 | 守夜 |
| UI-RESERVE-MATERIALS | 备用材料拖拽 chip | 守夜 |
| FX-SPARK | 火花点击特效 | 点火 |

### 8.5 音效（待确认）

| ID | 描述 | 使用阶段 |
|----|------|----------|
| SFX-FOOTSTEPS | 脚步声（Ren 出场） | NPC 出场 |
| SFX-BRANCH-SNAP | 树枝踩断（Ren 出场） | NPC 出场 |
| SFX-RAIN-LIGHT | 小雨背景音 | 收集 |
| SFX-RAIN-HEAVY | 大雨背景音 | 守夜 |
| SFX-FLINT-STRIKE | 燧石打击声 | 点火 |
| SFX-FIRE-CRACKLE | 火焰燃烧声 | 蔓延/守夜 |
| SFX-BLOW | 吹气声 | 点火 |
| SFX-FIRE-OUT | 火灭声 | 守夜 |
