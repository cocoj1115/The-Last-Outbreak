# Day 3 — Firemaking Minigame 开发文档

---

## 1. 概览

### 1.1 定位

Day 3 是 Day 2 教学关的应用关。玩家在风天环境下独自完成生火全流程，没有 NPC Ren 的引导。核心变化：撤去所有 scaffolding，环境从雨天变成风天，新增风天特有机制，场景从线性状态机变成开放式营地。

### 1.2 教学目标

1. 在风天选择合适的材料（重量成为新的判断维度）
2. 围石头挡风——观察风向，在迎风面搭建挡风墙（Day 3 新技能）
3. 从背风面点火，利用风向判断（Day 3 新技能）
4. 风天守夜的资源管理——观察风力预警，决定加柴时机
5. 独立完成完整生火流程，自主判断步骤顺序

### 1.3 架构

- 同一个 FireBuildingMinigame.js，通过 this.day >= 3 分支
- 同一个 FireBuildingCollect.js，通过 this.day 分支材料表和漂移动效
- 动效使用 GSAP（需在文件顶部 import { gsap } from 'gsap'）
- Ink 接入：day3.ink 第 104 行 # minigame:fire_campsite day:3
- 不修改任何 Ink 文件
- 不修改 Day 2 的逻辑路径

---

## 2. 核心架构：开放式营地

### 2.1 与 Day 2 的区别

Day 2：线性状态机，Ren 引导一步一步走。
Day 3：开放式营地，玩家自由操作。所有可交互元素同时存在于同一个营地画面。

### 2.2 场景中同时存在的可交互元素

| 元素 | 位置 | 可交互条件 | 操作 |
|------|------|-----------|------|
| 地面杂物 | 火坑周围 | 始终可点 | 点击清除 |
| 森林入口 | 左下角 | 始终可点 | 跳转收集 |
| 散落石头 | 火坑周围4块 | 始终可拖 | 拖到火坑边围挡风墙 |
| 材料 sprite | 收集回来后 | 收集后可见 | 拖到分类区或火坑 |
| 分类区域 | 火坑一侧 | 收集后可见 | 接收材料 |
| 火坑三层 | 火坑内 | 始终可见 | 接收材料 |
| 燧石 | 火坑右侧 | 火坑有材料时 | 点击打火花 |
| 吹气图标 | 燧石旁 | 冒烟后 | 点击吹气 |
| to-do list | 左上角 | 始终显示 | 仅显示不可点击 |

### 2.3 To-Do List

位置：左上角，体力条下方。纯文字列表，完成打勾变灰色。

内容：
- Clear fire pit
- Gather materials
- Sort materials
- Build wind shield
- Build fire lay
- Light the fire
- Survive the night

完成检测：
- clear：所有杂物被清除
- gather：collectedMaterials.count > 0
- sort：任意材料被拖入分类区
- shield：至少1块石头放到火坑边
- lay：火坑三层各至少1件材料
- light：点火成功
- survive：守夜进度条走完

---

## 3. 对白设计

### 3.1 进入营地
(Aiden) "Wind is strong. This is going to be different from last time."
(Aiden) "I know what to do. Just need to do it right."

### 3.2 清理火坑
全部清除后：
(Aiden) "Clear ground. That part I remember."

### 3.3 收集材料
进入森林：
(Aiden) "Everything light is moving. If it will not stay on the ground, it will not stay in the fire pit."

第一次捡轻材料（干草束等）：
(Aiden) "Light enough to blow away before it catches. Not worth the risk in this wind."

第一次捡重材料（厚树皮等）：
(Aiden) "Dense. The wind is not moving this one. Good."

第10把（预警）：
(Aiden) "Arms are getting heavy. Much more and I will be worn out before the night even starts."

第11把（扣体力）：
(Aiden) "That is going to cost me. But more fuel means a longer fire."

### 3.4 分拣
第一次拖材料到分类区：
(Aiden) "Tinder, kindling, fuel. Easier to grab what I need this way."

### 3.5 围石头（新机制）
第一次点击石头：
(Aiden) "These stones. If I stack them on the side the wind is hitting, they should block the worst of it."

放对（迎风面）：
(Aiden) "That side takes the wind. Good."

放错（背风面）：
(Aiden) "Wind is not coming from here. Wrong side."

围好2块后：
(Aiden) "Not perfect, but it will help. The wind cannot cut straight through now."

### 3.6 搭建
搭建完成：
(Aiden) "Fine at the bottom, heavy on top. I have done this before."

### 3.7 点火（新机制）
进入点火：
(Aiden) "I need to strike where the wind cannot reach. Watch which way it blows."

迎风面打火花：
(Aiden) "Wind blew it straight out. Wrong side."

吹气成功：
(Aiden) "Wait for the glow. Ren was right about that."

### 3.8 守夜
进入守夜：
(Aiden) "Fire is up. Now I keep it alive. The wind is not going to make that easy."

第一次风力预警：
(Aiden) "Wind is building. I can see the trees. It is about to hit."

风力事件击中（第一次）：
(Aiden) "Should have added fuel before that gust."

加柴浪费：
(Aiden) "Too early. I know better than that."

守夜成功：
(Aiden) "Made it through. The fire held."

---

