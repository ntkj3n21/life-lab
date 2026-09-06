# Life Lab production deployment

This deployment uses three services:

```text
Browser
  |
 HTTPS
  v
Frontend / Nginx
  |
 /api/*
  v
Spring Boot Backend
  |
  v
PostgreSQL
```

Only Nginx publishes host ports. Spring Boot and PostgreSQL stay on Docker networks and are not published directly.

## 1. Production environment

From the repository root:

```powershell
Copy-Item .env.production.example .env.production
```

Edit `.env.production` and provide real values for:

- `DB_PASSWORD`
- `LIFELAB_YOUTUBE_API_KEY`
- `LIFELAB_JWT_SECRET`
- `LIFELAB_DEFAULT_TIME_ZONE` if the deployment fallback should differ from the example

The JWT secret must be valid Base64 and decode to at least 32 bytes.

`LIFELAB_DEFAULT_TIME_ZONE` must be a valid IANA timezone such as `Asia/Ho_Chi_Minh` or `UTC`. It is only the fallback for Daily Plan requests; the frontend normally sends the browser timezone in `X-Time-Zone`.

## 2. TLS certificates

Place the certificate files here:

```text
deploy/
└── certs/
    ├── fullchain.pem
    └── privkey.pem
```

The certificate must match the hostname used to access Life Lab.

For an actual Internet deployment, use certificates issued for the real domain. Do not commit private keys or production certificates.

## 3. Validate Compose

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

## 4. Build and start

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check status:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Follow logs:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

## 5. Stop

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

The PostgreSQL named volume is intentionally preserved.

To remove containers AND the database volume, use `down -v` only when the stored database is no longer needed.

## Request flow

Nginx serves the built React SPA.

SPA routes use:

```nginx
try_files $uri $uri/ /index.html;
```

so direct navigation to routes such as `/notes/12` or `/tasks/7` returns the React application instead of a 404.

Requests under `/api/` are reverse proxied to the internal Docker service:

```text
backend:8080
```

The backend uses:

```text
postgres:5432
```

inside Docker. Neither port `8080` nor PostgreSQL port `5432` is published to the host.

## Security boundary

Production sets:

```text
LIFELAB_COOKIE_SECURE=true
```

TLS terminates at Nginx, and React plus `/api/*` share the same public origin.
