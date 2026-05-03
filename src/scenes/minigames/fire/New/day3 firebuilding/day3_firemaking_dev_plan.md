# Day 3 Firemaking — 开发计划

## 开发原则

1. 在同一个 FireBuildingMinigame.js 里加 this.day >= 3 分支，不复制新文件
2. 不动 Day 2 的逻辑路径——所有 Day 3 新逻辑在条件块内
3. 不修改任何 Ink 文件
4. 动效用 GSAP（import { gsap } from 'gsap'）
5. 每完成一步，用 mock day=2 跑一遍确认 Day 2 没坏

---

## Step 1：GSAP 引入 + Mock 入口 + To-Do List

做什么：
- FireBuildingMinigame.js 顶部加 import { gsap } from 'gsap'
- day2FireBuildingMock.js 加 Day 3 mock 配置（day=3, startStep, windDirection 等）
- 实现 to-do list UI（左上角文字列表，完成打勾）
- Day 3 进入时显示 to-do list，Day 2 不显示

验证：mock day=3 启动，看到 to-do list。mock day=2 启动，不显示 to-do list。

---

## Step 2：开放式营地架构

做什么：
- Day 3 进入时跳过 Ren 出场（ren_intro），跳过线性状态机
- 改为同时显示所有可交互元素
- 状态检测驱动：燧石只在火坑有材料时显示等
- Aiden 进入独白

验证：mock day=3，看到营地画面，杂物/石头/森林入口同时可见。

---

## Step 3：收集阶段 Day 3 分支

做什么：
- FireBuildingCollect.js 加 day >= 3 分支
- 材料表切换为 MATERIALS_DAY3
- 材料漂移 tween（GSAP，按重量不同幅度）
- 去掉 Ren 教学对白，换成 Aiden 观察独白
- 去掉目标计数器（无 X/3），只显示总数
- 第10把预警独白，11把起扣体力

验证：mock day=3 startStep='collect'。材料在动。轻的动得多。第10把有预警。

---

## Step 4：分拣可选

做什么：
- Day 3 不自动进入 sort 步骤
- 分类区域始终可见但不强制
- 玩家可拖材料到分类区（分拣），也可直接拖到火坑（跳过分拣）
- 去掉放错纠正——放哪算哪

验证：mock day=3，材料回来后可以直接拖到火坑不经过分拣。

---

## Step 5：围石头挡风（新增）

做什么：
- 4块石头 sprite 散落在火坑周围
- 风向随机生成（存入 this._windDirection）
- 风向视觉线索：GSAP 树叶粒子从风向飘过
- 石头拖拽到火坑边：迎风面有效（snap），背风面弹回
- windShield 计算写入 registry
- Aiden 独白（新机制引导）
- to-do 'shield' 打勾

验证：mock day=3，石头可拖。放对有反馈。放错弹回。windShield 正确写入。

---

## Step 6：搭建去掉 scaffolding

做什么：
- Day 3 去掉层级锁定（三层同时开放）
- 去掉放错纠正
- 去掉 Ren 对白，加 Aiden 独白
- 火坑格点更紧凑（格点间距 ×0.8，和石头围墙配合）

验证：mock day=3 startStep='stack'。三层同时可放。放错不弹回。

---

## Step 7：点火风向选择（新增）

做什么：
- Day 3 点火前新增方位选择 UI（4个方向圆形 hotspot）
- 选择后 effectiveDecayMs 乘以方向倍数
- 去掉 Ren 提示，加 Aiden 独白
- 脉动参数切换（亮0.8s/暗1.2s）

验证：mock day=3 startStep='ignite'。方位选择出现。选迎风面衰减快。选背风面正常。

---

## Step 8：守夜风力事件（新增）

做什么：
- Day 3 守夜替换雨天积水事件为风力事件
- 风力预警：GSAP 树木摇晃 + 画面闪白（事件前2秒）
- 风力事件触发：火焰 -(1/2/3) 按 windShield
- 频率：good每12s / poor每8s
- 衰减参数加入 windShield 修正
- Aiden 独白（风力预警和击中）

验证：mock day=3 startStep='sustain'。预警视觉出现。事件触发扣火焰。windShield 影响伤害。

---

## Step 9：集成测试

做什么：
- mock day=3 完整走通所有步骤
- 测试路径：good营地+全做对 / poor营地+多次失误 / dayFail
- 确认 Ink 变量写回正确
- 确认 Day 2（mock day=2）功能无回归

验证清单：
- to-do list 正确打勾
- 材料漂移正常
- 石头挡风逻辑正确
- 风向选择影响点火
- 风力事件预警和触发
- 体力扣除正确
- MINIGAME_COMPLETE 正确 emit
- Day 2 完整走通无异常

---

## 开发顺序速查

| Step | 内容 | 预计工作量 |
|------|------|-----------|
| 1 | GSAP + Mock + To-Do List | 小 |
| 2 | 开放式营地架构 | 大 |
| 3 | 收集 Day 3 分支 | 中 |
| 4 | 分拣可选 | 小 |
| 5 | 围石头挡风 | 大 |
| 6 | 搭建去 scaffolding | 小 |
| 7 | 点火风向选择 | 中 |
| 8 | 守夜风力事件 | 大 |
| 9 | 集成测试 | 中 |
