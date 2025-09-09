import { Router, RequestHandler, Express } from 'express';
import { z } from 'zod';
import { search, getResults, suggestPostal, searchQuick } from '../controllers/marketController';
import { createListing, listRecent, listFromDb, getListing } from '../controllers/listingController';
import { validateSearch as validateSearchMiddleware } from '../middleware/validateSearch';
import { defaultRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validateZod';

// Router for /api/* endpoints (attach with `app.use('/api', marketRoutes)`)
const router = Router();

// Placeholder middleware for future validation/authorization
const validateSearch: RequestHandler = (req, _res, next) => {
  // TODO: implement request validation (e.g. body shape, rate limits)
  return next();
};

// Apply rate limiter to all API routes
router.use(defaultRateLimiter);

// Validation schema for search
const searchSchema = z.object({
  query: z.string().min(2).optional(),
  keywords: z.string().min(2).optional(),
  location: z.string().optional(),
  saveToDb: z.boolean().optional(),
});

// Endpoints
router.post('/search', validate(searchSchema), search);
// quick, non-blocking search that returns stored results immediately and triggers a background refresh
router.post('/search-quick', validate(searchSchema), searchQuick as any);
router.get('/suggest/postal', suggestPostal);
router.get('/results', getResults);
// Listing CRUD (simple)
router.post('/listings', createListing);
router.get('/listings', listRecent);
// Debug: direct DB read for listings
router.get('/listings-db', listFromDb);
// Get single listing by url or id
router.get('/listing', getListing);
// Backwards-compatible named export: some older code imported `setRoutes`.
// Provide a tiny helper so both `import marketRoutes from './routes/marketRoutes'`
// and `import { setRoutes } from './routes/marketRoutes'` work.
export function setRoutes(app: any) {
  app.use('/api', router);
}

export default router;
