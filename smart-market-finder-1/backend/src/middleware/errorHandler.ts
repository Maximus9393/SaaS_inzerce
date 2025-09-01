import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Simple global error handler for Express
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  try {
    const status = err && err.status ? Number(err.status) : 500;
    const msg = err && err.message ? String(err.message) : 'Internal Server Error';
    logger.error(`Unhandled error: ${msg}`);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(status).json({ error: msg, stack: err && err.stack ? String(err.stack) : undefined });
    }
    return res.status(status).json({ error: msg });
  } catch (e) {
    // If the error handler itself fails, make sure we still respond
    try { logger.error('Error handler failed: ' + String(e)); } catch (_) { /* noop */ }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
