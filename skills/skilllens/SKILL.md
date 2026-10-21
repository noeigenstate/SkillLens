---
name: skilllens
description: Use SkillLens (this repository) to turn SKILL.md files into animated flowcharts, and to make skills chart well. Use it when someone wants to understand or present a skill's workflow, check whether the auto-extracted chart is right, add a skillflow block to a skill, export a web page / image / video of a skill, or change SkillLens itself.
---

# SkillLens: usage and maintenance

SkillLens turns any SKILL.md into an animated swimlane flowchart: cards are steps, diamonds are decisions, solid lines move forward, dashed lines loop back, glowing dots travel along the lines and the lit card is the current step. The UI and the fixed chart text come in English (default) and Chinese; "中 / EN" at the top right switches.

```skillflow
title: SkillLens
subtitle: SKILL.md in · auto-extracted · animated flowchart out
hero: SkillLens | import · extract · tweak · export

trigger start: Want to understand a skill [When] {bell}
  read the workflow
  check or present it

lane L1: Import [import] (green)
  step open: Open SkillLens [start.bat] {play}
    lists every local skill
    redraws on every save
  step add: Drop or paste [drop] {upload}
    folders, .md files
    or pasted text

lane L2: Extract [extract] (blue)
  decide has: skillflow block? [skillflow?]
  step auto: Heuristic extraction [auto] {sparkles}
    sections → lanes
    steps / decisions / loops
  step check: Check against the source [review] {scan-eye}
    click a card for its text
    see where it connects
  step tune: Tweak in Structure [edit] {pencil}
    apply to redraw
    copy as a code block

lane L3: Output [export] (purple)
  step draw: Draw from the block [render] {layers}
    lanes · cards · diamonds
    dots flow along lines
  step out: Export [export] {download} +end
    HTML / SVG / PNG
    record an mp4

flow:
  start -> open -> add -> has
  has -> auto : No
  has -> draw : Yes
  auto -> check -> tune -> draw -> out
  check ~> auto : fix the source text
```

## Open it

- **Double-click `start.bat`**: starts a local server and opens the browser. The list holds this repo's `skills/` and `examples/`, every agent's installed skills on the machine, the skills inside the projects next to this repo, the official libraries once downloaded, and the agents' marketplace caches (folded). It redraws within 2 seconds after a SKILL.md changes. Same as `npm start`; `npm run start:project` lists only the repo's own skills.
- **Find more on the web**: type in the search box and click **Search the web** (skills.sh + claudeskills.info); a click fetches that SKILL.md from GitHub and keeps it in the **From the web** group. **Download** at the bottom of the list (or `npm run fetch`) pulls anthropics/skills, openai/skills and anthropics/claude-plugins-official into `data/online/`.
- **Open `index.html` directly**: no server, but the list comes from `data/skills.js`, so run `npm run scan` first. Video recording and auto-translation need the server.
- Extra folders: `--root Name=<path>`, or a `skillviz.config.json` in the repo root: `{"roots":[{"label":"Team skills","dir":"<path>"}]}`. Leave a source out with `--no-agents`, `--no-workspace`, `--no-official`, `--no-catalog`; `--workspace <dir>` points at another projects folder.

## Writing skills that chart well

The extraction rules live in `src/extract.js`. A SKILL.md written like this charts correctly without a skillflow block:

1. Put the procedure under a heading such as `## Workflow` / `## Steps` / `## Process`, as an **ordered list** or numbered `###` subsections; write each step as `**Short title**: explanation`.
2. Start a decision with "If …" / "Whether …"; `If X, do Y` becomes a diamond with a Yes exit.
3. Write a router as a two-column table whose header says "State / Condition / If" on the left and "Action / Do / Route" on the right: it becomes a chain of first-match decisions.
4. Write loops as "go back to step N until …".
5. Mark optional steps with a leading `[If necessary]` / `[optional]`; the card gets a dashed border.
6. Rules under `## Rules` / `## Notes` become amber notes; material under `## Reference` becomes an unconnected reference lane.

## The skillflow block (exact control)

