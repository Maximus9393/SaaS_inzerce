"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const marketRoutes_1 = __importDefault(require("./routes/marketRoutes"));
const logger_1 = require("./utils/logger");
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3000;
// parsers
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// paths to built frontend (used by root handler)
// __dirname is backend/dist when compiled; go up two levels to reach smart-market-finder-1
const frontendBuild = path_1.default.join(__dirname, '..', '..', 'frontend', 'build');
const frontendDist = path_1.default.join(__dirname, '..', '..', 'frontend', 'dist');
// Middleware: measure approximate incoming header size and log when large
app.use((req, _res, next) => {
    try {
        // rawHeaders is an array [name, value, name, value, ...]
        const raw = req.rawHeaders || [];
        const totalHeaderBytes = raw.reduce((acc, cur) => acc + (cur ? String(cur).length : 0), 0);
        // attach for debugging
        req._totalHeaderBytes = totalHeaderBytes;
        if (totalHeaderBytes > 8000) {
            logger_1.logger.warn(`Large incoming headers: ${totalHeaderBytes} bytes for ${req.method} ${req.url}`);
        }
    }
    catch (e) {
        // ignore measurement errors
    }
    next();
});
// Basic root route: serve frontend index.html when available, otherwise return a small API stub
app.get('/', (req, res) => {
    const indexPath = path_1.default.join(frontendBuild, 'index.html');
    if (require('fs').existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    return res.send(`<html><body><h2>Smart Market Finder API</h2>
    <p>API endpoints: <a href="/api/results">/api/results</a>, POST /api/search</p></body></html>`);
});
// optionally serve frontend build if exists (prefer `frontend/build` if present, then `frontend/dist`)
if (require('fs').existsSync(frontendBuild)) {
    app.use(express_1.default.static(frontendBuild));
    // SPA fallback: serve index.html for any non-API GET route to support client-side routing
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/'))
            return next();
        const index = path_1.default.join(frontendBuild, 'index.html');
        if (require('fs').existsSync(index))
            return res.sendFile(index);
        return next();
    });
}
else if (require('fs').existsSync(frontendDist)) {
    app.use(express_1.default.static(frontendDist));
}
// mount API routes
app.use('/api', marketRoutes_1.default);
// global error handler (should be after routes)
app.use(errorHandler_1.errorHandler);
// start server only when run directly
if (require.main === module) {
    const server = app.listen(PORT, () => {
        logger_1.logger.info(`Server is running on http://localhost:${PORT}`);
    });
    // listen for low-level client errors (e.g. header overflow) and log details
    server.on('clientError', (err, socket) => {
        try {
            const code = err && (err.code || err.message) ? (err.code || err.message) : 'unknown';
            logger_1.logger.error(`clientError: code=${code} message=${String(err && err.message)}`);
        }
        catch (e) {
            // swallow
        }
        try {
            // politely close the socket
            socket.end && socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
        catch (e) {
            // ignore
        }
    });
}
exports.default = app;
