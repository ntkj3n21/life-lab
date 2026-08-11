# Life Lab

Life Lab is under active development. The repository currently contains the Vite frontend only.

## Current implementation status

- Frontend: implemented in `frontend/`.
- Backend: planned, not implemented yet.
- Database: planned, not implemented yet.
- Docker Compose: planned, not implemented yet.

No backend, authentication, database, or API integration is available in the current phase.

## Repository structure

```text
life-lab/
  frontend/           # Current React + TypeScript + Vite application
  backend/            # Planned; will be created in Phase 2
  docker-compose.yml  # Planned; not created yet
```

The planned entries above describe the target structure; they do not exist in the repository yet.

## Run the frontend

Requirements: Node.js and npm.

```bash
cd frontend
npm ci
npm run dev
```

## Frontend validation

Run these commands from `frontend/`:

```bash
npm run lint
npm run build
```

The build command runs the TypeScript project build and creates the production output in `frontend/dist/`.

## Author

Developed by [ntkj3n21](https://github.com/ntkj3n21).
