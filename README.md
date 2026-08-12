# Life Lab

Life Lab is a personal digital workspace focused on preserving context across multimedia learning and task management.

The core workflow is:

```text
YouTube Video
    ↓
Note
    ↓
Task
    ↓
Daily Plan
```

Life Lab also supports reverse navigation:

```text
Daily Plan
    ↓
Task
    ↓
Note
    ↓
Exact source video
    ↓
Original timestamp
```

The main goal is to let users move from consuming multimedia content to taking notes and planning work without losing the original source context.

## Core Features

### Authentication

- Account registration and login
- JWT-based authentication
- HttpOnly authentication cookie
- CSRF protection
- Account-scoped application data
- Logout state cleanup

### Video Library

- Add YouTube videos by URL
- Retrieve metadata from the YouTube Data API
- Rename library videos
- Delete videos from the personal library
- Search, filter, sort and paginate videos
- Organize videos with tags
- Filter by watched status and note existence

### Watch Tracking

- Create watch sessions when video playback begins
- Track actual elapsed playback time
- Heartbeat synchronization
- Close sessions when switching videos or leaving the workspace
- Preserve watch state consistently across context navigation

### Notes

- Create notes directly from a Library video
- Record the exact video source
- Optional timestamp capture
- Edit and delete notes
- Preserve the distinction between a missing timestamp and timestamp `0`
- Keep source history even when a video is removed from the personal Library

### Tasks and Daily Plan

- Create independent tasks
- Create tasks from Notes
- Update task title, description and deadline
- Task statuses:
  - `NOT_STARTED`
  - `IN_PROGRESS`
  - `COMPLETED`
- Source states:
  - `INDEPENDENT`
  - `HAS_SOURCE`
  - `SOURCE_MISSING`
- Derived Daily Plan with overdue, today, upcoming, no-deadline and completed groups

### Reverse Context Navigation

Life Lab can resolve a Task or Note back to its exact historical source.

Navigation modes include:

- `WORKSPACE`
- `SOURCE_PREVIEW`
- `VIDEO_UNAVAILABLE`
- `SOURCE_MISSING`
- `NO_SOURCE`

The application never substitutes a similar video when the original source is missing or unavailable.

If the exact YouTube source still exists but is no longer in the user's Library, Life Lab opens a read-only Source Preview.

Source Preview playback intentionally does not create a WatchSession.

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
- PostgreSQL
- Flyway
- Maven
- Testcontainers

### External Service

- YouTube Data API v3
- YouTube embedded player

## Repository Structure

```text
life-lab/
├── backend/
│   └── src/
├── frontend/
│   └── src/
├── docker-compose.yml
├── .env.example
└── README.md
```

The backend follows a modular-monolith structure organized by feature:

```text
auth
video
watch
note
task
context
common
```

The main backend flow follows:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL
```

## Requirements

Before running Life Lab locally, install:

- Java 17
- Node.js and npm
- Docker Desktop / Docker Compose

A YouTube Data API v3 key is required for live YouTube metadata resolution.

## Environment Configuration

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

Configure:

```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=lifelab
DB_USERNAME=lifelab
DB_PASSWORD=your-local-password

LIFELAB_YOUTUBE_API_KEY=your-youtube-data-api-key

LIFELAB_JWT_SECRET=your-base64-secret
LIFELAB_COOKIE_SECURE=false
```

`LIFELAB_JWT_SECRET` must be valid Base64 and decode to at least 32 bytes.

Do not commit `.env`.

## Run PostgreSQL

From the project root:

```powershell
docker compose up -d postgres
```

Check the container:

```powershell
docker compose ps
```

The local PostgreSQL service is exposed on:

```text
localhost:5433
```

## Run the Backend

From the project root:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The backend runs at:

```text
http://localhost:8080
```

Flyway automatically applies the database migration and Hibernate validates the JPA mappings during startup.

## Run the Frontend

Open another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

During local development, Vite proxies `/api` requests to the Spring Boot backend.

## Validation

### Backend

Run:

```powershell
cd backend
.\mvnw.cmd clean verify
```

### Frontend

Run:

```powershell
cd frontend
npm run lint
npm run build
```

Optional Git whitespace validation:

```powershell
git diff --check
```

## Main Workflow

A representative Life Lab workflow is:

```text
1. Register or sign in
2. Add a YouTube video to the Library
3. Play the video
4. Capture a Note at an exact timestamp
5. Create a Task from the Note
6. Assign a deadline
7. View the Task in the Daily Plan
8. Open the Task's source
9. Resolve Task → Note → exact Video → timestamp
```

If the Library entry is later deleted, the Note still preserves its original YouTube source.

If the Note is deleted, a Task created from that Note is preserved and becomes `SOURCE_MISSING`.

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

Daily Plan and reverse Context are derived application concepts and are not stored as independent database tables.

## Security Notes

- Passwords are hashed before storage.
- Authentication uses signed JWT access tokens.
- Authentication tokens are stored in HttpOnly cookies.
- Unsafe requests use CSRF protection.
- User-owned resources are scoped to the authenticated account.
- Secrets and API keys belong in `.env`, not in Git.

## Author

Developed by [ntkj3n21](https://github.com/ntkj3n21).