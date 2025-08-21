"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoutes = void 0;
const express_1 = require("express");
const marketController_1 = require("../controllers/marketController");
/**
 * Mount API routes.
 * Expects marketController to export named functions: search, getResults
 */
function setRoutes(app) {
    const router = (0, express_1.Router)();
    router.post('/search', marketController_1.search);
    router.get('/suggest/postal', marketController_1.suggestPostal);
    router.get('/results', marketController_1.getResults);
    app.use('/api', router);
}
exports.setRoutes = setRoutes;
