import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// In some dev/container environments express-rate-limit throws
// runtime validation errors when X-Forwarded-For headers are present.
// Allow disabling the rate limiter via env to avoid crashing the server.
let _defaultRateLimiter: any;
if (process.env.DISABLE_RATE_LIMIT === '1' || process.env.NODE_ENV === 'development') {
  _defaultRateLimiter = (req: Request, res: Response, next: NextFunction) => next();
} else {
  _defaultRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: Number(process.env.RATE_LIMIT_MAX || 60),
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export const defaultRateLimiter = _defaultRateLimiter;
