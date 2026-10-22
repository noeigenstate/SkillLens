<div align="center">

<img src="docs/logo.svg" width="84" alt="SkillLens logo">

# SkillLens

**把任意 `SKILL.md` 变成会动的流程图。**

丢进一个 skill，它的工作流就活起来：步骤、判断、回环自动提取，画成可以浏览、微调、导出的动态泳道图。

[![License: MIT](https://img.shields.io/badge/license-MIT-63d9f5?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-63d9f5?style=flat-square)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-ffbe57?style=flat-square)](package.json)
[![UI](https://img.shields.io/badge/UI-English%20%7C%20%E4%B8%AD%E6%96%87-a99bff?style=flat-square)](README.md)

[English](README.md) · **简体中文**

<br>

<a href="https://github.com/noeigenstate/SkillLens/raw/main/docs/promo.mp4"><img src="docs/promo.webp" width="880" alt="SkillLens 宣传片：把任意 SKILL.md 变成动态流程图"></a>

<sub>▶ <a href="https://github.com/noeigenstate/SkillLens/raw/main/docs/promo.mp4">下载带声音的 30 秒宣传片</a>（MP4 · 1080p · 8 MB）</sub>

</div>

## 为什么做 SkillLens

skill 是一份很长的 Markdown。工作流就写在里面，但要一行行读完才看得出：哪些步骤按顺序走，在哪里做判断，哪里会回头。SkillLens 替你读完，把工作的形状画出来。

- **不用改 skill。** 指向一个文件夹，里面每个 `SKILL.md` 都会自动出图。
- **看得见流动。** 当前步骤亮起，数据点沿线流动，一轮一轮走遍每条分支。
- **需要时可以固定。** 在编辑器里改好图，粘回 skill 成为 `skillflow` 代码块，之后就严格按它画。

## 功能

| | |
| --- | --- |
| **自动提取** | 章节变泳道；有序列表和编号小节变步骤；「如果…」变判断；「回到第 N 步，直到…」变回环；规则变注释；参考资料变侧边泳道。 |
| **动画播放** | 每一帧都由时间算出，可以暂停、逐步、拖动，录出来的视频逐帧准确。 |
| **你有的所有 skill** | 找出本机 20 多个 agent 装的 skill、各个项目里的 skill、官方库和插件市场缓存，还能去网上搜。同一份文件装在好几个 agent 里只列一次。保存后 2 秒内自动重画；拖入任意文件夹即可导入。 |
| **看原文** | 点任意卡片，查看原文、从哪来、到哪去。 |
| **`skillflow` 代码块** | 一种小巧的文本格式，精确控制泳道、卡片、判断和连线。 |
| **导出** | 独立的动画网页（单个文件，双击即看）、SVG、2 倍 PNG、MP4 视频。 |
| **三套主题** | 蓝图（默认）、深夜、柔光；字体为 Inter、Noto Sans SC、JetBrains Mono。 |
| **中英双语** | 一键切换界面语言；图里的文字自动翻译成对应语言，用本机的 Claude Code 或 Anthropic API。 |

## 主题

<table>
  <tr>
    <td align="center"><img src="docs/screenshot-blueprint.png" alt="蓝图主题"><br><sub><b>蓝图</b> · 默认</sub></td>
    <td align="center"><img src="docs/screenshot-midnight.png" alt="深夜主题"><br><sub><b>深夜</b></sub></td>
    <td align="center"><img src="docs/screenshot-glass.png" alt="柔光主题"><br><sub><b>柔光</b></sub></td>
  </tr>
</table>

中文界面下，图里的步骤也会自动翻译成中文：

<img src="docs/screenshot-zh.png" width="880" alt="SkillLens 中文界面">

## 快速开始

需要 [Node.js](https://nodejs.org) 22 或更新版本；导出视频还需要 Chrome 或 Edge，以及 [ffmpeg](https://ffmpeg.org)。

```bash
git clone https://github.com/noeigenstate/SkillLens.git
cd SkillLens
npm start -- --lang zh
```

Windows 上直接双击 **`start.bat`**。界面默认英文，点顶栏的 **中** 按钮切到中文，之后会一直记住。不需要安装任何依赖。浏览器会自动打开，列出找到的所有 skill。

不想起服务：先运行一次 `npm run scan`，再直接双击 `index.html`。

**快捷键：** <kbd>空格</kbd> 播放 / 暂停 · <kbd>←</kbd> <kbd>→</kbd> 逐步 · <kbd>+</kbd> <kbd>-</kbd> 缩放 · <kbd>0</kbd> 整张图放进画布 · <kbd>F</kbd> 全屏演示 · <kbd>Ctrl</kbd> + 滚轮缩放 · 拖动画布平移

## skill 从哪来

| 来源 | 列出什么 | 不要它 |
| --- | --- | --- |
| 本仓库 | `skills/` 和 `examples/` | |
| 本机装的 agent | Claude Code、Codex、GitHub Copilot、Cursor、Gemini CLI、Antigravity、Windsurf / Devin、OpenCode、Goose、Amp、Factory、Kiro、Pi、OpenClaw、Cline、Roo Code、Qwen Code、Kimi Code、Trae、通义灵码、Grok 的用户、插件和自带 skill 目录，以及各家共用的 `~/.agents/skills`。`CLAUDE_CONFIG_DIR`、`CODEX_HOME`、`COPILOT_HOME`、`XDG_CONFIG_HOME` 等环境变量都会照着找 | `--no-agents` |
| 你的项目 | SkillLens 所在的文件夹就是工作区：里面每个文件夹算一个项目，列出它的 `skills/`、`.claude/skills`、`.agents/skills`、`.github/skills`、`.cursor/skills` 等各家项目级目录。用 `--workspace <目录>` 换成别处 | `--no-workspace` |
| 官方库 | anthropics/skills、openai/skills、anthropics/claude-plugins-official。在列表最下面点 **下载**，或运行 `npm run fetch` | `--no-official` |
| 插件市场缓存 | agent 缓存在本机、但还没装的插件（Claude Code、Codex、Grok），默认折叠 | `--no-catalog` |
| 网上 | 在搜索框输入，再点 **在网上搜索**：结果来自 skills.sh 和 claudeskills.info，点一下就从 GitHub 取回 SKILL.md | |

同一份 SKILL.md 装在好几个 agent 里只列一次，旁边标 `+N`，详情面板写着还在哪些地方。所有文件都原地读取，扫描结果放在 `data/`，不进 git。只有网上搜索和下载官方库会联网。

## 工作原理

```mermaid
flowchart LR
  A["SKILL.md"] --> B["解析 Markdown"]
  B --> C{"有 skillflow 块？"}
  C -- "有" --> D["读取代码块"]
  C -- "没有" --> E["提取步骤、<br>判断、回环"]
  D --> F["排泳道、<br>走连线"]
  E --> F
  F --> G["渲染 SVG<br>并播放动画"]
  G --> H["浏览 · 网页 · 图片 · 视频"]
```

## 让 skill 画得准

自动提取跟着文件结构走，这样写效果最好：

1. 流程写在 `## 流程` / `## Workflow` 下，用有序列表，每步写成 `**短标题**：说明`。
2. 判断用「如果…」开头；`如果 X，就做 Y` 会画成带出口的菱形。
3. 回环写成「回到第 N 步，直到…」。
4. 规则放在 `## 注意`，背景资料放在 `## 参考`。
5. 参考资料表里写明每份文件在哪一步读（`Step 3: …` 或「第 3 步：…」）。文件卡片上会标出读它的步骤编号，播放到那一步时，会有一条点线从这一步连到它要读的文件。`skillflow` 代码块里写 `步骤 .> 文件`。

要精确控制，就加一个 `skillflow` 代码块。最快的办法：在「结构」面板里改好，点「复制为代码块」。完整语法见 [skills/skilllens/SKILL.md](skills/skilllens/SKILL.md)，[examples/review-loop](examples/review-loop/SKILL.md) 用到了全部元素。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm start` | 本地服务：实时刷新、自动翻译、页面内录视频 |
| `npm run start:project` | 同上，只列本仓库的 skill |
| `npm run stop [-- --port 5179 \| --all]` | 停止正在运行的服务（默认 5178 端口）；会先确认端口上确实是 SkillLens |
| `npm run scan` | 生成 `data/skills.js`，不起服务也能打开 `index.html` |
| `npm run fetch` | 下载官方 skill 库到 `data/online/` |
| `npm run record -- <skill> [--seconds 30] [--scale 2] [--theme blueprint\|dark\|light] [--lang en\|zh]` | 录 MP4 到 `output/` |

## 配置

| 设置 | 作用 |
| --- | --- |
| `--root 名字=<路径>` 或 `skillviz.config.json` | 多扫一些目录：`{"roots":[{"label":"团队 skills","dir":"<路径>"}]}` |
| `--project-only` | 只列本仓库的 skill（旧名 `--no-claude`） |
| `--workspace <目录>` | 换一个项目文件夹，可以写多次。配置文件里写 `"workspaces": ["<目录>"]` |
| `--no-agents`、`--no-workspace`、`--no-official`、`--no-catalog` | 去掉某一类来源。配置文件里写 `"agents": false`、`"workspaces": []`、`"official": false`、`"catalog": false` |
| `GITHUB_TOKEN` | 从网上取回 skill 时提高 GitHub 的访问次数上限 |
| `SV_TRANSLATE=off` | 关闭自动翻译 |
| `ANTHROPIC_API_KEY` + `npm install` | 用 Anthropic SDK 翻译，不用 Claude Code（`SV_TRANSLATE_MODEL` 指定模型） |
| `SV_CHROME`、`SV_FFMPEG`、`SV_CLAUDE` | 找不到 Chrome / Edge、ffmpeg、Claude Code 时指定路径 |

译文缓存在 `data/translations.json`，同一句话只翻一次。

## 致谢

视觉语法参考 [live-panel-skill](https://github.com/ythx-101/live-panel-skill) 的 loop 视图。图标来自 [Lucide](https://lucide.dev)（ISC），见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。宣传片配乐：Ruskerdax 的《[Cybershaman](https://opengameart.org/content/cybershaman)》（CC0）。

## 许可证

[MIT](LICENSE)
