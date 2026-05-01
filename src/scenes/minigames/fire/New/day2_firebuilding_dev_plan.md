# Day 2 FireBuilding — 逐步开发计划

> 本文档配合 `day2_firemaking_dev_spec.md`（设计文档）使用。
> 所有新文件建在 `New/` 文件夹下，不改动现有 Dev A 的文件。

---

## 开发原则

1. **不动现有文件** — NarrativeScene.js、InkBridge.js、day2.ink 等 Dev A 文件一律不改。需要的逻辑从中复制，不是引用改造。
2. **每步可独立测试** — 通过 Mock 入口直接跳到任意 step，不依赖 Ink 叙事流程。
3. **逐步推进** — 每一步开发完确认能跑通再做下一步。

---

## Step 0：新建 DialogueBox 公共组件

**目标：** 一个可复用的对话框类，FireBuildingMinigame 的所有对话都通过它显示。

**新建文件：** `New/DialogueBox.js`

**做什么：**
- 从 NarrativeScene.js 复制对话框相关逻辑，封装为独立类
- 包含功能：
  - `show({ speaker, text, onComplete })` — 显示对话，typewriter 效果，点击推进，结束时回调
  - `showSequence([{ speaker, text }, ...], onComplete)` — 连续播放多条对话，全部结束后回调
  - `showChoices([{ text, onSelect }])` — 显示选项按钮，点击后回调
  - `hide()` — 隐藏对话框
- 样式参数从 UIConstants.js 的 `DIALOGUE`、`BUTTONS`、`DEPTH` 读取
- 对话框位置、大小、颜色、字体与 NarrativeScene 保持一致
- Speaker tag（名称标签）在对话框左上角
- Continue arrow（▼）typewriter 结束后显示

**复用的 NarrativeScene 代码参考：**
```
位置常量: BOX_W, BOX_H, BOX_X, BOX_Y, TEXT_X, TEXT_Y 等
对话框绘制: this.add.rectangle(BOX_X, BOX_Y, BOX_W, BOX_H, ...)
Speaker tag: _drawTag(name)
Typewriter: this.time.addEvent({ delay: 35, ... })
点击推进: _onAdvance()
选项按钮: _showChoices(choices)
```

**验证：** 新建一个临时测试 scene，实例化 DialogueBox，调用 show / showChoices 确认显示正常。

---

## Step 1：搭建 FireBuildingMinigame 骨架

**目标：** 空壳 scene，能启动、能在 step 之间切换、能弹对话、能写回结果。

**新建文件：** `New/FireBuildingMinigame.js`

**做什么：**
- 继承 `Phaser.Scene`，key: `'FireBuildingMinigame'`
- 注册到 main.js
- `init(data)` 接收参数：
  - `day`（默认 2）
  - `startStep`（默认 `'ren_intro'`，可选 `'clear' | 'collect' | 'sort' | 'stack' | 'ignite' | 'spread' | 'sustain'`）
  - `campsiteQuality`（默认 `'good'`）
- 实现 step 状态机：
  ```
  _steps = ['ren_intro', 'clear', 'collect', 'sort', 'stack', 'ignite', 'spread', 'sustain']
  _currentStep = 0
  _enterStep(stepName) { ... }
  _nextStep() { ... }
  ```
- 每个 step 暂时只弹一句 placeholder 对话 + 点击后进入下一步
- 实例化 DialogueBox
- 接入 registry 读取 stamina、campsiteQuality 等
- 最后一步（sustain）结束后 emit `MINIGAME_COMPLETE`

**验证：** 通过 Mock 入口启动，能看到 step 依次推进，每步弹对话，最终 emit complete。

---

## Step 1.5：Mock 测试入口

**目标：** 随时跳到任意 step 测试，不依赖 Ink。

**新建文件：** `New/day2FireBuildingMock.js`

**做什么：**
- 导出配置常量：
  ```javascript
  export const DEV_MOCK_FIRE_BUILDING = true  // 主开关
  export const MOCK_CONFIG = {
    startStep: 'clear',         // 从哪一步开始
    campsiteQuality: 'good',    // 'good' | 'poor'
    stamina: 5,                 // 初始体力
    // 如果 startStep 不是 'clear'，需要伪造前置数据
    mockCollectedMaterials: {   // startStep >= 'sort' 时使用
      items: [
        { id: 'dry_leaves', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_grass_2', type: 'tinder', quality: 'GOOD' },
        { id: 'dry_twigs', type: 'kindling', quality: 'GOOD' },
        { id: 'thin_branch', type: 'kindling', quality: 'GOOD' },
        { id: 'thin_branch_2', type: 'kindling', quality: 'GOOD' },
        { id: 'thick_branch', type: 'fuel_wood', quality: 'GOOD' },
        { id: 'pine_cone', type: 'fuel_wood', quality: 'MID' },
      ]
    },
    mockSortedMaterials: {      // startStep >= 'stack' 时使用
      tinder: [/* ... */],
      kindling: [/* ... */],
      fuel_wood: [/* ... */],
    },
    mockStackData: {            // startStep >= 'ignite' 时使用
      bottom: [/* ... */],
      middle: [/* ... */],
      top: [/* ... */],
    },
  }
  ```
