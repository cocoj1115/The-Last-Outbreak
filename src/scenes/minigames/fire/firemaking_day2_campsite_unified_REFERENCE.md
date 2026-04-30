# Day2 营地一体生火（FireCampsiteMinigame）— 实现参考

> 本文档根据当前代码整理，用于你改版时对照行为与数据。主文件：`FireCampsiteMinigame.js`。森林收集为独立场景 `FireCollectMinigame.js`。

---

## 1. 整体架构

| 组件 | Scene key | 职责 |
|------|-----------|------|
| 营地一体 | `FireCampsiteMinigame` | 清场 → 分拣 → 码堆 → 打火 → 守夜（单场景内 `step` 状态机） |
| 森林收集 | `FireCollectMinigame` | 拾取材料、受潮降级、装包；结束后写 `registry` 并回到营地 |

**不**在营地场景内实现：林间游走玩法（仅在 `FireCollectMinigame`）。

---

## 2. 玩家-facing 流程（完整 Day2 链）

### 2.1 推荐开发入口（`day2FireMock.js`）

- `DEV_MOCK_DAY2_FIRE === true` 且 Boot 中 `DEV_PATH_B_DAY2_FIRE === false` 时，`seedDay2FireMockRegistry` 会：
  - 写入 `inkBridge` 桩（`campsite_quality`, `mg_fire_collect_score`）
  - `fullChain: true` 时：`devFireBuildChain = true`，`groundCleared = false`，`collectedMaterials = []`
- 首场景：`FireCampsiteMinigame`（从 **clear** 开始，除非 `campsiteStartStep` 覆盖）

**宏观顺序：**

1. **FireCampsite — clear**  
2. （可选链）**FireCollectMinigame** 收集  
3. **FireCampsite — sort → stack → ignite → sustain**

### 2.2 Clear 结束后的分支

`_onMoveOn()` 在清场逻辑结束后：

- 发出 `MINIGAME_COMPLETE`：`id: 'fire_clear'`，`score: groundCleared ? 1 : 0`
- 写入 `registry.groundCleared`
- 若 **`registry.devFireBuildChain === true`**：播放「去树林里找材料」对白 → 显示林缘热点；玩家点击热点后 `stop` 营地并 **`scene.start('FireCollectMinigame')`**
- 否则：直接进入 **`sort`**（无外出收集）

### 2.3 FireCollect 回到营地

`_onHeadBack()`（背包满或玩家回程）根据 registry：

| 条件 | 行为 |
|------|------|
| `fireCampsiteStackResume` 存在 | `FireCampsiteMinigame`，`startStep: 'stack'`，`resumeStackAfterCollect: true`（带快照恢复） |
| `devQuickFireChain` | 营地 **`startStep: 'ignite'`**（跳过 clear/sort/stack） |
| `devFireBuildChain` | 营地 **`startStep: 'sort'`** |
| 否则 | 仅 `scene.stop()`（叙事驱动下一步） |

写入：

- `collectedMaterials`：`{ items: [{ id, quality }], count }`（与营地 `_readInputs` 兼容）
- `inkBridge.setVariable('mg_fire_collect_score', difficulty)`，`difficulty` ∈ `EASY | MEDIUM | HARD`
- `fuelStock: 5`（历史字段，营地 sustain 新版本主要用备份拖拽逻辑）

发出：`MINIGAME_COMPLETE` `id: 'fire_collect'`，`score: difficulty`

### 2.4 营地内步骤顺序

```
clear → sort → stack → ignite → sustain →（成功）场景结束
```

`_enterStep(nextStep)`：先调上一个 step 的 `_exitHandlers`，再调 `_enterHandlers[next]`。

**调试入口 `init(data)`：**

- `day`（默认 2）
- `startStep`：`clear | sort | stack | ignite | sustain`（`clear` 为默认）
- `resumeStackAfterCollect`：配合 `registry.fireCampsiteStackResume` 从收集返回恢复堆叠态

非 `clear` 进入时，`_seedMatPhasesForDevStart` 会把可分拣材料伪造成对应阶段（便于单测后半段）。

---

## 3. 系统输入（Registry + Ink）

营地 `create()` 时 `_readInputs()`：

| 来源 | 用途 |
|------|------|
| `inkBridge.getVariable('campsite_quality')` | `'good' \| 'poor'`（雨天干扰条件等） |
| `registry.get('collectedMaterials')` | 数组或 `{ items }`；构建每块料的 `pile_i` 状态 |
| `registry.get('groundCleared')` | 是否清完场地（影响 sustain 的 DRAIN 档位等） |

**初值侧写（`fullChain` mock）：** 清场前材料为空；清场并外出收集后才有 sort 用料。

---

## 4. 材料与分拣桶

### 4.1 ID → 分拣区（`CORRECT_ZONE`）

