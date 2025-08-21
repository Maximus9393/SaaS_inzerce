import express from 'express';
import { setRoutes } from './routes/marketRoutes';
import { logger } from './utils/logger';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: measure approximate incoming header size and log when large
app.use((req, _res, next) => {
  try {
    // rawHeaders is an array [name, value, name, value, ...]
    const raw = (req as any).rawHeaders || [];
    const totalHeaderBytes = raw.reduce((acc: number, cur: any) => acc + (cur ? String(cur).length : 0), 0);
    // attach for debugging
    (req as any)._totalHeaderBytes = totalHeaderBytes;
    if (totalHeaderBytes > 8000) {
      logger.warn(`Large incoming headers: ${totalHeaderBytes} bytes for ${req.method} ${req.url}`);
    }
  } catch (e) {
    // ignore measurement errors
  }
  next();
});

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
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
  });

  // listen for low-level client errors (e.g. header overflow) and log details
  server.on('clientError', (err: any, socket: any) => {
    try {
      const code = err && (err.code || err.message) ? (err.code || err.message) : 'unknown';
      logger.error(`clientError: code=${code} message=${String(err && err.message)}`);
    } catch (e) {
      // swallow
    }
    try {
      // politely close the socket
      socket.end && socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch (e) {
      // ignore
    }
  });
}

export default app;