## 4. 逐阶段详细设计

### 4.1 收集材料

Day 3 材料表：

| 材料 | 类别 | 默认品质 | poor品质 | 风中漂移(px) |
|------|------|---------|---------|------------|
| 干树叶 | tinder | GOOD | MID | 30 |
| 干草束 | tinder | BAD | BAD | 50 |
| 干细枝 | kindling | GOOD | GOOD | 15 |
| 厚树皮 | tinder | GOOD | GOOD | 5 |
| 湿苔藓 | — | BAD | BAD | 0 |
| 松果 | fuel_wood | MID | MID | 8 |
| 粗树枝 | fuel_wood | GOOD | GOOD | 0 |

材料漂移实现（GSAP）：
gsap.to(sprite, {
  x: sprite.x + amplitude,
  duration: 0.8 + Math.random() * 0.4,
  yoyo: true, repeat: -1,
  ease: 'sine.inOut',
})

收集体力：8把免费，第10把预警，11把起每3把扣1体力。

### 4.2 围石头挡风（新增）

风向：随机（north/south/east/west），整场不变。

风向视觉线索：GSAP 驱动的树叶粒子，每2秒从风向方向飘过。

4块长方形石头散落火坑周围。玩家拖到火坑边。放迎风面有效，放背风面弹回。

windShield 计算：
- 迎风面 >=2 块 → 'good'（风力事件-1，衰减×0.8）
- 迎风面 1 块或侧面 >=2 → 'partial'（风力事件-2，衰减×1.0）
- 没放或全错 → 'none'（风力事件-3，衰减×1.3）

### 4.3 点火（风向选择）

火坑周围4个方位标记（圆形hotspot），玩家选择打火花方位。

- 背风面：effectiveDecayMs ×1.0
- 侧风面：effectiveDecayMs ×1.5
- 迎风面：effectiveDecayMs ×2.0

Day 3 脉动：亮0.8s / 暗1.2s（Day 2: 1.5s / 1.0s）

### 4.4 守夜（风力事件）

夜晚固定30秒。

衰减 DRAIN_MS 由 campsiteQuality + groundCleared + windShield 三因素决定。

风力事件频率：good每12s / poor每8s。

预警（2秒前）：GSAP 树木摇晃 + 画面边缘闪白。
触发：火焰 -(1/2/3) 按 windShield。

加柴效果同 Day 2。

---

## 5. 完整 Branching Map

进入 Day 3 (day=3) — 开放式营地

清理火坑：
  做了 → groundCleared=true → 守夜衰减正常
  没做 → groundCleared=false → 守夜衰减加速

收集材料 → 跳转 FireBuildingCollect：
  每次回森林消耗1体力（首次除外）
  <=8把无消耗
  第10把预警
  11把起每3把扣1体力
  材料品质：干草束BAD（Day2是GOOD），厚树皮GOOD（新材料）

分拣（可选）：
  做了 → 材料整齐 → 搭建方便
  没做 → 材料散乱 → 搭建要自己找（不影响数值）

围石头挡风：
  风向随机
  迎风面>=2块 → windShield='good' → 风力事件-1，衰减×0.8
  迎风面1块或侧面>=2 → windShield='partial' → 风力事件-2，衰减×1.0
  没放或全错 → windShield='none' → 风力事件-3，衰减×1.3
  跳过 → windShield='none'

搭建fire lay：
  无层级锁定，无纠正
  正确层级 → 点火蔓延正常
  错误层级 → 点火极难/蔓延卡住
  三层各>=1件 → 燧石出现

点火（风向选择）：
  背风面 → 衰减×1.0
  侧风面 → 衰减×1.5
  迎风面 → 衰减×2.0 + Aiden独白
  失败 → bottom全burned，体力-1
    有reserve tinder → 可拖进bottom重试
    无reserve → 可回森林（体力-1）
    体力归零 → dayFail
  成功 → 蔓延

蔓延：
  品质好 → strong fire
  需补救 → 从reserve拖 → weak fire
  完全失败 → dayFail

守夜（30秒）：
  衰减=campsiteQuality+groundCleared+windShield
  风力事件：预警2秒，触发-1/-2/-3
  频率：good每12s / poor每8s
  加柴：同Day2
  火灭 → 体力-1 → 回点火
  柴尽火灭 → 体力-2 → dayFail
  30秒走完 → 成功
    火焰>=3 → 'strong'
    火焰<3 → 'weak'（次日体力上限-1）

结果 → emit MINIGAME_COMPLETE → Ink分支

---

## 6. Day 2 → Day 3 代码分支清单

| 位置 | Day 2 | Day 3 |
|------|-------|-------|
| create() | Ren出场→线性状态机 | 开放式营地+to-do list |
| 材料表 | MATERIALS_DAY2 | MATERIALS_DAY3 |
| sort | 强制+纠正 | 可选，无纠正 |
| stack前 | 无 | 新增围石头 |
| stack层级 | 锁定顺序 | 无锁定 |
| ignite入口 | 直接选spark target | 先选方位 |
| ignite脉动 | 亮1.5s/暗1.0s | 亮0.8s/暗1.2s |
| sustain | 雨天积水事件 | 风力事件+预警 |
| 对白 | Ren对话+选项 | Aiden独白 |
