Unified dev / build / test scripts

From the repository root you can use the following npm scripts to manage both backend and frontend together:

- npm run install:all  # install dependencies for root, backend and frontend
- npm run build:all    # build backend and frontend
- npm run test:all     # run tests for backend and frontend
- npm run dev:all      # run backend dev server and frontend dev server in parallel
- npm run start:all    # run backend start and frontend start in parallel (production-like)
- npm run bootstrap    # install:all + build:all

Examples:

Install everything and build:
```
npm run bootstrap
```

Start development servers:
```
npm run dev:all
```

Notes:
- These scripts assume each package.json (`smart-market-finder-1/backend` and `/frontend`) has the usual `start`, `dev`, `build`, and `test` scripts.
- If you run into network or permission issues during `npm ci`, try `npm install` or adjusting your registry/settings.