| 材料 id | 区（sort / stack 语义） |
|---------|-------------------------|
| `dry_leaves`, `dry_grass` | `tinder`（底层 / Bottom） |
| `dry_twigs` | `kindling`（中层 / Middle） |
| `pine_cone`, `thick_branch` | `fuel_wood`（顶层 / Top） |

未映射 id 在分拣中不可放入三区（可来自收集的废料，营地内有灰色/禁用逻辑）。

### 4.2 品质

- `GOOD | MID | BAD`（颜色与交互限制度不同）
- **BAD** 可分拣材料：视觉弱化，堆叠阶段限制更多
- `_readInputs`：`badCount` 影响初始 `_strengthCeiling = max(1, 5 - badCount)`（5 为 `SEGMENT_COUNT`）

### 4.3 Sort 步骤要点

- 材料从 **背包 HUD**（与 FireCollect 左下角锚点一致）unpack 飞入再可拖拽
- 拖入错误区：`WRONG_SORT_FEEDBACK` 文案 + 纠正流程
- 全部可分拣块就位 → 延迟后 **`stack`**

---

## 5. Stack（码堆）步骤

### 5.1 层级与顺序

- 逻辑层：`bottom` / `middle` / `top` ↔ UI 区 `tinder` / `kindling` / `fuel_wood`
- **guided lay**：在 **`!_stackLayLockedComplete`** 时，拖拽落点必须等于 **`STACK_LAYER_ORDER[_stackActiveLayerIndex]`**（当前导航层），防止跨层误放
- 最小要求常量：`STACK_MIN_BOTTOM = 2`，`STACK_MIN_MIDDLE = 1`，`STACK_MIN_TOP = 1`（用于教学/门槛）

### 5.2 UI 与功能块

- 分类卡、横截面格点、Next/Prev 层、Finish lay、Spark target 选择（打火落点区：tinder/kindling/fuel_wood）
- **提前打火**：未完成 lay 时仍可点燧石进入试打火 → `_igniteEarlyLayAttempt`，目标火花暴涨 + 试后可能消耗材料（`_consumeEarlyStrikeMaterials` 等）

### 5.3 Lay 锁定后

- 排序阶段拖来的 sorted 材料交互会弹回（提示从横截面调整）
- 正常流程：选 spark 层 → 点燧石 → 进入 **ignite**

---

## 6. Ignite（打火）步骤

### 6.1 难度表 `DIFFICULTY_CONFIG`（来自收集分档）

| 档 | 目标火花 `target` | 火花衰减间隔 `decayMs` | `rainInterference` |
|----|-------------------|------------------------|--------------------|
| EASY | 10 | 800 | false |
| MEDIUM | 15 | 600 | false |
| HARD | 20 | 500 | **true** |

- 原始档：`inkBridge mg_fire_collect_score`（收集结束用 `computeDifficulty` 写入）
- **雨天**：仅当 `rainInterference && campsite_quality === 'poor'` 启用 `_useRain`，定时 `_applyRainInterference`

### 6.2 目标火花动态 `/_igniteTarget`

- 基准：`ceil(baseTarget * _computeStackIgniteTargetMultiplier())`
- **早 lay 试打**：额外抬高下限（`+22` 及 `*3.2` 等）
- **Clamp**：`[8, 60]`

**乘子逻辑概要（`_computeStackIgniteTargetMultiplier`）：**

- 按 **堆上 tinder/kindling 数量档**、**BAD 在中底层数量**、**spark 瞄准层**（tinder/kindling/fuel_wood）综合乘算

### 6.3 火花衰减与点击

- 周期性 `_decaySpark`（间隔受 **中层 kindling 数量** 影响：`0 层 → ×0.5` 间隔，`1 层 → ×0.8`，≥2 用基准）
- 每次点击：随机 `+1~3` 火花；`MAX_CLICKS = 30` 用尽失败

### 6.4 失败 / 重试

- **早 lay 失败/消耗** 路径：扣体力、必要时回 **stack** 并保留/破坏部分材料
- **纯 ignite 失败**：扣 1 体力；**首次**可 `_igniteRetry()`；再败则 `_emitDayFail('fire_campsite')`

### 6.5 成功

- 延迟进入 **`sustain`**

---

## 7. Sustain（守夜）步骤

### 7.1 火力与上限

- `_strengthCeiling`：`max(1, 5 - badCount - (无 kindling? +2) - (无 tinder? +1))`
- 入场：`_fireStrength = _strengthCeiling`
- UI：5 段 strength bar；背景随强度切换强/弱火色

### 7.2 「一夜」时长（动态）

基础秒数由 **已码在堆上的材料** 决定：

| 层 | 每件贡献 |
|----|----------|
| top（fuel） | +20 s |
| middle（kindling） | +6 s |
| bottom（tinder） | +2 s |

