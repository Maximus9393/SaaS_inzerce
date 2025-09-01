RSS fetcher

Usage:

- Install deps: npm install
- Run the fetcher for a specific Bazoš feed:

  npm run fetch:rss -- "https://auto.bazos.cz/rss.php?c=1&s=1&q=&mesto=Praha"

Behavior:
- Downloads the RSS XML, parses items, and stores them in `backend/data/rss_items.json`.
- New items are appended only if their URL/title hash is not already present.
