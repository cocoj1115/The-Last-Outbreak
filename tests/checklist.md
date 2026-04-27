# Integration Checklist

每次 integration session 前，两人各自跑一遍。全部打勾才能合并。

---

## 🔗 Core Loop (Week 1 target)

- [ ] `npm run dev` 能启动，浏览器打开，不报错
- [ ] BootScene 加载完毕，转入 NarrativeScene
- [ ] HUD 显示 5 个火焰图标 + "Day 1 / 7"
- [ ] NarrativeScene 显示占位对话文字

---

## 📖 Narrative → Minigame handoff (Dev A validates)

- [ ] Ink 触发 `#minigame:campsite` tag → `MINIGAME_TRIGGER` 事件被 emit
- [ ] NarrativeScene sleep，CampsiteMinigame 启动
- [ ] CampsiteMinigame 完成 → `MINIGAME_COMPLETE` payload 格式正确：
      `{ id: 'campsite', success: boolean, score: number }`
- [ ] NarrativeScene wake，InkBridge 收到结果，继续 Ink 故事
- [ ] `mg_campsite_success = true` 走 good 分支，显示正确对话
- [ ] `mg_campsite_success = false` 走 bad 分支，显示正确对话

---

## ⛺ CampsiteMinigame (Dev B validates)

- [ ] 三张卡片正确渲染（learn difficulty）
- [ ] 选中卡片高亮，再次点击取消选中
- [ ] 确认按钮在选中后变为可点击
- [ ] 选 'good' 营地 → `success: true`，Stamina 不扣
- [ ] 选 'bad' 营地 → `success: false`，Stamina 扣 2
- [ ] 场景 stop 后不报错

---

## 🔥 FireMinigame (Dev B validates)

- [ ] Material phase：8 个材料显示，最多选 3 个
- [ ] 选 3 个后确认按钮激活
- [ ] Ignition phase：光标左右移动，点击判定 in/out of sweet zone
- [ ] 命中 sweet zone → 进入 sustain phase
- [ ] 未命中 → Stamina 扣 1，可重试
- [ ] Sustain phase：火焰血条随时间下降
- [ ] 加柴按钮增加血条
- [ ] 撑过计时器 → `success: true`
- [ ] 血条归零 → Stamina 扣 2，`success: false`

---

## ❤️ Stamina system (Dev B validates)

- [ ] `stamina.deduct(2)` → HUD 火焰熄灭 2 个
- [ ] `stamina.deduct(5)` → `STAMINA_DEPLETED` 被 emit
- [ ] `stamina.reset(day)` → 火焰全亮
- [ ] `stamina.applyNightPenalty()` → 次日 effectiveMax 减 1

---

## 📅 Day system (Dev A validates)

- [ ] `days.advance()` → HUD 日期更新，月相变化
- [ ] Day 7 时再次 advance → `DAYS_EXHAUSTED` 被 emit
- [ ] `days.consumeBuffer()` → 天数消耗，日志输出

---

## 🔁 Stamina depleted → retry flow

- [ ] Stamina 归零 → NarrativeScene 显示 retry 提示（占位 console.log 也算）
- [ ] 重试消耗 1 天 → Days 更新
- [ ] Days 归零 → 强制进入最差结局分支

---

## 已知待做 (不影响 Week 1 验收)

- [ ] Ink story 接入真实 .ink.json 文件
- [ ] 替换 placeholder 背景图和立绘
- [ ] 对话框打字机效果微调
- [ ] 音效
