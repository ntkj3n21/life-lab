# Life Lab — Repository Instructions

## Project Purpose

Life Lab is a personal digital workspace that preserves learning context across media.

The established V1 flow is:

YouTube Video → Timestamp → Note → Task → Daily Plan

V2 may extend the same provenance model to approved media types such as Audio and Image without rewriting the existing YouTube domain.

Reverse navigation must preserve the exact recorded source context:

Daily Plan → Task → Note → exact original media source → original timestamp when the media type supports timestamps.

YouTube V1 behavior remains authoritative unless an approved task explicitly extends a requirement.

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
- Prefer additive integration with existing modules over broad frontend rewrites.
- Shared components must preserve the behavior of existing callers unless the current task explicitly changes it.

### Backend

- Preserve the existing Controller → Service → Repository layering.
- Keep DTOs at API boundaries.
- Keep account-scoped data isolation.
- Use Flyway migrations for database schema changes.
- Do not expose or proxy YouTube video streams through the backend.
- YouTube Data API is for source validation, availability, and metadata, not video streaming.
- Do not proxy, mirror, or download arbitrary external media unless the current approved task explicitly requires it.
- Keep media-source persistence additive. Do not force unrelated media types into one persistence model solely for abstraction consistency.
- Prefer preserving existing domain boundaries over introducing a repository-wide generic media abstraction.

## Business Invariants

Unless the current approved task explicitly changes a requirement, preserve these rules.

### Account Isolation

- A user's personal data is account-scoped.
- Reads, mutations, media access, organization data, and source relationships must not leak across accounts.
- Account-scoped uploaded media must not be accessible through arbitrary public filesystem paths.

### Source and Library Semantics

- Source identity and a user's Library membership are distinct concepts.
- YouTube source data and a user's Library Video are distinct concepts.
- The same YouTube source must not be duplicated in the same account's Library.
- Removing a media item from the Library must not destroy source data still required by surviving Notes or Tasks.
- New media support must preserve this distinction where source provenance must survive Library removal.

### Notes

- Notes preserve the exact media source they were created from.
- Existing YouTube Notes must continue to preserve the exact YouTube source independently of Library Video deletion.
- Do not substitute another, similar, replacement, or inferred source when the recorded source is unavailable.
- A Note timestamp is optional where the media type supports timestamps.
- The application must never fabricate an unknown timestamp.
- YouTube and Audio may support an exact timestamp.
- Image does not have timestamp semantics.
- A missing timestamp is represented as missing/null, not automatically as zero.
- Deleting a Note does not delete linked Tasks.
- Tasks affected by Note deletion preserve their existence and follow the existing source-missing behavior.

### Tasks

- A Task may be independent or originate from a Note.
- Existing Task source states remain authoritative:
  - `INDEPENDENT`
  - `HAS_SOURCE`
  - `SOURCE_MISSING`
- Tasks do not invent or substitute a different source when the original source chain is unavailable.
- A Task created from a Note follows that exact Note relationship.
- Media-type awareness should normally be resolved through the Note/source chain rather than duplicated into unrelated Task concepts unless explicitly required.

### Daily Plan

- Daily Plan is derived from Tasks.
- Daily Plan is not an independent persisted planning entity.
- Do not introduce a Daily Plan table or independent lifecycle unless explicitly approved.
- Existing grouping and Task execution semantics must remain unchanged unless the current task explicitly changes them.

### Reverse Context

- Reverse Context follows only the exact known relationship chain.
- Reverse Context stops where that exact chain is broken.
- Do not navigate to a similar, replacement, recommended, or inferred source.
- When the source supports timestamps, reverse navigation must restore the recorded timestamp when available.
- When the media type does not support timestamps, reverse navigation must restore the exact source without fabricating timestamp context.

### YouTube and Watch Sessions

- Existing YouTube V1 behavior remains authoritative unless explicitly extended.
- Watch tracking uses actual playing time, not media `currentTime`.
- A valid view follows the existing Watch Session validity policy.
- Do not alter Watch Session thresholds, counting semantics, or session lifecycle without an explicit requirement.
- New Audio or Image support must not silently reuse or alter YouTube Watch Session semantics.
- Deleting a Library Video must not automatically delete valuable Notes or Tasks that existing business rules require to survive.

