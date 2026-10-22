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

- **Double-click `start.bat`**: starts a local server and opens the browser. The list holds this repo's `skills/` and `examples/`, every agent's installed skills on the machine, the skills inside the projects next to this repo, the official libraries once downloaded, and the agents' marketplace caches (folded). It redraws within 2 seconds after a SKILL.md changes. Same as `npm start`; `npm run start:project` lists only the repo's own skills. `npm run stop` stops it (`-- --port N` for another port, `-- --all` for 5178–5199): it asks `GET /api/pid` and only kills a process that answers as SkillLens, so another app on the port is safe.
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

- For alternatives, use consecutive sibling headings with a shared label (`Recipe — …`, `Option A: …`, `方案一：…`); optionally put a `Which …` heading and a situation → tool/approach table immediately before them. They chart as one choice whose branches rejoin the next step; keep cost, caching and limitations in separate background sections.

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

- AI flow parsing: `scripts/lib/aiflow.mjs` first plans execution phases, then extracts each flow phase separately through the shared high-priority model queue. Exact source quotes are verified deterministically; an invalid phase gets one retry, then rule-based extraction. Finished specs are merged atomically into `data/aiflow.json`. Use `POST /api/aiflow` (with `peek` for cache-only lookup), `GET /api/aiflow?key=…` for progress, or `npm run aiflow -- <name-or-id> [--force]`. `output/check-aiflow.mjs` exercises fake model responses, verification, fallback, assembly, cache and API behavior. Saved Structure edits take precedence; the header switches between Rules and AI per skill.
  - On a local model serving one request at a time a skill takes 2–5 minutes (one call per phase), so results are cached and the page shows progress. Phase splits vary a little between runs. A high quote ratio proves each card has evidence, not that every branch was found.
  - Clean model output in code, not by prompting harder: `next` / `end` written as exit text become edges, incomplete decisions stay decisions for verification/repair, and rules written as paragraphs count one note per paragraph. Preserve labelled decision end outcomes as exits rather than folding them into an unconditional terminal flag.
  - Pass 2 sees one phase only, so most early benchmark failures were the pipeline losing correct answers, not the model: lines left between pass-1 ranges join the neighbouring flow phase; exits that name a node or "step N" in another phase become edges (unclear ones stay stubs); a phase loop from pass 1 replaces pass 2's local guess; a skill with no workflow finishes with `ai.noWorkflow`. Look at the raw model answers before blaming the model.
  - Execution can live outside a workflow heading: prerequisite reads, environment probes, numbered verification procedures and stop/ask guards belong in flow. After planning, a deterministic filter nominates up to 60 uncovered executable lines (excluding code, reference tables and pure prohibitions); one small model call assigns real actions to phase starts/ends. Pass 2 gets those original lines explicitly, with exact quote verification; `ai.verify.sweep` records candidates, accepted lines and elapsed time. Compression preserves stronger executable lines and their action clauses, including instructions directly after headings.
  - Branches need their own verification: check each phase and the assembled graph for missing/duplicate outcomes, identical targets, stop/ask guards without an exit, incomplete state routers and missing sweep decisions (`ai.verify.contract`). One global multiple-choice call repairs up to 15 decisions, prioritising contract violations and then unverified next-node targets. Give exact decision lines plus separate context and all node candidates; accept copied evidence only from the decision lines. Replace a decision atomically, require explicit repeat evidence for backward edges, retain rejected/untouched edges, and record timing, rejections and before/after snapshots in `ai.verify.branchPass`. Quote evidence proves source grounding, not correct target choice; compare saved pre-repair and post-repair graphs with the same bounded-path scorer to measure gains and regressions.
  - Preserve each decision's condition/action clause when several decisions share a paragraph. A copied condition alone does not establish the chosen destination, and a nearby checklist does not establish router states. Track evidence rejections and repair budget spent on unannotated guards. An outcome-only repair cannot recover missing decision nodes; source anchors and executable-item coverage need separate checks. Attached sweep lines must supply their original text to per-phase contracts too.
  - Score branch detail paths with a bound, not whole-graph reachability: at most three edges through verified unannotated/optional nodes or clauses on the same decision's source lines. Another required action or main-line decision blocks the path; `next` is immediate and an exit cannot silently continue. Shared source lines need outcome discrimination. Normalize line endings and privacy redaction on both sources, then check the whole annotated range before diagnosing a planning miss; always re-score saved output with the current rule. Pin benchmark source hashes across installed-skill updates and explain source-backed gold corrections separately from scorer improvements.
  - Strict benchmark (local, git-ignored, `output/aiflow-bench/`): hand-written gold for 10 real + 8 synthetic skills, scored by source line (step/decision/branch recall, precision, forbidden lines, invented loops, order); `run.mjs --runs 3` runs the model (~2 h), `--replay` re-scores saved answers after a code change in minutes. Gold changes need a source-backed reason in `gold/CHANGES.md`. The latest aiflow-5 live batch with the 27B model passed 6/8 synthetic and 0/20 real runs; same-graph repair gained two real gold branches without improving strict passes. See `output/aiflow-bench/task-g/measurement.md`; treat AI charts as drafts.

