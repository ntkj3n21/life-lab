# Life Lab — Repository Instructions

## Project Purpose

Life Lab is a personal digital workspace for turning information from digital media into durable knowledge and action while preserving exact source context.

Primary target users are students and self-directed learners who regularly learn or work from digital media. The broader product direction also supports knowledge workers with the same need:

`information / media → capture → knowledge → action → context recovery`

Life Lab must not be hard-coded as a school-only product.

The established product loop is:

`Media / Source → Capture → Note → Task → Daily Plan`

Reverse context is equally important:

`Task / Note → exact recorded Source`

When a source supports timestamps, the recorded timestamp may be restored. When it does not, the application must restore the exact source without inventing timestamp context.

Supported media domains are established, not hypothetical:

- Video / YouTube
- Image
- Audio

Keep their Library experiences separate unless an approved task explicitly changes that decision. Do not introduce a Unified Library merely for abstraction consistency.

Do not change this product model unless the current approved task explicitly changes a locked requirement.

## Repository Structure

- `frontend/`: React + TypeScript + Vite + Tailwind CSS + Zustand.
- `backend/`: Java 17 + Spring Boot + Spring Data JPA + Spring Security + Flyway + PostgreSQL.
- `docker-compose.yml`: local PostgreSQL.
- Production deployment uses Frontend/Nginx, Spring Boot Backend, and PostgreSQL.

## Architectural Boundaries

### Frontend

- Treat the backend API as the source of truth for business behavior and persisted state.
- Keep local form/filter/dialog state local when it does not need cross-screen coordination.
- Use Zustand for shared state that must coordinate across components/screens.
- Reuse existing semantic theme tokens in `frontend/src/index.css`.
- Preserve the existing Dark/Light theme architecture.
- Prefer existing UI patterns, dialog shells, cards, controls, and responsive conventions over introducing a new design system.
- Presentation-only work must not silently change business behavior.
- Prefer additive integration with existing modules over broad frontend rewrites.
- Shared components must preserve existing caller behavior unless the current task explicitly changes it.
- Keep source-aware Right Workspace state synchronized with the active route/source.
- Main-pane tools such as list filters must not accidentally behave like Right Workspace content.

### Backend

- Preserve the existing Controller → Service → Repository layering.
- Keep DTOs at API boundaries.
- Keep all personal data and personal organization account-scoped.
- Use Flyway migrations for database schema changes.
- Do not expose JPA entities directly when the existing API uses DTOs.
- Do not expose or proxy YouTube video streams through the backend.
- YouTube Data API is for source validation, availability, and metadata, not video streaming.
- Do not proxy, mirror, or download arbitrary external media unless the current approved task explicitly requires it.
- Keep media-source persistence additive. Do not force unrelated media types into one persistence model solely for abstraction consistency.
- Prefer preserving existing domain boundaries over introducing a repository-wide generic media abstraction.

## Business Invariants

Unless the current approved task explicitly changes a requirement, preserve the following rules.

### Account Isolation

- A user's personal data is account-scoped.
- Reads, mutations, search results, media access, organization data, metadata, and source relationships must not leak across accounts.
- IDs supplied by the client must not be trusted as proof of ownership.
- Account-scoped uploaded media must not be accessible through arbitrary public filesystem paths.
- Personal Tags, Categories, editable metadata, and Library membership must remain isolated by account.

### Source and Library Semantics

- Source identity and a user's Library membership are distinct concepts.
- A Source represents the media identity/provenance needed for exact context recovery.
- A Library membership represents a user's relationship to that source.
- Personal organization or editable metadata must not be moved onto globally shared Source identity merely for convenience.
- Removing an item from a user's Library must not destroy source data still required by surviving Notes or Tasks.
- Do not replace a missing Source with a similar, recommended, inferred, or newly discovered Source.
- Preserve original source metadata such as URL, provider identity, uploaded-file identity, and provenance even when a user adds personal display metadata.

### Personal Media Metadata

