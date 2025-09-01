Frontend Docker quick start

Build locally:

    cd smart-market-finder-1/frontend
    docker build -t smf-frontend:local .

Run locally:

    docker run --rm -p 3002:3002 -e PORT=3002 smf-frontend:local

Notes

- The image uses `serve` to host the static build on the PORT (default 3002).
- Ensure the backend URL is configured in the frontend environment (for deployed site you can set env vars or use a runtime-config approach).
