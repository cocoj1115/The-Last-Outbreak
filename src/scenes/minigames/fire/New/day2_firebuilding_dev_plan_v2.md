# Day 2 FireBuilding — 更新版开发计划

> **策略变更：** 不从零搭建，而是将现有的 `FireCampsiteMinigame.js` 和 `FireCollectMinigame.js` 复制到 `fire/New/` 文件夹，在已有代码基础上按新设计文档改动。

---

## 开发原则

1. **复制再改，不动原件** — 把 `FireCampsiteMinigame.js` 和 `FireCollectMinigame.js` 复制到 `fire/New/`，在副本上改。原文件保留直到新版本完全测试通过。
2. **Step 0 已完成** — `DialogueBox.js` 已经建好，对话框样式已对齐。
3. **逐阶段改动** — 按 step 状态机顺序（clear → collect → sort → stack → ignite → sustain），逐个阶段对照新设计文档改动。每改完一个阶段测试通过再改下一个。

---

## Step 1：复制 + 注册 + Mock 入口

**做什么：**
- 将 `FireCampsiteMinigame.js` 复制到 `fire/New/FireBuildingMinigame.js`
- 将 `FireCollectMinigame.js` 复制到 `fire/New/FireBuildingCollect.js`
- 修改新文件的 scene key（避免和旧文件冲突）：
  - `FireBuildingMinigame`（替代 `FireCampsiteMinigame`）
  - `FireBuildingCollect`（替代 `FireCollectMinigame`）
- 在 main.js 注册新 scene（保留旧 scene 注册，两套并存）
- 新建 `fire/New/day2FireBuildingMock.js`，Mock 入口直接启动 `FireBuildingMinigame`，可配置 `startStep`
- 将新文件里的对话系统替换为 `DialogueBox.js`（Step 0 成果）

**验证：** 通过 Mock 入口启动新 scene，确认现有功能（clear → sort → stack → ignite → sustain）在新文件里能正常跑通，和旧版行为一致。

---

## Step 2：加入 NPC Ren + 改造对话系统

**做什么：**
- 在 `FireBuildingMinigame.js` 的 step 状态机开头加入 `ren_intro` 步骤
- 加载 Ren 立绘（暂用 placeholder）
- 实现 Ren 出场对话序列（设计文档 4.0 的完整对白）
- 在每个现有 step（clear、sort、stack、ignite、sustain）开头加入 Ren 的 proposal 对白 + 两条路径选项（"我知道"/"教我"）
- 将现有 Aiden 独白替换为 Ren 的对话（对照设计文档逐条替换）

**验证：** 走通 ren_intro → clear，对话框显示 Ren 出场对白，speaker tag 正确。

---

## Step 3：改造 Clear（清理火坑）

**做什么：**
- 对照设计文档 4.1，修改清理阶段：
  - 替换 Aiden 独白为 Ren 的 proposal 对白
  - 清理完成后加 Ren 的反馈对白
  - 确认 `registry.groundCleared` 正确写入
- 清理步骤不需要大改交互逻辑，主要是对白替换

**验证：** Mock startStep: 'ren_intro'，走过出场 → 清理 → 确认对白和 registry 正确。

---

## Step 4：改造 Collect（收集材料）

**做什么：**
- 对照设计文档 4.2，修改 `FireBuildingCollect.js`：
  - 进入前加 Ren proposal + 两条路径选项
  - 进入森林后加机制说明对白
  - 替换首次拾取教学独白为 Ren 对话
  - 加入 HUD 计数器（Tinder 0/3, Kindling 0/3, Fuel 0/2）
  - 修改收集完成条件（三类达标后 Ren 提示）
  - 加入 Day 3 trade-off 提示对白
  - 修改后续拾取反馈为 HUD 轻量提示（"+1 Tinder" 等）
- 确保回营地时材料数据正确写入 registry

**验证：** Mock startStep: 'collect'。测试两条路径。测试计数器。测试首次拾取教学对白。

---

## Step 5：改造 Sort（分拣）

**做什么：**
- 对照设计文档 4.3，修改分拣阶段：
  - 加 Ren proposal + 两条路径
  - 替换放错反馈为 Ren 的 explanatory 反馈（不直接给答案）
  - 加入每种类型首次放对的 Ren 正反馈
  - 后续同类型放对改为 HUD 轻量反馈
  - 加入全部完成后的 Ren 总结对白

**验证：** Mock startStep: 'sort'。测试拖拽、放对/放错反馈。

---

## Step 6：改造 Stack（搭建）

**做什么：**
- 对照设计文档 4.4，修改搭建阶段：
  - 加 Ren proposal + 两条路径
  - 去掉间距交互（只考验层级）
  - Day 2 层级顺序锁定保留（现有代码已有此机制）
  - 替换放错/放对反馈为 Ren 对白
  - 加入搭完后 Ren 总结

**验证：** Mock startStep: 'stack'。测试层级锁定、反馈。

