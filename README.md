#The-Last-Outbreak

生存技能叙事游戏。Phaser 3 + Ink + GSAP。

---

## 快速开始（两个开发者都要做）

### 1. 安装前置工具

你需要：
- **Node.js 18+** — [下载地址](https://nodejs.org/)，选 LTS 版本
- **VS Code** — [下载地址](https://code.visualstudio.com/)
- **Git** — [下载地址](https://git-scm.com/)
- **Inky**（Dev A 需要）— [下载地址](https://github.com/inkle/inky/releases) — 写 Ink 对话用

检查安装成功：
```bash
node -v    # 应该显示 v18.x 或更高
npm -v     # 应该显示 9.x 或更高
git -v     # 应该显示版本号
```

---

### 2. 建 GitHub Repository

**由其中一人操作，另一人等待邀请：**

1. 打开 [github.com](https://github.com)，点右上角 **+** → **New repository**
2. Repository name: `wilderness-game`
3. 选 **Private**
4. **不要**勾 Add README（我们自己有）
5. 点 **Create repository**
6. 复制页面上的 SSH 或 HTTPS URL

---

### 3. 把这个骨架推上去

把项目文件夹放到你的电脑上，然后：

```bash
cd wilderness-game        # 进入项目文件夹
git init
git add .
git commit -m "初始骨架"
git branch -M main
git remote add origin <你的GitHub URL>
git push -u origin main
```

然后在 GitHub repo 页面 → **Settings** → **Collaborators** → 添加另一个开发者。

---

### 4. 另一个开发者 clone

```bash
git clone <GitHub URL>
cd wilderness-game
```

---

### 5. 安装依赖 & 运行

```bash
npm install
npm run dev
```

浏览器会自动打开 `http://localhost:3000`，你会看到一个黑色背景 + 占位对话文字，右上角有火焰图标和日期计数。这就是骨架跑起来了。✅

---

### 6. VS Code 推荐插件

按 `Ctrl+Shift+X`（Mac: `Cmd+Shift+X`），搜索安装：

- **Ink** (`ink.ink`) — .ink 文件语法高亮
- **GitLens** — 看谁改了什么
- **ESLint** — 代码规范（可选）

---

## 每天的工作流

### 开始工作前（两人都要做）

```bash
git pull origin main      # 拿最新代码，避免冲突
```

### 写完后提交

```bash
git add .
git commit -m "简短描述做了什么"
git push origin main
```

**Commit message 规范（Cursor/Claude Code 自动生成的可以，但加个前缀）：**
- `[A] 写完 Day 2 Ink 分支` — Dev A 的改动
- `[B] CampsiteMinigame 选中动画` — Dev B 的改动

---

## 项目结构

```
wilderness-game/
├── src/
│   ├── ink/                  ← Dev A：所有 .ink 对话文件
│   │   └── main.ink
│   ├── scenes/
│   │   ├── BootScene.js      ← 启动场景（两人都不常改）
│   │   ├── HUDScene.js       ← Dev B：血量/天数 UI
│   │   ├── narrative/
│   │   │   └── NarrativeScene.js   ← Dev A：对话显示
│   │   └── minigames/
│   │       ├── campsite/
│   │       │   └── CampsiteMinigame.js   ← Dev B
│   │       └── fire/
│   │           └── FireMinigame.js        ← Dev B
│   ├── systems/
│   │   ├── GameEvents.js     ← ⚠️ 两人共同维护，改前告知对方
│   │   ├── InkBridge.js      ← Dev A：Ink 和 Phaser 的桥接层
│   │   ├── StaminaSystem.js  ← Dev B：体力系统
│   │   └── DaySystem.js      ← Dev A：天数系统
│   └── main.js               ← Phaser 入口（两人不常改）
├── tests/
│   ├── checklist.md          ← 每次 integration 前对照检查
│   ├── mock_minigame.js      ← Dev A 用：模拟 minigame 完成
│   └── mock_ink_bridge.js    ← Dev B 用：验证 emit 格式
├── index.html
├── vite.config.js
└── package.json
```

---

## 分工

| 文件/系统 | 负责人 |
|-----------|--------|
| `src/ink/*.ink` | **Dev A** |
| `src/systems/InkBridge.js` | **Dev A** |
| `src/systems/DaySystem.js` | **Dev A** |
| `src/scenes/narrative/NarrativeScene.js` | **Dev A** |
| `src/scenes/minigames/**` | **Dev B** |
| `src/systems/StaminaSystem.js` | **Dev B** |
| `src/scenes/HUDScene.js` | **Dev B** |
| `src/systems/GameEvents.js` | **两人共同** |
| `src/scenes/BootScene.js` | **两人共同** |

---

## Ink 工作流（Dev A）

1. 用 **Inky** 打开 `src/ink/main.ink` 编写故事
2. 写完后在 Inky 菜单：**File → Export story to JSON...**
3. 保存到 `src/assets/story/main.ink.json`
4. 在 `BootScene.js` 的 preload 里取消注释这行：
   ```js
   this.load.json('story', 'assets/story/main.ink.json')
   ```
5. 在 `NarrativeScene.js` 的 create 里取消注释 InkBridge 初始化代码

**Ink 中触发 minigame 的语法：**
```ink
# minigame:campsite day:1 difficulty:learn
```
这一行会让 InkBridge 发出 `MINIGAME_TRIGGER` 事件，Phaser 接管。

---

## 第一周验收标准

能跑通这一个完整循环：
```
叙事对话
  → Ink 触发 #minigame:campsite
    → CampsiteMinigame 启动
      → 玩家选营地
        → MINIGAME_COMPLETE 被 emit
          → Stamina 变化反映在 HUD
            → NarrativeScene 恢复，显示对应对话分支
```

对照 `tests/checklist.md` 全部打勾。

---

## 常见问题

**`npm install` 报错？**
确认 Node.js 版本是 18+：`node -v`

**Ink 文件改了但游戏没变化？**
需要重新在 Inky 里 Export to JSON。.ink 文件不会自动编译。

**两人改了同一个文件冲突了？**
```bash
git pull origin main   # 先拉，VS Code 会显示冲突
# 在 VS Code 里手动选择保留哪个版本
git add .
git commit -m "解决合并冲突"
git push
```
尽量避免同时改 `GameEvents.js` 和 `BootScene.js`。

**minigame 触发了但画面没变化？**
检查 `GameEvents.MINIGAME_TRIGGER` 的 `id` 是否匹配 `main.js` 里的场景 key。
