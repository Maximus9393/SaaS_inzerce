import { Router } from 'express';
import { search, getResults } from '../controllers/marketController';

/**
 * Mount API routes.
 * Expects marketController to export named functions: search, getResults
 */
export function setRoutes(app: any) {
  const router = Router();

  router.post('/search', search);
  router.get('/results', getResults);

  app.use('/api', router);
}