When a media type supports editable personal metadata:

- personal/custom title and personal description belong to the account-owned Library side of the model unless the current architecture explicitly establishes another account-safe boundary;
- editing personal metadata must not mutate the original Source identity;
- title fallback behavior must remain deterministic;
- description remains optional unless an approved requirement explicitly changes that rule.

Do not create transcript, summary, AI metadata, or other derived fields unless an approved task explicitly requires them.

### Notes

- Notes preserve the exact media Source they were created from.
- A Note must continue to preserve its exact Source even if that Source is later removed from the user's Library.
- Do not substitute another, similar, replacement, recommended, or inferred Source.
- A Note timestamp is optional where the media type supports timestamps.
- The application must never fabricate an unknown timestamp.
- Video/YouTube and Audio may support exact timestamp context according to their established contracts.
- Image has no timestamp semantics.
- Missing timestamp is represented as missing/null, not automatically as zero.
- Deleting a Note does not delete linked Tasks.
- Tasks affected by Note deletion preserve their existence and follow the existing `SOURCE_MISSING` behavior.
- Quick Note capture is content-first. Do not require Category or Tags before the Note can be saved unless explicitly approved.

### Tasks

- A Task may be independent or originate from a Note.
- Existing Task source states remain authoritative:
  - `INDEPENDENT`
  - `HAS_SOURCE`
  - `SOURCE_MISSING`
- Tasks do not invent or substitute a different source when the original source chain is unavailable.
- A Task created from a Note follows that exact Note relationship.
- Note → Create Task must preserve the exact Note/source context and must not silently switch to another active Source.
- Media-type awareness should normally be resolved through the Note/source chain rather than duplicated into unrelated Task concepts unless explicitly required.

### Daily Plan

- Daily Plan is derived from Tasks.
- Daily Plan is not an independent persisted planning entity.
- Do not introduce a Daily Plan table, manual membership field, pin-to-today state, or independent lifecycle unless explicitly approved.
- Daily Plan should act as a review/action view over Task state, not as a second general Task-management database.
- Preserve the established semantic groups such as Today, Overdue, Upcoming, No deadline, and Completed unless the current task explicitly changes them.
- Do not add Focus Today or a new planning domain merely as a UI shortcut unless explicitly approved.

### Reverse Context

- Reverse Context follows only the exact known relationship chain.
- Reverse Context stops where that exact chain is broken.
- Do not navigate to a similar, replacement, recommended, or inferred source.
- When the source supports timestamps, reverse navigation restores the recorded timestamp when available.
- When the source does not support timestamps, reverse navigation restores the exact source without fabricating timestamp context.

### Video / YouTube and Watch Sessions

- Existing Video/YouTube Watch Session behavior remains authoritative unless explicitly extended.
- Watch tracking uses actual playing time, not media `currentTime` alone.
- A valid view follows the existing Watch Session validity policy.
- Do not alter Watch Session thresholds, counting semantics, or session lifecycle without an explicit requirement.
- Watch status and Watch Session semantics are Video-only unless an approved requirement explicitly extends them.
- Image and Audio must not silently reuse Video Watch Session semantics.
- Removing a Library Video must not automatically delete valuable Notes or Tasks that existing business rules require to survive.

### Image

- Image is a first-class Source type.
- Image Notes do not have timestamp semantics.
- Image must not gain Video watch state merely for UI consistency.
- Preserve whether an Image came from upload or an approved external reference when that origin exists in the current domain.
- Uploaded Image data remains account-scoped application data.

### Audio

- Audio is a first-class Source type.
- Preserve the established Audio timestamp/playback contract.
- Audio must not gain Video watch state merely for UI consistency.
- Preserve original upload/external source identity and playback data when personal metadata is edited.
- Duration-based behavior may be used only when duration data is reliable in the current domain.

## Organization Semantics

Category and Tags are related but distinct concepts. Do not merge them into one domain merely to simplify UI code.

### Category