- Layers: `markdown.js` parses → `extract.js` / `dsl.js` build the structure → `layout.js` places cards and routes lines → `render.js` draws the SVG and plays it → `app.js` is the UI. All UI and chart strings live in `i18n.js`; add every key in both `en` and `zh`.
- Alternative groups stay atomic in `hier.js`; a lone choice with at most eight nodes is visible in the overview, larger choices drill into their router and whole-section cards. Run `output/check-alternatives.mjs` and the all-skill sweep in `output/check-hier.mjs` after changing these rules.
- The page must open by double-click, so it uses plain `<script>` tags, no ES modules. Each script is written as `SV.mod.name = function (SV) {…}` so the standalone export can inline the code with `toString()`.
- Every frame must be a pure function of time t (no CSS animation, `Math.random` or wall clock), or frame-by-frame video recording breaks.
- Themes: `light` (cream 3D, default), `dark` and `blueprint` (`?theme=`). Chart colors are in `THEMES` in `render.js`, UI colors in the CSS variables at the top of `style.css`; change both together. Blueprint-only details (grid, rulers, corner ticks, card numbers, amber active step) are behind `P.blueprint`.
- Fonts: Noto Sans SC (Chinese), Inter (Latin), JetBrains Mono (tags and paths) from Google Fonts, falling back to system fonts offline. Layout measures text with a canvas, so it must wait for fonts: `app.js` clears the measure cache and redraws on `loadingdone`, and record mode plus the standalone export call `document.fonts.load` for the chart's text first. Keep the font link in `index.html`, `FONT` / `MONO` in `layout.js` and the link in the standalone template in sync.
- Plain-language explanation comes before translation. Many skills are AI-written and messy, so translating their sentences is not enough; good expression is the base of a good skill and of this app. `scripts/lib/explain.mjs` (`/api/explain`) and `src/explain.js` rewrite the visible level in the UI language:
  - the skill: what it does, when to use it, what you get;
  - each card: a verb-object title and one line that fits without "…";
  - each step: what happens, why, watch out;
  - decisions: clear questions.
  - It must stay faithful: no new steps, numbers or tools, and backticked names must appear in the node's source (checked in code). It retries once, then falls back to translation for that node. Results are cached in `data/explain.json` per 12-node chunk.
  - The page asks for the visible level first and sends only uncovered strings to translation. The panel toggles 「通俗讲解 / 原文措辞」, and the original stays one click away. The detail view reuses the overview's explained phase name for its title and lane, so one phase never has two names.
  - Test: `output/check-explain.mjs` (fake LLM).
  - An enumeration in the source (states, categories) drawn as steps by the rules extractor still looks like steps after explanation; that is a structure problem for the extractor or AI parsing, not something the explanation can fix.
- Auto-translation: `scripts/lib/translate.mjs` (server, `/api/translate`) and `useTranslation` / `graphPass` in `src/app.js` (which strings on the chart get translated). Only chart text and opened source text are translated; tags, file names, paths and Yes / No are kept. Backend order: an OpenAI-compatible LLM from the git-ignored `data/ollama.json` (or `SV_LLM_URL` / `SV_LLM_MODEL` / `SV_LLM_KEY`), then the Anthropic SDK when an API key is set, else the local Claude Code CLI (on Windows call `node_modules/@anthropic-ai/claude-code/bin/claude.exe` directly to avoid `.cmd` quoting). The cache key is `lang + \u0001 + text` on both sides.
  - A local LLM may serve one request at a time (the LAN vLLM did: ~6 s per 15 short strings, no gain from parallel calls). So speed comes from order, not concurrency: the page sends ≤15 strings per request in visual priority (titles first), redraws after each, and aborts its old request when the skill or language changes; the server runs the newest request first, drops batches of aborted requests, retries a failed or wrong-length batch in halves, splits long Markdown outside code fences, and lets the test-case warm-up run only after 20 s without foreground requests.
  - Never "polish" translations with blanket regex replacements. Paths, file names, commands, URLs and product names (Claude Code, HyperFrames, …) stay exactly as written, and nothing is applied to untranslated originals. An earlier zh pass that replaced `add`, `init`, `/hyperframes`, `.pptx`, `Claude` and path segments corrupted code and made paths unusable.
  - The status chip `#trStatus` must stay visible and honest: progress `翻译中 N/M`, leftovers `部分未翻译（N）` (click retries). A failure must never look like success.
  - `output/check-translate.mjs` (local; `output/` is git-ignored, like the other check scripts) tests the queue, abort, retries, Markdown split and server hardening with fake backends; run it with `check-reads.mjs` and `check-motion.mjs` after touching translation or the server.
