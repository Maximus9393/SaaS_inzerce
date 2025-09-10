let logger: any;
try {
  const pino = require('pino');
  const instance = pino({ level: process.env.LOG_LEVEL || 'info', prettyPrint: process.env.NODE_ENV !== 'production' });
  logger = {
    info: (msg: string, meta?: any) => instance.info(Object.assign({}, meta || {}), String(msg)),
    warn: (msg: string, meta?: any) => instance.warn(Object.assign({}, meta || {}), String(msg)),
    error: (msg: string, meta?: any) => instance.error(Object.assign({}, meta || {}), String(msg))
  };
} catch (e) {
  logger = {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`)
  };
}

export { logger };