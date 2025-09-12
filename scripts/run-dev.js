/* Helper dev runner: picks free ports and starts backend + frontend together.
   - Starts backend on PORT (default 3000) unless in-use; if port in use, it finds next free port.
   - Starts frontend with environment PORT set to chosen frontend port (default 3002).
   - Streams logs from both processes to the console prefixed with [backend] / [frontend].
*/

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

function findFreePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const server = net.createServer();
      server.once('error', () => {
        tryPort(p + 1);
      });
      server.once('listening', () => {
        server.close(() => resolve(p));
      });
      server.listen(p, '0.0.0.0');
    };
    tryPort(start);
  });
}

(async function() {
  // ensure backend/frontend have dependencies installed (fast check for node_modules/.bin)
  const root = process.cwd();
  const backendDir = path.join(root, 'smart-market-finder-1', 'backend');
  const frontendDir = path.join(root, 'smart-market-finder-1', 'frontend');

  function ensureInstalled(dir, binName) {
    try {
      const binPath = path.join(dir, 'node_modules', '.bin', binName + (process.platform === 'win32' ? '.cmd' : ''));
      if (!fs.existsSync(binPath)) {
        console.log(`[dev-runner] ${binName} missing in ${dir}; attempting npm ci (may fail if registry or versions are incompatible)`);
        const r = spawnSync('npm', ['ci'], { cwd: dir, stdio: 'inherit' });
        if (r.status !== 0) {
          console.warn(`[dev-runner] npm ci failed in ${dir} with code ${r.status} — continuing and using fallback to npx when possible`);
        }
      }
    } catch (e) {
      console.warn('[dev-runner] ensureInstalled failed', e && e.message ? e.message : e);
    }
  }

  ensureInstalled(backendDir, 'nodemon');
  ensureInstalled(frontendDir, 'react-scripts');

  const backendPort = await findFreePort(process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 3000);
  const frontendPort = await findFreePort(process.env.FRONTEND_PORT ? Number(process.env.FRONTEND_PORT) : 3002);

  console.log(`[dev-runner] starting backend on http://localhost:${backendPort}`);
  console.log(`[dev-runner] starting frontend on http://localhost:${frontendPort}`);

  const envBackend = Object.assign({}, process.env, { PORT: String(backendPort) });
  // prefer nodemon if available, otherwise fallback to ts-node via npx
  let backendCmd, backendArgs;
  const nodemonBin = path.join(process.cwd(), 'smart-market-finder-1', 'backend', 'node_modules', '.bin', 'nodemon');
  if (fs.existsSync(nodemonBin)) {
    backendCmd = 'npm'; backendArgs = ['run', 'dev:backend'];
  } else {
    // use npx ts-node to run server.ts directly as a best-effort fallback
    backendCmd = 'npx'; backendArgs = ['-y', 'ts-node', 'src/server.ts'];
    console.log('[dev-runner] nodemon not found; falling back to `npx ts-node src/server.ts` for backend');
  }

  const backend = spawn(backendCmd, backendArgs, { env: envBackend, stdio: ['ignore', 'pipe', 'pipe'], cwd: path.join(process.cwd(), 'smart-market-finder-1', 'backend') });

  backend.stdout.on('data', (d) => process.stdout.write(`[backend] ${d.toString()}`));
  backend.stderr.on('data', (d) => process.stderr.write(`[backend:err] ${d.toString()}`));

  // start frontend
  const envFrontend = Object.assign({}, process.env, { PORT: String(frontendPort) });
  const frontend = spawn('npm', ['run', 'frontend'], { env: envFrontend, stdio: ['ignore', 'pipe', 'pipe'], cwd: path.join(process.cwd(), 'smart-market-finder-1', 'frontend') });

  frontend.stdout.on('data', (d) => process.stdout.write(`[frontend] ${d.toString()}`));
  frontend.stderr.on('data', (d) => process.stderr.write(`[frontend:err] ${d.toString()}`));

  const onExit = (code, signal) => {
    console.log(`[dev-runner] exiting, code=${code}, signal=${signal}`);
    try { backend.kill(); } catch (e) {}
    try { frontend.kill(); } catch (e) {}
    process.exit(code || 0);
  };
  process.on('SIGINT', () => onExit(0, 'SIGINT'));
  process.on('SIGTERM', () => onExit(0, 'SIGTERM'));

})();