### Multimedia Extension Rules

- Audio and Image support must be additive.
- Do not perform a repository-wide `Video → Source` rename or abstraction unless explicitly approved.
- Generalize only the relationships that actually need to support multiple media types.
- Do not create duplicated Note or Task systems such as `AudioNote`, `ImageNote`, `AudioTask`, or `ImageTask` unless an approved requirement explicitly requires separate domains.
- Preserve exact provenance regardless of whether media was added by URL, upload, or another approved discovery mechanism.
- External media URLs are references unless the current task explicitly requires local persistence.
- Uploaded media must be handled as account-scoped application data.
- Uploaded media must not expose arbitrary filesystem paths.
- Generated storage identifiers should be preferred over trusting user-provided filenames for storage paths.

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

Prefer existing interaction patterns before introducing new UI primitives.

Organization, media, filtering, and source controls should remain secondary to the user's content.

Do not add unrelated modules, dashboards, recommendation systems, music/focus systems, custom accent systems, AI features, collaboration systems, or other features unless the current task explicitly requires them.

## Coding Rules

- Inspect the relevant existing implementation before editing.
- Make the smallest correct change that satisfies the current task.
- Start implementation once the required context is established.
- Do not perform unrelated refactors.
- Do not rewrite architecture solely for conceptual cleanliness.
- Do not add or upgrade dependencies unless the task clearly requires it.
- Do not change API contracts, database schema, authentication behavior, business rules, or route semantics unless explicitly required.
- Do not guess missing requirements. Report the ambiguity instead.
- Preserve existing error handling and accessibility patterns unless the task explicitly improves them.
- Preserve existing naming and domain terminology unless an approved task explicitly changes it.
- For shared behavior, inspect relevant callers/dependencies before changing a shared symbol.
- Preserve unrelated working-tree changes.
- Do not discard, reset, checkout, clean, stash, overwrite, or delete unrelated user changes.
- If a target file already contains unrelated user edits, make the smallest compatible patch around them.
- Do not create commits unless the current task explicitly asks for one.

## GitNexus Usage

This repository may be indexed by GitNexus.

GitNexus is a just-in-time dependency and impact-analysis aid. It is not a mandatory ritual for every edit.

Use GitNexus when it materially reduces uncertainty, especially for:

- locating unfamiliar execution flows;
- understanding callers and callees of shared symbols;
- checking blast radius before changing shared services, stores, APIs, DTOs, or lifecycle behavior;
- reviewing the impact of non-trivial backend/domain changes;
- understanding cross-module dependencies;
- investigating behavior where direct repository inspection does not establish the dependency surface confidently.

Normal repository inspection/search is preferable for:

- known-file changes;
- isolated components;
- simple API wiring;
- CSS or presentation-only changes;
- obvious local dependencies;
- small deterministic patches.

For non-trivial shared changes, use the narrowest useful GitNexus query rather than broad repository exploration.

A HIGH or CRITICAL impact result is a signal to inspect the affected execution paths carefully. It does not automatically authorize broader refactoring.

If GitNexus reports that its index is stale:

- stop relying on stale graph results;
- refresh the index only when the current task materially benefits from graph analysis;
- a stale GitNexus index does not block a task whose edit surface and dependencies can be established safely through direct repository inspection.

Do not regenerate, overwrite, replace, or modify `AGENTS.md` as part of GitNexus indexing, analysis, setup, or maintenance.

`AGENTS.md` is manually maintained by the project owner and is authoritative repository instruction.

## Validation

Use validation proportional to the task.

Executors should run only targeted validation directly relevant to changed code unless the current task explicitly requests broader validation.

Do not automatically run broad or expensive validation when a narrower check is sufficient to establish correctness.

Full repository validation may be performed separately by the project owner and must not be treated as a mandatory executor step for every task.

### Targeted Validation

Prefer the narrowest validation that exercises the changed behavior.

Examples include:

- focused backend tests for changed controllers/services/repositories;
- focused integration tests for changed API contracts;
- focused frontend type/component checks when available;
- manual browser verification for behavior that cannot be reliably validated automatically.

Expand validation only when the task's blast radius justifies it.

### Full Frontend Validation Reference

From `frontend/`:

```bash
npm run lint
npm run build
```