- 导出 `seedFireBuildingMockRegistry(registry)` 函数：根据 `startStep` 往 registry 塞对应的桩数据
- 导出 `getFireBuildingMockPayload()` 函数：返回传给 `scene.start()` 的 data 对象

**在 BootScene.js 中使用（或新建 dev 入口）：**
```javascript
import { DEV_MOCK_FIRE_BUILDING, seedFireBuildingMockRegistry, getFireBuildingMockPayload } from './day2FireBuildingMock.js'

// 在 create() 里，最前面加：
if (DEV_MOCK_FIRE_BUILDING) {
  seedFireBuildingMockRegistry(this.registry)
  this.scene.launch('HUDScene')
  this.scene.start('FireBuildingMinigame', getFireBuildingMockPayload())
  return
}
```

**验证：** 改 `MOCK_CONFIG.startStep` 的值，启动游戏直接跳到对应步骤。

---

## Step 2：NPC Ren 出场 + 清理火坑

**目标：** 实现前两个阶段的完整交互。

**做什么：**

### 2a: Ren 出场
- 加载 Ren 立绘（暂用 placeholder）
- 营地背景（暂用 placeholder 或现有 bg_site_b_rain）
- 播放出场对话序列（用 `dialogueBox.showSequence`）：
  ```
  SFX 脚步声（可选，暂跳过）
  Ren: "Huh. Do not see many people out this deep..."
  Aiden: "I could say the same about you."
  Ren: "Fair enough. I am Ren — I hunt out here..."
  ... （完整对话见设计文档 4.0）
  ```
- 对话结束后 `_nextStep()` → 进入 clear

### 2b: 清理火坑
- 营地背景上绘制可点击的杂物 hotspot（Graphics 绘制的临时形状即可）
- Ren proposal 对白弹出
- 玩家逐个点击清除
- 清除完毕 → Ren 反馈对白
- 写入 `registry.groundCleared = true`
- `_nextStep()` → 进入 collect

**验证：** Mock startStep: 'ren_intro'，完整走过出场 → 清理 → 确认 registry 写入正确。

---

## Step 3：收集材料

**目标：** 完整的森林收集场景。

**做什么：**
- 场景切换到森林背景
- Ren proposal + 两条路径选项（"I know" / "Remind me"）
- 森林地面材料 hotspot
- 拾取交互：点击 → 拾取 → HUD 反馈
- 首次拾取每种类型 → 强制对话教学
- 受潮机制：定时器推进品质降级（GOOD → MID → BAD）
- HUD 计数器：Tinder 0/3, Kindling 0/3, Fuel 0/2
- 达到目标 → Ren 完成对话 + Day 3 trade-off 提示
- 收集结果写入 registry.collectedMaterials
- 切回营地背景 → `_nextStep()`

**验证：** Mock startStep: 'collect'。测试两条路径。测试拾取计数。测试受潮机制。

---

## Step 4：分拣（Sort）

**目标：** 拖拽分类交互。

**做什么：**
- 营地背景，材料散落为可拖拽对象
- 三个分类区域（Tinder / Kindling / Fuel Wood）
- Ren proposal + 两条路径
- 拖拽判定：
  - 放对 → 首次强制对话反馈，后续 HUD 轻量反馈
  - 放错 → 强制对话反馈（explanatory，不给答案），材料弹回
- 全部完成 → Ren 总结对话
- 写入 registry.sortedMaterials
- `_nextStep()`

**验证：** Mock startStep: 'sort'（使用 mockCollectedMaterials）。测试拖拽、放对、放错反馈。

---

## Step 5：搭建（Stack）

**目标：** 火坑三层搭建交互。

**做什么：**
- 火坑横截面 UI，三层放置区
- 三堆已分好的材料（从 registry.sortedMaterials 读取）
- Ren proposal + 两条路径
- Day 2 层级顺序锁定：底层 → 中层 → 上层 逐步解锁
- 拖拽判定 + 反馈（同 Sort 模式）
- 每层最低要求：底层 2、中层 1、上层 1
- 全部完成 → Ren 总结
- 写入 registry.stackData 和 registry.reserveMaterials
- `_nextStep()`

**验证：** Mock startStep: 'stack'（使用 mockSortedMaterials）。测试层级锁定、放错弹回。

