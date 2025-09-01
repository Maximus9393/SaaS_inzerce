"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoutes = setRoutes;
const express_1 = require("express");
const zod_1 = require("zod");
const marketController_1 = require("../controllers/marketController");
const listingController_1 = require("../controllers/listingController");
const rateLimit_1 = require("../middleware/rateLimit");
const validateZod_1 = require("../middleware/validateZod");
// Router for /api/* endpoints (attach with `app.use('/api', marketRoutes)`)
const router = (0, express_1.Router)();
// Placeholder middleware for future validation/authorization
const validateSearch = (req, _res, next) => {
    // TODO: implement request validation (e.g. body shape, rate limits)
    return next();
};
// Apply rate limiter to all API routes
router.use(rateLimit_1.defaultRateLimiter);
// Validation schema for search
const searchSchema = zod_1.z.object({
    query: zod_1.z.string().min(2).optional(),
    keywords: zod_1.z.string().min(2).optional(),
    location: zod_1.z.string().optional(),
    saveToDb: zod_1.z.boolean().optional(),
});
// Endpoints
router.post('/search', (0, validateZod_1.validate)(searchSchema), marketController_1.search);
router.get('/suggest/postal', marketController_1.suggestPostal);
router.get('/results', marketController_1.getResults);
// Listing CRUD (simple)
router.post('/listings', listingController_1.createListing);
router.get('/listings', listingController_1.listRecent);
// Backwards-compatible named export: some older code imported `setRoutes`.
// Provide a tiny helper so both `import marketRoutes from './routes/marketRoutes'`
// and `import { setRoutes } from './routes/marketRoutes'` work.
function setRoutes(app) {
    app.use('/api', router);
}
exports.default = router;
