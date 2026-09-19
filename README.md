# Life Lab

**Life Lab** is a full-stack productivity workspace that preserves context from multimedia learning all the way to daily planning.

Instead of separating media sources, notes, and tasks into disconnected tools, Life Lab keeps the original learning context attached to the user's work.

### Core workflow

Life Lab preserves a source-aware learning chain:

`Video / Image / Audio → Note → Task → Daily Plan`

For timestamp-capable media:

- YouTube Video Notes may preserve an optional playback timestamp.
- Audio Notes may preserve an optional playback timestamp.
- Image Notes do not use timestamps.

A timestamp value of `0` is a valid exact position and is distinct from an unknown timestamp.

### Reverse context

`Daily Plan → Task → Note → Exact Source → Original Context`

Reverse Context returns to the exact source referenced by the Note:

- Video → original YouTube source and timestamp when available
- Audio → original audio source and timestamp when available
- Image → original image source

If the original Library membership no longer exists, Life Lab may use a read-only Source Preview without recreating Library membership or watch history.

**Tech:** React · TypeScript · Spring Boot · PostgreSQL · Docker

---

## Screenshots

> Screenshots will be added after the final UI and deployment pass.

<!--
Recommended screenshots:
1. Library
2. Video Workspace + Notes
3. Tasks / source context
4. Daily Plan
-->

---

## Key Features

### Unified Library

- Manage YouTube Videos, Images, and Audio in one Library
- Add YouTube videos by URL
- Add Images through local upload
- Add Audio by URL or local MP3 upload
- Retrieve YouTube metadata through the YouTube Data API
- Search, filter, sort, and paginate supported Library content
- Keep source identity separate from personal Library membership
- Remove Library membership without deleting existing Notes or Tasks

### Context-Aware Notes

- Create Notes from Video, Image, or Audio sources
- Preserve the exact source that created the Note
- Capture an optional timestamp for Video and Audio
- Keep Image Notes timestamp-free
- Edit, organize, filter, and delete Notes
- Preserve historical source context after Library membership is removed
- Keep unknown timestamp distinct from timestamp `0`

### Tasks

- Create independent Tasks
- Create Tasks from Notes
- Manage title, description, deadline, and status
- Preserve Tasks even if their source Note is later deleted
- Clearly distinguish independent, linked, and missing-source Tasks
- Filter Tasks by their exact Video, Image, or Audio source
- Keep Tasks linked to Notes rather than linking Tasks directly to media sources

### Daily Plan

Tasks are automatically organized into a derived Daily Plan:

- Overdue
- Today
- Upcoming
- No deadline
- Completed

Daily Plan is derived from authoritative Task data rather than stored as a separate planning model.

### Reverse Context Navigation

Life Lab can resolve a Task or Note back to its exact original source.

```text
Task
  ↓
Note
  ↓
Exact Video / Image / Audio source
  ↓
Original timestamp when the source supports one
```

Reverse navigation never substitutes a different source.

If Library membership was removed but the underlying source is still available, Life Lab can provide a read-only Source Preview without restoring Library membership.

If the source Note was deleted, the Task remains valid and explicitly reports `SOURCE_MISSING`.

### YouTube Watch Tracking

WatchSession applies only to normal YouTube Library playback.

- Track real YouTube viewing sessions
- Synchronize playback progress through heartbeat updates
- Close sessions when switching videos or leaving the workspace
- Do not create WatchSessions for Image or Audio
- Do not create WatchSessions for read-only Source Preview

### Authentication & Data Isolation

- Account registration and login
- JWT-based authentication
- HttpOnly authentication cookie
- CSRF protection
- Account-scoped application data
- Logout state cleanup

---

## Engineering Highlights

Life Lab includes several domain and architecture decisions beyond basic CRUD behavior:

- **Exact context preservation**
  Notes preserve their exact Video, Image, or Audio source. Video and Audio may additionally preserve an exact playback timestamp.

- **Source vs Library separation**
  A source identity is distinct from an account's Library membership. Removing Library membership does not delete historical Note or Task provenance.

- **Historical context preservation**
  Removing Video, Image, or Audio Library membership does not invalidate Notes that reference the original source.

- **Task preservation**
  Deleting a source Note does not delete Tasks created from it. The Task remains valid while its source is explicitly represented as missing.

- **Derived planning model**
  Daily Plan is computed from Task data instead of persisting duplicate planning state.

- **Multisource Reverse Context**
  Navigation follows only the real Task → Note → source relationship and returns to the exact Video, Image, or Audio source without substituting unrelated content.