When a SKILL.md contains a ` ```skillflow ` block, SkillLens draws only that. The fastest way to write one: fix the auto-extracted chart in the Structure panel, click "Copy as code block" and paste it into the SKILL.md. Syntax:

| Line | Meaning |
| --- | --- |
| `title:` `subtitle:` `hero: title \| subtitle` `footer:` `window:` `cols: 4` | page text and cards per row |
| `trigger id: Title [tag] {icon}` | the trigger card at the top; indented lines below are its description |
| `lane id: Title [tag] (color kind)` | a lane; colors green / blue / purple / teal / rose / amber / slate; kinds flow (default, chained) / ref (reference, unconnected) / bare (no frame) |
| `step id: Title [tag] {icon} +optional +end` | a step card; `+end` is the end step (solid icon), `+optional` a dashed card |
| `decide id: Question? [subtitle]` | a decision diamond |
| `note: text` | a note inside the lane |
| `a -> b -> c : label` under `flow:` | forward lines; `~>` is a dashed loop; `a -> "text" : Yes` is an exit pointing at a short text |
| `a .> b` under `flow:` | step a reads reference b |

Without `flow:`, the cards of non-ref lanes are chained in order. Icons are [Lucide](https://lucide.dev) names, listed in `src/icons.js`; to add one, copy its SVG body from lucide-static.

## Changing SkillLens

- Layers: `markdown.js` parses → `extract.js` / `dsl.js` build the structure → `layout.js` places cards and routes lines → `render.js` draws the SVG and plays it → `app.js` is the UI. All UI and chart strings live in `i18n.js`; add every key in both `en` and `zh`.
- The page must open by double-click, so it uses plain `<script>` tags, no ES modules. Each script is written as `SV.mod.name = function (SV) {…}` so the standalone export can inline the code with `toString()`.
- Every frame must be a pure function of time t (no CSS animation, `Math.random` or wall clock), or frame-by-frame video recording breaks.
- Themes: `light` (cream 3D, default), `dark` and `blueprint` (`?theme=`). Chart colors are in `THEMES` in `render.js`, UI colors in the CSS variables at the top of `style.css`; change both together. Blueprint-only details (grid, rulers, corner ticks, card numbers, amber active step) are behind `P.blueprint`.
- Fonts: Noto Sans SC (Chinese), Inter (Latin), JetBrains Mono (tags and paths) from Google Fonts, falling back to system fonts offline. Layout measures text with a canvas, so it must wait for fonts: `app.js` clears the measure cache and redraws on `loadingdone`, and record mode plus the standalone export call `document.fonts.load` for the chart's text first. Keep the font link in `index.html`, `FONT` / `MONO` in `layout.js` and the link in the standalone template in sync.
- Auto-translation: `scripts/lib/translate.mjs` (server, `/api/translate`) and `useTranslation` / `graphPass` in `src/app.js` (which strings on the chart get translated). Only chart text and opened source text are translated; tags, file names, paths and Yes / No are kept. Backend order: an OpenAI-compatible LLM from the git-ignored `data/ollama.json` (or `SV_LLM_URL` / `SV_LLM_MODEL` / `SV_LLM_KEY`), then the Anthropic SDK when an API key is set, else the local Claude Code CLI (on Windows call `node_modules/@anthropic-ai/claude-code/bin/claude.exe` directly to avoid `.cmd` quoting). The cache key is `lang + \u0001 + text` on both sides.
  - A local LLM may serve one request at a time (the LAN vLLM did: ~6 s per 15 short strings, no gain from parallel calls). So speed comes from order, not concurrency: the page sends ≤15 strings per request in visual priority (titles first), redraws after each, and aborts its old request when the skill or language changes; the server runs the newest request first, drops batches of aborted requests, retries a failed or wrong-length batch in halves, splits long Markdown outside code fences, and lets the test-case warm-up run only after 20 s without foreground requests.
  - Never "polish" translations with blanket regex replacements. Paths, file names, commands, URLs and product names (Claude Code, HyperFrames, …) stay exactly as written, and nothing is applied to untranslated originals. An earlier zh pass that replaced `add`, `init`, `/hyperframes`, `.pptx`, `Claude` and path segments corrupted code and made paths unusable.
  - The status chip `#trStatus` must stay visible and honest: progress `翻译中 N/M`, leftovers `部分未翻译（N）` (click retries). A failure must never look like success.
  - `output/check-translate.mjs` (local; `output/` is git-ignored, like the other check scripts) tests the queue, abort, retries, Markdown split and server hardening with fake backends; run it with `check-reads.mjs` and `check-motion.mjs` after touching translation or the server.
