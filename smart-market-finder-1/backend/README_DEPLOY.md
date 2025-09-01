Backend Docker quick start

Build locally:

    cd smart-market-finder-1/backend
    docker build -t smf-backend:local .

Run locally:

    docker run --rm -p 3000:3000 -e PORT=3000 smf-backend:local

Important env variables

- PORT - port the server listens on (default 3000)
- MAX_PSC_INITIAL - initial number of PSČ to try per search (default 16)
- MAX_PSC_EXTRA - extra PSČ attempts to try to fill a requested page size (default 50)
- MIN_ACCEPT - minimum number of items from a single PSČ run to accept without extra attempts (default 3)

Notes

- The Docker image includes system libraries used by Puppeteer. If you're not using Puppeteer in your Render environment, you can slim the image by removing it.