- Category is a broad primary grouping for Notes and Tasks.
- A Note/Task has at most one selected Category under the established model.
- Do not add Category directly to media Library items unless an approved task explicitly requires it.

### Tags

- Tags are reusable, flexible, many-valued labels.
- A Note/Task may have multiple Tags.
- Media Library items may use the same personal Tag catalog where approved by the current product requirements.
- Do not create separate user-facing VideoTag/ImageTag/AudioTag taxonomies when one reusable personal Tag domain is sufficient.
- Tag assignment and Tag catalog management are different interactions.

### Assign vs Manage

- `Organize` means assigning Category/Tags to the current Note or Task.
- Managing reusable Categories/Tags means creating, renaming, or deleting catalog values.
- Keep item-level assignment separate from global catalog management.
- Filters consume Category/Tags; filter UIs should not become the primary CRUD surface for those catalogs.

## Library and Search Direction

The media Libraries should share a recognizable interaction foundation without becoming mechanically identical.

Common concepts may include:

- search;
- media-appropriate filters;
- sort;
- personal Tags;
- pagination;
- add/find actions;
- exact Source opening;
- account-safe personal metadata.

Keep media-specific behavior media-specific:

- Video may expose Watch status, watch-derived views, duration, and other Video-specific filters.
- Image must not expose Watch status.
- Audio must not expose Watch status.
- Do not add meaningless Video concepts to Image/Audio just for visual symmetry.

When implementing or modifying user-facing Library search, preserve the approved search direction:

- case-insensitive matching;
- Vietnamese accent-insensitive matching;
- intentional handling of `đ` / `Đ` normalization;
- practical partial/substring matching;
- search over meaningful user-facing metadata such as effective title and personal description where those fields exist.

Do not introduce fuzzy typo correction, similarity ranking, semantic/AI search, or recommendation behavior unless an approved task explicitly requires it.

For live search UI, prefer debounced requests rather than one backend request per keystroke, and prevent stale responses from replacing newer results.

## UI / UX Direction

Preserve these V3 product principles:

1. User language over system language.
2. Capture fast, organize later.
3. Context must survive.
4. Primary action first.
5. Progressive disclosure.
6. Recoverable by default.
7. Automation assists; the user decides.

For UI work:

- keep the experience quiet, content-first, and context-first;
- keep cards and controls compact;
- use subtle borders and restrained visual emphasis;
- prefer user-facing wording over internal enum/database terminology;
- separate primary workflow actions from secondary management actions;
- use progressive disclosure for advanced filters/options;
- prefer responsive reflow over mechanically shrinking desktop layouts;
- desktop: Sidebar + Topbar + Main Content + contextual Right Workspace;
- smaller screens: Mobile Navigation + Main Content + Right Workspace as a drawer;
- preserve keyboard focus, labels, error states, dialog behavior, and accessible semantics when changing interactions.

Organization, media, filtering, sorting, and source-management controls should remain secondary to the user's actual content/work.

Prefer existing interaction patterns before introducing new UI primitives.

Do not add unrelated dashboards, recommendation systems, music/focus systems, custom accent systems, AI features, collaboration systems, LMS features, realtime notifications, external calendar integrations, or other unrelated features unless the current task explicitly requires them.

## Multimedia Extension Rules

- Video/YouTube, Image, and Audio are established Source types.
- Do not perform a repository-wide `Video → Source` rename or generic-media refactor solely for conceptual cleanliness.
- Generalize only relationships that actually need to support multiple media types.
- Do not create duplicated Note or Task systems such as `AudioNote`, `ImageNote`, `AudioTask`, or `ImageTask` unless an approved requirement explicitly requires separate domains.
- Preserve exact provenance regardless of whether media was added by URL, upload, or another approved discovery mechanism.
- External media URLs are references unless the current task explicitly requires local persistence.
- Uploaded media must be handled as account-scoped application data.
- Uploaded media must not expose arbitrary filesystem paths.
- Generated storage identifiers should be preferred over trusting user-provided filenames for storage paths.

