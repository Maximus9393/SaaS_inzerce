"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
// Simple global error handler for Express
function errorHandler(err, _req, res, _next) {
    try {
        const status = err && err.status ? Number(err.status) : 500;
        const msg = err && err.message ? String(err.message) : 'Internal Server Error';
        logger_1.logger.error(`Unhandled error: ${msg}`);
        if (process.env.NODE_ENV !== 'production') {
            return res.status(status).json({ error: msg, stack: err && err.stack ? String(err.stack) : undefined });
        }
        return res.status(status).json({ error: msg });
    }
    catch (e) {
        // If the error handler itself fails, make sure we still respond
        try {
            logger_1.logger.error('Error handler failed: ' + String(e));
        }
        catch (_) { /* noop */ }
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
