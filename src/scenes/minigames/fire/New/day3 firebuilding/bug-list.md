# Day 3 Step 9 — Bug List

> 更新规则：发现 bug 立即追加行；修完后将状态改为 ✅，并注明修复所在行号。

| # | 路径 | 步骤 | 描述 | 严重度 | 状态 |
|---|------|------|------|--------|------|
| B01 | All | todo list | `updateTodoList` 用 `'  '`（两空格）作未完成前缀，`_buildTodoList` 用 `'· '`（圆点），导致首次 `updateTodoList()` 调用后圆点消失、变成空格，视觉不一致 | Low | ✅ 已修（FireBuildingMinigame.js:2377，改为 `'· '`） |
| B02 | All | todo list | `updateTodoList` 颜色与 `_buildTodoList` 不同：done 用 `#666644` vs `#6a8a44`，not-done 用 `#aaa890` vs `#b8b898`；未完成项在首次更新后颜色微变 | Low | ✅ 已修（FireBuildingMinigame.js:2378，统一为 `#6a8a44` / `#b8b898`） |
| B03 | Path A/B | ignite | 点火方向衰减倍数：代码 `leeward×1.0 / side×1.3 / windward×1.6`，spec 写 `×1.0 / ×1.5 / ×2.0`。经查 Step 8 commit `aa6c46b "tune ignite difficulty"` 已有意调整，非回归 bug，属 spec 与实现的说明差异 | Info | 📝 不修（Step 8 主动调参；测试时以代码值 1.6/1.3 验证） |

---

## 代码审查通过项（路径 A–D + Day 2 回归）

| 检查点 | 结论 |
|--------|------|
| Path A — clear todo（line 3281） | ✅ Day 3 分支正确打勾 |
| Path A — gather todo（line 2704） | ✅ 返回营地后自动勾选 |
| Path A — sort todo（line 2854） | ✅ 首次拖入分类区触发，一次性 registry 标志 |
| Path A — shield todo（line 1657） | ✅ 首块石头放入有效槽位时勾选 |
| Path A — lay todo（line 3035） | ✅ 三层各≥1件后勾选；被风吹走后取消（line 5321） |
| Path A — light todo（line 8203） | ✅ 点火成功时勾选 |
| Path A — survive todo（line 9468） | ✅ 守夜完成时勾选，Day 2 由 `return` 跳过 |
| Path A — emit payload（line 9445） | ✅ `{id:'fire_campsite', success:true, score:'strong'/'weak', staminaDepleted:false}` |
| Path B — windShield='none' 风力伤害（line 9102） | ✅ -3 per gust |
| Path B — poor camp 频率（line 8984） | ✅ 8 000ms；good → 12 000ms |
| Path C — dayFail（line 9519） | ✅ `{success:false, staminaDepleted:true}` → Ink `mg_fire_campsite_success=false`, `stamina_depleted=true` |
| Path C — 无 stamina 对象时（mock 未初始化） | ✅ `stamina?.deduct() ?? true` 跳过扣减，但 `_emitDayFail` 仍硬编码 `staminaDepleted:true`，Ink 分支正确 |
| Path D — windShield='none'（跳过石头） | ✅ `_recomputeWindShield` 无迎风侧石头 → 'none' |
| 4方向 windSlotRoles（line 431） | ✅ windward/leeward/sideA/sideB 映射正确 |
| windShield 3态守夜伤害（line 9102-9103） | ✅ good=-1, partial=-2, none=-3 |
| 石头不出现于 Day 2（line 1332） | ✅ `_buildDay3Rocks()` 有 `if (this.day < 3) return` |
| todo list 不出现于 Day 2（line 2335） | ✅ `_buildTodoList()` 有 `if (this.day < 3) return` |
| 风粒子不出现于 Day 2（line 1692） | ✅ `_day3WindFxAllowedForStep()` 在 day<3 时 false |
| 守夜进入：Day 3 跳过 Ren 提示（line 9195） | ✅ `if (this.day >= 3) { _beginSustain(); return }` |
| 守夜 sustain 时石头不可拖（line 1544） | ✅ `allow = step === 'campsite_open' || step === 'stack'` → sustain 时 false |
| campsite_quality Ink 变量（day3.ink:124） | ✅ 已由 mock seedRegistry 预置；minigame 不需要回写 |
| `mg_fire_campsite_success` InkBridge 映射（InkBridge.js:40） | ✅ `mg_${id}_success = success` 自动映射 |
| Aiden 独白一次性标志 | ✅ 均用 `registry.get('day3XxxDone')` 防重复 |

---

## 测试矩阵 MOCK_CONFIG 速查

| 路径 | 需设置的 MOCK_CONFIG |
|------|---------------------|
| A（理想） | `day:3, startStep:'ren_intro', mockPreset:'ideal', campsiteQuality:'good'` |
| B（poor+失误） | `day:3, startStep:'ren_intro', mockPreset:'bad', campsiteQuality:'poor', windDirection:'north'` |
| C（dayFail） | `day:3, startStep:'sustain', mockPreset:'bad', campsiteQuality:'poor', windDirection:'north', mockWindShield:'none'` |
| D（极简） | `day:3, startStep:'ren_intro', mockPreset:'ideal', campsiteQuality:'good'` |
| windShield单测 | `day:3, startStep:'sustain', windDirection:'north', mockWindShield:'good'/'partial'/'none'` |
| Day 2 回归 | `day:2, startStep:'ren_intro', mockPreset:'ideal', campsiteQuality:'good'` |

提交前记得把 `DEV_MOCK_FIRE_BUILDING = false`。
