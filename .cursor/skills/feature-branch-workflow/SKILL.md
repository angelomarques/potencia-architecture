---
name: feature-branch-workflow
description: >-
  Opt-in stacked feature-branch flow for big features so each PR stays small
  and reviewable. Use only when Ângelo explicitly asks for it on a feature, or
  when the repo enables it with a standalone line `feature-branch-workflow: enabled`
  in AGENTS.md or `.cursor/rules`. Copy, logo, and small fixes stay a single PR to main.
---

# feature-branch-workflow

Ângelo's review flow for **big features**. One long-lived feature branch, then small sub-PRs into that branch. He approves every sub-PR. Nothing merges to `main` or deploys to production without his explicit approval.

## When it applies (opt-in only)

Use this flow only when one of these is true:

1. **Ângelo explicitly asks** for it on this feature, or
2. **The project has it enabled.** A line by itself (not inside a bullet, comment, or this skill) in `AGENTS.md` or a file under `.cursor/rules`:

```
feature-branch-workflow: enabled
```

Add that line to turn the flow on for a repo. Remove it to turn the flow off. Do not invent another switch.

When it is enabled, every **new complex** feature uses this flow. Small or simple changes still use one branch and one PR into `main`: copy edits, logo swaps, small fixes.

This template ships with the switch **off**.

## Flow

### 1. Feature branch off `main`

`<short-name>` is a short kebab-case slug (`billing`, `help-center`).

```bash
git fetch origin main
git checkout main
git pull origin main
git checkout -b feature/<short-name>
git push -u origin feature/<short-name>
```

### 2. Split into sub-tasks and write the checklist

Aim for **small diffs, one concern each**, independently reviewable. Put the breakdown in a tracking issue or a draft PR description:

```bash
gh issue create --title "feature/<short-name>" --body "$(cat <<'EOF'
## Sub-tasks
- [ ] schema — tables and types
- [ ] api — handler for the new shape
- [ ] ui — form wired to the handler

Each sub-task is its own PR into `feature/<short-name>`. Ângelo approves every one.
EOF
)"
```

A draft PR `feature/<short-name>` → `main` can hold the same checklist. Leave it draft until step 6. Do not merge it.

### 3. One branch and one PR per sub-task

Branch from the **latest** feature branch. The PR **base is the feature branch**, not `main`.

```bash
git fetch origin feature/<short-name>
git checkout feature/<short-name>
git pull origin feature/<short-name>
git checkout -b feature/<short-name>/<subtask>
# implement one concern, commit, then:
git push -u origin feature/<short-name>/<subtask>

gh pr create --base feature/<short-name> --head feature/<short-name>/<subtask> \
  --title "feat(<short-name>): <subtask>" \
  --body "What changed, how it was verified, screenshots or video."
```

If a nested ref is awkward, use `feature/<short-name>--<subtask>`. The base is still `feature/<short-name>`.

### 4. Ângelo approves, then squash-merge, then update the rest

He reviews and approves **every** sub-PR. Never merge a sub-PR without his explicit approval (a review or comment that clearly says to merge).

```bash
gh pr merge <number> --squash --delete-branch

git fetch origin feature/<short-name>
git checkout feature/<short-name>/<other>
git rebase origin/feature/<short-name>
git push --force-with-lease
```

Rebase every remaining sub-branch onto the updated feature branch so the next review sees only that sub-task.

### 5. Verify and attach evidence

On **every** sub-PR, scan `.cursor/skills/` for skills whose name or body says **verify** or **prove** (in this template: `verify-potencia-stack`). Run what they require. Package scripts go through **pnpm** (`pnpm doctor`, `pnpm smoke`, `pnpm typecheck`). Never npm or yarn.

Put the result in the PR body and attach evidence: screenshots for UI, a short video when the flow is interactive.

### 6. Feature complete → PR to `main`

When every sub-PR is squash-merged into the feature branch:

1. Tell Ângelo, in the PR and in the handoff, that the feature is complete and waiting for his review.
2. Open the final PR, or mark the draft from step 2 ready. Base is `main`. The body summarizes the feature and **links every sub-PR**.

```bash
gh pr create --base main --head feature/<short-name> \
  --title "feat: <short-name>" \
  --body "$(cat <<'EOF'
## Summary
...

## Sub-PRs
- https://github.com/<owner>/<repo>/pull/11
- https://github.com/<owner>/<repo>/pull/12

Waiting for Ângelo's approval. Do not merge. Do not deploy.
EOF
)"
```

Stop there. Merging to `main` and deploying to production happen only after he approves.

## Model routing

Team policy. The person orchestrating the feature picks where each sub-task runs.

| Sub-task | Where it runs |
|---|---|
| Easy work in an already-structured codebase: logo, text, design tweaks, features that follow an existing pattern | **Antigravity** with **Gemini** models |
| Hard work | **Plan** with **Claude on Antigravity** (planning only; credits are limited). **Implement** with a **Cursor cloud agent** using **Grok** models |
| Everything else | **Cursor cloud agent** with **Grok** models |

The Claude plan must list exact files, data shapes, ordered steps, risks, and how to verify. If Antigravity Claude credits run out, plan and implement with a Cursor cloud agent on Grok models.

**Never use Claude models through Cursor** (cost).

## Stops

- A sub-PR whose base is `main`.
- Merging a sub-PR, merging the feature PR, or deploying to production without Ângelo's explicit approval.
- Packing unrelated concerns into one sub-PR.
- Using this flow for copy, logo, or small fixes unless he asks for it on that change.
