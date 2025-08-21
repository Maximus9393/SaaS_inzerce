import express from 'express';
import { setRoutes } from './routes/marketRoutes';
import { logger } from './utils/logger';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic root route to avoid "Cannot GET /"
app.get('/', (_req, res) => {
  res.send(`<html><body><h2>Smart Market Finder API</h2>
    <p>API endpoints: <a href="/api/results">/api/results</a>, POST /api/search</p></body></html>`);
});

// optionally serve frontend build if exists
const frontendDist = path.join(__dirname, '../../../../frontend/dist');
app.use(express.static(frontendDist));

// mount API routes
setRoutes(app);

// start server only when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;