- **Account-scoped data boundaries**
  User-owned resources are isolated by authenticated account.

- **Browser-side video playback**
  YouTube video streams remain browser-side. The backend only handles metadata, validation, and source resolution.

---

## Architecture

```text
Browser
   │
   ▼
React + TypeScript
   │
   │ REST / JSON
   ▼
Spring Boot
   │
   ▼
PostgreSQL
```

YouTube integration follows a separate path:

```text
Browser
   │
   ├── YouTube embedded playback
   │
   └── Life Lab API
            │
            └── YouTube Data API
                metadata / validation
```

The backend does **not** proxy YouTube video streams.
Uploaded Image and Audio content is stored by the backend. Local development uses filesystem storage under the backend data directory, while production Docker deployment mounts persistent named volumes for uploaded media.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- React Player
- Lucide React

### Backend

- Java 17
- Spring Boot
- Spring Security
- Spring Data JPA
- Maven

### Data & Infrastructure

- PostgreSQL
- Flyway
- Docker
- Docker Compose
- Nginx
- Testcontainers

### External Services

- YouTube Data API v3
- YouTube embedded player

---

## Repository Structure

```text
life-lab/
├── backend/
│   └── src/
├── frontend/
│   └── src/
├── deploy/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── DEPLOYMENT.md
└── README.md
```

The backend is organized as a modular monolith by feature:

```text
auth
video
source
watch
note
task
organization
context
common
```

Typical backend flow:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL
```

---

## Running Locally

### Requirements

Install:

- Java 17
- Node.js and npm
- Docker Desktop / Docker Compose

A **YouTube Data API v3 key** is required for live metadata resolution.

---

### 1. Configure Environment

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Configure the required values:

```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=lifelab
DB_USERNAME=lifelab
DB_PASSWORD=your-local-password

LIFELAB_YOUTUBE_API_KEY=your-youtube-data-api-key

LIFELAB_JWT_SECRET=your-base64-secret
LIFELAB_JWT_ISSUER=life-lab
LIFELAB_JWT_ACCESS_TOKEN_TTL=30m
LIFELAB_DEFAULT_TIME_ZONE=Asia/Ho_Chi_Minh
LIFELAB_COOKIE_SECURE=false
```

`LIFELAB_JWT_SECRET` must be valid Base64 and decode to at least 32 bytes.

Do not commit `.env`.

---

### 2. Start PostgreSQL

From the project root:

```bash
docker compose up -d postgres
```

Check the service:

```bash
docker compose ps
```

PostgreSQL is exposed locally on:

```text
localhost:5433
```

---

### 3. Start the Backend

Windows:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Unix-like systems:

```bash
cd backend
./mvnw spring-boot:run
```

Backend:

```text
http://localhost:8080
```

Flyway applies database migrations during startup.

---

### 4. Start the Frontend

Open another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Vite normally starts at:

```text
http://localhost:5173
```

During local development, `/api` requests are proxied to the Spring Boot backend.

---

## Validation

### Frontend

```bash
cd frontend
npm run check
```

### Backend

Windows:

```powershell
cd backend
.\mvnw.cmd clean verify
```

Unix-like systems:

```bash
cd backend
./mvnw clean verify
```

Optional Git whitespace validation:

```bash
git diff --check
```

---

## Production Deployment

Production uses:

```text
Browser
   ↓ HTTPS
Nginx / Frontend
   ↓ /api/*
Spring Boot
   ↓
PostgreSQL
```

Only Nginx exposes host-facing ports. Backend and PostgreSQL remain on internal Docker networks.

Production configuration uses:

```bash
docker-compose.prod.yml
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the complete deployment procedure.

---

## Data Model

The main persisted concepts include:

```text
Account

YouTubeVideo
LibraryVideo
Tag
LibraryVideoTag
WatchSession

ImageSource
LibraryImage

AudioSource
LibraryAudio

Note
Category
NoteTag

Task
TaskTag
```

Notes provide the provenance bridge from Tasks back to their original media source.

Daily Plan and Reverse Context are **derived application concepts** rather than independent persisted models.

---

## Security

- Passwords are hashed before storage
- Authentication uses signed JWT access tokens
- Authentication tokens are stored in HttpOnly cookies
- Unsafe requests use CSRF protection
- User-owned data is scoped to the authenticated account
- Secrets and API keys are stored outside the repository

---

## Project Status

Life Lab is being developed as a full-stack software engineering portfolio project.

Current work focuses on final validation, deployment, documentation, and portfolio presentation.

---

## Author

Developed by [ntkj3n21](https://github.com/ntkj3n21).
