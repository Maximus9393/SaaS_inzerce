import { Router } from 'express';
import { search, getResults, suggestPostal } from '../controllers/marketController';

/**
 * Mount API routes.
 * Expects marketController to export named functions: search, getResults
 */
export function setRoutes(app: any) {
  const router = Router();

  router.post('/search', search);
  router.get('/suggest/postal', suggestPostal);
  router.get('/results', getResults);

  app.use('/api', router);
}