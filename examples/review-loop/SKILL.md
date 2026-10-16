---
name: review-loop
description: Example skill for SkillLens. Reviews a pull request with automated checks, an AI review pass and a final human decision. Use it to see how a skillflow block pins the exact chart.
---

# PR Review Loop

This example shows every element SkillLens can draw: a trigger, swimlanes, decisions with a branch exit, a loop back, notes and an end step. The `skillflow` block below pins the chart exactly; without it, SkillLens extracts the flow from the Workflow section on its own.

```skillflow
title: PR Review Loop
subtitle: Checks run first · AI reviews the diff · a human makes the call
hero: Review loop | checks · AI review · human gate
window: skills / review-loop / SKILL.md
footer: SkillLens example · icons Lucide (ISC)

trigger start: New pull request [pull_request] {git-pull-request}
  opened or updated
  wakes the review loop

lane checks: Automated checks [CI] (green)
  step lint: Lint and test [ci] {terminal}
    run the full test suite
    collect the failures
  decide pass: Checks pass? [checks?]

lane review: AI review [AI] (blue)
  step read: Read the diff [diff] {file-search}
    changed files only
    load the context
  step judge: Weigh the risk [risk] {scan-eye}
    bugs · security · style
    flag what matters
  step write: Write the review [review] {file-text}
    inline comments
    one clear summary
  note: No changes needed → approve with a short note
  note: Reviewer asks for changes → back to the AI pass
  note: Nothing new on the branch → nothing runs

lane gate: Human gate [you] (purple)
  step look: Read the summary [panel] {eye}
    one screen per PR
    approve or push back
  decide ok: Approve? [approve?]
  step ship: Merge and release [merge] {rocket} +end
    squash and merge
    tag the release

flow:
  start -> lint -> pass
  pass -> read : Yes
  pass -> "Fix and push again" : No
  read -> judge -> write -> look -> ok
  ok -> ship : Yes
  ok ~> read : No · revise
  ship ~> start : next PR
```

## Workflow

1. **Lint and test**: run the full suite on every push.
2. **Read the diff**: if the checks fail, stop and ask the author to fix and push again.
3. **Weigh the risk**: look for bugs, security issues and style problems.
4. **Write the review**: inline comments plus one short summary.
5. **Human gate**: approve to merge, or send it back; go back to step 2 until approved.

## Rules

- Never merge with failing checks.
- The AI review never pushes commits; it only comments.