- Two levels (the product's main view): `src/hier.js` turns the uncapped spec (`SV.extract(text, { cap: false })` or a skillflow spec) into an overview and one detail spec per phase, both drawn by the unchanged layout/render. The overview aims for 3–8 main-line nodes: lanes are phases; if fewer than 3, the largest lane is expanded into its steps (a decision stays with its branch targets as one drillable unit); a lane holding more than half the steps is expanded when the total stays ≤ 8, unless its author gave it a `summary:` line; above 8, the smallest adjacent pair is merged. Single-step units are plain cards (click selects); only condensed units drill. The overview draws only the trigger and the main line: reference and rules phases (`kind` `ref` / `notes`) have no lines to the main line, so they stay in `phases` and are listed in the right panel under "References & rules" (click opens their detail, which is always drillable when non-empty); a skill with no main line at all still gets the compact strip so the overview is not empty. A phase detail keeps the reference files that phase reads (the `__refs` lane with dotted read lines). The all-levels video covers the overview and drillable main-line phases only; the all-levels web page reaches reference / rules details through buttons at the bottom left of the overview. Detail specs keep the original node ids and use the overview node's colour. URL `#skill=<id>&node=P3`; Back returns to the overview. Checks: `output/check-hier.mjs` (model + sweep over every skill), `check-hier-ui.mjs`, `check-hier-extras.mjs`, `check-hier-export.mjs` (all-levels HTML and video timeline).
- `serve.mjs` serves only `index.html`, `src/`, `docs/`, `output/` and `data/{skills,translations,testcases}.js`; everything else (including `data/ollama.json` with its key, and `.git/`) is 404. Never send the LLM key to the browser.
- Check changes in a headless browser: `npm run scan`, then `node scripts/record.mjs <skill> --seconds 3`, or screenshot through `scripts/lib/cdp.mjs`. For a regression run, push every skill through `SV.extract` → `SV.layout` → `SV.render.toSVG` and make sure nothing throws and no text overflows its card.
- Recording needs a local Chrome / Edge and ffmpeg; set `SV_CHROME` / `SV_FFMPEG` if they are not found.
- Skill sources live in `scripts/lib/channels.mjs`: one row per agent folder, taken from that agent's official docs. To support a new agent, add a row there (user folder, plugin or built-in folder, the env var that moves it) and, if it has a project-level folder, add that to `PROJECT_SKILL_DIRS`. Every `~/` path is tried under each candidate home: the OS home plus the parent of a relocated `CLAUDE_CONFIG_DIR` / `CODEX_HOME`. Folders reached twice through links are read once.
- `scan()` in `scripts/lib/scan.mjs` lists a SKILL.md once by content hash and records the other places in `alsoIn`. Plugin caches keep old versions, so rows marked `versioned` keep only the newest version folder and skip ones with `.orphaned_at`. Keep `idKey` values stable: saved chart edits are keyed by skill id.
- `version()` (the 2-second live-reload check) skips marketplace caches because they are large and rarely change; `serve.mjs` caches the scan by that version. The page folds official, marketplace and built-in groups and does not build their items until opened, so a list of 1,000+ skills stays fast; list descriptions are translated only for groups that are open.
- `scripts/lib/online.mjs` holds the network parts: official repos come as GitHub tarballs read in memory, and only SKILL.md text plus file names are saved (third-party scripts never land on disk); web search merges skills.sh (installs) and claudeskills.info (path, description); a pick is fetched from raw.githubusercontent.com, falling back to the repo tree API to find the folder.
- README hero media: `docs/promo.webp` (the animation shown inline) links to the raw `docs/promo.mp4` (the full video with sound). GitHub never plays a repo MP4: not inline in the README and not in the file view, whatever its size, so the raw link downloads it; an inline player needs the video uploaded through the github.com editor (a `user-attachments` URL). Use animated WebP, not GIF: on the dark Blueprint gradients a 30 s GIF is over 20 MB, while WebP stays under 8 MB with cleaner color. From a 1080p master: `ffmpeg -i master.mp4 -vf "fps=15,scale=960:-1:flags=lanczos" -c:v libwebp -quality 70 -compression_level 6 -loop 0 -an docs/promo.webp` and `ffmpeg -i master.mp4 -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart docs/promo.mp4`.