## Protected Data and Report Baselines

- Existing A1 and A2 fixtures/verifiers are protected regression baselines.
- Existing DEMO SCALE data/verifier is a protected demo/performance baseline.
- Do not resurrect or create an A3 baseline unless explicitly approved.
- Do not change protected fixture meaning, account isolation, or expected counts merely to make a feature demonstration easier.
- Schema evolution should keep existing fixtures valid whenever possible through nullable/default-safe migrations.
- Do not rewrite the locked report or introduce new performance/user-effectiveness claims unless the current task explicitly asks for report changes.
- Do not describe local single-user timings as throughput, scalability, or production-performance proof.

## Coding Rules

- Inspect the relevant current implementation before editing.
- Do not rely on memory, previous summaries, stale Repomix snapshots, or older copies when the current repository state can be inspected.
- Make the smallest correct change that satisfies the current approved task.
- Start implementation once the required context is established.
- Do not perform unrelated refactors.
- Do not rewrite architecture solely for conceptual cleanliness.
- Do not add or upgrade dependencies unless the task clearly requires it.
- Do not change API contracts, database schema, authentication behavior, business rules, or route semantics unless explicitly required by the approved task.
- Do not guess missing product/business/security requirements. Report the ambiguity instead.
- Preserve existing error handling and accessibility patterns unless the task explicitly improves them.
- Preserve established naming and domain terminology unless an approved task explicitly changes it.
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
- checking blast radius before changing shared services, stores, APIs, DTOs, lifecycle behavior, or source/library ownership boundaries;
- reviewing the impact of non-trivial backend/domain/database changes;
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

A HIGH or CRITICAL impact result is a signal to inspect affected execution paths carefully. It does not authorize broader refactoring by itself.

If GitNexus reports that its index is stale:

- stop relying on stale graph results;
- refresh the index only when the current task materially benefits from graph analysis;
- a stale GitNexus index does not block a task whose edit surface and dependencies can be established safely through direct repository inspection.

Do not regenerate, overwrite, replace, or modify `AGENTS.md` as part of GitNexus indexing, analysis, setup, or maintenance.

`AGENTS.md` is manually maintained by the project owner and is authoritative repository instruction.

## Validation

Use validation proportional to the task and its blast radius.

- Prefer the narrowest validation that directly exercises the changed behavior.
- Expand validation when a task crosses shared contracts, database schema, ownership boundaries, provenance, or multiple media types.
- Do not automatically run broad or expensive validation when a narrower check is sufficient, unless the approved Task Packet explicitly requires broader validation.
- Never claim a check passed if it was not actually run.
- Runtime/manual browser verification is required for visual or interaction claims that automated checks cannot establish.

### Targeted Validation Examples

- focused backend tests for changed controllers/services/repositories;
- focused integration tests for changed API contracts;
- migration/startup verification for schema changes;
- focused frontend type/component checks when available;
- `git diff --check` for patch hygiene;
- manual browser verification for dialogs, focus, responsive behavior, source context, and other runtime interactions.

### Full Frontend Validation Reference

From `frontend/`:

```bash
npm run lint
npm run build
```

### Protected Data Validation

When a task can affect persisted data, ownership, provenance, media queries, or schema compatibility, run the relevant existing fixture/verifier checks required by the Task Packet, including A1/A2/DEMO SCALE when applicable.

Do not alter a verifier merely to make a failing implementation appear correct.

## Definition of Done

A task is not done merely because code was written.

Before reporting completion:

- confirm the implementation matches the approved Task Packet;
- confirm applicable `AGENTS.md` instructions were followed;
- inspect the actual diff;
- run the validation justified by the change surface;
- preserve account isolation and provenance invariants;
- preserve unrelated working-tree changes;
- report any unrun checks, unresolved tradeoffs, or required browser confirmation explicitly;
- do not declare unrelated project phases complete.
