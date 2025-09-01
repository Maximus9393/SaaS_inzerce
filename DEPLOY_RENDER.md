Quick Render + Docker deployment

This repo contains two services under `smart-market-finder-1/`:

- backend: `smart-market-finder-1/backend` (Node + TypeScript)
- frontend: `smart-market-finder-1/frontend` (React build)

Files added for Render:

- `render.yaml` – service manifest for Render (two web services using Docker)
- `smart-market-finder-1/backend/Dockerfile` and `.dockerignore`
- `smart-market-finder-1/frontend/Dockerfile` and `.dockerignore`

Notes & tips

- Backend Dockerfile builds the TypeScript project and runs `node dist/server.js` on port 3000.
- Puppeteer dependencies are installed in the image. If you prefer not to include Puppeteer in Render, unset/omit the `puppeteer` dependency and rely on HTML fallback.
- Frontend is built and served with `serve` on port 3002.

How to deploy on Render

1. Push to a Git repository.
2. In Render, create a new "Web Service" and choose "Docker". Use the provided `render.yaml` to create both services automatically (Render will detect it).
3. Set any environment variables in the Render dashboard (for example, `MEILI_HOST`, `MEILI_KEY`, etc.).

Optional tuning

- Use `MAX_PSC_INITIAL`, `MAX_PSC_EXTRA`, and `MIN_ACCEPT` env vars to tune backend scraping behavior.
- For production, consider adding caching (Redis) or Meilisearch indexing to avoid heavy scraping on each request.
