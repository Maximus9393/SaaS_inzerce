import path from 'path';
import fs from 'fs';

// Load .env if present
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envPath });
}

export const DATABASE_URL = process.env.DATABASE_URL || '';
