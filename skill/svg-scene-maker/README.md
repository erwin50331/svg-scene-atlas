# svg-scene-maker

目前版本：**v1.1**（2026-11-26）。想知道手上的是不是最新版，打開 `SKILL.md` 看開頭的版本；沒有寫版本的就是 v1.0。更新內容見 [CHANGELOG.md](CHANGELOG.md)，最新版在[網站](https://svg-scene-atlas.pages.dev/#skillStep)下載。

讓 Claude 幫你做出像《[SVG 動畫圖鑑](https://svg-scene-atlas.pages.dev/)》那樣的互動 SVG 動畫場景：一個 HTML 檔、會日夜循環、可以點、有一段值得按的「秀」和原創配樂。

這是 101 組作品一路修正下來的做法，包括畫風寫法、秀的設計、配樂和聲規則，以及分成「在地查證、物理舒適、使用體驗、構圖美感、技術」五類的驗收清單。

## 安裝

- **Claude.ai／Claude 桌面版**：
  1. 把整個 `svg-scene-maker` 資料夾壓成 zip。
  2. 到 Claude 設定裡的「技能（Skills）」頁面上傳。
- **Claude Code**：
  1. 把資料夾複製到 `~/.claude/skills/svg-scene-maker/`，個人使用；或複製到專案的 `.claude/skills/`。
  2. 重新開啟 Claude Code。

## 使用

直接說你想要的場景就好，例如：

> 幫我做一組「京都伏見稻荷的千本鳥居」SVG 動畫場景，用剪紙層疊風格，秀是夜裡鳥居燈籠一路亮上山。

Claude 會先列出內容讓你確認，再照 skill 裡的規則做出單一 HTML 檔。

## 內容

```
svg-scene-maker/
├── SKILL.md                     流程與不能妥協的規則
├── CHANGELOG.md                 更新紀錄
├── references/
│   ├── styles.md                20 種畫風的畫法
│   ├── show-and-motion.md       秀、表演氛圍、優雅停止、移動物與步態
│   ├── sound.md                 聲音架構與配樂和聲規則
│   ├── local-facts.md           在地細節查證
│   ├── composition.md           前中後景、上下構圖、創意視角
│   ├── delivery.md              交付檔案與下載設計
│   └── checklist.md             驗收清單
├── templates/
│   └── scene-skeleton.html      可以直接打開的最小場景骨架
└── tools/
    ├── showstop.js              「表演再按一下優雅停止」共用模組
    ├── showstop_inject.py       把模組注入場景的小工具
    └── scene-bgm.js             可換曲譜的背景配樂引擎
```

## 授權

MIT。你用這個 skill 做出來的作品屬於你自己。
