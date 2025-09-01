import { Request, Response, NextFunction } from 'express';

export function validateSearch(req: Request, res: Response, next: NextFunction) {
  const body = req.body || {};
  const q = String(body.query || body.keywords || '').trim();
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'query/keywords must be at least 2 characters' });
  }
  return next();
}
