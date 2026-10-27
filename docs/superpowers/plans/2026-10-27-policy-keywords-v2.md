# Policy Keywords V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the approved grouped keyword interface with real extraction, new-term discovery, linked news tags and hourly GitHub updates.

**Architecture:** A deterministic shared keyword engine derives a snapshot-bound public index. The Node build/collection pipeline persists the index and the browser uses the same engine for window statistics and exact keyword filtering. Existing source data and features remain available.

**Tech Stack:** Node22 Intl.Segmenter, React19, TypeScript, Vite8, existing Node test runner.

**Spec:** `docs/v2-design.md`

## Global Constraints

- Every hour (`0 * * * *`), no new service credentials or dependencies.
- Title-only analysis, original publication dates in Asia/Shanghai, no mock data.
- New-term threshold: 3 distinct documents and 2 publishing sources.
- Stable six-domain colors; unknown new terms remain in a separate neutral group.
- Existing Sites deployment is outside this change.

## Review Focus

- Duplicate republications, aliases and repeated words must not inflate counts.
- Missing, invalid and future dates must not enter recent windows.
- New terminology must be discovered outside the seed vocabulary without promoting boilerplate.
- Missing/stale indexes must not display mismatched statistics or break static deployment.
- Filtered lists, saved items, mobile layout and repository-subpath resources must keep working.

### Task 1: Keyword engine and data contract

Files: `lib/keyword-config.mjs`, `lib/keywords.mjs`, `tests/keywords.test.mjs`, `lib/dataset.mjs`.

Interfaces: `buildKeywordIndex(snapshot,{now,previousIndex})`, `keywordOverview(index,params,{days,now})`, `getArticleKeywords(index,id,limit)`, `isKeywordIndexFor(index,snapshot)`. `queryArticles(snapshot,params,limit,index)` adds exact canonical keyword matching.

- [x] Write and run failing tests for aliases, duplicate counts, dates, open-vocabulary discovery, promotion history, boilerplate and exact linked search.
- [x] Implement seed matching, conservative statistical discovery, grouping, snapshot binding and publication-date windows.
- [x] Run `node --test tests/keywords.test.mjs tests/dataset.test.mjs`; expected: all pass.

### Task 2: Hourly pipeline and grouped UI

Files: `scripts/keywords.mjs`, `scripts/build.mjs`, `.github/workflows/update-and-deploy.yml`, `src/data-client.ts`, `src/KeywordPanel.tsx`, `src/Observatory.tsx`, `src/styles.css`, `package.json`.

- [x] Generate and validate the snapshot-bound index after collection and during build; commit both data files in the hourly job.
- [x] Integrate the approved two-column grouped wall, period controls, per-group expansion, new markers, source/date notes and canonical news tags.
- [x] Verify actual root and repository-subpath pages, keyword selection/clear, search/filters, favorites and mobile layout.
- [x] Run `npm test && npm run check && npm run build && npm run verify`; expected: all pass.

### Task 3: Review and delivery

- [x] Review the final diff and data quality, repair important findings and repeat affected checks.
- [x] Update README/VALIDATION with analysis limits, upgrade and hourly refresh behavior.
- [x] Package source as `policy-observatory-github-v2.zip`, exclude Git metadata, dependencies and build output; verify archive and deployment files.

## Execution notes

User approved the selected design and explicitly requested implementation. Proceed without another design approval. The existing local News repository is clean and is the authoritative project; preserve user-added LICENSE and repository history. No push or live Sites update is needed to deliver a reviewable second version.

## Completion evidence

Task 1: complete. Engine and dataset tests passed; discovery was verified outside the seed list and against the real snapshot.

Task 2: complete. 41/41 tests, TypeScript, production build and root/subpath verification passed. Browser QA covered linked search, canonical dates, source filters, saved items, period changes and expansion. Layout is isolated in `src/keywords.css` instead of expanding the existing stylesheet.

Task 3: complete. Fresh independent review received. All 3 Important findings were reproduced with failing tests, fixed and verified passing. No user-facing Minor findings were deferred.

Local repository changes remain uncommitted for the user's GitHub upload workflow. Existing history and LICENSE are retained. The source ZIP excludes Git metadata, local dependencies and build output.