- Two levels (the product's main view): `src/hier.js` turns the uncapped spec (`SV.extract(text, { cap: false })` or a skillflow spec) into an overview and one detail spec per phase, both drawn by the unchanged layout/render. The overview aims for 3–8 main-line nodes: lanes are phases; if fewer than 3, the largest lane is expanded into its steps (a decision stays with its branch targets as one drillable unit); a lane holding more than half the steps is expanded when the total stays ≤ 8, unless its author gave it a `summary:` line; above 8, the smallest adjacent pair is merged. Single-step units are plain cards (click selects); only condensed units drill. References and rules sit in a compact strip below the main line. Detail specs keep the original node ids and use the overview node's colour. URL `#skill=<id>&node=P3`; Back returns to the overview. Checks: `output/check-hier.mjs` (model + sweep over every skill), `check-hier-ui.mjs`, `check-hier-extras.mjs`, `check-hier-export.mjs` (all-levels HTML and video timeline).
- `serve.mjs` serves only `index.html`, `src/`, `docs/`, `output/` and `data/{skills,translations,testcases}.js`; everything else (including `data/ollama.json` with its key, and `.git/`) is 404. Never send the LLM key to the browser.
- Check changes in a headless browser: `npm run scan`, then `node scripts/record.mjs <skill> --seconds 3`, or screenshot through `scripts/lib/cdp.mjs`. For a regression run, push every skill through `SV.extract` → `SV.layout` → `SV.render.toSVG` and make sure nothing throws and no text overflows its card.
- Recording needs a local Chrome / Edge and ffmpeg; set `SV_CHROME` / `SV_FFMPEG` if they are not found.
- Skill sources live in `scripts/lib/channels.mjs`: one row per agent folder, taken from that agent's official docs. To support a new agent, add a row there (user folder, plugin or built-in folder, the env var that moves it) and, if it has a project-level folder, add that to `PROJECT_SKILL_DIRS`. Every `~/` path is tried under each candidate home: the OS home plus the parent of a relocated `CLAUDE_CONFIG_DIR` / `CODEX_HOME`. Folders reached twice through links are read once.
- `scan()` in `scripts/lib/scan.mjs` lists a SKILL.md once by content hash and records the other places in `alsoIn`. Plugin caches keep old versions, so rows marked `versioned` keep only the newest version folder and skip ones with `.orphaned_at`. Keep `idKey` values stable: saved chart edits are keyed by skill id.
- `version()` (the 2-second live-reload check) skips marketplace caches because they are large and rarely change; `serve.mjs` caches the scan by that version. The page folds official, marketplace and built-in groups and does not build their items until opened, so a list of 1,000+ skills stays fast; list descriptions are translated only for groups that are open.
- `scripts/lib/online.mjs` holds the network parts: official repos come as GitHub tarballs read in memory, and only SKILL.md text plus file names are saved (third-party scripts never land on disk); web search merges skills.sh (installs) and claudeskills.info (path, description); a pick is fetched from raw.githubusercontent.com, falling back to the repo tree API to find the folder.
- README hero media: `docs/promo.webp` (the animation shown inline) links to the raw `docs/promo.mp4` (the full video with sound). GitHub never plays a repo MP4: not inline in the README and not in the file view, whatever its size, so the raw link downloads it; an inline player needs the video uploaded through the github.com editor (a `user-attachments` URL). Use animated WebP, not GIF: on the dark Blueprint gradients a 30 s GIF is over 20 MB, while WebP stays under 8 MB with cleaner color. From a 1080p master: `ffmpeg -i master.mp4 -vf "fps=15,scale=960:-1:flags=lanczos" -c:v libwebp -quality 70 -compression_level 6 -loop 0 -an docs/promo.webp` and `ffmpeg -i master.mp4 -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart docs/promo.mp4`.
