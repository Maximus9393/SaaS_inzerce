const { PurgeCSS } = require('purgecss');
const fs = require('fs');
const path = require('path');

async function run() {
  const config = require('../package.json').purgecss || {};
  const content = config.content || ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'];
  const cssFiles = config.css || ['./src/styles/main.css'];
  const safelist = config.safelist || [];

  const purger = new PurgeCSS();
  console.log('Scanning content:', content);
  console.log('Purging css files:', cssFiles);

  const results = await purger.purge({ content, css: cssFiles, safelist });
  results.forEach(r => {
    const out = path.join(path.dirname(r.file), path.basename(r.file, '.css') + '.purged.css');
    fs.writeFileSync(out, r.css, 'utf8');
    console.log('Wrote:', out, ' original:', r.file, ' size:', r.originalSize, '->', r.size);
  });
}

run().catch(err => { console.error(err); process.exit(1); });