---

## Step 6：点火（Ignite）

**目标：** 两阶段点火操作——打火花 + 吹气。

**做什么：**
- 火坑 tinder 层特写背景
- Ren proposal + 两条路径
- 选择火花落点（三层可点击，只有 tinder 正确）
- 阶段一——打火花：
  - 燧石图标可点击
  - 进度条 + 衰减机制
  - 难度参数从 registry 读取（材料品质、数量、营地质量）
- 阶段二——吹气：
  - 进度条到冒烟线 → 吹气图标激活
  - 节奏判断（太快暴跌、太慢倒退）
  - Ren 提示（Day 2）
- 进度条满 → 点火成功
- 失败 → 体力扣除 → 重试 or dayFail
- 写入 registry.ignitionSuccess
- `_nextStep()`

**验证：** Mock startStep: 'ignite'（使用 mockStackData）。测试不同难度参数下的体验。测试失败重试。

---

## Step 7：蔓延（Spread）

**目标：** 自动蔓延 + 卡住补救。

**做什么：**
- 根据 stackData 计算蔓延结果
- 成功路径：背景逐步切换（tinder → kindling → fuel 着火）+ Ren 解说
- 卡住路径：火停在某层 + Ren 诊断 + 玩家拖备用材料补救
- 写入 registry.fireQuality
- `_nextStep()`

**验证：** Mock 不同的 stackData（好/差），确认蔓延成功和卡住两条路径都能走通。

---

## Step 8：守夜（Sustain）

**目标：** 完整守夜机制。

**做什么：**
- 火焰强度条（5 格）
- 雨夜进度条
- 备用材料区
- Ren proposal + 两条路径
- 火焰衰减（参数由 campsiteQuality + groundCleared 决定）
- 加柴操作 + 时机反馈
- 积水事件（poor 营地）
- 火灭 → 体力扣除 → 回点火 or dayFail
- 进度条满 → 成功
- 成功评级（strong / weak）
- emit `MINIGAME_COMPLETE`，写回 registry

**验证：** Mock startStep: 'sustain'。测试 good/poor 营地参数差异。测试火灭重试。测试成功评级。

---

## Step 9：集成测试

**目标：** 接入真实 Ink 流程，完整走通。

**做什么：**
- 确认 day2.ink 中 `#minigame:fire_campsite` 能正确跳入 FireBuildingMinigame
  - 可能需要在 NarrativeScene._launchMinigame 的 map 里加一条映射（如果不改 NarrativeScene，则在 BootScene 或其他入口处理）
- 完整走通：Ink 叙事 → 营地选择 → FireBuildingMinigame → Ink 结果分支
- 测试路径：
  - Site B（good）→ 全部做对 → strong fire → 搜索成功
  - Site A（poor）→ 部分失误 → weak fire → 搜索困难
  - 多次失误 → triggerDayFail → buffer day → 重来
- 确认 Ink 变量写回正确：`mg_fire_campsite_success`、`mg_fire_campsite_score`、`stamina_depleted`

---

## Step 10：清理

**目标：** 移除旧文件，确认无回归。

**做什么：**
- 确认新 FireBuildingMinigame 完全替代旧的 FireCampsiteMinigame + FireCollectMinigame
- 从 main.js 注销旧 scene
- 删除或归档旧文件：
  - FireCampsiteMinigame.js
  - FireCollectMinigame.js
  - FireClearMinigame.legacy.js
  - FireIgniteMinigame.legacy.js
  - FireSortMinigame.legacy.js
  - FireSustainMinigame.legacy.js
  - FireMinigame.js
- 删除 `day2FireMock.js`（旧的 mock），保留新的 `day2FireBuildingMock.js`
- 将 `DEV_MOCK_FIRE_BUILDING` 设为 `false`
- 全流程回归测试

---

## 开发顺序速查

| Step | 内容 | 依赖 | 预计工作量 |
|------|------|------|-----------|
| 0 | DialogueBox 组件 | UIConstants.js | 小 |
| 1 | Scene 骨架 + 状态机 | Step 0 | 小 |
| 1.5 | Mock 测试入口 | Step 1 | 小 |
| 2 | Ren 出场 + 清理火坑 | Step 1.5 | 中 |
| 3 | 收集材料 | Step 2 | 大 |
| 4 | 分拣 Sort | Step 3 | 中 |
| 5 | 搭建 Stack | Step 4 | 中 |
| 6 | 点火 Ignite | Step 5 | 大 |
| 7 | 蔓延 Spread | Step 6 | 中 |
| 8 | 守夜 Sustain | Step 7 | 大 |
| 9 | 集成测试 | Step 8 | 中 |
| 10 | 清理旧文件 | Step 9 | 小 |