- **Clamp**：`[SUSTAIN_NIGHT_MIN_SEC=20, SUSTAIN_NIGHT_MAX_SEC=100]`
- 计时：`_nightElapsed` 每 500ms +500；`**_nightElapsed >= _nightTotalMs**` → **`_onNightComplete`**

### 7.3 强度衰减（drain）

基于 `campsite_quality` + `groundCleared` 四档 **`DRAIN_MS`**（每跌一格火的间隔）：

| 条件 | ms |
|------|-----|
| good + cleared | 18000 |
| good + dirty | 14000 |
| poor + cleared | 11000 |
| poor + dirty | 8000 |

- 实现为 **链式 `delayedCall`**，每 tick `_drainStrength(-1)`
- **Tinder 备份 debuff**：接下来 **6s** 内间隔 `×0.5`（掉血更快）
- **Fuel 备份 buff**：接下来 **20s** 内间隔 `×1.25`（掉血更慢）

### 7.4 备份燃料（未上架的 sorted 材料）

- 来源：`phase === 'sorted'` 且可分拣、非 BAD —— 即 **分拣后从未放进横截面/堆里的余料**
- UI：底部三个拖拽 chip（tinder / kindling / fuel_wood），拖入 **火坑命中区** 消耗 1
- 效果：
  - 共性：若 `_fireStrength < _strengthCeiling` 则 **+1**
  - **Tinder**：+6s 双倍 drain 窗（与上）
  - **Kindling**：**+10000 ms** `_nightTotalMs`
  - **Fuel wood**：**+20000 ms** `_nightTotalMs` + **20s** 慢 drain 窗
- **洪水事件**（`poor`）：周期触发；`_floodLocked` 时背景变洪色、**禁止**再拖备份；结束扣 1 格火

### 7.5 进度条

- 显示 `_nightElapsed / _nightTotalMs`，用 **`_nightBarProgressFloor`** 防止 **加长一夜总时长后条往回缩**

### 7.6 灭火与重燃

- `_fireStrength === 0` → `_onFireOut`
- 若仍有备份材料：扣 1 体力 → 短暂后进 **`ignite` 重打**（非全新 MINIGAME_COMPLETE）
- 否则扣 2 体力 → **`_emitDayFail`**

### 7.7 成功结束

- `MINIGAME_COMPLETE`：`id: 'fire_campsite'`，`success: true`，`score: 'strong' | 'weak'`（由结束前 `_fireStrength >= 3` 判定）

---

## 8. FireCollect（摘要，便于改 Camp 时对齐）

- **材料池**：`MATERIAL_POOL_ROWS` 多行 id + 数量；抽空重洗
- **受潮环**：场上越久 `GOOD→MID→BAD`；`poor` 营地spawn 时部分 id 用 `poorStartQuality`
- **装包**：顺序写入 `_packedOrder`；回程 **`computeDifficulty`** → `EASY/MEDIUM/HARD`
- 与营地的 **唯一契约**：`collectedMaterials` 形状 + `mg_fire_collect_score` +（可选）各类 dev registry 标志

---

## 9. 堆叠恢复快照（外出收集再回）

- `registry.fireCampsiteStackResume` + `resumeStackAfterCollect`：`_buildStackResumePayload()` / `_applyStackResumeFromCollect()`
- 含：每 pile 的 phase、sortZoneId、layerId、位置、教程 flags、nav index、是否 lay locked 等

---

## 10. Phaser / 场景注册（当前工程）

- `main.js`：注册 **`FireCollectMinigame`** + **`FireCampsiteMinigame`**（拆分 Clear/Sort/Ignite/Sustain **不再注册**，文件可仍存在）
- 叙事：`NarrativeScene` 中 `fire` → **`FireCampsiteMinigame`**

---

## 11. 常量速查（营地文件顶部）

```
STACK_MIN_BOTTOM/MIDDLE/TOP = 2 / 1 / 1
MAX_CLICKS = 30 (ignite)
SEGMENT_COUNT = 5 (fire strength segments)
SUSTAIN_SEC_PER_TOP/MIDDLE/BOTTOM = 20 / 6 / 2
SUSTAIN_NIGHT_MIN/MAX_SEC = 20 / 100
FLOOD_INTERVAL_CLEARED/DIRTY = 20000 / 15000 ms
FLOOD_BG_DURATION = 1200 ms
```

---

## 12. 改版时可优先动刀的点（非需求，仅供思考）

- `step` 状态机是否拆分/合并 UI 层
- `registry` 契约与 Ink 字段命名
- sustain 的经济与进度条语义（剩余时间 vs 已熬时间）
- 早 lay / 重试 / 体力消耗节奏
- FireCollect 与 Camp 的 dev 标志（`devFireBuildChain` / `devQuickFireChain`）是否收敛为一个「流程图配置」

---

*文档生成自仓库当前实现；若代码已改，请以 `FireCampsiteMinigame.js` 为准并更新本文档。*
