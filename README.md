# Life Lab

**Life Lab** is a full-stack productivity workspace that preserves context from multimedia learning all the way to daily planning.

Instead of separating videos, notes, and tasks into disconnected tools, Life Lab keeps the original learning context attached to the user's work.

### Core workflow

`YouTube Video → Timestamp → Note → Task → Daily Plan`

### Reverse context

`Daily Plan → Task → Note → Exact YouTube Source → Original Timestamp`

This allows users to move from consuming video content to taking notes and planning work, while still being able to return to the exact source that created that context.

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

### Video Library

- Add YouTube videos by URL
- Retrieve video metadata through the YouTube Data API
- Search, filter, sort, and paginate Library videos
- Organize videos with tags
- Filter by watched state and note existence
- Rename or remove videos from the personal Library

### Context-Aware Notes

- Create Notes directly from a Library video
- Preserve the exact YouTube source
- Capture an optional playback timestamp
- Edit and delete Notes
- Preserve historical source context even if the video is removed from the Library

### Tasks

- Create independent Tasks
- Create Tasks from Notes
- Manage title, description, deadline, and status
- Preserve Tasks even if their source Note is later deleted
- Clearly distinguish independent, linked, and missing-source Tasks

### Daily Plan

Tasks are automatically organized into a derived Daily Plan:

- Overdue
- Today
- Upcoming
- No deadline
- Completed

Daily Plan is derived from authoritative Task data rather than stored as a separate planning model.

### Reverse Context Navigation

Life Lab can resolve a Task or Note back to its original multimedia context.

For example:

```text
Task
  ↓
Note
  ↓
Exact YouTube source
  ↓
Original timestamp
```

If the original video is no longer in the user's Library but still exists on YouTube, Life Lab provides a read-only Source Preview.

If the original source is unavailable or missing, Life Lab reports that state instead of substituting unrelated content.

### Watch Tracking

- Track real video viewing sessions
- Synchronize playback progress through heartbeat updates
- Close sessions when switching videos or leaving the workspace
- Keep Source Preview playback separate from normal Library watch tracking

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
  Notes can preserve the exact YouTube source and playback timestamp that created them.

- **Source vs Library separation**  
  A YouTube source is distinct from a user's personal Library entry.

- **Historical context preservation**  
  Removing a video from the Library does not invalidate Notes that reference its original source.

- **Task preservation**  
  Deleting a source Note does not delete Tasks created from it. The Task remains valid while its source is explicitly represented as missing.

- **Derived planning model**  
  Daily Plan is computed from Task data instead of persisting duplicate planning state.

- **Strict Reverse Context**  
  Navigation follows only the real Task → Note → source relationship and never fabricates substitute context.

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
watch
note
task
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

The main persisted concepts are:

```text
Account
YouTubeVideo
LibraryVideo
Tag
LibraryVideoTag
WatchSession
Note
Task
```

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
