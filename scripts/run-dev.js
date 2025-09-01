/* Helper dev runner: picks free ports and starts backend + frontend together.
   - Starts backend on PORT (default 3000) unless in-use; if port in use, it finds next free port.
   - Starts frontend with environment PORT set to chosen frontend port (default 3002).
   - Streams logs from both processes to the console prefixed with [backend] / [frontend].
*/

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

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
  const backendPort = await findFreePort(process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 3000);
  const frontendPort = await findFreePort(process.env.FRONTEND_PORT ? Number(process.env.FRONTEND_PORT) : 3002);

  console.log(`[dev-runner] starting backend on http://localhost:${backendPort}`);
  console.log(`[dev-runner] starting frontend on http://localhost:${frontendPort}`);

  const envBackend = Object.assign({}, process.env, { PORT: String(backendPort) });
  const backend = spawn('npm', ['run', 'dev:backend'], { env: envBackend, stdio: ['ignore', 'pipe', 'pipe'], cwd: process.cwd() });

  backend.stdout.on('data', (d) => process.stdout.write(`[backend] ${d.toString()}`));
  backend.stderr.on('data', (d) => process.stderr.write(`[backend:err] ${d.toString()}`));

  // start frontend
  const envFrontend = Object.assign({}, process.env, { PORT: String(frontendPort) });
  const frontend = spawn('npm', ['run', 'frontend'], { env: envFrontend, stdio: ['ignore', 'pipe', 'pipe'], cwd: process.cwd() });

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
