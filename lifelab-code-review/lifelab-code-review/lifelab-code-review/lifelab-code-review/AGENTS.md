# Life Lab — Repository Instructions

## Project Purpose

Life Lab is a personal digital workspace that preserves learning context across the core flow:

YouTube Video → Timestamp → Note → Task → Daily Plan

It also supports reverse navigation:

Daily Plan → Task → Note → exact YouTube source → original timestamp

Do not change this product model unless the current task explicitly changes an approved requirement.

## Repository Structure

- `frontend/`: React + TypeScript + Vite + Tailwind CSS + Zustand.
- `backend/`: Java 17 + Spring Boot + Spring Data JPA + Spring Security + Flyway + PostgreSQL.
- `docker-compose.yml`: local PostgreSQL.
- Production deployment uses Frontend/Nginx, Spring Boot Backend, and PostgreSQL.

## Architectural Boundaries

### Frontend

- Treat the backend API as the source of truth for business behavior.
- Keep local form/filter state local when it does not need cross-screen coordination.
- Use Zustand for shared state that must coordinate across components/screens.
- Reuse existing semantic theme tokens in `frontend/src/index.css`.
- Preserve the existing Dark/Light theme architecture.
- Prefer existing UI patterns and components over introducing a new design system.
- Presentation-only work must not silently change business behavior.

### Backend

- Preserve the existing Controller → Service → Repository layering.
- Keep DTOs at API boundaries.
- Keep account-scoped data isolation.
- Do not expose or proxy YouTube video streams through the backend.
- YouTube Data API is for source validation/availability/metadata, not video streaming.
- Database changes must use Flyway migrations when explicitly required.

## Business Invariants

Unless the current approved task explicitly changes a requirement, preserve these rules:

- A user's personal data is account-scoped.
- YouTube source data and a user's Library Video are distinct concepts.
- The same YouTube source must not be duplicated in the same account's library.
- Notes preserve the exact YouTube source independently of Library Video deletion.
- A Note timestamp is optional, but the application must not fabricate an unknown timestamp.
- Deleting a Note does not delete linked Tasks; affected Tasks preserve their existence and become source-missing.
- A Task may be independent or originate from a Note.
- Tasks do not invent or substitute a different source when the original source chain is unavailable.
- Daily Plan is derived from Tasks; it is not an independent persisted planning entity.
- Reverse Context follows only the exact known chain and stops where that chain is broken.
- Watch tracking uses actual playing time, not media `currentTime`.
- A valid view follows the existing Watch Session validity policy; do not alter its threshold or counting semantics without an explicit requirement.
- Deleting a Library Video must not automatically delete valuable Notes or Tasks that are required to survive by the existing business rules.

## UI Direction

For UI work, preserve the current direction:

- quiet and content-first;
- context-first;
- progressive disclosure;
- compact cards and controls;
- subtle borders and restrained visual emphasis;
- responsive behavior rather than mechanically shrinking desktop layouts;
- desktop: Sidebar + Topbar + Main Content + contextual Right Workspace;
- smaller screens: Mobile Navigation + Main Content + Right Workspace as a drawer.

Do not add unrelated modules, dashboards, recommendation systems, music/focus systems, custom accent systems, or other features unless the current task explicitly requires them.

## Coding Rules

- Inspect the relevant existing implementation before editing.
- Make the smallest correct change that satisfies the current task.
- Do not perform unrelated refactors.
- Do not add or upgrade dependencies unless the task clearly requires it.
- Do not change API contracts, database schema, authentication behavior, business rules, or route semantics unless explicitly required.
- Do not guess missing requirements. Report the ambiguity instead.
- Preserve existing error handling and accessibility patterns unless the task explicitly improves them.
- For shared behavior, check callers/dependencies before changing a shared symbol.
- Use GitNexus for dependency/impact analysis when it reduces uncertainty; do not use it as a mandatory ritual for trivial edits.

## GitNexus Usage

This repository may be indexed by GitNexus.

Use GitNexus when useful for:
- locating unfamiliar execution flows;
- understanding callers/callees of shared symbols;
- checking blast radius before changing shared services/stores/APIs;
- reviewing the impact of non-trivial changes.

Normal repository search is preferable for simple text, CSS, isolated component, or known-file changes.

If GitNexus reports that the index is stale, stop relying on graph results until the index is refreshed.

## Validation

Use validation proportional to the task.

### Frontend

From `frontend/`:

```bash
npm run lint
npm run build
```

The combined project script is:

```bash
npm run check
```

For visual/frontend tasks, manual browser review may still be required after automated checks.

### Backend

From `backend/` on Windows:

```powershell
.\mvnw.cmd test
```

On macOS/Linux:

```bash
./mvnw test
```

Use broader verification only when the task's blast radius justifies it.

### Full-stack / database work

When needed, local PostgreSQL is available through the root `docker-compose.yml`.

Do not run broad or destructive validation automatically when a narrower check is sufficient.

## Definition of Done

A task is implementation-complete when:

- the approved current requirement is implemented;
- behavior outside the task scope is preserved;
- relevant validation passes or any validation limitation is clearly reported;
- no unrelated feature/refactor/dependency/schema/API change was introduced;
- manual checks that cannot be reliably automated are listed for the user;
- the implementation result is returned to the Project Chat for final PASS / NOT PASS review.

## Scope Authority

The current task packet/prompt defines temporary task scope.

This file defines stable repository rules.

If a task prompt conflicts with an approved business requirement or creates ambiguity about changing a stable invariant, do not silently choose a new product decision. Report the conflict so it can be resolved in the Project Chat.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **life-lab** (3092 symbols, 9408 relationships, 258 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/life-lab/context` | Codebase overview, check index freshness |
| `gitnexus://repo/life-lab/clusters` | All functional areas |
| `gitnexus://repo/life-lab/processes` | All execution flows |
| `gitnexus://repo/life-lab/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