---

## Step 7：改造 Ignite（点火）

**做什么：**
- 对照设计文档 4.5，**重新设计**点火阶段：
  - Ren proposal + 两条路径（已在场景内用 `DialogueBox` 选项承接）
  - 火花落点：**火坑同心圆三层可点**；路径 B 仅内圈（tinder）高亮且可点；错层 Ren 说教后重选
  - 两阶段机制：
    - **阶段一：** 点击燧石累积热度（随机 +1~3），进度持续衰减（难度来自前置材料/营地）
    - **阶段二：** 达冒烟线后进入吹气；**烟雾明/暗脉动 timing**（Day 2：亮 1.5s / 暗 1.0s；Day 3：亮 0.8s / 暗 1.2s）；**亮窗吹气涨进度、暗窗吹气扣进度**；不点击则进度缓慢倒退，跌破冒烟线退回阶段一
  - `DIFFICULTY_CONFIG` + tinder/kindling 数量映射：**冒烟阈值**、吹气增减幅度、吹气错误惩罚、雨滴干扰等（见 spec 表格）
  - Day 2 Ren **一次性强制提示**：冒烟进入阶段二、首次暗窗误吹、首次亮窗吹对（文案见 spec 4.5）
  - 失败/重试：`MAX_CLICKS = 30` 共享两阶段；首次失败 Ren + 体力/tinder；二次失败 `triggerDayFail()`
  - UI：`UI-IGNITE-BAR` 锚在火炉外圈下方（避免与底部木槽重叠）；占位可用 tint 表现明暗烟雾直至 BG-IGNITE-SMOKE-* 就绪

**注意：** Step 1（`fire/New/` 副本 + Mock）若已在仓库落地，则以 Mock `startStep: 'ignite'` 为主验证入口；Ink 主线切换见 Step 10。

**验证：**
- Mock `startStep: 'ignite'`：proposal 两条路径；路径 A 三层圆环命中；路径 B 仅内圈；错层对白；阶段一/二切换与退回阶段一
- 吹气：**亮窗涨、暗窗跌**；idle 衰减；Ren 三条提示各触发一次
- Day 3：`day >= 3` 时脉动周期收紧（可与 Mock 传参核对）
- 失败线与 `registry.ignitionSuccess` / `registry.fireQuality`

---

## Step 8：新增 Spread（蔓延）

**做什么：**
- 这是**新增**的阶段，原代码中没有独立的蔓延步骤
- 在 step 状态机中 ignite 和 sustain 之间插入 `spread`
- 对照设计文档 4.6 实现：
  - 根据 stackData 计算蔓延结果
  - 成功：背景切换序列 + Ren 解说
  - 卡住：诊断 + 补救操作
  - 写入 fireQuality

**验证：** Mock startStep: 'ignite'，走完点火进入蔓延，测试成功和卡住两条路径。

---

## Step 9：改造 Sustain（守夜）

**做什么：**
- 对照设计文档 4.7，修改守夜阶段：
  - 加 Ren proposal + 两条路径
  - 替换加柴反馈为 Ren 对白
  - 保留现有的衰减机制、积水事件、备用材料系统
  - 调整参数（夜晚时长计算、衰减档位等）按新设计文档
  - 确保 MINIGAME_COMPLETE 正确 emit

**验证：** Mock startStep: 'sustain'。测试 good/poor 营地。测试加柴反馈。测试成功/失败。

---

## Step 10：集成测试

**做什么：**
- 将 Ink 中的 minigame 映射从 `FireCampsiteMinigame` 改到 `FireBuildingMinigame`
- 完整走通 Ink → 营地选择 → FireBuildingMinigame → Ink 结果分支
- 测试所有路径组合
- 确认 Ink 变量写回正确

---

## Step 11：清理

**做什么：**
- 确认新版完全替代旧版
- 从 main.js 注销旧 scene
- 删除或归档旧文件
- Mock 开关设为 false
- 全流程回归测试

---

## 开发顺序速查

| Step | 内容 | 性质 | 预计工作量 |
|------|------|------|-----------|
| 0 | DialogueBox 组件 | ✅ 已完成 | — |
| 1 | 复制 + 注册 + Mock | 搭建 | 小 |
| 2 | Ren 出场 + 对话系统改造 | 新增 | 中 |
| 3 | 改造 Clear | 对白替换 | 小 |
| 4 | 改造 Collect | 对白 + 机制调整 | 大 |
| 5 | 改造 Sort | 对白替换 + 反馈改造 | 中 |
| 6 | 改造 Stack | 对白替换 | 中 |
| 7 | 改造 Ignite | **重新设计交互** | 大 |
| 8 | 新增 Spread | 新增阶段 | 中 |
| 9 | 改造 Sustain | 对白 + 参数调整 | 中 |
| 10 | 集成测试 | 测试 | 中 |
| 11 | 清理旧文件 | 清理 | 小 |
