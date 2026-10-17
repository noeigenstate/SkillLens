<div align="center">

<img src="docs/logo.svg" width="84" alt="SkillLens logo">

# SkillLens

**Turn any `SKILL.md` into an animated flowchart.**

Drop in an agent skill and watch its workflow come alive: steps, decisions and loops are extracted automatically and drawn as a live swimlane diagram you can browse, tweak and export.

[![License: MIT](https://img.shields.io/badge/license-MIT-63d9f5?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-63d9f5?style=flat-square)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-ffbe57?style=flat-square)](package.json)
[![UI](https://img.shields.io/badge/UI-English%20%7C%20%E4%B8%AD%E6%96%87-a99bff?style=flat-square)](README.zh-CN.md)

**English** · [简体中文](README.zh-CN.md)

<br>

<a href="https://github.com/noeigenstate/SkillLens/raw/main/docs/promo.mp4"><img src="docs/promo.webp" width="880" alt="SkillLens promo: turn any SKILL.md into an animated flowchart"></a>

<sub>▶ <a href="https://github.com/noeigenstate/SkillLens/raw/main/docs/promo.mp4">Download the 30-second video with sound</a> (MP4 · 1080p · 8 MB)</sub>

</div>

## Why SkillLens

Skills are long Markdown files. The workflow is in there, but you have to read every line to see it: which steps run in order, where the agent decides, what loops back. SkillLens reads the file for you and shows the shape of the work.

- **No changes to your skills.** Point it at a folder and every `SKILL.md` is charted on its own.
- **See it move.** The current step lights up and data dots travel along the lines, round after round, through every branch.
- **Pin it when it matters.** Fix the chart in the editor and paste it back into the skill as a `skillflow` block; from then on it draws exactly that.

## Features

| | |
| --- | --- |
| **Automatic extraction** | Sections become lanes, ordered lists and numbered headings become steps, "If …" becomes a decision, "go back to step N until …" becomes a loop, rules become notes, references become a side lane. |
| **Animated playback** | Every frame is a pure function of time, so playback can pause, step and seek, and videos record frame-perfect. |
| **Every skill you have** | Finds the skills of 20+ agents on your machine, the ones inside your projects, the official libraries and marketplace caches, and searches the web for more. A file installed in several agents is listed once. Redraws within 2 seconds of a save; drag in any folder to import. |
| **Read the source** | Click a card to see its original text and where it comes from and goes to. |
| **`skillflow` blocks** | A small text format for exact control over lanes, cards, decisions and lines. |
| **Export** | Standalone animated HTML (one file, double-click to view), SVG, 2× PNG and MP4 video. |
| **Three themes** | Blueprint (default), Midnight and Glass, with Inter, Noto Sans SC and JetBrains Mono. |
| **English and Chinese** | Switch the UI with one click; chart text is auto-translated to match, using your local Claude Code or the Anthropic API. |

## Themes

<table>
  <tr>
    <td align="center"><img src="docs/screenshot-blueprint.png" alt="Blueprint theme"><br><sub><b>Blueprint</b> · default</sub></td>
    <td align="center"><img src="docs/screenshot-midnight.png" alt="Midnight theme"><br><sub><b>Midnight</b></sub></td>
    <td align="center"><img src="docs/screenshot-glass.png" alt="Glass theme"><br><sub><b>Glass</b></sub></td>
  </tr>
</table>

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer. Video export also needs Chrome or Edge, and [ffmpeg](https://ffmpeg.org).

```bash
git clone https://github.com/noeigenstate/SkillLens.git
cd SkillLens
npm start
```

On Windows you can double-click **`start.bat`** instead. Switch the UI to Chinese with the **中** button in the top bar; the choice is remembered. There is nothing to install: SkillLens has no dependencies. Your browser opens with every skill it found.

Prefer no server? Run `npm run scan` once, then open `index.html` directly.

**Keyboard:** <kbd>Space</kbd> play / pause · <kbd>←</kbd> <kbd>→</kbd> step · <kbd>+</kbd> <kbd>-</kbd> zoom · <kbd>0</kbd> fit the whole chart · <kbd>F</kbd> present · <kbd>Ctrl</kbd> + wheel zoom · drag to pan

## Where skills come from

| Source | What gets listed | Leave it out |
| --- | --- | --- |
| This repo | `skills/` and `examples/` | |
| Installed agents | The user, plugin and built-in skill folders of Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI, Antigravity, Windsurf / Devin, OpenCode, Goose, Amp, Factory, Kiro, Pi, OpenClaw, Cline, Roo Code, Qwen Code, Kimi Code, Trae, Lingma, Grok, and the shared `~/.agents/skills`. `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `COPILOT_HOME`, `XDG_CONFIG_HOME` and the like are honored | `--no-agents` |
| Your projects | The folder that holds SkillLens is your workspace: each folder in it is a project, and its `skills/`, `.claude/skills`, `.agents/skills`, `.github/skills`, `.cursor/skills` and the other agents' project folders are listed. Point elsewhere with `--workspace <dir>` | `--no-workspace` |
| Official libraries | anthropics/skills, openai/skills and anthropics/claude-plugins-official, after you click **Download** at the bottom of the list or run `npm run fetch` | `--no-official` |
| Marketplace caches | Plugins your agents have cached but not installed (Claude Code, Codex, Grok). Folded by default | `--no-catalog` |
| The web | Type in the search box, then **Search the web**: results come from skills.sh and claudeskills.info, and one click fetches the SKILL.md from GitHub | |

The same SKILL.md installed in several agents shows up once, with a `+N` badge; the details panel lists where else it lives. Everything is read in place and the scan result stays in `data/`, which git ignores. Only web search and the official download go online.

## How it works

```mermaid
flowchart LR
  A["SKILL.md"] --> B["Parse Markdown"]
  B --> C{"skillflow block?"}
  C -- "yes" --> D["Read the block"]
  C -- "no" --> E["Extract steps,<br>decisions, loops"]
  D --> F["Lay out lanes,<br>route the lines"]
  E --> F
  F --> G["Render SVG<br>and animate"]
  G --> H["Browse · HTML · PNG · MP4"]
```

## Make your skill chart well

Auto-extraction follows the structure of the file. These habits give the best charts:

1. Put the procedure under `## Workflow` (or `## Steps`, `## Process`) as an ordered list, one `**Short title**: explanation` per step.
2. Start decisions with "If …"; `If X, do Y` becomes a diamond with an exit.
3. Write loops as "go back to step N until …".
4. Keep rules under `## Rules` and background under `## Reference`.

For full control, add a `skillflow` block. The quickest way is to fix the chart in the **Structure** panel and click **Copy as code block**:

```skillflow
title: My skill
trigger start: When to use [When] {bell}
  short description line

lane L1: Main flow [steps] (green)
  step a: First step [tag] {play}
    one or two lines of detail
  decide b: Needs review?
  step c: Ship it {send} +end

flow:
  start -> a -> b
  b -> c : No
  b ~> a : Yes · revise
```

`->` is a forward line, `~>` a dashed loop, `a -> "text" : Yes` an exit to a note. The full syntax is in [skills/skilllens/SKILL.md](skills/skilllens/SKILL.md), and [examples/review-loop](examples/review-loop/SKILL.md) uses every element.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Local server with live reload, translation and in-page video recording |
| `npm run start:project` | Same, listing only this repo's skills |
| `npm run scan` | Writes `data/skills.js` so `index.html` works without a server |
| `npm run fetch` | Downloads the official skill libraries into `data/online/` |
| `npm run record -- <skill> [--seconds 30] [--scale 2] [--theme blueprint\|dark\|light] [--lang en\|zh]` | Records an MP4 into `output/` |

## Configuration

| Setting | Purpose |
| --- | --- |
| `--root Name=<path>` or `skillviz.config.json` | Scan more folders: `{"roots":[{"label":"Team skills","dir":"<path>"}]}` |
| `--project-only` | List only this repo's skills (old name: `--no-claude`) |
| `--workspace <dir>` | Use another projects folder; repeat for more. In the config file: `"workspaces": ["<dir>"]` |
| `--no-agents`, `--no-workspace`, `--no-official`, `--no-catalog` | Leave a source out. In the config file: `"agents": false`, `"workspaces": []`, `"official": false`, `"catalog": false` |
| `GITHUB_TOKEN` | Raises GitHub's rate limit when fetching skills found on the web |
| `SV_TRANSLATE=off` | Turn auto-translation off |
| `ANTHROPIC_API_KEY` + `npm install` | Translate through the Anthropic SDK instead of Claude Code (`SV_TRANSLATE_MODEL` picks the model) |
| `SV_CHROME`, `SV_FFMPEG`, `SV_CLAUDE` | Paths to Chrome / Edge, ffmpeg and the Claude Code binary when they are not found |

Translations are cached in `data/translations.json`, so each string is translated once.

## Project layout

```
index.html        the app
src/              parsing, extraction, layout, rendering, UI, strings (en / zh)
scripts/          scan, local server, video recording, official and web skills (no third-party packages)
skills/skilllens  the guide for using and changing SkillLens
examples/         example skills
docs/             logo, screenshots and the promo video
```

## Credits

The visual grammar follows the loop view of [live-panel-skill](https://github.com/ythx-101/live-panel-skill). Icons by [Lucide](https://lucide.dev) (ISC); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Music in the promo video: "[Cybershaman](https://opengameart.org/content/cybershaman)" by Ruskerdax (CC0).

## License

[MIT](LICENSE)
