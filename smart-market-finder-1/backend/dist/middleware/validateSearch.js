"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSearch = validateSearch;
function validateSearch(req, res, next) {
    const body = req.body || {};
    const q = String(body.query || body.keywords || '').trim();
    if (!q || q.length < 2) {
        return res.status(400).json({ error: 'query/keywords must be at least 2 characters' });
    }
    return next();
}
