Render deployment checklist

1) Create a new Web Service on Render
- Type: Web Service
- Environment: Docker
- Branch: main
- Dockerfile path: smart-market-finder-1/backend/Dockerfile
- Region/Plan: choose as preferred (render.yaml uses region: oregon and starter plan)

2) Set environment variables (in Render service settings)
- DATABASE_URL = postgresql://<user>:<pass>@<host>:5432/<db>
- REDIS_URL = redis://<host>:6379 (optional)
- MEILI_HOST = http://<host>:7700 (optional)
- MEILI_KEY = <your_meili_master_key> (optional)
- PORT = 3000 (optional, default used in Dockerfile)

3) Deployment notes
- The backend Dockerfile builds the frontend during the image build and copies built files into the final image. The backend will serve static files from `/frontend/build` if present.
- The container `CMD` runs `/app/start.sh` which will run `npx prisma generate` and attempt `npx prisma migrate deploy` if `DATABASE_URL` is set. Migrations have retries to wait for DB startup.
- If you don't provide `DATABASE_URL`, migrations will be skipped and the server will still run, but persistent storage won't be available.

4) Health checks & logs
- Use Render logs to watch the container startup. Look for `start.sh` output and Prisma migrate lines.
- Test the public URL once deployment finishes.

5) Optional: using Render managed Postgres
- Provision a Render Postgres database and copy its connection string into `DATABASE_URL`.
- If you provision Render Redis or an external Redis, set `REDIS_URL`.

6) Troubleshooting
- If migrations fail repeatedly, check DB credentials and network rules.
- If frontend isn't served, ensure the Docker build step successfully ran `npm run build` (check build logs).

